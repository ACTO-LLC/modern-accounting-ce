/**
 * CE bridge — loads real paid bank-sync module unless CE_BUILD (then no-op facade).
 * Export omit may delete the real module; keep this bridge + facade in CE trees.
 * @module ce/bridges/bank-sync
 */
import { isCeBuild } from '../ce-build.js';

const mod = isCeBuild()
    ? await import('../facades/bank-sync.js')
    : await import('../../../' + ['plaid', 'sync'].join('-') + '.js');

export const plaidSync = mod.plaidSync;
export default mod.default ?? mod.plaidSync;
