/**
 * VERSA - KpiCard Component
 * 
 * Componente reutilizable para mostrar KPIs en el dashboard
 * con 3 variantes: hero, standard, compact
 * 
 * Features:
 * - Badge de origen (Global/Taller/Marketplace/Ledger)
 * - Tooltip accesible (hover + focus)
 * - Botón de ocultar rápido
 * - Drill-down al hacer click
 */

import { getKpiById, getKpiColor, getBadgeColor, getBadgeLabel, formatKpiValue } from '../services/kpi-registry.js';
import { toggleKpiVisibility } from '../services/dashboard-prefs-service.js';

// =====================================================
// Render Functions
// =====================================================

/**
 * Renderizar una tarjeta KPI
 * 
 * @param {Object} options
 * @param {string} options.kpiId - ID del KPI desde el registry
 * @param {any} options.value - Valor a mostrar
 * @param {string} [options.subValue] - Valor secundario (opcional)
 * @param {boolean} [options.showHideButton] - Mostrar botón ocultar
 * @param {Function} [options.onHide] - Callback cuando se oculta
 * @returns {string} HTML de la tarjeta
 */
export function renderKpiCard({ kpiId, value, subValue = null, showHideButton = false, onHide = null }) {
    const kpi = getKpiById(kpiId);
    if (!kpi) {
        console.warn(`KPI not found: ${kpiId}`);
        return '';
    }

    const color = getKpiColor(kpi.color);
    const badge = getBadgeColor(kpi.badge_origin);
    const badgeLabel = getBadgeLabel(kpi.badge_origin);
    const formattedValue = formatKpiValue(value, kpi.format);

    switch (kpi.weight) {
        case 'hero':
            return renderHeroCard(kpi, formattedValue, subValue, color, badge, badgeLabel, showHideButton);
        case 'standard':
            return renderStandardCard(kpi, formattedValue, subValue, color, badge, badgeLabel, showHideButton);
        case 'compact':
        default:
            return renderCompactCard(kpi, formattedValue, subValue, color, badge, badgeLabel, showHideButton);
    }
}

/**
 * Renderizar tarjeta Hero (grande)
 */
function renderHeroCard(kpi, value, subValue, color, badge, badgeLabel, showHideButton) {
    const drilldownAttr = kpi.drilldown ? `onclick="window.location='${kpi.drilldown}'"` : '';
    const cursorClass = kpi.drilldown ? 'cursor-pointer' : '';

    return `
        <div class="kpi-card kpi-card-hero ${cursorClass}" 
             data-kpi-id="${kpi.id}"
             ${drilldownAttr}
             aria-label="${kpi.label}: ${value}">
            <div class="kpi-card-accent" style="background: ${color.main}20;"></div>
            <div class="kpi-card-header">
                <div class="kpi-label-row">
                    <p class="kpi-label">${kpi.label}</p>
                    ${renderBadge(badge, badgeLabel)}
                    ${renderTooltipTrigger(kpi)}
                </div>
                <div class="kpi-icon-container" style="background: ${color.bg};">
                    <span class="material-symbols-outlined" style="color: ${color.main};">${kpi.icon}</span>
                </div>
            </div>
            <div class="kpi-value-row">
                <p class="kpi-value kpi-value-hero" style="--hover-color: ${color.main};">${value}</p>
                ${showHideButton ? renderHideButton(kpi.id) : ''}
            </div>
            ${subValue ? `<p class="kpi-subvalue">${subValue}</p>` : ''}
            ${renderTooltipContent(kpi)}
        </div>
    `;
}

/**
 * Renderizar tarjeta Standard (mediana)
 */
function renderStandardCard(kpi, value, subValue, color, badge, badgeLabel, showHideButton) {
    const drilldownAttr = kpi.drilldown ? `onclick="window.location='${kpi.drilldown}'"` : '';
    const cursorClass = kpi.drilldown ? 'cursor-pointer' : '';

    return `
        <div class="kpi-card kpi-card-standard ${cursorClass}" 
             data-kpi-id="${kpi.id}"
             ${drilldownAttr}
             aria-label="${kpi.label}: ${value}">
            <div class="kpi-card-gradient" style="background: linear-gradient(to bottom, ${color.main}, ${color.main}80);"></div>
            <div class="kpi-card-header">
                <div class="kpi-label-row">
                    <p class="kpi-label">${kpi.label}</p>
                    ${renderBadge(badge, badgeLabel)}
                    ${renderTooltipTrigger(kpi)}
                </div>
                <div class="kpi-icon-container" style="background: ${color.bg};">
                    <span class="material-symbols-outlined" style="color: ${color.main};">${kpi.icon}</span>
                </div>
            </div>
            <div class="kpi-value-row">
                <p class="kpi-value kpi-value-standard" style="--hover-color: ${color.main};">${value}</p>
                ${showHideButton ? renderHideButton(kpi.id) : ''}
            </div>
            ${subValue ? `<p class="kpi-subvalue">${subValue}</p>` : ''}
            ${renderTooltipContent(kpi)}
        </div>
    `;
}

/**
 * Renderizar tarjeta Compact (fila)
 */
function renderCompactCard(kpi, value, subValue, color, badge, badgeLabel, showHideButton) {
    const drilldownAttr = kpi.drilldown ? `onclick="window.location='${kpi.drilldown}'"` : '';
    const cursorClass = kpi.drilldown ? 'cursor-pointer' : '';

    return `
        <div class="kpi-card kpi-card-compact ${cursorClass}" 
             data-kpi-id="${kpi.id}"
             ${drilldownAttr}
             aria-label="${kpi.label}: ${value}">
            <div class="kpi-compact-left">
                <div class="kpi-icon-small" style="background: ${color.bg};">
                    <span class="material-symbols-outlined" style="color: ${color.main}; font-size: 18px;">${kpi.icon}</span>
                </div>
                <div class="kpi-compact-info">
                    <span class="kpi-label-compact">${kpi.label}</span>
                    ${renderBadge(badge, badgeLabel, true)}
                </div>
            </div>
            <div class="kpi-compact-right">
                <p class="kpi-value kpi-value-compact" style="--hover-color: ${color.main};">${value}</p>
                ${renderTooltipTrigger(kpi, true)}
                ${showHideButton ? renderHideButton(kpi.id, true) : ''}
            </div>
            ${renderTooltipContent(kpi)}
        </div>
    `;
}

// =====================================================
// Helper Renders
// =====================================================

function renderBadge(badge, label, small = false) {
    const sizeClass = small ? 'kpi-badge-small' : 'kpi-badge';
    return `
        <span class="${sizeClass}" 
              style="background: ${badge.bg}; color: ${badge.text}; border-color: ${badge.border};">
            ${label}
        </span>
    `;
}

function renderTooltipTrigger(kpi, small = false) {
    const sizeClass = small ? 'text-sm' : 'text-base';
    return `
        <button class="kpi-tooltip-trigger ${sizeClass}" 
                aria-describedby="tooltip-${kpi.id}"
                tabindex="0">
            <span class="material-symbols-outlined" style="font-size: inherit;">info</span>
        </button>
    `;
}

function renderTooltipContent(kpi) {
    const tooltip = kpi.tooltip || {};
    return `
        <div class="kpi-tooltip-content" id="tooltip-${kpi.id}" role="tooltip">
            <div class="kpi-tooltip-title">${kpi.label}</div>
            ${tooltip.definition ? `<p class="kpi-tooltip-text">${tooltip.definition}</p>` : ''}
            ${tooltip.formula ? `<p class="kpi-tooltip-formula"><strong>Fórmula:</strong> ${tooltip.formula}</p>` : ''}
            ${tooltip.source ? `<p class="kpi-tooltip-source"><strong>Fuente:</strong> ${tooltip.source}</p>` : ''}
            ${tooltip.exclusion ? `<p class="kpi-tooltip-exclusion">⚠️ ${tooltip.exclusion}</p>` : ''}
        </div>
    `;
}

function renderHideButton(kpiId, small = false) {
    const sizeClass = small ? 'kpi-hide-btn-small' : 'kpi-hide-btn';
    return `
        <button class="${sizeClass}" 
                data-hide-kpi="${kpiId}"
                title="Ocultar este KPI"
                aria-label="Ocultar ${kpiId}">
            <span class="material-symbols-outlined" style="font-size: 16px;">visibility_off</span>
        </button>
    `;
}

// =====================================================
// Section Renderer
// =====================================================

/**
 * Renderizar una sección colapsable del dashboard
 */
export function renderDashboardSection({ section, kpis, isCollapsed = false, onToggle = null }) {
    const collapseIcon = isCollapsed ? 'expand_more' : 'expand_less';
    const contentClass = isCollapsed ? 'hidden' : '';

    return `
        <section class="dashboard-section" data-section-id="${section.id}">
            <div class="dashboard-section-header" onclick="toggleDashboardSection('${section.id}')">
                <div class="section-title-row">
                    <span class="material-symbols-outlined section-icon">${section.icon}</span>
                    <div class="section-title-text">
                        <h2 class="section-title">${section.title}</h2>
                        <p class="section-description">${section.description}</p>
                    </div>
                </div>
                <button class="section-collapse-btn" aria-expanded="${!isCollapsed}" aria-label="Colapsar sección">
                    <span class="material-symbols-outlined">${collapseIcon}</span>
                </button>
            </div>
            <div class="dashboard-section-content ${contentClass}" id="section-content-${section.id}">
                ${kpis}
            </div>
        </section>
    `;
}

// =====================================================
// Legend Component
// =====================================================

/**
 * Renderizar la leyenda del dashboard
 */
export function renderDashboardLegend({ period, branch, mode = 'chips' }) {
    if (mode === 'popover') {
        return renderLegendPopover(period, branch);
    }
    return renderLegendChips(period, branch);
}

function renderLegendChips(period, branch) {
    return `
        <div class="dashboard-legend" role="region" aria-label="Leyenda del dashboard">
            <div class="legend-chips">
                <span class="legend-chip legend-chip-period">
                    <span class="material-symbols-outlined" style="font-size: 14px;">calendar_today</span>
                    ${period}
                </span>
                ${branch ? `
                    <span class="legend-chip legend-chip-branch">
                        <span class="material-symbols-outlined" style="font-size: 14px;">store</span>
                        ${branch}
                    </span>
                ` : ''}
                <span class="legend-chip legend-chip-taller" title="Origen: Taller">
                    <span class="legend-dot" style="background: #f59e0b;"></span>
                    Taller
                </span>
                <span class="legend-chip legend-chip-marketplace" title="Origen: Marketplace">
                    <span class="legend-dot" style="background: #06b6d4;"></span>
                    Marketplace
                </span>
                <span class="legend-chip legend-chip-ledger" title="Origen: Ledger">
                    <span class="legend-dot" style="background: #22c55e;"></span>
                    Ledger
                </span>
            </div>
        </div>
    `;
}

function renderLegendPopover(period, branch) {
    return `
        <div class="dashboard-legend dashboard-legend-mobile" role="region" aria-label="Leyenda del dashboard">
            <button class="legend-popover-trigger" aria-haspopup="true" aria-expanded="false">
                <span class="material-symbols-outlined">info</span>
                <span>Leyenda</span>
            </button>
            <div class="legend-popover-content">
                <div class="legend-popover-item">
                    <span class="material-symbols-outlined">calendar_today</span>
                    <span>${period}</span>
                </div>
                ${branch ? `
                    <div class="legend-popover-item">
                        <span class="material-symbols-outlined">store</span>
                        <span>${branch}</span>
                    </div>
                ` : ''}
                <hr class="legend-divider">
                <div class="legend-popover-item">
                    <span class="legend-dot" style="background: #f59e0b;"></span>
                    <span>Taller</span>
                </div>
                <div class="legend-popover-item">
                    <span class="legend-dot" style="background: #06b6d4;"></span>
                    <span>Marketplace</span>
                </div>
                <div class="legend-popover-item">
                    <span class="legend-dot" style="background: #22c55e;"></span>
                    <span>Ledger</span>
                </div>
            </div>
        </div>
    `;
}

// =====================================================
// Preferences Drawer
// =====================================================

/**
 * Renderizar el drawer de personalización
 */
export function renderPreferencesDrawer({ kpisBySection, visibleKpis, density, onClose }) {
    let sectionsHtml = '';

    for (const [sectionId, sectionData] of Object.entries(kpisBySection)) {
        const kpisHtml = sectionData.kpis.map(kpi => {
            const isVisible = visibleKpis.includes(kpi.id);
            return `
                <label class="prefs-kpi-item">
                    <span class="prefs-kpi-label">${kpi.label}</span>
                    <input type="checkbox" 
                           class="prefs-kpi-toggle" 
                           data-kpi-id="${kpi.id}"
                           ${isVisible ? 'checked' : ''}>
                    <span class="prefs-toggle-slider"></span>
                </label>
            `;
        }).join('');

        sectionsHtml += `
            <div class="prefs-section">
                <h4 class="prefs-section-title">
                    <span class="material-symbols-outlined">${sectionData.section.icon}</span>
                    ${sectionData.section.title}
                </h4>
                <div class="prefs-kpi-list">
                    ${kpisHtml}
                </div>
            </div>
        `;
    }

    return `
        <div class="prefs-drawer-overlay" id="prefs-drawer-overlay" onclick="closePreferencesDrawer()"></div>
        <div class="prefs-drawer" id="prefs-drawer" role="dialog" aria-modal="true" aria-labelledby="prefs-title">
            <div class="prefs-drawer-header">
                <div class="prefs-title-row">
                    <span class="material-symbols-outlined">visibility</span>
                    <h3 id="prefs-title">Personalizar Dashboard</h3>
                </div>
                <button class="prefs-close-btn" onclick="closePreferencesDrawer()" aria-label="Cerrar">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            
            <div class="prefs-drawer-content">
                <div class="prefs-density-section">
                    <label class="prefs-density-label">Densidad:</label>
                    <div class="prefs-density-options">
                        <button class="prefs-density-btn ${density === 'compacto' ? 'active' : ''}" 
                                data-density="compacto">
                            Compacto
                        </button>
                        <button class="prefs-density-btn ${density === 'normal' ? 'active' : ''}" 
                                data-density="normal">
                            Normal
                        </button>
                    </div>
                </div>
                
                <div class="prefs-sections-container">
                    ${sectionsHtml}
                </div>
            </div>
            
            <div class="prefs-drawer-footer">
                <button class="prefs-reset-btn" onclick="resetPreferencesToDefaults()">
                    <span class="material-symbols-outlined">restart_alt</span>
                    Restaurar predeterminados
                </button>
            </div>
        </div>
    `;
}

// =====================================================
// Event Handlers (to be attached)
// =====================================================

/**
 * Inicializar event listeners para KPIs
 */
export function initKpiCardEvents() {
    // Tooltip hover/focus
    document.querySelectorAll('.kpi-tooltip-trigger').forEach(trigger => {
        const card = trigger.closest('.kpi-card');
        const tooltip = card?.querySelector('.kpi-tooltip-content');

        if (tooltip) {
            trigger.addEventListener('mouseenter', () => tooltip.classList.add('visible'));
            trigger.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
            trigger.addEventListener('focus', () => tooltip.classList.add('visible'));
            trigger.addEventListener('blur', () => tooltip.classList.remove('visible'));
        }
    });

    // Hide buttons
    document.querySelectorAll('[data-hide-kpi]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const kpiId = btn.dataset.hideKpi;
            await toggleKpiVisibility(kpiId);
            // Trigger a refresh of the dashboard
            if (typeof window.refreshDashboard === 'function') {
                window.refreshDashboard();
            }
        });
    });
}

/**
 * Inicializar toggle de secciones
 */
window.toggleDashboardSection = function (sectionId) {
    const content = document.getElementById(`section-content-${sectionId}`);
    const header = document.querySelector(`[data-section-id="${sectionId}"] .section-collapse-btn`);
    const icon = header?.querySelector('.material-symbols-outlined');

    if (content && icon) {
        const isHidden = content.classList.contains('hidden');
        content.classList.toggle('hidden');
        icon.textContent = isHidden ? 'expand_less' : 'expand_more';
        header.setAttribute('aria-expanded', isHidden);

        // Save preference
        import('../services/dashboard-prefs-service.js').then(module => {
            module.toggleSectionCollapse(sectionId);
        });
    }
};
