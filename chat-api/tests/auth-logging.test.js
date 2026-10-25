/**
 * Tests for auth trace-logging gating.
 *
 * Default-deny (issue #646) means validateJWT runs on every request, so the
 * verbose traces — which include the authenticated user's email address — must
 * not reach production logs.
 */
import { describe, it, expect } from 'vitest';
import { isAuthDebugEnabled } from '../src/middleware/auth.js';

describe('isAuthDebugEnabled', () => {
    it('is off in production by default, keeping user emails out of the logs', () => {
        expect(isAuthDebugEnabled({ NODE_ENV: 'production' })).toBe(false);
    });

    it('is on in development, where the traces are useful', () => {
        expect(isAuthDebugEnabled({ NODE_ENV: 'development' })).toBe(true);
    });

    it('is on when NODE_ENV is unset (bare local runs)', () => {
        expect(isAuthDebugEnabled({})).toBe(true);
    });

    it('can be switched on in production deliberately, for incident triage', () => {
        expect(isAuthDebugEnabled({ NODE_ENV: 'production', AUTH_DEBUG: 'true' })).toBe(true);
    });

    it('can be switched off outside production', () => {
        expect(isAuthDebugEnabled({ NODE_ENV: 'development', AUTH_DEBUG: 'false' })).toBe(false);
    });

    it('ignores a non-boolean AUTH_DEBUG rather than treating it as enabled', () => {
        expect(isAuthDebugEnabled({ NODE_ENV: 'production', AUTH_DEBUG: '1' })).toBe(false);
        expect(isAuthDebugEnabled({ NODE_ENV: 'production', AUTH_DEBUG: 'yes' })).toBe(false);
    });
});
