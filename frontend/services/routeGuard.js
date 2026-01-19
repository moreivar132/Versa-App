/**
 * VERSA - Route Guard Utilities
 * 
 * Provides route guard functions for protecting pages based on
 * vertical access and permissions.
 * 
 * Usage:
 *   import { enforceVerticalAccess, enforcePermission } from './services/routeGuard.js';
 *   
 *   // At page initialization
 *   await enforceVerticalAccess('manager');  // Redirects if no access
 *   await enforcePermission('manager.workorders.create');  // Redirects if no permission
 */

import accessStore from './accessStore.js';

/**
 * Ensure access store is loaded
 * @returns {Promise<boolean>} true if loaded successfully
 */
async function ensureLoaded() {
    if (accessStore.loaded) return true;

    try {
        await accessStore.load();
        return true;
    } catch (error) {
        console.error('[RouteGuard] Failed to load access store:', error);

        if (error.message === 'Unauthorized' || error.message === 'No authentication token') {
            // Redirect to login
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
            return false;
        }

        return false;
    }
}

/**
 * Enforce vertical access - redirects to 403 if user can't access the vertical
 * @param {string} verticalKey - 'manager' | 'saas' | 'marketplace'
 * @param {Object} options
 * @param {boolean} options.redirect - Whether to redirect (default: true)
 * @param {string} options.redirectUrl - Custom redirect URL
 * @returns {Promise<boolean>} true if access granted
 */
export async function enforceVerticalAccess(verticalKey, options = {}) {
    const { redirect = true, redirectUrl = '/403.html?reason=vertical' } = options;

    if (!await ensureLoaded()) {
        return false;
    }

    const hasAccess = accessStore.canAccessVertical(verticalKey);

    if (!hasAccess && redirect) {
        console.warn(`[RouteGuard] Access denied to vertical: ${verticalKey}`);
        window.location.href = redirectUrl;
        return false;
    }

    return hasAccess;
}

/**
 * Enforce permission - redirects to 403 if user doesn't have permission
 * @param {string} permissionKey - e.g. 'manager.workorders.create'
 * @param {Object} options
 * @param {boolean} options.redirect - Whether to redirect (default: true)
 * @param {string} options.redirectUrl - Custom redirect URL
 * @returns {Promise<boolean>} true if permission granted
 */
export async function enforcePermission(permissionKey, options = {}) {
    const { redirect = true, redirectUrl = '/403.html?reason=permission' } = options;

    if (!await ensureLoaded()) {
        return false;
    }

    const hasPermission = accessStore.can(permissionKey);

    if (!hasPermission && redirect) {
        console.warn(`[RouteGuard] Permission denied: ${permissionKey}`);
        window.location.href = redirectUrl;
        return false;
    }

    return hasPermission;
}

/**
 * Enforce any of multiple permissions
 * @param {string[]} permissionKeys 
 * @param {Object} options
 * @returns {Promise<boolean>}
 */
export async function enforceAnyPermission(permissionKeys, options = {}) {
    const { redirect = true, redirectUrl = '/403.html?reason=permission' } = options;

    if (!await ensureLoaded()) {
        return false;
    }

    const hasAny = accessStore.canAny(permissionKeys);

    if (!hasAny && redirect) {
        console.warn(`[RouteGuard] No permission for any of: ${permissionKeys.join(', ')}`);
        window.location.href = redirectUrl;
        return false;
    }

    return hasAny;
}

/**
 * Check access without redirecting (for conditional rendering)
 * @param {string} verticalKey 
 * @returns {Promise<boolean>}
 */
export async function checkVerticalAccess(verticalKey) {
    return enforceVerticalAccess(verticalKey, { redirect: false });
}

/**
 * Check permission without redirecting (for conditional rendering)
 * @param {string} permissionKey 
 * @returns {Promise<boolean>}
 */
export async function checkPermission(permissionKey) {
    return enforcePermission(permissionKey, { redirect: false });
}

/**
 * Initialize page with guards - commonly used combo
 * @param {Object} requirements
 * @param {string} requirements.vertical - Required vertical
 * @param {string[]} requirements.permissions - Required permissions (any)
 * @returns {Promise<boolean>}
 */
export async function initPageGuards(requirements = {}) {
    const { vertical, permissions } = requirements;

    // Check vertical first
    if (vertical) {
        const verticalOk = await enforceVerticalAccess(vertical);
        if (!verticalOk) return false;
    }

    // Then check permissions
    if (permissions && permissions.length > 0) {
        const permOk = await enforceAnyPermission(permissions);
        if (!permOk) return false;
    }

    return true;
}

// Export access store for convenience
export { accessStore };
