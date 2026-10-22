import React, { useState } from 'react';
import { ArrowDown, WifiOff, Server } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { getApiBaseUrl } from '../services/api';
import { MessageBubble } from './MessageBubble';
import { AIOrb3D } from './AIOrb3D';
import { SuggestionCards } from './SuggestionCards';
import { ThinkingDots } from './ThinkingDots';
import { OrbAvatar } from './OrbAvatar';
import { BackendSettingsModal } from './BackendSettingsModal';

export function ChatWindow() {
  const messages = useChatStore((state) => state.messages);
  const isThinking = useChatStore((state) => state.isThinking);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const streamingContent = useChatStore((state) => state.streamingContent);
  const streamingSources = useChatStore((state) => state.streamingSources);
  const isOffline = useChatStore((state) => state.isOffline);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const scrollTrigger = `${messages.length}-${streamingContent.length}-${isThinking}`;
  const { containerRef, showScrollBottom, scrollToBottom, handleScroll } = useAutoScroll(scrollTrigger);

  const isEmpty = messages.length === 0 && !isStreaming;
  const hasBackend = Boolean(getApiBaseUrl());

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col">
      {/* Backend Setup Banner (only shown if no backend is set) */}
      {!hasBackend && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 text-accent-blue px-4 py-2 text-xs flex items-center justify-between select-none">
          <div className="flex items-center space-x-2">
            <Server className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Connect your Render Backend URL to enable AI responses & database history.</span>
          </div>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="underline font-medium hover:text-white transition-colors ml-2 flex-shrink-0"
          >
            Configure URL
          </button>
        </div>
      )}

      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-500 px-4 py-1.5 text-xs flex items-center justify-center space-x-2 select-none">
          <WifiOff className="w-3.5 h-3.5" />
          <span>You are currently offline. Check your internet connection.</span>
        </div>
      )}

      {/* Main Scrollable Messages Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-8 py-6 flex flex-col"
      >
        {isEmpty ? (
          /* Empty State: 3D Hero Orb + Greeting + 4 Suggestion Cards */
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-8">
            <AIOrb3D />
            <h1 className="font-heading font-semibold text-2xl md:text-3xl text-light-text dark:text-dark-text mt-3 tracking-tight">
              Hello, how can I help you today?
            </h1>
            <p className="text-sm text-light-muted dark:text-dark-muted max-w-md mt-2">
              Powered by Google Gemini with real-time web search grounding and subtle 3D depth.
            </p>
            <SuggestionCards />
          </div>
        ) : (
          /* Active Chat Message Stream */
          <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col">
            {messages.map((msg, index) => (
              <MessageBubble
                key={msg.id || index}
                message={msg}
                isLast={index === messages.length - 1}
              />
            ))}

            {/* Thinking 3-Dots indicator before first token */}
            {isThinking && (
              <div className="flex items-start space-x-3.5 mb-8">
                <OrbAvatar isPulsing={true} size="sm" />
                <ThinkingDots />
              </div>
            )}

            {/* Active Streaming Message Token by Token */}
            {isStreaming && streamingContent && (
              <MessageBubble
                message={{
                  role: 'model',
                  content: streamingContent,
                  sources: streamingSources,
                }}
                isStreaming={true}
                isLast={true}
              />
            )}
          </div>
        )}
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-4 right-6 p-2 rounded-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text dark:text-dark-text shadow-lg hover:border-accent-blue/50 transition-all z-20 group"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
        </button>
      )}

      {/* Backend Settings Modal */}
      <BackendSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
}
