/**
 * CE no-op facade helpers — no paid SDKs or secrets.
 * @module ce/facades/ce-facade
 */

export function ceError(capability) {
    const err = new Error('Not available in Community Edition');
    err.capability = capability || 'paid';
    err.statusCode = 403;
    return err;
}

/**
 * Proxy object: known methods from `methods` (sync/async no-ops or custom);
 * unknown property access returns an async function that throws CE 403.
 *
 * @param {string} capability
 * @param {Record<string, Function>} [methods]
 */
export function createThrowFacade(capability, methods = {}) {
    const asyncThrow = async () => {
        throw ceError(capability);
    };
    const target = { _ceCapability: capability, ...methods };
    return new Proxy(target, {
        get(obj, prop) {
            if (prop === 'then' || prop === 'toJSON' || prop === Symbol.toStringTag) {
                return undefined;
            }
            if (prop in obj) return obj[prop];
            return asyncThrow;
        },
    });
}
