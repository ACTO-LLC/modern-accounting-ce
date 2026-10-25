/**
 * Tests for the default-deny authentication gate (issue #646).
 *
 * BYPASS_AUTH must be off before importing the middleware — auth.js snapshots
 * it into module config at load time, and with it on every request would pass.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let requireAuth;
let isPublicRoute;
let PUBLIC_ROUTES;
let originalBypassAuth;

beforeAll(async () => {
    originalBypassAuth = process.env.BYPASS_AUTH;
    process.env.BYPASS_AUTH = 'false';

    // Drop any cached copy of auth.js so it re-snapshots BYPASS_AUTH from the
    // env we just set. Without this the suite would depend on whether some
    // other test imported auth.js first.
    vi.resetModules();

    const mod = await import('../src/middleware/requireAuth.js');
    requireAuth = mod.requireAuth;
    isPublicRoute = mod.isPublicRoute;
    PUBLIC_ROUTES = mod.PUBLIC_ROUTES;
});

afterAll(() => {
    // Leave the environment exactly as we found it for any suite sharing this worker.
    if (originalBypassAuth === undefined) {
        delete process.env.BYPASS_AUTH;
    } else {
        process.env.BYPASS_AUTH = originalBypassAuth;
    }
    vi.resetModules();
});

/** Minimal Express-shaped response double. */
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

describe('isPublicRoute', () => {
    it('allows every declared public route', () => {
        for (const route of PUBLIC_ROUTES) {
            expect(isPublicRoute(route.method, route.path)).toBe(true);
        }
    });

    it('allows CORS preflight, which cannot carry an Authorization header', () => {
        expect(isPublicRoute('OPTIONS', '/api/enhancements')).toBe(true);
    });

    it('normalizes case and trailing slashes the way Express routes them', () => {
        expect(isPublicRoute('GET', '/API/Health')).toBe(true);
        expect(isPublicRoute('GET', '/api/health/')).toBe(true);
    });

    it('denies a public path under a different method', () => {
        expect(isPublicRoute('POST', '/api/health')).toBe(false);
        expect(isPublicRoute('DELETE', '/api/health')).toBe(false);
    });

    it('matches exactly, so a public prefix cannot tunnel to a protected route', () => {
        expect(isPublicRoute('GET', '/api/health/../enhancements')).toBe(false);
        expect(isPublicRoute('GET', '/api/healthcheck')).toBe(false);
        expect(isPublicRoute('GET', '/api/health/secrets')).toBe(false);
    });

    it('denies the route groups called out in issue #646', () => {
        const shouldBeProtected = [
            ['POST', '/api/plaid/link-token'],
            ['POST', '/api/plaid/exchange-token'],
            ['GET', '/api/plaid/connections'],
            ['POST', '/api/plaid/sync-all'],
            ['POST', '/api/enhancements'],
            ['GET', '/api/enhancements'],
            ['GET', '/api/deployments'],
            ['POST', '/api/github/pulls'],
            ['POST', '/api/chat'],
            ['GET', '/email-api/settings'],
            ['POST', '/api/payments'],
            ['POST', '/api/invoices/5/post'],
            ['GET', '/api/banktransactions'],
        ];

        for (const [method, routePath] of shouldBeProtected) {
            expect(
                isPublicRoute(method, routePath),
                `${method} ${routePath} must not be public`
            ).toBe(false);
        }
    });

    it('keeps the public allow-list minimal and intentional', () => {
        // A tripwire: growing this list is a security decision that belongs in review.
        expect(PUBLIC_ROUTES).toHaveLength(4);
        for (const route of PUBLIC_ROUTES) {
            expect(route.why, `${route.path} needs a justification`).toBeTruthy();
        }
    });
});

describe('requireAuth', () => {
    it('calls next() for a public route without touching auth', () => {
        const next = vi.fn();
        const res = mockResponse();

        requireAuth({ method: 'GET', path: '/api/health', headers: {} }, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(res.statusCode).toBeNull();
    });

    it('rejects an unauthenticated request to a protected route with 401', async () => {
        const next = vi.fn();
        const res = mockResponse();

        await requireAuth({ method: 'POST', path: '/api/plaid/link-token', headers: {} }, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects a malformed Authorization header rather than falling open', async () => {
        const next = vi.fn();
        const res = mockResponse();

        await requireAuth(
            { method: 'GET', path: '/api/enhancements', headers: { authorization: 'Basic abc123' } },
            res,
            next
        );

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    it('protects a route nobody has written yet (default-deny)', async () => {
        const next = vi.fn();
        const res = mockResponse();

        await requireAuth({ method: 'GET', path: '/api/some-future-route', headers: {} }, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });
});

describe('server.js wiring', () => {
    const serverSource = readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

    it('mounts the gate before any route or proxy is registered', () => {
        const gateIndex = serverSource.indexOf('app.use(requireAuth)');
        expect(gateIndex, 'requireAuth must be mounted in server.js').toBeGreaterThan(-1);

        // The email-api proxy is the earliest-registered request handler; every
        // route follows it. If the gate ever moves after one of these, the
        // surface it guards silently reopens.
        const firstProxyIndex = serverSource.indexOf("app.use('/email-api'");
        const firstApiRouteIndex = serverSource.indexOf("app.use('/api'");

        expect(gateIndex).toBeLessThan(firstProxyIndex);
        expect(gateIndex).toBeLessThan(firstApiRouteIndex);
    });
});
