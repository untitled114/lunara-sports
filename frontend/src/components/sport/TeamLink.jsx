import { Link } from 'react-router-dom';

// One link to a team's page around a whole row or tile, logo included.
export function TeamLink({ abbrev, children, className, ...rest }) {
  if (!abbrev) return <span className={className}>{children}</span>;
  return (
    <Link to={`/team/${abbrev}`} className={className} {...rest}>
      {children}
    </Link>
  );
}
