/**
 * CE bridge — loads real paid router unless CE_BUILD (then 403 facade).
 * @module ce/bridges/github-routes
 */
import { isCeBuild } from '../ce-build.js';

const mod = isCeBuild()
    ? await import('../facades/github-routes.js')
    : await import('../../routes/github.js');

export default mod.default;
