import React, { useState } from 'react';
import { ApiService } from '../services/api';
import { Lock, User, Loader2, Settings, Check } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('reporting_api@ipsoft.com');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [proxyEnabled, setProxyEnabled] = useState(true);
  const [proxyUrl, setProxyUrl] = useState('');

  const toggleSettings = () => {
    if (!showSettings) {
      // Load current settings when opening
      const config = ApiService.getProxyConfig();
      setProxyEnabled(config.enabled);
      setProxyUrl(config.url);
    }
    setShowSettings(!showSettings);
  };

  const handleSaveSettings = () => {
    ApiService.setProxyConfig(proxyEnabled, proxyUrl);
    setShowSettings(false);
    setError(''); // Clear any previous login errors
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const token = await ApiService.login(username, password);
      ApiService.setToken(token);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials or server error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden border border-slate-100 relative">
        
        {/* Settings Toggle Button */}
        <button 
          onClick={toggleSettings}
          className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all z-10"
          title="Connection Settings"
        >
          <Settings className="h-5 w-5" />
        </button>

        <div className="bg-blue-600 p-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Amelia Insights</h1>
          <p className="text-blue-100">Secure Reporting Dashboard</p>
        </div>
        
        {showSettings ? (
          <div className="p-8 space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Connection Settings</h2>
              <p className="text-sm text-slate-500">Configure API connectivity options.</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-900">External CORS Proxy</span>
                  <span className="text-xs text-slate-500">
                    {proxyEnabled ? "Enabled (Recommended for Demo)" : "Disabled (Using Local/Vite Proxy)"}
                  </span>
                </div>
                <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                  <input 
                    type="checkbox" 
                    name="toggle" 
                    id="toggle" 
                    checked={proxyEnabled}
                    onChange={(e) => setProxyEnabled(e.target.checked)}
                    className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 right-5"
                    style={{ right: proxyEnabled ? '0' : '50%' }}
                  />
                  <label 
                    htmlFor="toggle" 
                    onClick={() => setProxyEnabled(!proxyEnabled)}
                    className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${proxyEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                  ></label>
                </div>
              </div>

              <div className={`transition-all duration-300 ${proxyEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                <label className="block text-sm font-medium text-slate-700 mb-2">Proxy URL Prefix</label>
                <div className="relative">
                  <input
                    type="text"
                    value={proxyUrl}
                    onChange={(e) => setProxyUrl(e.target.value)}
                    className="block w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900 text-sm"
                    placeholder="https://corsproxy.io/?"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  The target API URL will be encoded and appended to this prefix.
                </p>
              </div>
              
              {!proxyEnabled && (
                 <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
                    <strong>Local Proxy Mode:</strong> Requests will use relative paths (e.g., <code>/api/...</code>). 
                    Ensure your local server (Vite) is configured to proxy these to <code>support.amelia.com</code>.
                 </div>
              )}
            </div>

            <button
              onClick={handleSaveSettings}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all"
            >
              <Check className="h-4 w-4 mr-2" />
              Save Settings
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900 sm:text-sm transition-colors"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900 sm:text-sm transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginForm;