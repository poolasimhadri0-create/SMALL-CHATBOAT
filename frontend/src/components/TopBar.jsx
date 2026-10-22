import React, { useState } from 'react';
import { PanelLeft, Edit3, Check, X } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

export function TopBar() {
  const sidebarOpen = useChatStore((state) => state.sidebarOpen);
  const toggleSidebar = useChatStore((state) => state.toggleSidebar);
  const activeTitle = useChatStore((state) => state.activeTitle);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const renameChat = useChatStore((state) => state.renameChat);

  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleStartEdit = () => {
    if (!activeConversationId) return;
    setNewTitle(activeTitle);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (newTitle.trim() && activeConversationId) {
      renameChat(activeConversationId, newTitle.trim());
    }
    setIsEditing(false);
  };

  return (
    <header className="h-14 border-b border-light-border dark:border-dark-border px-4 flex items-center justify-between bg-light-surface/70 dark:bg-dark-surface/70 backdrop-blur-md z-20 flex-shrink-0 select-none">
      <div className="flex items-center space-x-3 min-w-0">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {isEditing ? (
          <div className="flex items-center space-x-1.5">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              autoFocus
              className="bg-light-bg dark:bg-dark-bg border border-accent-blue rounded px-2 py-0.5 text-xs text-light-text dark:text-dark-text outline-none font-medium"
            />
            <button onClick={handleSave} className="p-1 hover:text-emerald-400">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setIsEditing(false)} className="p-1 hover:text-rose-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            onClick={handleStartEdit}
            className={`flex items-center space-x-2 text-xs font-heading font-medium text-light-text dark:text-dark-text truncate cursor-pointer rounded-lg px-2 py-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group ${
              activeConversationId ? 'cursor-pointer' : 'cursor-default'
            }`}
            title={activeConversationId ? 'Click to rename' : ''}
          >
            <span className="truncate max-w-xs md:max-w-md">{activeTitle}</span>
            {activeConversationId && (
              <Edit3 className="w-3 h-3 text-light-muted dark:text-dark-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        )}
      </div>
    </header>
  );
}
