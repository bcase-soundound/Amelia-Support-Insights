
import React, { useState } from 'react';
import { X, Key, Save, ShieldCheck } from 'lucide-react';
import { AiService } from '../services/ai';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState(AiService.getApiKey());
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    AiService.setApiKey(apiKey);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white flex flex-col overflow-hidden border border-slate-200 shadow-2xl rounded-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="bg-slate-200 p-2 rounded-lg">
               <Key className="h-5 w-5 text-slate-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Settings</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
              <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Gemini API Key</label>
            <div className="relative">
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API Key"
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3 bg-white text-slate-900 pr-10"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Key className="h-4 w-4 text-slate-400" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              This key is required for AI features when running on static hosting like GitHub Pages. 
              It is stored <strong>only</strong> in your browser's local storage.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Get a free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="text-xs text-blue-800">
              Your API key is never sent to our servers. It is used directly to communicate with Google's Gemini API from your browser.
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaved}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium shadow-sm transition-all ${isSaved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {isSaved ? <ShieldCheck className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {isSaved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
