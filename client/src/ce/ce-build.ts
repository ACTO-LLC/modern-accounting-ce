/**
 * Client Community Edition flag (Developer Phase 1b).
 * Set VITE_CE_BUILD=true for CE builds. Prefer VITE_BYPASS_AUTH=true in CE.
 */
export function isCeBuild(): boolean {
  const raw = import.meta.env.VITE_CE_BUILD;
  if (raw === undefined || raw === null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === 'true' || v === '1';
}

export default isCeBuild;
