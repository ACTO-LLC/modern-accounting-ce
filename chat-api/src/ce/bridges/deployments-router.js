/**
 * CE bridge — loads real paid router unless CE_BUILD (then 403 facade).
 * @module ce/bridges/deployments-router
 */
import { isCeBuild } from '../ce-build.js';

const mod = isCeBuild()
    ? await import('../facades/deployments-router.js')
    : await import('../../routes/deployments.js');

export default mod.default;
