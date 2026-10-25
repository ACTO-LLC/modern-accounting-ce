/**
 * Default-deny authentication gate.
 *
 * Mounted once, ahead of every route in `server.js`, so that a newly added
 * endpoint is authenticated by default. Making a route public is an explicit,
 * reviewable act: add it to PUBLIC_ROUTES below.
 *
 * Previously each route opted *in* to `validateJWT`, which left Plaid, GitHub,
 * enhancements, deployments, the email-api proxy and most accounting mutations
 * reachable with no credentials at all (issue #646).
 *
 * CE Phase 1b: under CE_BUILD, paid path prefixes (paid surfaces (payments, practice-OS, bank-link, QBO,
 * GitHub, enhancements, deployments) are rejected here with 403 before JWT
 * (see src/ce/ce-build.js). Prefer export-omit + bridges/facades; this gate is
 * belt-and-suspenders for residual mounts and future #699/#712 paths.
 *
 * @module middleware/requireAuth
 */

import { validateJWT } from './auth.js';
import { rejectPaidPathIfCe } from '../ce/ce-build.js';

/**
 * The complete set of endpoints reachable without a bearer token.
 *
 * Every entry here is public internet surface, so keep the list minimal and
 * justify each one. Matching is exact (after trailing-slash and case
 * normalization) — never prefix-based, so a public path can't be used to
 * tunnel to a protected one.
 *
 * @type {ReadonlyArray<{method: string, path: string, why: string}>}
 */
export const PUBLIC_ROUTES = Object.freeze([
    {
        method: 'GET',
        path: '/api/health',
        why: 'Liveness probe for Azure/Docker health checks; returns no business data.',
    },
    {
        method: 'GET',
        path: '/api/plaid/health',
        why: 'Reports Plaid client configuration status only; no account or token data.',
    },
    {
        method: 'GET',
        path: '/api/qbo/oauth-callback',
        why: 'Intuit redirects the browser here with an auth code; it cannot carry our JWT.',
    },
    {
        method: 'GET',
        path: '/api/qbo/callback',
        why: 'Legacy Intuit redirect target, same constraint as /api/qbo/oauth-callback.',
    },
]);

/**
 * Normalize a request path for allow-list comparison.
 *
 * Express routes case-insensitively and treats a trailing slash as equivalent,
 * so the gate must too — otherwise `/API/Health` would reach the public health
 * handler while the gate rejected it (or, worse, the reverse).
 *
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
    const withoutTrailingSlash = path.length > 1 ? path.replace(/\/+$/, '') : path;
    return withoutTrailingSlash.toLowerCase();
}

/**
 * Whether a request may proceed without authentication.
 *
 * @param {string} method - HTTP method
 * @param {string} path - Request path (no query string)
 * @returns {boolean}
 */
export function isPublicRoute(method, path) {
    // CORS preflight cannot carry an Authorization header. It exposes no data —
    // the browser still applies the CORS result to the real (authenticated) request.
    if (method === 'OPTIONS') {
        return true;
    }

    const normalized = normalizePath(path);
    return PUBLIC_ROUTES.some(
        route => route.method === method && normalizePath(route.path) === normalized
    );
}

/**
 * Express middleware enforcing the default-deny posture.
 *
 * Public routes pass straight through; everything else must satisfy
 * `validateJWT`, which responds 401 on a missing or invalid token.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireAuth(req, res, next) {
    // CE fail-if-paid route guard (paid-path only). Runs before JWT so CE
    // images never exercise paid handlers even with a valid token.
    if (rejectPaidPathIfCe(req, res)) {
        return;
    }

    if (isPublicRoute(req.method, req.path)) {
        return next();
    }

    return validateJWT(req, res, next);
}

export default requireAuth;
