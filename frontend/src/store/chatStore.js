import { create } from 'zustand';
import {
  fetchConversations,
  fetchConversation,
  renameConversation as apiRename,
  deleteConversation as apiDelete,
} from '../services/api';
import { streamChat, streamRegenerate } from '../services/sse';

export const useChatStore = create((set, get) => ({
  // State
  conversations: [],
  activeConversationId: null,
  messages: [],
  activeTitle: 'New Chat',
  isStreaming: false,
  isThinking: false,
  streamingMessageId: null,
  streamingContent: '',
  streamingSources: [],
  abortController: null,
  searchQuery: '',
  sidebarOpen: true,
  theme: localStorage.getItem('theme') || 'dark',
  toasts: [],
  isOffline: !navigator.onLine,

  // Toast notifications
  addToast: (message, type = 'info') => {
    const id = Date.now() + Math.random();
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  setTheme: (newTheme) => {
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    set({ theme: newTheme });
  },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().loadConversations(query);
  },

  setOffline: (status) => set({ isOffline: status }),

  // Load all conversations
  loadConversations: async (search = '') => {
    try {
      const data = await fetchConversations(search);
      set({ conversations: data });
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  },

  // Select an existing conversation
  selectConversation: async (id) => {
    if (get().isStreaming) {
      get().stopStreaming();
    }
    set({ activeConversationId: id, messages: [], streamingContent: '', streamingSources: [] });
    try {
      const data = await fetchConversation(id);
      set({
        messages: data.messages || [],
        activeTitle: data.title || 'Conversation',
      });
    } catch (err) {
      get().addToast(`Error loading chat: ${err.message}`, 'error');
    }
  },

  // Start fresh chat
  startNewChat: () => {
    if (get().isStreaming) {
      get().stopStreaming();
    }
    set({
      activeConversationId: null,
      messages: [],
      activeTitle: 'New Chat',
      streamingContent: '',
      streamingSources: [],
    });
  },

  // Rename conversation
  renameChat: async (id, newTitle) => {
    try {
      const updated = await apiRename(id, newTitle);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, title: updated.title } : c
        ),
        activeTitle: state.activeConversationId === id ? updated.title : state.activeTitle,
      }));
      get().addToast('Chat renamed', 'success');
    } catch (err) {
      get().addToast(`Failed to rename: ${err.message}`, 'error');
    }
  },

  // Delete conversation
  deleteChat: async (id) => {
    try {
      await apiDelete(id);
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
      }));
      if (get().activeConversationId === id) {
        get().startNewChat();
      }
      get().addToast('Conversation deleted', 'info');
    } catch (err) {
      get().addToast(`Delete failed: ${err.message}`, 'error');
    }
  },

  // Send message & stream answer
  sendMessage: async (text, imageFile = null) => {
    if (get().isStreaming) return;
    const trimmed = text.trim();
    if (!trimmed && !imageFile) return;

    // Create optimistic user message
    const tempUserMsg = {
      id: Date.now(),
      role: 'user',
      content: trimmed,
      image_path: imageFile ? URL.createObjectURL(imageFile) : null,
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, tempUserMsg],
      isStreaming: true,
      isThinking: true,
      streamingContent: '',
      streamingSources: [],
    }));

    const controller = new AbortController();
    set({ abortController: controller });

    await streamChat({
      message: trimmed,
      conversationId: get().activeConversationId,
      imageFile,
      signal: controller.signal,
      onToken: (token) => {
        set((state) => ({
          isThinking: false,
          streamingContent: state.streamingContent + token,
        }));
      },
      onSources: (sources) => {
        set({ streamingSources: sources });
      },
      onDone: (payload) => {
        const fullContent = get().streamingContent;
        const sources = get().streamingSources;
        const convId = payload?.conversation_id || get().activeConversationId;

        if (fullContent) {
          const aiMsg = {
            id: payload?.message_id || Date.now() + 1,
            role: 'model',
            content: fullContent,
            sources: sources.length ? sources : null,
            created_at: new Date().toISOString(),
          };
          set((state) => ({
            messages: [...state.messages, aiMsg],
          }));
        }

        set({
          isStreaming: false,
          isThinking: false,
          streamingContent: '',
          streamingSources: [],
          abortController: null,
          activeConversationId: convId,
        });

        // Refresh sidebar conversation list
        get().loadConversations();
      },
      onError: (err) => {
        set({ isStreaming: false, isThinking: false, abortController: null });
        get().addToast(`AI generation failed: ${err.message}`, 'error');
      },
    });
  },

  // Regenerate last AI response
  regenerateLast: async () => {
    const { activeConversationId, messages, isStreaming } = get();
    if (isStreaming || !activeConversationId) return;

    // Remove last model message from UI if present
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'model') {
      set({ messages: messages.slice(0, -1) });
    }

    set({
      isStreaming: true,
      isThinking: true,
      streamingContent: '',
      streamingSources: [],
    });

    const controller = new AbortController();
    set({ abortController: controller });

    await streamRegenerate({
      conversationId: activeConversationId,
      signal: controller.signal,
      onToken: (token) => {
        set((state) => ({
          isThinking: false,
          streamingContent: state.streamingContent + token,
        }));
      },
      onSources: (sources) => {
        set({ streamingSources: sources });
      },
      onDone: (payload) => {
        const fullContent = get().streamingContent;
        const sources = get().streamingSources;

        if (fullContent) {
          const aiMsg = {
            id: payload?.message_id || Date.now() + 2,
            role: 'model',
            content: fullContent,
            sources: sources.length ? sources : null,
            created_at: new Date().toISOString(),
          };
          set((state) => ({
            messages: [...state.messages, aiMsg],
          }));
        }

        set({
          isStreaming: false,
          isThinking: false,
          streamingContent: '',
          streamingSources: [],
          abortController: null,
        });
      },
      onError: (err) => {
        set({ isStreaming: false, isThinking: false, abortController: null });
        get().addToast(`Regeneration failed: ${err.message}`, 'error');
      },
    });
  },

  // Stop current streaming
  stopStreaming: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({ isStreaming: false, isThinking: false, abortController: null });
  },
}));
