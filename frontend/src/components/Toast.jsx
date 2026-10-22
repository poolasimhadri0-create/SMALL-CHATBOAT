import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

export function ToastContainer() {
  const toasts = useChatStore((state) => state.toasts);
  const removeToast = useChatStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none">
      {toasts.map((toast) => {
        let Icon = Info;
        let colorClasses = 'border-accent-blue/30 text-accent-blue bg-light-surface dark:bg-dark-surface';

        if (toast.type === 'error') {
          Icon = AlertCircle;
          colorClasses = 'border-rose-500/30 text-rose-500 bg-light-surface dark:bg-dark-surface';
        } else if (toast.type === 'success') {
          Icon = CheckCircle2;
          colorClasses = 'border-emerald-500/30 text-emerald-500 bg-light-surface dark:bg-dark-surface';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl border shadow-lg text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200 ${colorClasses}`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="text-light-text dark:text-dark-text max-w-xs">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 text-light-muted dark:text-dark-muted hover:text-white rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
