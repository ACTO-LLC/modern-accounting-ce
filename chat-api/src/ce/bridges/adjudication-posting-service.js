/**
 * CE bridge — loads real paid module unless CE_BUILD (then no-op facade).
 * Export omit may delete the real module; keep this bridge + facade in CE trees.
 * @module ce/bridges/adjudication-posting-service
 */
import { isCeBuild } from '../ce-build.js';

const mod = isCeBuild()
    ? await import('../facades/adjudication-posting-service.js')
    : await import('../../../adjudication-posting-service.js');

export const adjudicationPostingService = mod.adjudicationPostingService;
export default mod.default ?? mod.adjudicationPostingService;
