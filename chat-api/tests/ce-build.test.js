/**
 * CE_BUILD flag + fail-if-paid helpers (Developer Phase 1b).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const STRIPE_KEYS = [
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'PAYMENTS_ENCRYPTION_KEY',
];

const PLAID_KEYS = ['PLAID_CLIENT_ID', 'PLAID_SECRET'];
const GITHUB_KEYS = ['GITHUB_TOKEN'];

const CE_ENV_KEYS = ['CE_BUILD', ...STRIPE_KEYS, ...PLAID_KEYS, ...GITHUB_KEYS];

let saved = {};

function clearCeEnv() {
    for (const k of CE_ENV_KEYS) {
        delete process.env[k];
    }
}

beforeEach(() => {
    saved = {};
    for (const k of CE_ENV_KEYS) {
        saved[k] = process.env[k];
    }
    clearCeEnv();
    vi.resetModules();
});

afterEach(() => {
    clearCeEnv();
    for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    vi.resetModules();
});

function mockResponse() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

describe('isCeBuild', () => {
    it('is false when CE_BUILD unset', async () => {
        const { isCeBuild } = await import('../src/ce/ce-build.js');
        expect(isCeBuild()).toBe(false);
    });

    it('is true for true/1 (case-insensitive)', async () => {
        process.env.CE_BUILD = 'true';
        let mod = await import('../src/ce/ce-build.js');
        expect(mod.isCeBuild()).toBe(true);

        vi.resetModules();
        process.env.CE_BUILD = '1';
        mod = await import('../src/ce/ce-build.js');
        expect(mod.isCeBuild()).toBe(true);

        vi.resetModules();
        process.env.CE_BUILD = 'TRUE';
        mod = await import('../src/ce/ce-build.js');
        expect(mod.isCeBuild()).toBe(true);
    });

    it('is false for other values', async () => {
        process.env.CE_BUILD = 'false';
        const { isCeBuild } = await import('../src/ce/ce-build.js');
        expect(isCeBuild()).toBe(false);
    });
});

describe('assertPaidNotLinked', () => {
    it('does nothing when CE_BUILD is off even if Stripe env is set', async () => {
        process.env.STRIPE_SECRET_KEY = 'sk_test_x';
        const { assertPaidNotLinked } = await import('../src/ce/ce-build.js');
        expect(() => assertPaidNotLinked()).not.toThrow();
    });

    it('ok when CE_BUILD on and no paid env linked', async () => {
        process.env.CE_BUILD = 'true';
        const { assertPaidNotLinked } = await import('../src/ce/ce-build.js');
        expect(() => assertPaidNotLinked()).not.toThrow();
    });

    it('throws when CE_BUILD on and STRIPE_SECRET_KEY set', async () => {
        process.env.CE_BUILD = 'true';
        process.env.STRIPE_SECRET_KEY = 'sk_test_x';
        const { assertPaidNotLinked } = await import('../src/ce/ce-build.js');
        expect(() => assertPaidNotLinked()).toThrow(/STRIPE_SECRET_KEY/);
    });

    it('throws when CE_BUILD on and PAYMENTS_ENCRYPTION_KEY set', async () => {
        process.env.CE_BUILD = '1';
        process.env.PAYMENTS_ENCRYPTION_KEY = 'abc';
        const { assertPaidNotLinked } = await import('../src/ce/ce-build.js');
        expect(() => assertPaidNotLinked()).toThrow(/PAYMENTS_ENCRYPTION_KEY/);
    });

    it('throws when CE_BUILD on and PLAID_SECRET set', async () => {
        process.env.CE_BUILD = 'true';
        process.env.PLAID_SECRET = 'secret';
        const { assertPaidNotLinked } = await import('../src/ce/ce-build.js');
        expect(() => assertPaidNotLinked()).toThrow(/PLAID_SECRET/);
    });

    it('throws when CE_BUILD on and GITHUB_TOKEN set', async () => {
        process.env.CE_BUILD = 'true';
        process.env.GITHUB_TOKEN = 'ghp_x';
        const { assertPaidNotLinked } = await import('../src/ce/ce-build.js');
        expect(() => assertPaidNotLinked()).toThrow(/GITHUB_TOKEN/);
    });

    it('ignores whitespace-only Stripe env values', async () => {
        process.env.CE_BUILD = 'true';
        process.env.STRIPE_SECRET_KEY = '   ';
        const { assertPaidNotLinked } = await import('../src/ce/ce-build.js');
        expect(() => assertPaidNotLinked()).not.toThrow();
    });
});

describe('rejectPaidCapability middleware', () => {
    it('returns 403 JSON under CE_BUILD', async () => {
        process.env.CE_BUILD = 'true';
        const { rejectPaidCapability } = await import('../src/ce/ce-build.js');
        const mw = rejectPaidCapability('stripe');
        const next = vi.fn();
        const res = mockResponse();
        mw({}, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({
            error: 'Not available in Community Edition',
            capability: 'stripe',
        });
    });

    it('calls next when CE_BUILD is off', async () => {
        const { rejectPaidCapability } = await import('../src/ce/ce-build.js');
        const mw = rejectPaidCapability('rcm');
        const next = vi.fn();
        const res = mockResponse();
        mw({}, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.statusCode).toBeNull();
    });
});

describe('paidCapabilityForPath / rejectPaidPathIfCe', () => {
    it('maps Stripe, RCM, Plaid, QBO, GitHub, enhancements, deployments paths', async () => {
        const { paidCapabilityForPath } = await import('../src/ce/ce-build.js');
        expect(paidCapabilityForPath('/api/stripe/settings')).toBe('stripe');
        expect(paidCapabilityForPath('/api/adjudication')).toBe('rcm');
        expect(paidCapabilityForPath('/api/rcm/adjudication')).toBe('rcm');
        expect(paidCapabilityForPath('/api/settlement')).toBe('rcm');
        expect(paidCapabilityForPath('/api/invoices/by-claim')).toBe('rcm');
        expect(paidCapabilityForPath('/api/invoices/by-claim/a7050001-0001-4000-8000-000000000001')).toBe('rcm');
        expect(paidCapabilityForPath('/api/plaid/link-token')).toBe('plaid');
        expect(paidCapabilityForPath('/api/qbo/connect')).toBe('qbo');
        expect(paidCapabilityForPath('/api/github/branches')).toBe('github');
        expect(paidCapabilityForPath('/api/enhancements')).toBe('enhancements');
        expect(paidCapabilityForPath('/api/deployments')).toBe('deployments');
        expect(paidCapabilityForPath('/api/invoices')).toBeNull();
        expect(paidCapabilityForPath('/api/health')).toBeNull();
        expect(paidCapabilityForPath('/api/payments')).toBeNull();
    });

    it('rejectPaidPathIfCe 403s RCM under CE_BUILD', async () => {
        process.env.CE_BUILD = 'true';
        const { rejectPaidPathIfCe } = await import('../src/ce/ce-build.js');
        const res = mockResponse();
        const blocked = rejectPaidPathIfCe({ path: '/api/rcm/adjudication' }, res);
        expect(blocked).toBe(true);
        expect(res.statusCode).toBe(403);
        expect(res.body.capability).toBe('rcm');
    });

    it('rejectPaidPathIfCe 403s /api/plaid under CE_BUILD', async () => {
        process.env.CE_BUILD = 'true';
        const { rejectPaidPathIfCe } = await import('../src/ce/ce-build.js');
        const res = mockResponse();
        const blocked = rejectPaidPathIfCe({ path: '/api/plaid/connections' }, res);
        expect(blocked).toBe(true);
        expect(res.statusCode).toBe(403);
        expect(res.body.capability).toBe('plaid');
    });

    it('rejectPaidPathIfCe 403s /api/invoices/by-claim under CE_BUILD', async () => {
        process.env.CE_BUILD = 'true';
        const { rejectPaidPathIfCe } = await import('../src/ce/ce-build.js');
        const res = mockResponse();
        const blocked = rejectPaidPathIfCe(
            { path: '/api/invoices/by-claim/a7050001-0001-4000-8000-000000000001' },
            res
        );
        expect(blocked).toBe(true);
        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({
            error: 'Not available in Community Edition',
            capability: 'rcm',
        });
    });
});

describe('CE bridges under CE_BUILD', () => {
    it('plaid bridge exports facade (no throw on getClient)', async () => {
        process.env.CE_BUILD = 'true';
        const { plaidService } = await import('../src/ce/bridges/bank-link.js');
        expect(plaidService.getClient()).toBeNull();
        expect(await plaidService.loadConnectionsFromDB()).toBe(0);
    });

    it('plaid scheduler bridge no-ops start', async () => {
        process.env.CE_BUILD = 'true';
        const { plaidScheduler } = await import('../src/ce/bridges/bank-scheduler.js');
        expect(() => plaidScheduler.start()).not.toThrow();
        expect(plaidScheduler.getStatus()).toMatchObject({ running: false, ce: true });
    });

    it('github routes bridge 403s', async () => {
        process.env.CE_BUILD = 'true';
        const githubRoutes = (await import('../src/ce/bridges/github-routes.js')).default;
        const res = mockResponse();
        // Express routers are functions; invoke layer via handle if present
        await new Promise((resolve) => {
            githubRoutes({ method: 'GET', url: '/', path: '/' }, res, () => resolve());
            // Router may call res directly
            if (res.statusCode) resolve();
            setTimeout(resolve, 50);
        });
        expect(res.statusCode).toBe(403);
        expect(res.body.capability).toBe('github');
    });
});
