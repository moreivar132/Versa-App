/**
 * VERSA - Access Store
 * 
 * Centralized client-side store for user access information.
 * Caches verticals, permissions, branches, and roles from /api/me/access.
 * 
 * Usage:
 *   import accessStore from './services/accessStore.js';
 *   
 *   await accessStore.load();
 *   if (accessStore.canAccessVertical('manager')) { ... }
 *   if (accessStore.can('manager.workorders.create')) { ... }
 */

const API_BASE = window.API_BASE_URL || '';

const accessStore = {
    // State
    verticals: [],
    permissions: [],
    branches: [],
    roles: [],
    loaded: false,
    loading: false,
    error: null,

    /**
     * Load access info from API
     * @param {boolean} force - Force reload even if already loaded
     * @returns {Promise<void>}
     */
    async load(force = false) {
        if (this.loaded && !force) {
            return;
        }

        if (this.loading) {
            // Wait for existing load to complete
            return new Promise((resolve) => {
                const check = setInterval(() => {
                    if (!this.loading) {
                        clearInterval(check);
                        resolve();
                    }
                }, 100);
            });
        }

        this.loading = true;
        this.error = null;

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token');
            }

            const response = await fetch(`${API_BASE}/api/me/access`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized');
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            this.verticals = data.verticals || [];
            this.permissions = data.permissions || [];
            this.branches = data.branches || [];
            this.roles = data.roles || [];
            this.loaded = true;

            console.log('[AccessStore] Loaded:', {
                verticals: this.verticals.length,
                permissions: this.permissions.length,
                branches: this.branches.length,
                roles: this.roles.length
            });

        } catch (error) {
            console.error('[AccessStore] Load error:', error);
            this.error = error.message;
            throw error;
        } finally {
            this.loading = false;
        }
    },

    /**
     * Reset store (on logout)
     */
    reset() {
        this.verticals = [];
        this.permissions = [];
        this.branches = [];
        this.roles = [];
        this.loaded = false;
        this.loading = false;
        this.error = null;
    },

    /**
     * Check if user can access a vertical
     * @param {string} verticalKey - 'manager' | 'saas' | 'marketplace'
     * @returns {boolean}
     */
    canAccessVertical(verticalKey) {
        if (!this.loaded) {
            console.warn('[AccessStore] Not loaded yet, call load() first');
            return false;
        }

        // Super admin check (has '*' permission)
        if (this.permissions.includes('*')) {
            return true;
        }

        const vertical = this.verticals.find(v => v.key === verticalKey);
        return vertical?.enabled === true;
    },

    /**
     * Check if user has a specific permission
     * @param {string} permissionKey - e.g. 'manager.workorders.create'
     * @returns {boolean}
     */
    can(permissionKey) {
        if (!this.loaded) {
            console.warn('[AccessStore] Not loaded yet, call load() first');
            return false;
        }

        // Super admin has all permissions
        if (this.permissions.includes('*')) {
            return true;
        }

        return this.permissions.includes(permissionKey);
    },

    /**
     * Check if user has any of the specified permissions
     * @param {string[]} permissionKeys 
     * @returns {boolean}
     */
    canAny(permissionKeys) {
        return permissionKeys.some(p => this.can(p));
    },

    /**
     * Check if user has all of the specified permissions
     * @param {string[]} permissionKeys 
     * @returns {boolean}
     */
    canAll(permissionKeys) {
        return permissionKeys.every(p => this.can(p));
    },

    /**
     * Get enabled verticals
     * @returns {Array<{key: string, name: string, enabled: boolean}>}
     */
    getEnabledVerticals() {
        return this.verticals.filter(v => v.enabled);
    },

    /**
     * Get user's accessible branches
     * @returns {Array<{id: number, nombre: string}>}
     */
    getBranches() {
        return this.branches;
    },

    /**
     * Get user's roles
     * @returns {Array<{id: number, key: string, nombre: string}>}
     */
    getRoles() {
        return this.roles;
    },

    /**
     * Check if user is super admin
     * @returns {boolean}
     */
    isSuperAdmin() {
        return this.permissions.includes('*');
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = accessStore;
}

// Export for ES modules
export default accessStore;
