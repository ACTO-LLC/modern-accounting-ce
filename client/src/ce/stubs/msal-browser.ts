/** CE stub — directory SSO MSAL packaging is paid. Use VITE_BYPASS_AUTH=true. */

export type AccountInfo = {
  homeAccountId?: string;
  localAccountId?: string;
  username?: string;
  name?: string;
  environment?: string;
  tenantId?: string;
  idTokenClaims?: Record<string, unknown>;
};

export type Configuration = Record<string, unknown>;

export type SilentRequest = {
  scopes?: string[];
  account?: AccountInfo | null;
  [key: string]: unknown;
};

/** Mirrors @azure/msal-browser InteractionStatus values used by AuthContext. */
export enum InteractionStatus {
  None = 'none',
  Startup = 'startup',
  Login = 'login',
  Logout = 'logout',
  AcquireToken = 'acquireToken',
  HandleRedirect = 'handleRedirect',
  SsoSilent = 'ssoSilent',
}

/** Mirrors @azure/msal-browser LogLevel used by authProviders. */
export enum LogLevel {
  Error = 0,
  Warning = 1,
  Info = 2,
  Verbose = 3,
  Trace = 4,
}

export class InteractionRequiredAuthError extends Error {
  constructor(message?: string) {
    super(message ?? 'interaction_required');
    this.name = 'InteractionRequiredAuthError';
  }
}

export class PublicClientApplication {
  constructor(_config?: unknown) {}
  initialize(): Promise<void> {
    return Promise.resolve();
  }
  getAllAccounts(): AccountInfo[] {
    return [];
  }
  getActiveAccount(): AccountInfo | null {
    return null;
  }
  async loginPopup() {
    return { account: null as AccountInfo | null };
  }
  async loginRedirect(_request?: unknown) {
    return undefined;
  }
  async logoutPopup() {
    return undefined;
  }
  async logoutRedirect(_request?: unknown) {
    return undefined;
  }
  async acquireTokenSilent(_request?: SilentRequest) {
    return { accessToken: '' };
  }
  async handleRedirectPromise() {
    return null;
  }
}
