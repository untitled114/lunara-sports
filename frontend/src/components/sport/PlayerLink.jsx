import { Link } from 'react-router-dom';

// One link to a player's page around a whole row or tile, headshot included:
// one click anywhere on it is enough. Without an id the content shows as plain text.
export function PlayerLink({ id, children, className, ...rest }) {
  if (!id) return <span className={className}>{children}</span>;
  return (
    <Link to={`/player/${id}`} className={className} {...rest}>
      {children}
    </Link>
  );
}
