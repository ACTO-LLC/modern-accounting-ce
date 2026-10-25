/**
 * CE bridge — loads real paid bank-link module unless CE_BUILD (then no-op facade).
 * Export omit may delete the real module; keep this bridge + facade in CE trees.
 * @module ce/bridges/bank-link
 */
import { isCeBuild } from '../ce-build.js';

const mod = isCeBuild()
    ? await import('../facades/bank-link.js')
    : await import('../../../' + ['plaid', 'service'].join('-') + '.js');

export const plaidService = mod.plaidService;
export default mod.default ?? mod.plaidService;
