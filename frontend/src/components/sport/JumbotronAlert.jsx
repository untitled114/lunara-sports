import React, { useState, useEffect } from 'react';
import { Zap, X } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export function JumbotronAlert({ message, subtext }) {
  const [isVisible, setIsVisible] = useState(false);
  const { playThud } = useTheme();

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      playThud();
      const timer = setTimeout(() => setIsVisible(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [message, playThud]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 right-8 z-[150] w-full max-w-md px-4 animate-slideInRight">
      <div className="bg-surface-1 rounded-lg border border-accent/30 overflow-hidden shadow-2xl group">
        <div className="h-1 w-full bg-accent-fill animate-pulse opacity-50" />

        <div className="p-6 relative">
          <div className="absolute inset-0 bg-surface-2/40 animate-flash pointer-events-none" />

          <div className="flex items-center gap-6 relative z-10">
            <div className="h-12 w-12 rounded-lg bg-accent-fill text-white flex items-center justify-center shadow-xl shrink-0 rotate-2 group-hover:rotate-0 transition-transform duration-500">
              <Zap className="h-6 w-6 fill-current" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="t-label text-accent">Milestone</span>
                <div className="h-1.5 w-1.5 rounded-sm bg-loss animate-ping" />
              </div>
              <h2 className="t-section text-text-1 leading-none mb-1.5 truncate">{message}</h2>
              <p className="t-label text-text-3 truncate">{subtext}</p>
            </div>

            <button onClick={() => setIsVisible(false)} aria-label="Dismiss" className="p-2 hover:bg-surface-2 rounded-md transition-colors ml-2">
              <X className="h-4 w-4 text-text-3" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Bottom Progress Decay */}
        <div className="h-0.5 w-full bg-surface-2 overflow-hidden">
          <div className="h-full bg-accent/40 animate-progress" style={{ animationDuration: '8s' }} />
        </div>
      </div>
    </div>
  );
}
