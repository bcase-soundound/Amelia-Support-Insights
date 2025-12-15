import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '../services/api';
import { AiService } from '../services/ai';
import { Ticket, AiConfig, AiAnalysisResult, GeminiModel } from '../types';
import { 
  X, 
  Bot, 
  Play, 
  Settings2, 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp,
  BrainCircuit,
  Key,
  RefreshCw,
  Loader2,
  ShieldAlert
} from 'lucide-react';

interface AiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: Ticket[];
}

const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({ isOpen, onClose, tickets }) => {
  const [step, setStep] = useState<'config' | 'processing' | 'results'>('config');
  
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
  
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state when opening
      setStep('config');
      setResults([]);
      setProgress(0);
      setAuthError('');
      isRunningRef.current = false;
      // Note: We don't reset config to preserve user settings between runs
    }
  }, [isOpen]);

  const startAnalysis = async () => {
    setAuthError('');
    setIsVerifying(true);

    // 1. Verify Connection (uses provided key or env key)
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

    // Calculate delay based on RPM (Requests Per Minute)
    // Example: 10 RPM = 6000ms delay
    const delayMs = Math.max(100, 60000 / config.rpm);
    
    // We only process the first 50 tickets to be safe/sane for a demo
    const ticketsToProcess = tickets.slice(0, 50);

    for (let i = 0; i < ticketsToProcess.length; i++) {
      if (!isRunningRef.current) break;
      
      const ticket = ticketsToProcess[i];
      setCurrentProcessingId(ticket.ticketId);

      const startTime = Date.now();

      try {
        // 1. Fetch History
        const historyResponse = await ApiService.getTicketHistory(ticket.ticketId);
        
        // 2. Call Gemini
        const result = await AiService.analyzeTicket(
            ticket, 
            historyResponse.content, 
            config.model,
            config.apiKey
        );

        setResults(prev => [...prev, result]);
      } catch (err: any) {
        console.error(`Error processing ticket ${ticket.ticketId}`, err);
        
        // Check for fatal auth errors during processing
        if (err.message && (err.message.includes('401') || err.message.includes('API key'))) {
             isRunningRef.current = false;
             setStep('results');
             setResults(prev => [...prev, {
                ticketId: ticket.ticketId,
                score: 0,
                summary: "Authentication failed during batch processing.",
                strengths: [],
                weaknesses: ["Invalid or Expired API Key"],
                rcaDetected: false,
                error: "Critical Auth Error"
            }]);
            break;
        }

        // Add a failed record for this specific ticket
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

      // Throttling Logic
      // We calculate how much time the request took and wait the remainder of the delayMs interval
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
    setStep('results'); // Show what we have so far
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
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
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {step === 'config' && (
            <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
                    <BrainCircuit className="h-6 w-6 text-blue-600 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">About this analysis</p>
                        This process will read filtered tickets ({tickets.length} total) and their history. 
                        It uses the Gemini API key from your environment by default, or you can override it below.
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
                            Gemini API Key <span className="text-slate-400 font-normal">(Optional - Overrides Environment Key)</span>
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
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="120"
                                    value={config.rpm}
                                    onChange={(e) => setConfig({...config, rpm: parseInt(e.target.value) || 10})}
                                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 py-2.5 px-3 text-slate-900"
                                />
                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                    req/min
                                </span>
                            </div>
                        </div>
                    </div>
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
                            Currently reading: #{currentProcessingId}
                        </p>
                    )}
                </div>
             </div>
          )}

          {step === 'results' && (
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
                  {results.length === 0 && (
                      <div className="text-center text-slate-500 py-10">No results generated.</div>
                  )}
              </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
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
                <button 
                    onClick={() => setStep('config')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg"
                >
                    New Analysis
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default AiAnalysisModal;