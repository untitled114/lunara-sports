import { useEffect } from 'react';

const SITE = 'Lunara Sports';

// The page's browser title ("<title> | Lunara Sports", just "Lunara Sports" at home) and the
// plain description search engines show. Pages call it with their own words.
export function usePageMeta(title, description) {
  useEffect(() => {
    document.title = !title || title === SITE ? SITE : `${title} | ${SITE}`;
    if (!description) return;
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'description');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', description);
  }, [title, description]);
}
