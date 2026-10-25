/**
 * CE bridge — loads real paid module unless CE_BUILD (then no-op facade).
 * Export omit may delete the real module; keep this bridge + facade in CE trees.
 * @module ce/bridges/adjudication-inbound-facade
 */
import { isCeBuild } from '../ce-build.js';

const mod = isCeBuild()
    ? await import('../facades/adjudication-inbound-facade.js')
    : await import('../../../adjudication-inbound-facade.js');

export const adjudicationInboundFacade = mod.adjudicationInboundFacade;
export default mod.default ?? mod.adjudicationInboundFacade;
