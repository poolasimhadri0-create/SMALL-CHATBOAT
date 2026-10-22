import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, RotateCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { OrbAvatar } from './OrbAvatar';
import { CodeBlock } from './CodeBlock';
import { SourceChips } from './SourceChips';
import { useChatStore } from '../store/chatStore';

export function MessageBubble({ message, isStreaming = false, isLast = false }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'like' | 'dislike' | null
  const regenerateLast = useChatStore((state) => state.regenerateLast);
  const isStoreStreaming = useChatStore((state) => state.isStreaming);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-6 w-full">
        <div className="max-w-[85%] md:max-w-[70%] flex flex-col items-end">
          {/* User Attached Image preview */}
          {message.image_path && (
            <div className="mb-2 rounded-xl overflow-hidden border border-white/10 max-h-60 max-w-sm shadow-md">
              <img
                src={message.image_path.startsWith('blob:') ? message.image_path : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/${message.image_path}`}
                alt="Attached preview"
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          {/* User Bubble */}
          <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-gradient-to-r from-accent-blue/15 to-accent-violet/25 dark:from-accent-blue/20 dark:to-accent-violet/30 border border-accent-blue/30 text-light-text dark:text-dark-text shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // AI Assistant Message
  return (
    <div className="flex items-start space-x-3.5 mb-8 w-full group">
      <OrbAvatar isPulsing={isStreaming} size="sm" />

      <div className="flex-1 min-w-0 max-w-[760px]">
        {/* Markdown rendered body */}
        <div className="prose dark:prose-invert max-w-none text-[15px] leading-relaxed text-light-text dark:text-dark-text break-words">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <CodeBlock
                    language={match[1]}
                    value={String(children).replace(/\n$/, '')}
                  />
                ) : (
                  <code
                    className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[13px] text-accent-blue"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              table({ children }) {
                return (
                  <div className="overflow-x-auto my-3 border border-black/10 dark:border-white/10 rounded-lg">
                    <table className="w-full text-left text-sm">{children}</table>
                  </div>
                );
              },
              th({ children }) {
                return <th className="px-3 py-2 bg-black/5 dark:bg-white/5 font-semibold text-xs border-b border-black/10 dark:border-white/10">{children}</th>;
              },
              td({ children }) {
                return <td className="px-3 py-2 border-b border-black/5 dark:border-white/5 text-xs">{children}</td>;
              },
              a({ href, children }) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-blue hover:underline font-medium"
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>

          {isStreaming && <span className="streaming-caret" aria-hidden="true" />}
        </div>

        {/* Source chips if grounding links exist */}
        {message.sources && <SourceChips sources={message.sources} />}

        {/* Action toolbar under each reply */}
        {!isStreaming && (
          <div className="flex items-center space-x-1 mt-3 text-xs text-light-muted dark:text-dark-muted opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text transition-colors flex items-center space-x-1"
              title="Copy answer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {isLast && !isStoreStreaming && (
              <button
                onClick={regenerateLast}
                className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text transition-colors flex items-center space-x-1"
                title="Regenerate this response"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="text-[11px]">Regenerate</span>
              </button>
            )}

            <button
              onClick={() => setFeedback(feedback === 'like' ? null : 'like')}
              className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                feedback === 'like' ? 'text-accent-blue' : ''
              }`}
              title="Helpful response"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setFeedback(feedback === 'dislike' ? null : 'dislike')}
              className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                feedback === 'dislike' ? 'text-rose-400' : ''
              }`}
              title="Unhelpful response"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
