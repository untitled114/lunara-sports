import { useEffect, useRef } from 'react';
import { useTheme } from '@/context/ThemeContext';

export function usePolling(callback, { enabled = true, intervalOverride } = {}) {
  const { refreshInterval } = useTheme();
  const savedCallback = useRef(callback);
  const ms = (intervalOverride ?? refreshInterval) * 1000;

  useEffect(() => { savedCallback.current = callback; });

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => savedCallback.current(), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}
