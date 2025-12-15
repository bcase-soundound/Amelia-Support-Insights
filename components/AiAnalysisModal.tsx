import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '../services/api';
import { AiService } from '../services/ai';
import { Ticket, AiConfig, AiAnalysisResult } from '../types';
import { 
  X, 
  Bot, 
  Play, 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp,
  BrainCircuit,
  Key,
  Loader2,
  ShieldAlert,
  Maximize2,
  Minimize2,
  Download,
  FileCode,
  BarChart3,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

interface AiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: Ticket[];
}

const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({ isOpen, onClose, tickets }) => {
  const [step, setStep] = useState<'config' | 'processing' | 'results'>('config');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Default Config
  const [config, setConfig] = useState<AiConfig>({
    apiKey: '',
    model: 'gemini-2.5-flash',
    rpm: 10
  });
  
  // Load models statically
  const availableModels = AiService.getModels();

  const [progress, setProgress] = useState(0);
  const [currentProcessingId, setCurrentProcessingId] = useState<number | null>(null);
  const [results, setResults] = useState<AiAnalysisResult[]>([]);
  const [expandedResultId, setExpandedResultId] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [authError, setAuthError] = useState('');
  
  // Prompt Preview State
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state when opening
      setStep('config');
      setResults([]);
      setProgress(0);
      setAuthError('');
      setShowPromptPreview(false);
      isRunningRef.current = false;
    }
  }, [isOpen]);

  const handlePreviewPrompt = async () => {
    if (tickets.length === 0) return;
    
    setShowPromptPreview(true);
    if (promptText) return; // Already loaded

    setIsLoadingPrompt(true);
    try {
        // Fetch history for the first ticket as a sample
        const sampleTicket = tickets[0];
        const historyResponse = await ApiService.getTicketHistory(sampleTicket.ticketId);
        const generatedPrompt = AiService.constructPrompt(sampleTicket, historyResponse.content);
        setPromptText(generatedPrompt);
    } catch (e) {
        setPromptText("Error generating preview: Could not fetch sample ticket history.");
    } finally {
        setIsLoadingPrompt(false);
    }
  };

  const startAnalysis = async () => {
    setAuthError('');
    setIsVerifying(true);

    // 1. Verify Connection
    const isValid = await AiService.validateApiKey(config.apiKey);
    
    if (!isValid) {
      setAuthError('Connection failed. Please check your API Key or environment configuration.');
      setIsVerifying(false);
      return;
    }

    setIsVerifying(false);
    setStep('processing');
    setResults([]);
    setProgress(0);
    isRunningRef.current = true;

    const delayMs = Math.max(100, 60000 / config.rpm);
    const ticketsToProcess = tickets.slice(0, 50);

    for (let i = 0; i < ticketsToProcess.length; i++) {
      if (!isRunningRef.current) break;
      
      const ticket = ticketsToProcess[i];
      setCurrentProcessingId(ticket.ticketId);

      const startTime = Date.now();

      try {
        const historyResponse = await ApiService.getTicketHistory(ticket.ticketId);
        const result = await AiService.analyzeTicket(
            ticket, 
            historyResponse.content, 
            config.model,
            config.apiKey
        );

        setResults(prev => [...prev, result]);
      } catch (err: any) {
        console.error(`Error processing ticket ${ticket.ticketId}`, err);
        
        const msg = err.message?.toLowerCase() || '';
        const status = err.status || 0;
        
        // Check for Auth Errors
        const isAuthError = msg.includes('401') || msg.includes('api key') || msg.includes('unauthorized') || status === 401;
        
        // Check for Rate Limit / Quota Errors
        const isRateLimit = status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('too many requests') || msg.includes('resource exhausted');

        if (isAuthError || isRateLimit) {
             isRunningRef.current = false;
             setStep('results');
             
             const errorTitle = isRateLimit ? "Rate Limit Exceeded (429)" : "Critical Auth Error";
             const errorDesc = isRateLimit ? "API Quota Exceeded" : "Invalid API Key";
             const userAlertMsg = isRateLimit 
                ? "Analysis stopped: API Quota/Rate limit exceeded. Please try again later or increase the RPM delay." 
                : "Analysis stopped: Authentication failed.";

             setAuthError(userAlertMsg);

             setResults(prev => [...prev, {
                ticketId: ticket.ticketId,
                score: 0,
                summary: `Processing halted: ${errorDesc}`,
                strengths: [],
                weaknesses: [errorDesc],
                rcaDetected: false,
                error: errorTitle
            }]);
            break;
        }

        // Standard per-ticket failure (continue processing)
        setResults(prev => [...prev, {
            ticketId: ticket.ticketId,
            score: 0,
            summary: "Analysis failed.",
            strengths: [],
            weaknesses: ["Error processing ticket"],
            rcaDetected: false,
            error: err.message || "Unknown error"
        }]);
      }

      setProgress(i + 1);

      if (i < ticketsToProcess.length - 1 && isRunningRef.current) {
        const elapsedTime = Date.now() - startTime;
        const timeToWait = Math.max(0, delayMs - elapsedTime);
        if (timeToWait > 0) {
            await new Promise(resolve => setTimeout(resolve, timeToWait));
        }
      }
    }

    setStep('results');
    isRunningRef.current = false;
  };

  const handleStop = () => {
    isRunningRef.current = false;
    setStep('results'); 
  };

  const handleDownload = () => {
    // Define headers
    const headers = ["Ticket ID", "Score", "Summary", "RCA Detected", "Strengths", "Weaknesses", "Error"];

    // Helper to escape special characters for CSV
    const escapeCsv = (field: any) => {
      if (field === null || field === undefined) return '';
      const stringField = String(field);
      // If the field contains quotes, commas, or newlines, wrap it in quotes and escape existing quotes
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    // Construct CSV content
    const csvRows = results.map(res => [
      res.ticketId,
      res.score,
      res.summary,
      res.rcaDetected ? "Yes" : "No",
      res.strengths.join('; '), // Join arrays with semicolon to separate items clearly in CSV
      res.weaknesses.join('; '),
      res.error || ''
    ].map(escapeCsv).join(','));

    const csvContent = [headers.join(','), ...csvRows].join('\n');

    // Create a Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `amelia_analysis_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleExpand = (id: number) => {
    setExpandedResultId(expandedResultId === id ? null : id);
  };

  const getScoreColor = (score: number, error?: string) => {
    if (error) return 'text-red-600 bg-red-50 border-red-200';
    if (score >= 8) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  // Helper to calculate stats
  const getStats = () => {
      const total = results.length;
      if (total === 0) return { avgScore: 0, rcaPercent: 0, commonWeakness: 'N/A' };
      
      const validResults = results.filter(r => !r.error);
      const avgScore = validResults.reduce((acc, curr) => acc + curr.score, 0) / (validResults.length || 1);
      const rcaCount = validResults.filter(r => r.rcaDetected).length;
      
      // Calculate common weaknesses
      const weaknessMap: Record<string, number> = {};
      validResults.forEach(r => {
          r.weaknesses.forEach(w => {
              // Simple normalization
              const key = w.toLowerCase().trim();
              weaknessMap[key] = (weaknessMap[key] || 0) + 1;
          });
      });
      
      const sortedWeaknesses = Object.entries(weaknessMap).sort((a,b) => b[1] - a[1]);
      const commonWeakness = sortedWeaknesses.length > 0 ? sortedWeaknesses[0][0] : 'None';

      return {
          avgScore: avgScore.toFixed(1),
          rcaPercent: Math.round((rcaCount / (validResults.length || 1)) * 100),
          commonWeakness
      };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm transition-all duration-300">
      <div className={`bg-white flex flex-col overflow-hidden border border-slate-200 shadow-2xl transition-all duration-300 ${isFullscreen ? 'fixed inset-0 w-full h-full rounded-none' : 'w-full max-w-2xl h-[80vh] rounded-2xl'}`}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="bg-purple-100 p-2 rounded-lg">
               <Bot className="h-5 w-5 text-purple-600" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800">AI Quality Audit</h2>
                <p className="text-xs text-slate-500">Powered by Gemini 2.5</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
                onClick={() => setIsFullscreen(!isFullscreen)} 
                className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors hidden sm:block"
                title={isFullscreen ? "Minimize" : "Maximize"}
            >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          
          {step === 'config' && (
            <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
                    <BrainCircuit className="h-6 w-6 text-blue-600 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">About this analysis</p>
                        This process will read filtered tickets ({tickets.length} total) and their history. 
                        It uses the Gemini API key from your environment by default.
                    </div>
                </div>

                {authError && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex gap-3 items-center text-red-700 animate-pulse">
                     <ShieldAlert className="h-5 w-5" />
                     <span className="text-sm font-medium">{authError}</span>
                  </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Gemini API Key <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <div className="relative">
                           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                             <Key className="h-4 w-4 text-slate-400" />
                           </div>
                           <input 
                               type="password"
                               value={config.apiKey || ''}
                               onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                               placeholder="Use Default Environment Key"
                               className="w-full rounded-lg border-slate-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 py-2.5 pl-10 pr-3 bg-white text-slate-900 placeholder:text-slate-400"
                           />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Select Model</label>
                            <select 
                                value={config.model}
                                onChange={(e) => setConfig({...config, model: e.target.value})}
                                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 py-2.5 px-3 bg-white text-slate-900"
                            >
                                {availableModels.map(m => (
                                <option key={m.id} value={m.id}>{m.displayName}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Throughput (RPM)</label>
                            <input 
                                type="number" 
                                min="1" 
                                max="120"
                                value={config.rpm}
                                onChange={(e) => setConfig({...config, rpm: parseInt(e.target.value) || 10})}
                                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 py-2.5 px-3 text-slate-900"
                            />
                        </div>
                    </div>
                </div>

                {/* Prompt Preview Section */}
                <div className="border-t border-slate-200 pt-4">
                   <button 
                     onClick={handlePreviewPrompt}
                     className="flex items-center gap-2 text-sm text-slate-600 hover:text-purple-600 transition-colors"
                   >
                     <FileCode className="h-4 w-4" />
                     {showPromptPreview ? "Hide Prompt Preview" : "Preview Prompt Template"}
                   </button>
                   
                   {showPromptPreview && (
                     <div className="mt-3 bg-slate-800 rounded-lg p-4 overflow-hidden relative group">
                        {isLoadingPrompt ? (
                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <Loader2 className="animate-spin h-4 w-4" /> Generating preview from first ticket...
                            </div>
                        ) : (
                            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto h-64 custom-scrollbar">
                                {promptText}
                            </pre>
                        )}
                        <div className="absolute top-2 right-2 px-2 py-1 bg-slate-700 rounded text-[10px] text-slate-300">
                             Sample: Ticket #{tickets[0]?.ticketId}
                        </div>
                     </div>
                   )}
                </div>
            </div>
          )}

          {step === 'processing' && (
             <div className="flex flex-col items-center justify-center h-full py-10 space-y-6">
                <div className="relative h-24 w-24">
                     <svg className="animate-spin h-full w-full text-purple-200" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-purple-600">
                        {Math.round((progress / tickets.length) * 100)}%
                     </div>
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-medium text-slate-900">Analyzing Tickets...</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Processed {progress} of {tickets.length} tickets
                    </p>
                    {currentProcessingId && (
                        <p className="text-xs text-slate-400 mt-2 font-mono">
                            Reading history for: #{currentProcessingId}
                        </p>
                    )}
                </div>
             </div>
          )}

          {step === 'results' && (
              <div className="space-y-6">
                  {/* Error Banner for Results View */}
                  {authError && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex gap-3 items-center text-red-700 animate-pulse mb-4">
                       <ShieldAlert className="h-5 w-5" />
                       <span className="text-sm font-medium">{authError}</span>
                    </div>
                  )}

                  {/* Performance Dashboard Widgets */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {(() => {
                          const stats = getStats();
                          return (
                              <>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BarChart3 className="h-4 w-4 text-slate-400"/>
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Quality</span>
                                    </div>
                                    <span className={`text-3xl font-bold ${Number(stats.avgScore) >= 8 ? 'text-green-600' : Number(stats.avgScore) >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {stats.avgScore}
                                    </span>
                                    <span className="text-[10px] text-slate-400 mt-1">Target: 8.0+</span>
                                </div>
                                
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp className="h-4 w-4 text-slate-400"/>
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">RCA Rate</span>
                                    </div>
                                    <span className={`text-3xl font-bold ${stats.rcaPercent >= 90 ? 'text-green-600' : 'text-blue-600'}`}>
                                        {stats.rcaPercent}%
                                    </span>
                                    <span className="text-[10px] text-slate-400 mt-1">Tickets with Root Cause</span>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="h-4 w-4 text-slate-400"/>
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Top Issue</span>
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700 line-clamp-2 px-2">
                                        {stats.commonWeakness}
                                    </span>
                                    <span className="text-[10px] text-slate-400 mt-1">Most Frequent Weakness</span>
                                </div>
                              </>
                          );
                      })()}
                  </div>

                  {/* List of Results */}
                  <div className="space-y-4">
                    {results.map((res) => (
                        <div key={res.ticketId} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                            <div 
                                className="flex items-center justify-between p-4 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
                                onClick={() => toggleExpand(res.ticketId)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg border ${getScoreColor(res.score, res.error)}`}>
                                        {res.error ? <AlertCircle className="h-6 w-6"/> : <span className="text-lg font-bold">{res.score}</span>}
                                        <span className="text-[9px] uppercase font-medium">{res.error ? 'Error' : 'Score'}</span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-slate-500">#{res.ticketId}</span>
                                            {res.rcaDetected && (
                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium border border-blue-200">RCA DETECTED</span>
                                            )}
                                        </div>
                                        <p className={`text-sm font-medium line-clamp-1 ${res.error ? 'text-red-600' : 'text-slate-800'}`}>
                                            {res.error ? `Failed: ${res.error}` : res.summary}
                                        </p>
                                    </div>
                                </div>
                                {expandedResultId === res.ticketId ? <ChevronUp className="h-5 w-5 text-slate-400"/> : <ChevronDown className="h-5 w-5 text-slate-400"/>}
                            </div>
                            
                            {expandedResultId === res.ticketId && (
                                <div className="p-4 border-t border-slate-200 bg-white grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {res.error ? (
                                        <div className="col-span-2 text-xs text-red-600 bg-red-50 p-3 rounded border border-red-100">
                                            <strong>Analysis Error:</strong> {res.error}
                                        </div>
                                    ) : (
                                        <>
                                        <div>
                                            <h4 className="text-xs font-bold text-green-700 uppercase mb-2 flex items-center gap-1">
                                                <CheckCircle2 className="h-3 w-3"/> Strengths
                                            </h4>
                                            <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                                                {res.strengths.length > 0 ? res.strengths.map((s, i) => <li key={i}>{s}</li>) : <li>No specific strengths detected.</li>}
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-red-700 uppercase mb-2 flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3"/> Weaknesses
                                        </h4>
                                            <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                                                {res.weaknesses.length > 0 ? res.weaknesses.map((w, i) => <li key={i}>{w}</li>) : <li>No specific weaknesses detected.</li>}
                                            </ul>
                                        </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                  </div>
                  
                  {results.length === 0 && (
                      <div className="text-center text-slate-500 py-10">No results generated.</div>
                  )}
              </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
            <div className="text-xs text-slate-400">
                {step === 'results' && `Analyzed ${results.length} tickets`}
            </div>
            
            <div className="flex gap-3">
                {step === 'config' && (
                    <>
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">
                            Cancel
                        </button>
                        <button 
                            onClick={startAnalysis} 
                            disabled={tickets.length === 0 || isVerifying}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isVerifying ? <Loader2 className="animate-spin h-4 w-4" /> : <Play className="h-4 w-4" />}
                            {isVerifying ? "Verifying..." : "Start Analysis"}
                        </button>
                    </>
                )}
                
                {step === 'processing' && (
                    <button 
                        onClick={handleStop}
                        className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg"
                    >
                        Stop
                    </button>
                )}

                {step === 'results' && (
                    <>
                        <button 
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg"
                        >
                            <Download className="h-4 w-4" /> Export Report
                        </button>
                        <button 
                            onClick={() => setStep('config')}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg"
                        >
                            New Analysis
                        </button>
                    </>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AiAnalysisModal;