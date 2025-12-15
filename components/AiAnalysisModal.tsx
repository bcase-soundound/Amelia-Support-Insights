import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '../services/api';
import { AiService } from '../services/ai';
import { Ticket, AiConfig, AiAnalysisResult } from '../types';
import { 
  X, 
  Bot, 
  Play, 
  BrainCircuit,
  Key,
  Loader2,
  ShieldAlert,
  FileCode,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface AiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: Ticket[];
  onAnalysisUpdate: (result: AiAnalysisResult) => void;
}

const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({ isOpen, onClose, tickets, onAnalysisUpdate }) => {
  const [step, setStep] = useState<'config' | 'processing' | 'complete'>('config');
  
  // Default Config
  const [config, setConfig] = useState<AiConfig>({
    apiKey: '',
    model: 'gemini-2.5-flash',
    rpm: 30 // Increased default slightly for better UX
  });
  
  // Load models statically
  const availableModels = AiService.getModels();

  const [progress, setProgress] = useState(0);
  const [currentProcessingId, setCurrentProcessingId] = useState<number | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
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
      setProgress(0);
      setProcessedCount(0);
      setErrorCount(0);
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
    
    // 1. Verify Connection
    // Quick validation if key is provided, otherwise rely on env/process
    if (config.apiKey) {
        const isValid = await AiService.validateApiKey(config.apiKey);
        if (!isValid) {
            setAuthError('Connection failed. Please check your API Key.');
            return;
        }
    }

    setStep('processing');
    setProgress(0);
    setProcessedCount(0);
    setErrorCount(0);
    isRunningRef.current = true;

    const delayMs = Math.max(100, 60000 / config.rpm);
    // Limit to 50 for safety in this demo, or remove limit for prod
    const ticketsToProcess = tickets; 

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

        // Send result back to parent immediately
        onAnalysisUpdate(result);
        setProcessedCount(prev => prev + 1);

      } catch (err: any) {
        console.error(`Error processing ticket ${ticket.ticketId}`, err);
        setErrorCount(prev => prev + 1);
        
        const msg = err.message?.toLowerCase() || '';
        const status = err.status || 0;
        
        const isAuthError = msg.includes('401') || msg.includes('api key') || msg.includes('unauthorized') || status === 401;
        const isRateLimit = status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('too many requests') || msg.includes('resource exhausted');

        if (isAuthError || isRateLimit) {
             isRunningRef.current = false;
             setStep('complete');
             setAuthError(isRateLimit ? "Analysis paused: Rate limit exceeded." : "Analysis stopped: Auth failed.");
             
             // Push a failure result for this specific ticket so it's not lost
             onAnalysisUpdate({
                ticketId: ticket.ticketId,
                score: 0,
                summary: isRateLimit ? "Rate Limit Exceeded" : "Auth Failed",
                strengths: [],
                weaknesses: [],
                rcaDetected: false,
                error: isRateLimit ? "429 Quota Exceeded" : "401 Unauthorized"
             });
             break;
        }

        // Standard per-ticket failure
        onAnalysisUpdate({
            ticketId: ticket.ticketId,
            score: 0,
            summary: "Analysis failed",
            strengths: [],
            weaknesses: [],
            rcaDetected: false,
            error: err.message || "Unknown error"
        });
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

    setStep('complete');
    isRunningRef.current = false;
  };

  const handleStop = () => {
    isRunningRef.current = false;
    setStep('complete'); 
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white flex flex-col overflow-hidden border border-slate-200 shadow-2xl rounded-2xl w-full max-w-lg">
        
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
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
              <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          
          {step === 'config' && (
            <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
                    <BrainCircuit className="h-6 w-6 text-blue-600 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">Configuration</p>
                        Analyze {tickets.length} tickets. Results will be merged into your dashboard for sorting and export.
                    </div>
                </div>

                {authError && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex gap-2 items-center text-red-700 text-sm">
                     <ShieldAlert className="h-4 w-4" /> {authError}
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
                                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 py-2.5 px-3 bg-white text-slate-900"
                            />
                        </div>
                    </div>
                </div>
                
                <div className="border-t border-slate-200 pt-3">
                   <button 
                     onClick={handlePreviewPrompt}
                     className="flex items-center gap-2 text-xs text-slate-500 hover:text-purple-600 transition-colors"
                   >
                     <FileCode className="h-3 w-3" />
                     {showPromptPreview ? "Hide Preview" : "Preview Prompt"}
                   </button>
                   {showPromptPreview && (
                     <div className="mt-2 bg-slate-800 rounded-lg p-3 overflow-hidden">
                        {isLoadingPrompt ? (
                            <div className="flex items-center gap-2 text-slate-400 text-xs">
                                <Loader2 className="animate-spin h-3 w-3" /> Generating...
                            </div>
                        ) : (
                            <pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap h-32 overflow-y-auto custom-scrollbar">
                                {promptText}
                            </pre>
                        )}
                     </div>
                   )}
                </div>
            </div>
          )}

          {step === 'processing' && (
             <div className="flex flex-col items-center justify-center py-6 space-y-6">
                <div className="relative h-20 w-20">
                     <svg className="animate-spin h-full w-full text-purple-200" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-purple-600">
                        {Math.round((progress / tickets.length) * 100)}%
                     </div>
                </div>
                <div className="text-center w-full">
                    <h3 className="text-base font-medium text-slate-900">Analyzing Tickets...</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Processed {progress} of {tickets.length}
                    </p>
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
                        <div 
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                            style={{width: `${(progress / tickets.length) * 100}%`}}
                        ></div>
                    </div>
                </div>
             </div>
          )}

          {step === 'complete' && (
              <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center">
                  <div className={`p-3 rounded-full ${authError ? 'bg-red-100' : 'bg-green-100'}`}>
                      {authError ? <ShieldAlert className="h-8 w-8 text-red-600"/> : <CheckCircle2 className="h-8 w-8 text-green-600"/>}
                  </div>
                  <div>
                      <h3 className="text-xl font-bold text-slate-800">{authError ? 'Analysis Interrupted' : 'Analysis Complete'}</h3>
                      <p className="text-slate-500 mt-2">
                        Successfully processed <strong className="text-slate-800">{processedCount}</strong> tickets.
                        {errorCount > 0 && <span className="text-red-500 ml-1">({errorCount} failed)</span>}
                      </p>
                  </div>
                  {authError && (
                      <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-100 w-full">
                          {authError}
                      </div>
                  )}
                  <p className="text-sm text-slate-400 max-w-xs">
                      The results have been merged into your dashboard. You can now sort by score or filter by RCA status.
                  </p>
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
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
                    >
                        <Play className="h-4 w-4" /> Start Analysis
                    </button>
                </>
            )}
            
            {step === 'processing' && (
                <button 
                    onClick={handleStop}
                    className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg"
                >
                    Stop Processing
                </button>
            )}

            {step === 'complete' && (
                <button 
                    onClick={onClose}
                    className="flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg shadow-sm"
                >
                    View Results <ArrowRight className="h-4 w-4" />
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default AiAnalysisModal;