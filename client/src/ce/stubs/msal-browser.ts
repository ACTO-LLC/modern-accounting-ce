/** CE stub — directory SSO MSAL packaging is paid. Use VITE_BYPASS_AUTH=true. */
export class PublicClientApplication {
  constructor(_config?: unknown) {}
  initialize(): Promise<void> {
    return Promise.resolve();
  }
  getAllAccounts() {
    return [];
  }
  async loginPopup() {
    return { account: null };
  }
  async logoutPopup() {
    return undefined;
  }
  async acquireTokenSilent() {
    return { accessToken: '' };
  }
}

export type AccountInfo = { homeAccountId?: string; username?: string };
export type Configuration = Record<string, unknown>;
