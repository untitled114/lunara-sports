import { useTheme } from '@/context/ThemeContext';

const TZ_MAP = {
  local: undefined,
  ET: 'America/New_York',
  CT: 'America/Chicago',
  MT: 'America/Denver',
  PT: 'America/Los_Angeles',
};

const TZ_LABEL = { local: '', ET: ' ET', CT: ' CT', MT: ' MT', PT: ' PT' };

export function formatGameTime(isoString, tz = 'local') {
  if (!isoString) return 'TBD';
  const opts = { hour: 'numeric', minute: '2-digit' };
  if (TZ_MAP[tz]) opts.timeZone = TZ_MAP[tz];
  // Normalize all Unicode whitespace (U+202F, U+00A0, etc.) to regular spaces
  const raw = new Date(isoString).toLocaleTimeString('en-US', opts);
  return raw.replace(/[^\S\r\n]/g, ' ') + TZ_LABEL[tz];
}

/**
 * Returns structured time parts for components that display time/period separately.
 * e.g. { time: "7:30", period: "PM", tz: "ET" }
 */
export function formatGameTimeParts(isoString, tz = 'local') {
  if (!isoString) return { time: 'TBD', period: '', tz: '' };
  const d = new Date(isoString);
  const tzOpt = TZ_MAP[tz];
  const hours = parseInt(d.toLocaleString('en-US', { hour: 'numeric', hour12: true, ...(tzOpt && { timeZone: tzOpt }) }));
  const minutes = d.toLocaleString('en-US', { minute: '2-digit', ...(tzOpt && { timeZone: tzOpt }) });
  const period = parseInt(d.toLocaleString('en-US', { hour: 'numeric', hour12: false, ...(tzOpt && { timeZone: tzOpt }) })) >= 12 ? 'PM' : 'AM';
  return {
    time: `${hours}:${minutes.padStart(2, '0')}`,
    period,
    tz: tz === 'local' ? '' : tz,
  };
}

export function formatGameDay(isoString, tz = 'local') {
  if (!isoString) return '';
  const opts = { weekday: 'short' };
  if (TZ_MAP[tz]) opts.timeZone = TZ_MAP[tz];
  return new Date(isoString).toLocaleDateString('en-US', opts).toUpperCase();
}

const zoneOpt = (tz) => (TZ_MAP[tz] ? { timeZone: TZ_MAP[tz] } : {});

/**
 * When a game tips, in the chosen time zone with its label (the ticker's and the home
 * page's status line): "Tonight, 7:00 PM ET" from 5 PM on the game's day, "Today, 2:00 PM ET"
 * before that, "Sat, 7:00 PM ET" on any other day. "Local" adds no label.
 */
export function formatTipWhen(isoString, tz = 'local', now = new Date()) {
  if (!isoString) return 'TBD';
  const tip = new Date(isoString);
  const zone = zoneOpt(tz);
  const dayKey = (d) => d.toLocaleDateString('en-CA', zone);
  const time = tip.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...zone }).replace(/[^\S\r\n]/g, ' ') + (TZ_LABEL[tz] ?? '');
  if (dayKey(tip) !== dayKey(now)) {
    return `${tip.toLocaleDateString('en-US', { weekday: 'short', ...zone })}, ${time}`;
  }
  const hour = Number(tip.toLocaleString('en-US', { hour: 'numeric', hourCycle: 'h23', ...zone }));
  return `${hour >= 17 ? 'Tonight' : 'Today'}, ${time}`;
}

export function useFormatTime() {
  const { timezone } = useTheme();
  const fmt = (isoString) => formatGameTime(isoString, timezone);
  fmt.day = (isoString) => formatGameDay(isoString, timezone);
  fmt.parts = (isoString) => formatGameTimeParts(isoString, timezone);
  fmt.when = (isoString) => formatTipWhen(isoString, timezone);
  return fmt;
}
