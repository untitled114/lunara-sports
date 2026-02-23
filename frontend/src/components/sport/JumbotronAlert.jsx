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
      <div className="liquid-mirror rounded-[2rem] border border-indigo-500/30 overflow-hidden shadow-2xl group">
        <div className="h-1 w-full bg-indigo-500 animate-pulse opacity-50" />
        
        <div className="p-6 relative">
           <div className="absolute inset-0 bg-white/5 animate-flash pointer-events-none" />
           
           <div className="flex items-center gap-6 relative z-10">
              <div className="h-12 w-12 rounded-xl bg-white text-black flex items-center justify-center shadow-xl shrink-0 rotate-2 group-hover:rotate-0 transition-transform duration-500">
                 <Zap className="h-6 w-6 fill-black" />
              </div>
              
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[13px] font-black uppercase tracking-[0.4em] text-indigo-400">Milestone</span>
                    <div className="h-1 w-1 rounded-full bg-red-500 animate-ping" />
                 </div>
                 <h2 className="text-xl font-black uppercase tracking-tight text-white leading-none mb-1.5 truncate">{message}</h2>
                 <p className="text-sm font-bold text-white/40 uppercase tracking-widest truncate">{subtext}</p>
              </div>
              
              <button onClick={() => setIsVisible(false)} className="p-2 hover:bg-white/5 rounded-lg transition-colors ml-2">
                 <X className="h-4 w-4 text-white/50" />
              </button>
           </div>
        </div>
        
        {/* Bottom Progress Decay */}
        <div className="h-0.5 w-full bg-white/5 overflow-hidden">
           <div className="h-full bg-indigo-500/40 animate-progress" style={{ animationDuration: '8s' }} />
        </div>
      </div>
    </div>
  );
}
