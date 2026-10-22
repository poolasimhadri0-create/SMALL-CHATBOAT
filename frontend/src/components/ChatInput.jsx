import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Square, Image, Mic, MicOff, X } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { useSpeech } from '../hooks/useSpeech';

export function ChatInput() {
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const sendMessage = useChatStore((state) => state.sendMessage);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const stopStreaming = useChatStore((state) => state.stopStreaming);
  const addToast = useChatStore((state) => state.addToast);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [text]);

  // Voice recognition hook
  const { isListening, supported: speechSupported, toggleListening } = useSpeech({
    onTranscript: (transcript) => {
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    },
  });

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      addToast('Only PNG, JPEG, and WEBP images are supported.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('Image size cannot exceed 5MB.', 'error');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = () => {
    if (isStreaming) {
      stopStreaming();
      return;
    }

    const trimmed = text.trim();
    if (!trimmed && !imageFile) return;

    if (trimmed.length > 8000) {
      addToast('Message exceeds maximum 8000 characters limit.', 'error');
      return;
    }

    sendMessage(trimmed, imageFile);
    setText('');
    removeImage();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 select-none">
      {/* Floating Glass Bar */}
      <div className="relative rounded-[22px] bg-light-surface/90 dark:bg-[#151924]/90 backdrop-blur-xl border border-light-border dark:border-white/10 shadow-lg p-2.5 transition-all focus-within:border-accent-blue/50 focus-within:ring-2 focus-within:ring-accent-blue/20">
        {/* Image Attachment Preview */}
        {imagePreview && (
          <div className="relative inline-block mb-2 ml-2">
            <img
              src={imagePreview}
              alt="Attachment preview"
              className="w-16 h-16 object-cover rounded-xl border border-white/20 shadow-md"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-dark-bg/90 text-white hover:bg-rose-500 transition-colors shadow"
              title="Remove image"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-end space-x-2">
          {/* File input button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-full text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0"
            title="Attach image (PNG, JPEG, WEBP <= 5MB)"
          >
            <Image className="w-5 h-5" />
          </button>

          {/* Voice Input Button */}
          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2.5 rounded-full transition-colors flex-shrink-0 ${
                isListening
                  ? 'text-rose-500 bg-rose-500/10 animate-pulse'
                  : 'text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}

          {/* Auto-growing Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            className="flex-1 bg-transparent border-0 outline-none resize-none px-2 py-2 text-[15px] leading-relaxed text-light-text dark:text-dark-text placeholder:text-light-muted dark:placeholder:text-[#8A91A5]/60 max-h-44"
          />

          {/* Raised 3D Send / Stop Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!isStreaming && !text.trim() && !imageFile}
            className={`p-2.5 rounded-full flex-shrink-0 text-white flex items-center justify-center btn-send-3d ${
              !isStreaming && !text.trim() && !imageFile ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title={isStreaming ? 'Stop generating (Esc)' : 'Send message (Enter)'}
          >
            {isStreaming ? (
              <Square className="w-4 h-4 fill-white" />
            ) : (
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            )}
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center px-4 pt-1.5 text-[11px] text-light-muted dark:text-dark-muted/60">
        <span>Gemini can make mistakes. Verify important info.</span>
        <span>Shift + Enter for new line</span>
      </div>
    </div>
  );
}
