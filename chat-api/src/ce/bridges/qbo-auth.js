/**
 * CE bridge — loads real paid module unless CE_BUILD (then no-op facade).
 * Export omit may delete the real module; keep this bridge + facade in CE trees.
 * @module ce/bridges/qbo-auth
 */
import { isCeBuild } from '../ce-build.js';

const mod = isCeBuild()
    ? await import('../facades/qbo-auth.js')
    : await import('../../../qbo-auth.js');

export const qboAuth = mod.qboAuth;
export default mod.default ?? mod.qboAuth;
