import { ReactNode } from 'react';

/** CE stub — no @azure/msal-react in Community Edition. */
export function MsalProvider({ children }: { children: ReactNode; instance?: unknown }) {
  return <>{children}</>;
}

export function useMsal() {
  return {
    instance: null,
    accounts: [] as unknown[],
    inProgress: 'none',
  };
}

export function useIsAuthenticated() {
  return false;
}
