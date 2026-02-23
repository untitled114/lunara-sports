import React, { useState, useCallback } from 'react';
import { useTheme } from '@/context/ThemeContext';

const EMOJIS = ['🔥', '😱', '🧱', '🎯', '🙌', '🧊'];

export function ReactionOverlay() {
  const [reactions, setReactions] = useState([]);
  const { playGlassClick } = useTheme();

  const addReaction = useCallback((emoji) => {
    const id = Date.now() + Math.random();
    const x = 20 + Math.random() * 60; // 20% to 80% width
    
    setReactions(prev => [...prev, { id, emoji, x }]);
    playGlassClick();

    // Cleanup after animation
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  }, [playGlassClick]);

  return (
    <>
      {/* Floating Reached */}
      <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
        {reactions.map(r => (
          <div
            key={r.id}
            className="absolute bottom-0 text-3xl animate-reaction-float transition-opacity"
            style={{ 
              left: `${r.x}%`,
              filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.3))'
            }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Reaction Picker Bar */}
      <div className="liquid-glass glass-pill flex items-center gap-2 p-1.5 rounded-2xl shadow-2xl">
        {EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => addReaction(emoji)}
            className="h-10 w-10 flex items-center justify-center text-xl hover:scale-125 hover:-translate-y-1 active:scale-90 transition-all rounded-xl hover:bg-white/10"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
