import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';

export function SourceChips({ sources = [] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 mb-1 pt-2 border-t border-black/5 dark:border-white/5">
      <div className="flex items-center space-x-1.5 text-xs text-muted dark:text-[#8A91A5] mb-2 font-medium">
        <Globe className="w-3.5 h-3.5 text-accent-blue" />
        <span>Sources & Grounding:</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {sources.map((src, idx) => {
          let domain = '';
          try {
            domain = new URL(src.uri).hostname.replace('www.', '');
          } catch {
            domain = src.uri;
          }

          return (
            <a
              key={idx}
              href={src.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-muted hover:text-white border border-black/5 dark:border-white/10 transition-colors"
              title={src.title || src.uri}
            >
              <img
                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                alt=""
                className="w-3.5 h-3.5 rounded-full"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <span className="truncate max-w-[150px] font-medium">{src.title || domain}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
