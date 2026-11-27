import { useCallback, useSyncExternalStore } from 'react';

// Below Tailwind's sm breakpoint (640px): a phone.
export const PHONE = '(max-width: 639.98px)';

// Whether a media query matches, kept in step with the window. Without matchMedia (jsdom,
// very old browsers) it is false, which lays pages out as on a desktop.
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener?.('change', onChange);
      return () => list.removeEventListener?.('change', onChange);
    },
    [query]
  );
  const read = () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, read, () => false);
}
