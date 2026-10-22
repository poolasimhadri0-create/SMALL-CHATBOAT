import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Edit2,
  Trash2,
  Check,
  X,
  Sparkles,
  PanelLeftClose,
  Sun,
  Moon,
} from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { useTheme } from '../hooks/useTheme';

function groupConversations(conversations) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const groups = {
    Today: [],
    Yesterday: [],
    'Previous 7 Days': [],
    Older: [],
  };

  conversations.forEach((conv) => {
    const convDate = new Date(conv.updated_at || conv.created_at);
    if (convDate >= today) {
      groups.Today.push(conv);
    } else if (convDate >= yesterday) {
      groups.Yesterday.push(conv);
    } else if (convDate >= sevenDaysAgo) {
      groups['Previous 7 Days'].push(conv);
    } else {
      groups.Older.push(conv);
    }
  });

  return groups;
}

export function Sidebar() {
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const selectConversation = useChatStore((state) => state.selectConversation);
  const startNewChat = useChatStore((state) => state.startNewChat);
  const renameChat = useChatStore((state) => state.renameChat);
  const deleteChat = useChatStore((state) => state.deleteChat);
  const loadConversations = useChatStore((state) => state.loadConversations);
  const sidebarOpen = useChatStore((state) => state.sidebarOpen);
  const setSidebarOpen = useChatStore((state) => state.setSidebarOpen);
  const searchQuery = useChatStore((state) => state.searchQuery);
  const setSearchQuery = useChatStore((state) => state.setSearchQuery);

  const { theme, toggleTheme } = useTheme();

  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Group conversations by date
  const groupedChats = React.useMemo(() => groupConversations(conversations), [conversations]);

  const handleStartRename = (conv, e) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveRename = (id, e) => {
    e.stopPropagation();
    if (editingTitle.trim()) {
      renameChat(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    deleteChat(id);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-[270px] bg-light-surface dark:bg-dark-surface border-r border-light-border dark:border-dark-border flex flex-col transition-transform duration-200 ease-out select-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:-translate-x-full'
        }`}
      >
        {/* Top Header: Logo + Close */}
        <div className="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-accent-blue to-accent-violet flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-heading font-semibold text-sm tracking-tight text-light-text dark:text-dark-text block">
                Gemini AI
              </span>
              <span className="text-[10px] text-light-muted dark:text-dark-muted uppercase tracking-wider block">
                v3.6 Flash
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-light-muted dark:text-dark-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors md:hidden"
            title="Close sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg hover:border-accent-blue/40 text-light-text dark:text-dark-text font-medium text-xs shadow-sm hover:shadow transition-all group"
          >
            <div className="flex items-center space-x-2">
              <Plus className="w-4 h-4 text-accent-blue group-hover:rotate-90 transition-transform" />
              <span>New chat</span>
            </div>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-light-muted dark:text-dark-muted font-mono">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Search Input */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-light-muted dark:text-dark-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-light-bg dark:bg-dark-bg/60 border border-light-border dark:border-dark-border text-light-text dark:text-dark-text placeholder:text-light-muted dark:placeholder:text-dark-muted/60 outline-none focus:border-accent-blue/50"
            />
          </div>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-4 py-2">
          {Object.entries(groupedChats).map(([groupTitle, list]) => {
            if (list.length === 0) return null;

            return (
              <div key={groupTitle}>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-light-muted dark:text-dark-muted/70 px-3 mb-1.5">
                  {groupTitle}
                </h4>
                <div className="space-y-0.5">
                  {list.map((conv) => {
                    const isActive = conv.id === activeConversationId;
                    const isEditing = conv.id === editingId;

                    return (
                      <div
                        key={conv.id}
                        onClick={() => selectConversation(conv.id)}
                        className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-accent-blue/15 text-accent-blue font-medium'
                            : 'text-light-text dark:text-dark-text hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-accent-blue' : 'text-light-muted dark:text-dark-muted'}`} />
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(conv.id, e);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              className="bg-transparent border-b border-accent-blue outline-none text-xs text-light-text dark:text-dark-text w-full py-0.5"
                            />
                          ) : (
                            <span className="truncate block" title={conv.title}>
                              {conv.title}
                            </span>
                          )}
                        </div>

                        {/* Hover Actions */}
                        <div className="flex items-center space-x-1 pl-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={(e) => handleSaveRename(conv.id, e)}
                                className="p-1 hover:text-emerald-400"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(null);
                                }}
                                className="p-1 hover:text-rose-400"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 transition-opacity">
                              <button
                                onClick={(e) => handleStartRename(conv, e)}
                                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text"
                                title="Rename"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(conv.id, e)}
                                className="p-1 rounded hover:bg-rose-500/10 text-light-muted dark:text-dark-muted hover:text-rose-400"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {conversations.length === 0 && (
            <div className="text-center py-8 text-xs text-light-muted dark:text-dark-muted px-4">
              No conversations yet. Start a new chat to begin!
            </div>
          )}
        </div>

        {/* Footer: Theme Toggle */}
        <div className="p-3 border-t border-light-border dark:border-dark-border flex items-center justify-between">
          <span className="text-xs text-light-muted dark:text-dark-muted font-medium">Theme</span>
          <button
            onClick={toggleTheme}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text text-xs hover:border-accent-blue/30 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? (
              <>
                <Moon className="w-3.5 h-3.5 text-accent-violet" />
                <span>Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
