import { Link } from 'react-router-dom';

// One home box: title, text, a small real piece of the site pinned to the bottom
// (so the pieces line up across a row), then Explore where the box has a link. A soft glow
// in the box's own color sits in its top-right corner. No image and no icon inside.
export function HomeBox({ title, text, piece, href, glow, delay = '0s' }) {
  return (
    <div
      data-testid="home-box"
      className="relative overflow-hidden flex flex-col h-full rounded-lg border border-border bg-surface-1 shadow-card p-[28px] animate-float"
      style={{ animationDelay: delay }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[70px] -top-[70px] h-[220px] w-[220px] opacity-25"
        style={{ backgroundImage: `radial-gradient(circle, ${glow} 0%, transparent 70%)` }}
      />
      <h2 className="relative t-section text-text-1 mb-[10px]">{title}</h2>
      <p className="relative t-body text-text-2 mb-[24px]">{text}</p>
      <div className="relative mt-auto min-h-[30px] flex items-center">{piece}</div>
      {href && (
        <Link
          to={href}
          className="relative self-start mt-[12px] inline-flex items-center min-h-[44px] t-small font-semibold text-accent hover:text-accent-hover transition-colors"
        >
          Explore
        </Link>
      )}
    </div>
  );
}
