/**
 * CE bridge — loads real paid module unless CE_BUILD (then no-op facade).
 * Export omit may delete the real module; keep this bridge + facade in CE trees.
 * @module ce/bridges/settlement-posting-service
 */
import { isCeBuild } from '../ce-build.js';

const mod = isCeBuild()
    ? await import('../facades/settlement-posting-service.js')
    : await import('../../../settlement-posting-service.js');

export const settlementPostingService = mod.settlementPostingService;
export default mod.default ?? mod.settlementPostingService;
