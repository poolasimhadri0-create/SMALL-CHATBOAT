import React from 'react';
import { Sparkles, Code2, Compass, Lightbulb } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

const SUGGESTIONS = [
  {
    icon: Sparkles,
    title: 'Explain Quantum Computing',
    desc: 'Break it down simply with a real-world metaphor.',
    prompt: 'Explain the principles of quantum computing in simple terms using a real-world metaphor.',
  },
  {
    icon: Code2,
    title: 'Design a RESTful API',
    desc: 'Best practices for scalable microservices.',
    prompt: 'Outline best practices for designing a scalable RESTful API with authentication and rate limiting.',
  },
  {
    icon: Compass,
    title: 'Explore India & Culture',
    desc: 'Traditions, food, and must-visit heritage.',
    prompt: 'What are the top 5 historical places to visit in India and their cultural significance?',
  },
  {
    icon: Lightbulb,
    title: 'Brainstorm Startup Ideas',
    desc: 'AI-assisted developer productivity tools.',
    prompt: 'Brainstorm 3 innovative AI-powered SaaS product ideas for software engineers in 2026.',
  },
];

export function SuggestionCards({ onSelect }) {
  const sendMessage = useChatStore((state) => state.sendMessage);

  const handleClick = (prompt) => {
    if (onSelect) {
      onSelect(prompt);
    } else {
      sendMessage(prompt);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-2xl px-4 mt-6">
      {SUGGESTIONS.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={i}
            onClick={() => handleClick(item.prompt)}
            className="card-3d text-left p-4 rounded-card bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-card-light dark:shadow-card-dark hover:border-accent-blue/40 group flex items-start space-x-3.5"
          >
            <div className="p-2.5 rounded-xl bg-accent-blue/10 text-accent-blue group-hover:scale-105 transition-transform">
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading font-semibold text-sm text-light-text dark:text-dark-text group-hover:text-accent-blue transition-colors truncate">
                {item.title}
              </h3>
              <p className="text-xs text-light-muted dark:text-dark-muted mt-1 line-clamp-2">
                {item.desc}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
