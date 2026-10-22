import React, { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ChatWindow } from './components/ChatWindow';
import { ChatInput } from './components/ChatInput';
import { ToastContainer } from './components/Toast';
import { useChatStore } from './store/chatStore';

export default function App() {
  const startNewChat = useChatStore((state) => state.startNewChat);
  const stopStreaming = useChatStore((state) => state.stopStreaming);
  const setOffline = useChatStore((state) => state.setOffline);

  // Global Keyboard Shortcuts (Ctrl/Cmd+K: New Chat, Esc: Stop Streaming)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        startNewChat();
      } else if (e.key === 'Escape') {
        stopStreaming();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [startNewChat, stopStreaming]);

  // Online / Offline tracking
  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOffline]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text font-sans antialiased">
      {/* Toast notifications */}
      <ToastContainer />

      {/* Collapsible Sidebar */}
      <Sidebar />

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        <TopBar />
        <ChatWindow />
        <ChatInput />
      </div>
    </div>
  );
}
