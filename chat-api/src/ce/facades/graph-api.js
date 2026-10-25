/**
 * CE stub for Graph/SSO admin packaging — no @azure Graph SDK.
 * @module ce/facades/graph-api
 */
import { createThrowFacade } from './ce-facade.js';

export const graphApi = createThrowFacade('sso');
export default graphApi;
