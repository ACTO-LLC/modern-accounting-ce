/**
 * Community Edition (CE) build flag + fail-if-paid helpers.
 *
 * Policy: docs/architecture/ce-seams.md, ce-phase-1b-strip-plan.md, ADR-0001
 *
 * Phase 1a: Stripe + practice-OS route/env guards.
 * Phase 1b: expand path prefixes + PLAID_/GITHUB_TOKEN env denylist; bridges/facades
 *           so paid modules are not linked under CE_BUILD (export-omit + no-op leftovers).
 *
 * @module ce/ce-build
 */

/** Env vars that mean Stripe / Pay-on-Invoice is linked into this process. */
export const STRIPE_PAID_ENV_KEYS = Object.freeze([
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'PAYMENTS_ENCRYPTION_KEY',
]);

/** Env vars that mean Plaid / ZTB is linked (Phase 1b). */
export const PLAID_PAID_ENV_KEYS = Object.freeze([
    'PLAID_CLIENT_ID',
    'PLAID_SECRET',
]);

/** Env vars that mean write-agent GitHub is linked (Phase 1b). */
export const GITHUB_PAID_ENV_KEYS = Object.freeze([
    'GITHUB_TOKEN',
]);

/** All paid-link env keys checked by assertPaidNotLinked under CE_BUILD. */
export const PAID_LINK_ENV_KEYS = Object.freeze([
    ...STRIPE_PAID_ENV_KEYS,
    ...PLAID_PAID_ENV_KEYS,
    ...GITHUB_PAID_ENV_KEYS,
]);

/**
 * Path prefixes (lowercase) that are paid capabilities under CE_BUILD.
 * Belt-and-suspenders when routes still exist in the private tree; CE export omits them.
 * Stripe / ClaimId paths apply when #699 / #712 merge.
 */
const PAID_PATH_PREFIXES = Object.freeze([
    { prefix: '/api/stripe', capability: 'stripe' },
    { prefix: '/api/adjudication', capability: 'rcm' },
    { prefix: '/api/rcm', capability: 'rcm' },
    { prefix: '/api/settlement', capability: 'rcm' },
    { prefix: '/api/invoices/by-claim', capability: 'rcm' },
    { prefix: '/api/plaid', capability: 'plaid' },
    { prefix: '/api/github', capability: 'github' },
    { prefix: '/api/enhancements', capability: 'enhancements' },
    { prefix: '/api/deployments', capability: 'deployments' },
    { prefix: '/api/qbo', capability: 'qbo' },
]);

/**
 * @returns {boolean} true when CE_BUILD is "true" or "1" (case-insensitive).
 */
export function isCeBuild() {
    const raw = process.env.CE_BUILD;
    if (raw === undefined || raw === null) return false;
    const v = String(raw).trim().toLowerCase();
    return v === 'true' || v === '1';
}

/**
 * @param {string} [path]
 * @returns {string|null} capability name or null if not a paid CE path
 */
export function paidCapabilityForPath(path) {
    if (!path || typeof path !== 'string') return null;
    const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
    const lower = normalized.toLowerCase();
    for (const { prefix, capability } of PAID_PATH_PREFIXES) {
        if (lower === prefix || lower.startsWith(`${prefix}/`)) {
            return capability;
        }
    }
    return null;
}

function nonEmptyEnv(name) {
    const v = process.env[name];
    return typeof v === 'string' && v.trim() !== '';
}

/**
 * Fail boot when CE_BUILD is on and paid-link env vars are present.
 * Phase 1b: Stripe + PLAID_CLIENT_ID/PLAID_SECRET + GITHUB_TOKEN.
 *
 * @throws {Error}
 */
export function assertPaidNotLinked() {
    if (!isCeBuild()) return;

    const linked = PAID_LINK_ENV_KEYS.filter(nonEmptyEnv);
    if (linked.length === 0) return;

    throw new Error(
        `CE_BUILD is enabled but paid env is linked: ${linked.join(', ')}. ` +
            'Unset these variables for Community Edition (see docs/architecture/ce-seams.md).'
    );
}

/**
 * Express middleware that responds 403 under CE_BUILD for a named capability.
 * When CE_BUILD is off, calls next().
 *
 * @param {string} name capability id (e.g. "stripe", "rcm")
 * @returns {import('express').RequestHandler}
 */
export function rejectPaidCapability(name) {
    const capability = name || 'paid';
    return function ceRejectPaidCapability(req, res, next) {
        if (!isCeBuild()) {
            return next();
        }
        return res.status(403).json({
            error: 'Not available in Community Edition',
            capability,
        });
    };
}

/**
 * If CE_BUILD and the request path is a paid route, write 403 and return true.
 * Otherwise return false (caller continues).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {boolean}
 */
export function rejectPaidPathIfCe(req, res) {
    if (!isCeBuild()) return false;
    const capability = paidCapabilityForPath(req.path || '');
    if (!capability) return false;
    res.status(403).json({
        error: 'Not available in Community Edition',
        capability,
    });
    return true;
}

export default {
    isCeBuild,
    assertPaidNotLinked,
    rejectPaidCapability,
    rejectPaidPathIfCe,
    paidCapabilityForPath,
    STRIPE_PAID_ENV_KEYS,
    PLAID_PAID_ENV_KEYS,
    GITHUB_PAID_ENV_KEYS,
    PAID_LINK_ENV_KEYS,
};
