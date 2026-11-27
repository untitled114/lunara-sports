import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

// A table row that opens `to` from any cell. A link cannot wrap a <tr>, so a click
// outside the row's own links and buttons navigates; keyboard and screen-reader users reach
// the same page through the row's name link. Selecting text, or a click with a modifier key
// held, does not navigate here (the name link still opens a new tab).
export function LinkRow({ to, className, children }) {
  const navigate = useNavigate();
  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.target.closest('a, button, input, select, textarea, label')) return;
    if (window.getSelection?.()?.toString()) return;
    navigate(to);
  };
  return (
    <tr className={clsx(className, 'cursor-pointer hover:bg-surface-2 transition-colors')} onClick={onClick}>
      {children}
    </tr>
  );
}
