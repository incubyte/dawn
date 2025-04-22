export function assert(condition: any, message: string): asserts condition {
    if (import.meta.env.PROD) {
        return;
    }
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

export function assertNotNullOrUndefined(value: any, message: string): asserts value {
    if (import.meta.env.PROD) {
        return;
    }
    if (value === null || typeof value === 'undefined') {
        throw new Error(`Assertion failed: ${message}`);
    }
}


