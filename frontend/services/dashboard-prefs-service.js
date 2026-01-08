/**
 * VERSA - Dashboard Preferences Service
 * 
 * Servicio para gestionar preferencias del dashboard con
 * persistencia en API + fallback a localStorage.
 */

import { fetchWithAuth } from '/auth.js';
import { getDefaultVisibleKpis, KPI_DEFINITIONS, KPI_SECTIONS } from './kpi-registry.js';

const STORAGE_KEY = 'versa_dashboard_prefs';
const API_BASE = '/api/dashboard';

// =====================================================
// Estado local (cache)
// =====================================================
let cachedPrefs = null;
let currentRole = 'admin';

// =====================================================
// API Functions
// =====================================================

/**
 * Cargar preferencias del usuario
 * Intenta API primero, fallback a localStorage
 */
export async function loadDashboardPrefs(pageKey = 'home_dashboard', branchId = null) {
    try {
        let url = `${API_BASE}/prefs?page_key=${pageKey}`;
        if (branchId) url += `&branch_id=${branchId}`;

        const response = await fetchWithAuth(url);

        if (response.ok) {
            const data = await response.json();
            cachedPrefs = data.prefs;
            currentRole = data.role || 'admin';

            // También guardar en localStorage como backup
            saveToLocalStorage(pageKey, branchId, cachedPrefs);

            return {
                success: true,
                prefs: cachedPrefs,
                source: data.source,
                role: currentRole
            };
        }

        throw new Error('API unavailable');
    } catch (error) {
        console.warn('Error cargando prefs del API, usando localStorage:', error.message);

        // Fallback a localStorage
        const localPrefs = loadFromLocalStorage(pageKey, branchId);
        if (localPrefs) {
            cachedPrefs = localPrefs;
            return { success: true, prefs: cachedPrefs, source: 'localStorage' };
        }

        // Sin preferencias guardadas, usar defaults
        cachedPrefs = getDefaultPrefs();
        return { success: true, prefs: cachedPrefs, source: 'defaults' };
    }
}

/**
 * Guardar preferencias del usuario
 */
export async function saveDashboardPrefs(prefs, pageKey = 'home_dashboard', branchId = null) {
    // Actualizar cache local
    cachedPrefs = { ...cachedPrefs, ...prefs };

    // Guardar en localStorage inmediatamente (para responsive UI)
    saveToLocalStorage(pageKey, branchId, cachedPrefs);

    try {
        const response = await fetchWithAuth(`${API_BASE}/prefs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                page_key: pageKey,
                branch_id: branchId,
                prefs_json: prefs
            })
        });

        if (response.ok) {
            const data = await response.json();
            cachedPrefs = data.prefs;
            return { success: true, prefs: cachedPrefs };
        }

        throw new Error('Error saving to API');
    } catch (error) {
        console.warn('Error guardando prefs en API (localStorage OK):', error.message);
        return { success: true, prefs: cachedPrefs, source: 'localStorage' };
    }
}

/**
 * Resetear preferencias a defaults del rol
 */
export async function resetDashboardPrefs(pageKey = 'home_dashboard', branchId = null) {
    try {
        let url = `${API_BASE}/prefs?page_key=${pageKey}`;
        if (branchId) url += `&branch_id=${branchId}`;

        const response = await fetchWithAuth(url, { method: 'DELETE' });

        if (response.ok) {
            const data = await response.json();
            cachedPrefs = data.prefs;

            // Limpiar localStorage
            removeFromLocalStorage(pageKey, branchId);

            return { success: true, prefs: cachedPrefs, role: data.role };
        }

        throw new Error('Error resetting via API');
    } catch (error) {
        console.warn('Error reseteando prefs:', error.message);

        // Fallback: usar defaults locales
        cachedPrefs = getDefaultPrefs();
        removeFromLocalStorage(pageKey, branchId);

        return { success: true, prefs: cachedPrefs, source: 'defaults' };
    }
}

// =====================================================
// Helpers de Preferencias
// =====================================================

/**
 * Obtener preferencias actuales (cache)
 */
export function getCurrentPrefs() {
    return cachedPrefs || getDefaultPrefs();
}

/**
 * Obtener defaults para el rol actual
 */
export function getDefaultPrefs(role = currentRole) {
    return {
        visible_kpis: getDefaultVisibleKpis(role),
        order: KPI_DEFINITIONS.map(k => k.id),
        density: 'normal',
        collapsed_sections: [],
        legend_mode: 'chips'
    };
}

/**
 * Verificar si un KPI es visible
 */
export function isKpiVisible(kpiId) {
    const prefs = getCurrentPrefs();
    if (!prefs.visible_kpis) return true;
    return prefs.visible_kpis.includes(kpiId);
}

/**
 * Toggle visibilidad de un KPI
 */
export async function toggleKpiVisibility(kpiId, pageKey = 'home_dashboard', branchId = null) {
    const prefs = getCurrentPrefs();
    let visible_kpis = [...(prefs.visible_kpis || [])];

    if (visible_kpis.includes(kpiId)) {
        visible_kpis = visible_kpis.filter(id => id !== kpiId);
    } else {
        visible_kpis.push(kpiId);
    }

    return saveDashboardPrefs({ visible_kpis }, pageKey, branchId);
}

/**
 * Verificar si una sección está colapsada
 */
export function isSectionCollapsed(sectionId) {
    const prefs = getCurrentPrefs();
    if (!prefs.collapsed_sections) return false;
    return prefs.collapsed_sections.includes(sectionId);
}

/**
 * Toggle colapso de sección
 */
export async function toggleSectionCollapse(sectionId, pageKey = 'home_dashboard', branchId = null) {
    const prefs = getCurrentPrefs();
    let collapsed_sections = [...(prefs.collapsed_sections || [])];

    if (collapsed_sections.includes(sectionId)) {
        collapsed_sections = collapsed_sections.filter(id => id !== sectionId);
    } else {
        collapsed_sections.push(sectionId);
    }

    return saveDashboardPrefs({ collapsed_sections }, pageKey, branchId);
}

/**
 * Obtener densidad actual
 */
export function getDensity() {
    return getCurrentPrefs().density || 'normal';
}

/**
 * Cambiar densidad
 */
export async function setDensity(density, pageKey = 'home_dashboard', branchId = null) {
    if (!['compacto', 'normal'].includes(density)) return;
    return saveDashboardPrefs({ density }, pageKey, branchId);
}

/**
 * Obtener modo de leyenda
 */
export function getLegendMode() {
    return getCurrentPrefs().legend_mode || 'chips';
}

// =====================================================
// LocalStorage Helpers
// =====================================================

function getStorageKey(pageKey, branchId) {
    return `${STORAGE_KEY}_${pageKey}${branchId ? `_${branchId}` : ''}`;
}

function saveToLocalStorage(pageKey, branchId, prefs) {
    try {
        const key = getStorageKey(pageKey, branchId);
        localStorage.setItem(key, JSON.stringify(prefs));
    } catch (e) {
        console.warn('Error saving to localStorage:', e);
    }
}

function loadFromLocalStorage(pageKey, branchId) {
    try {
        const key = getStorageKey(pageKey, branchId);
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.warn('Error loading from localStorage:', e);
        return null;
    }
}

function removeFromLocalStorage(pageKey, branchId) {
    try {
        const key = getStorageKey(pageKey, branchId);
        localStorage.removeItem(key);
    } catch (e) {
        console.warn('Error removing from localStorage:', e);
    }
}
