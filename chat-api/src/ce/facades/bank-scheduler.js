import { createThrowFacade } from './ce-facade.js';

export const plaidScheduler = createThrowFacade('bank-link', {
    start() {
        /* no-op under CE */
    },
    stop() {
        /* no-op under CE */
    },
    getStatus() {
        return { running: false, capability: 'bank-link', ce: true };
    },
});

export default plaidScheduler;
