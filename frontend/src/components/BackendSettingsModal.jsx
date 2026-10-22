import React, { useState } from 'react';
import { Server, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { getApiBaseUrl } from '../services/api';
import { useChatStore } from '../store/chatStore';

export function BackendSettingsModal({ isOpen, onClose }) {
  const [url, setUrl] = useState(() => getApiBaseUrl() || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const loadConversations = useChatStore((state) => state.loadConversations);
  const addToast = useChatStore((state) => state.addToast);

  if (!isOpen) return null;

  const handleTestAndSave = async (e) => {
    e?.preventDefault();
    const cleanUrl = url.trim().replace(/\/$/, '');
    setTesting(true);
    setTestResult(null);

    try {
      const targetHealthUrl = cleanUrl ? `${cleanUrl}/api/health` : '/api/health';
      const res = await fetch(targetHealthUrl, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        if (cleanUrl) {
          localStorage.setItem('chatbot_backend_url', cleanUrl);
        } else {
          localStorage.removeItem('chatbot_backend_url');
        }
        setTestResult({
          success: true,
          message: `Connected successfully! (Model: ${data.gemini_model || 'Gemini'}, DB: ${data.database || 'OK'})`,
        });
        addToast('Backend connected successfully!', 'success');
        loadConversations();
        setTimeout(() => onClose(), 1200);
      } else {
        setTestResult({
          success: false,
          message: `Server returned HTTP ${res.status}: ${res.statusText}`,
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: `Connection failed: ${err.message}. Ensure the backend is deployed and CORS permits this origin.`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleResetToDefault = () => {
    localStorage.removeItem('chatbot_backend_url');
    setUrl('');
    addToast('Reset to default backend URL', 'info');
    loadConversations();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 rounded-xl bg-accent-blue/10 text-accent-blue">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-semibold text-lg text-light-text dark:text-dark-text">
              Backend Connection
            </h2>
            <p className="text-xs text-light-muted dark:text-dark-muted">
              Connect your frontend to your deployed Render API service
            </p>
          </div>
        </div>

        <form onSubmit={handleTestAndSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-light-muted dark:text-dark-muted mb-1.5">
              Backend API Base URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. https://small-chatboat-backend.onrender.com"
              className="w-full px-3.5 py-2 text-sm rounded-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:border-accent-blue transition-colors"
            />
            <p className="text-[11px] text-light-muted dark:text-dark-muted mt-1.5">
              Leave empty if running locally on <code className="text-accent-blue font-mono">http://localhost:5000</code>.
            </p>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start space-x-2.5 ${
                testResult.success
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-xs text-light-muted dark:text-dark-muted hover:underline"
            >
              Reset to default
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium rounded-xl border border-light-border dark:border-dark-border text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={testing}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-accent-blue text-white hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-sm"
              >
                {testing ? 'Testing Connection...' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
