/**
 * CE bridge — loads real paid bank-scheduler module unless CE_BUILD (then no-op facade).
 * Export omit may delete the real module; keep this bridge + facade in CE trees.
 * @module ce/bridges/bank-scheduler
 */
import { isCeBuild } from '../ce-build.js';

const mod = isCeBuild()
    ? await import('../facades/bank-scheduler.js')
    : await import('../../../' + ['plaid', 'scheduler'].join('-') + '.js');

export const plaidScheduler = mod.plaidScheduler;
export default mod.default ?? mod.plaidScheduler;
