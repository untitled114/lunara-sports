import { useState } from 'react';
import { getHeadshotUrl } from '@/utils/teamColors';

/**
 * A player's headshot at `px` CSS pixels, fetched at 2x through getHeadshotUrl (ESPN's
 * combiner) instead of the full-size original. When there is no headshot, or ESPN
 * answers with an error for this player, `fallback` renders instead (the page's
 * existing no-headshot state: an initial, a team logo, or nothing).
 */
export function PlayerHeadshot({ url, px, alt = '', className, fallback = null }) {
  const [failedUrl, setFailedUrl] = useState(null);
  if (!url || failedUrl === url) return fallback;
  return (
    <img
      src={getHeadshotUrl(url, px * 2)}
      alt={alt}
      width={px}
      height={px}
      loading="lazy"
      onError={() => setFailedUrl(url)}
      className={className}
    />
  );
}
