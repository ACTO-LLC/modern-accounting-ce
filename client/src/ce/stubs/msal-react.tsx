import { ReactNode } from 'react';
import type { AccountInfo } from './msal-browser';

/** CE stub — no @azure/msal-react in Community Edition. */
export function MsalProvider({ children }: { children: ReactNode; instance?: unknown }) {
  return <>{children}</>;
}

export function useMsal() {
  return {
    instance: null as unknown,
    accounts: [] as AccountInfo[],
    inProgress: 'none',
  };
}

export function useIsAuthenticated() {
  return false;
}

export function useAccount(_account?: AccountInfo | null): AccountInfo | null {
  return null;
}
