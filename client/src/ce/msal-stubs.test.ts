import { describe, it, expect } from 'vitest';
import {
  PublicClientApplication,
  InteractionStatus,
  InteractionRequiredAuthError,
  LogLevel,
} from './stubs/msal-browser';
import {
  MsalProvider,
  useMsal,
  useIsAuthenticated,
  useAccount,
} from './stubs/msal-react';

/**
 * CE Vite aliases @azure/msal-* to these stubs. AuthContext and friends still
 * statically import InteractionStatus / useAccount / LogLevel / etc., so the
 * stubs must export every symbol the CE graph imports or Vite's dependency
 * scan fails at boot (seen as a red overlay on :5173).
 */
describe('CE MSAL stubs export surface', () => {
  it('exports browser symbols used by AuthContext / api / authProviders', () => {
    expect(PublicClientApplication).toBeTypeOf('function');
    expect(InteractionStatus.None).toBe('none');
    expect(new InteractionRequiredAuthError()).toBeInstanceOf(Error);
    expect(LogLevel.Error).toBeTypeOf('number');
  });

  it('exports react hooks/components used by AuthContext / App', () => {
    expect(MsalProvider).toBeTypeOf('function');
    expect(useMsal).toBeTypeOf('function');
    expect(useIsAuthenticated).toBeTypeOf('function');
    expect(useAccount).toBeTypeOf('function');
    expect(useAccount(null)).toBeNull();
    expect(useIsAuthenticated()).toBe(false);
    expect(useMsal().inProgress).toBe('none');
  });
});
