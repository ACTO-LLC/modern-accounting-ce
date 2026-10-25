/** Persistent browser session id for QBO OAuth (no paid SDK). */
export function getQboSessionId(): string {
  let sessionId = localStorage.getItem('qbo_session_id');
  if (!sessionId) {
    sessionId = `qbo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('qbo_session_id', sessionId);
  }
  return sessionId;
}
