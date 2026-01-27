import { getSession, redirectToLogin, requireAuth } from './auth.js';

(async function () {
    // 1. Sync Check (Fast)
    const session = getSession();
    if (!session || !session.token) {
        // Allow auth.js to handle public page exclusions
        redirectToLogin();
        return;
    }

    // 2. Async Check (Server Validation)
    // We run this to ensure token validity, but we let the page render if local session exists
    // to avoid blocking the UI too much, similar to original guard behavior.
    try {
        await requireAuth();
        // Dispatch event if successful, compatible with original guard expectations
        window.dispatchEvent(new CustomEvent('authValidated', {
            detail: { user: session.user }
        }));
    } catch (e) {
        console.error('Guard auth check failed:', e);
        // requireAuth handles redirect on failure
    }
})();
