import { Navigate } from 'react-router-dom';

/** Placeholder for paid UI omitted from Community Edition. */
export default function CeUnavailable() {
  return <Navigate to="/" replace />;
}
