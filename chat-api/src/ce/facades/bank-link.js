import { createThrowFacade } from './ce-facade.js';

export const plaidService = createThrowFacade('bank-link', {
    getClient() {
        return null;
    },
    async loadConnectionsFromDB() {
        return 0;
    },
});

export default plaidService;
