import { createThrowFacade } from './ce-facade.js';

export const qboAuth = createThrowFacade('qbo', {
    async loadConnectionsFromDB() {
        return 0;
    },
    async getStatus() {
        return { connected: false, capability: 'qbo', ce: true };
    },
});

export default qboAuth;
