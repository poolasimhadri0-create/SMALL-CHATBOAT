import React from 'react';

export function ThinkingDots() {
  return (
    <div className="flex items-center space-x-1.5 py-2 px-1" aria-label="Gemini is thinking">
      <span className="w-2 h-2 rounded-full bg-accent-blue/80 animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2 h-2 rounded-full bg-indigo-400/80 animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2 h-2 rounded-full bg-accent-violet/80 animate-bounce" />
    </div>
  );
}
