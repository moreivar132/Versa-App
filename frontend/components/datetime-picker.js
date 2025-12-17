/**
 * VERSA DateTime Picker Component
 * Componente reutilizable para selección de fecha y hora
 * Incluye: Calendario bonito + Reloj circular (24h)
 * 
 * Uso:
 * import { initDateTimePicker, initDatePicker, initTimePicker } from './components/datetime-picker.js';
 * 
 * // Para fecha + hora
 * initDateTimePicker('mi-input-id');
 * 
 * // Solo fecha
 * initDatePicker('mi-input-fecha');
 * 
 * // Solo hora
 * initTimePicker('mi-input-hora');
 */

// ========================================
// ESTILOS CSS (se inyectan automáticamente)
// ========================================
const DATETIME_PICKER_STYLES = `
/* DateTime Picker Estilos */
.versa-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: none;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.versa-picker-overlay.show {
  display: flex;
}

.versa-picker-card {
  background: #1a1a1a;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  width: 320px;
  animation: versaFadeInUp 0.3s ease;
}

@keyframes versaFadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.versa-picker-header {
  background: #ff5f00;
  padding: 20px;
  text-align: center;
}

.versa-picker-header-title {
  font-size: 14px;
  opacity: 0.8;
  color: white;
  margin-bottom: 5px;
}

.versa-picker-header-value {
  font-size: 28px;
  font-weight: 600;
  color: white;
  font-family: 'Montserrat', sans-serif;
}

.versa-picker-body {
  padding: 20px;
}

/* Calendario */
.versa-calendar-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.versa-calendar-nav-btn {
  background: transparent;
  border: none;
  color: #ff5f00;
  font-size: 18px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background 0.2s;
}

.versa-calendar-nav-btn:hover {
  background: rgba(255, 95, 0, 0.1);
}

.versa-calendar-month-year {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.versa-calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 10px;
}

.versa-calendar-weekday {
  text-align: center;
  font-size: 12px;
  color: #888;
  padding: 5px;
  font-weight: 500;
}

.versa-calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.versa-calendar-day {
  aspect-ratio: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: transparent;
}

.versa-calendar-day:hover:not(.empty):not(.selected) {
  background: rgba(255, 95, 0, 0.2);
}

.versa-calendar-day.empty {
  cursor: default;
}

.versa-calendar-day.today {
  border: 2px solid #ff5f00;
}

.versa-calendar-day.selected {
  background: #ff5f00;
  color: white;
  box-shadow: 0 0 15px rgba(255, 95, 0, 0.5);
}

.versa-calendar-day.other-month {
  color: #555;
}

/* Time Picker */
.versa-time-display {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 48px;
  font-weight: 300;
  color: white;
  font-family: 'Montserrat', sans-serif;
}

.versa-time-display span {
  padding: 5px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.versa-time-display span.active {
  background: rgba(255, 255, 255, 0.2);
}

.versa-time-display span:hover {
  background: rgba(255, 255, 255, 0.15);
}

.versa-time-separator {
  margin: 0 5px;
}

.versa-time-tabs {
  display: flex;
  margin-bottom: 15px;
  background: #252525;
  border-radius: 8px;
  padding: 4px;
}

.versa-time-tab {
  flex: 1;
  padding: 8px 20px;
  border: none;
  background: transparent;
  color: #888;
  cursor: pointer;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s;
}

.versa-time-tab.active {
  background: #ff5f00;
  color: white;
}

.versa-clock {
  position: relative;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: #252525;
  margin: 0 auto 20px;
}

.versa-clock-face {
  position: absolute;
  width: 100%;
  height: 100%;
}

.versa-clock-number {
  position: absolute;
  width: 36px;
  height: 36px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  font-size: 14px;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.versa-clock-number:hover {
  background: rgba(255, 95, 0, 0.2);
}

.versa-clock-number.selected {
  background: #ff5f00;
  color: white;
  box-shadow: 0 0 15px rgba(255, 95, 0, 0.5);
}

.versa-clock-number.inner {
  font-size: 12px;
  color: #888;
}

.versa-clock-hand {
  position: absolute;
  bottom: 50%;
  left: 50%;
  width: 2px;
  background: #ff5f00;
  transform-origin: bottom center;
  transform: translateX(-50%);
  transition: transform 0.2s ease, height 0.2s ease;
}

.versa-clock-center {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  background: #ff5f00;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

/* Actions */
.versa-picker-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 15px;
  border-top: 1px solid #333;
}

.versa-picker-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  font-size: 14px;
}

.versa-picker-btn.cancel {
  background: transparent;
  color: #888;
}

.versa-picker-btn.cancel:hover {
  background: rgba(255, 255, 255, 0.1);
}

.versa-picker-btn.ok {
  background: #ff5f00;
  color: white;
}

.versa-picker-btn.ok:hover {
  background: #e04400;
  box-shadow: 0 0 15px rgba(255, 95, 0, 0.4);
}

/* DateTime Combined */
.versa-datetime-tabs {
  display: flex;
  margin-bottom: 15px;
  background: #252525;
  border-radius: 8px;
  padding: 4px;
}

.versa-datetime-tab {
  flex: 1;
  padding: 10px 20px;
  border: none;
  background: transparent;
  color: #888;
  cursor: pointer;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.versa-datetime-tab.active {
  background: #ff5f00;
  color: white;
}

/* Input styling */
.versa-datetime-input {
  width: 100%;
  padding: 10px 40px 10px 12px;
  background: var(--input-bg, #1a1a1a);
  border: 1px solid var(--input-border, #333);
  border-radius: 8px;
  color: var(--text-primary, #fff);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.versa-datetime-input:hover,
.versa-datetime-input:focus {
  border-color: #ff5f00;
  outline: none;
}

.versa-datetime-container {
  position: relative;
  display: inline-block;
  width: 100%;
}

.versa-datetime-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #888;
  pointer-events: none;
}
`;

// ========================================
// INYECCIÓN DE ESTILOS
// ========================================
function injectStyles() {
    if (!document.getElementById('versa-datetime-picker-styles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'versa-datetime-picker-styles';
        styleTag.textContent = DATETIME_PICKER_STYLES;
        document.head.appendChild(styleTag);
    }
}

// ========================================
// MESES Y DÍAS EN ESPAÑOL
// ========================================
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

// ========================================
// CREAR MODAL HTML
// ========================================
function createPickerModal(id, type = 'datetime') {
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'versa-picker-overlay';

    let tabsHTML = '';
    if (type === 'datetime') {
        tabsHTML = `
      <div class="versa-datetime-tabs">
        <button type="button" class="versa-datetime-tab active" data-mode="date">
          <i class="fas fa-calendar"></i> Fecha
        </button>
        <button type="button" class="versa-datetime-tab" data-mode="time">
          <i class="fas fa-clock"></i> Hora
        </button>
      </div>
    `;
    }

    modal.innerHTML = `
    <div class="versa-picker-card">
      <div class="versa-picker-header">
        <div class="versa-picker-header-title">Seleccionar ${type === 'time' ? 'Hora' : type === 'date' ? 'Fecha' : 'Fecha y Hora'}</div>
        <div class="versa-picker-header-value" id="${id}-header-value">--</div>
      </div>
      <div class="versa-picker-body">
        ${tabsHTML}
        
        <!-- Contenedor del Calendario -->
        <div id="${id}-calendar-container" style="${type === 'time' ? 'display:none' : ''}">
          <div class="versa-calendar-nav">
            <button type="button" class="versa-calendar-nav-btn" id="${id}-prev-month">
              <i class="fas fa-chevron-left"></i>
            </button>
            <span class="versa-calendar-month-year" id="${id}-month-year"></span>
            <button type="button" class="versa-calendar-nav-btn" id="${id}-next-month">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
          <div class="versa-calendar-weekdays">
            ${WEEKDAYS.map(d => `<span class="versa-calendar-weekday">${d}</span>`).join('')}
          </div>
          <div class="versa-calendar-days" id="${id}-days"></div>
        </div>
        
        <!-- Contenedor del Reloj -->
        <div id="${id}-time-container" style="${type === 'date' ? 'display:none' : type === 'datetime' ? 'display:none' : ''}">
          <div class="versa-time-tabs">
            <button type="button" class="versa-time-tab active" id="${id}-tab-hours">Hora</button>
            <button type="button" class="versa-time-tab" id="${id}-tab-minutes">Min</button>
          </div>
          <div class="versa-clock" id="${id}-clock">
            <div class="versa-clock-face" id="${id}-clock-face"></div>
            <div class="versa-clock-center"></div>
            <div class="versa-clock-hand" id="${id}-hand"></div>
          </div>
        </div>
        
        <div class="versa-picker-actions">
          <button type="button" class="versa-picker-btn cancel" id="${id}-cancel">Cancelar</button>
          <button type="button" class="versa-picker-btn ok" id="${id}-ok">OK</button>
        </div>
      </div>
    </div>
  `;

    document.body.appendChild(modal);
    return modal;
}

// ========================================
// CLASE PRINCIPAL DEL PICKER
// ========================================
class VersaPicker {
    constructor(inputId, type = 'datetime') {
        this.inputId = inputId;
        this.type = type;
        this.modalId = `versa-picker-${inputId}`;
        this.input = document.getElementById(inputId);

        if (!this.input) {
            console.error(`VersaPicker: No se encontró el input con id "${inputId}"`);
            return;
        }

        // Estado
        this.selectedDate = new Date();
        this.selectedHour = this.selectedDate.getHours();
        this.selectedMinute = Math.round(this.selectedDate.getMinutes() / 5) * 5;
        if (this.selectedMinute === 60) this.selectedMinute = 0;
        this.viewDate = new Date();
        this.currentTimeMode = 'hours';
        this.currentMainMode = 'date'; // 'date' o 'time'

        // Crear modal
        injectStyles();
        this.modal = createPickerModal(this.modalId, type);

        // Referencias DOM
        this.headerValue = document.getElementById(`${this.modalId}-header-value`);
        this.calendarContainer = document.getElementById(`${this.modalId}-calendar-container`);
        this.timeContainer = document.getElementById(`${this.modalId}-time-container`);
        this.daysContainer = document.getElementById(`${this.modalId}-days`);
        this.monthYearEl = document.getElementById(`${this.modalId}-month-year`);
        this.clockFace = document.getElementById(`${this.modalId}-clock-face`);
        this.hand = document.getElementById(`${this.modalId}-hand`);

        // Inicializar
        this.bindEvents();
        this.updateHeaderValue();
    }

    bindEvents() {
        // Abrir picker al hacer clic en input
        this.input.addEventListener('click', () => this.open());
        this.input.readOnly = true;
        this.input.style.cursor = 'pointer';

        // Botones de navegación del calendario
        document.getElementById(`${this.modalId}-prev-month`)?.addEventListener('click', () => this.changeMonth(-1));
        document.getElementById(`${this.modalId}-next-month`)?.addEventListener('click', () => this.changeMonth(1));

        // Tabs hora/minuto
        document.getElementById(`${this.modalId}-tab-hours`)?.addEventListener('click', () => this.switchTimeMode('hours'));
        document.getElementById(`${this.modalId}-tab-minutes`)?.addEventListener('click', () => this.switchTimeMode('minutes'));

        // Tabs fecha/hora (para datetime)
        if (this.type === 'datetime') {
            this.modal.querySelectorAll('.versa-datetime-tab').forEach(tab => {
                tab.addEventListener('click', () => this.switchMainMode(tab.dataset.mode));
            });
        }

        // Cancelar y OK
        document.getElementById(`${this.modalId}-cancel`)?.addEventListener('click', () => this.close());
        document.getElementById(`${this.modalId}-ok`)?.addEventListener('click', () => this.confirm());

        // Cerrar con Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('show')) {
                this.close();
            }
        });

        // Cerrar al hacer clic fuera
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
    }

    open() {
        // Resetear a fecha/hora actual si no hay valor
        if (!this.input.value) {
            this.selectedDate = new Date();
            this.selectedHour = this.selectedDate.getHours();
            this.selectedMinute = Math.round(this.selectedDate.getMinutes() / 5) * 5;
            if (this.selectedMinute === 60) this.selectedMinute = 0;
        }
        this.viewDate = new Date(this.selectedDate);

        if (this.type === 'datetime') {
            this.switchMainMode('date');
        } else if (this.type === 'date') {
            this.renderCalendar();
        } else {
            this.renderClock();
        }

        this.updateHeaderValue();
        this.modal.classList.add('show');
    }

    close() {
        this.modal.classList.remove('show');
    }

    confirm() {
        let value = '';
        const day = this.selectedDate.getDate().toString().padStart(2, '0');
        const month = (this.selectedDate.getMonth() + 1).toString().padStart(2, '0');
        const year = this.selectedDate.getFullYear();
        const hour = this.selectedHour.toString().padStart(2, '0');
        const minute = this.selectedMinute.toString().padStart(2, '0');

        if (this.type === 'date') {
            value = `${day}/${month}/${year}`;
        } else if (this.type === 'time') {
            value = `${hour}:${minute}`;
        } else {
            value = `${day}/${month}/${year}, ${hour}:${minute}`;
        }

        this.input.value = value;
        this.close();

        // Disparar evento change
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    updateHeaderValue() {
        const day = this.selectedDate.getDate().toString().padStart(2, '0');
        const month = MONTHS[this.selectedDate.getMonth()].substring(0, 3);
        const year = this.selectedDate.getFullYear();
        const hour = this.selectedHour.toString().padStart(2, '0');
        const minute = this.selectedMinute.toString().padStart(2, '0');

        if (this.type === 'date') {
            this.headerValue.textContent = `${day} ${month} ${year}`;
        } else if (this.type === 'time') {
            this.headerValue.textContent = `${hour}:${minute}`;
        } else {
            if (this.currentMainMode === 'date') {
                this.headerValue.textContent = `${day} ${month} ${year}`;
            } else {
                this.headerValue.textContent = `${hour}:${minute}`;
            }
        }
    }

    switchMainMode(mode) {
        this.currentMainMode = mode;

        // Actualizar tabs
        this.modal.querySelectorAll('.versa-datetime-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });

        // Mostrar/ocultar contenedores
        if (mode === 'date') {
            this.calendarContainer.style.display = '';
            this.timeContainer.style.display = 'none';
            this.renderCalendar();
        } else {
            this.calendarContainer.style.display = 'none';
            this.timeContainer.style.display = '';
            this.switchTimeMode('hours');
        }

        this.updateHeaderValue();
    }

    // ========== CALENDARIO ==========
    changeMonth(delta) {
        this.viewDate.setMonth(this.viewDate.getMonth() + delta);
        this.renderCalendar();
    }

    renderCalendar() {
        const year = this.viewDate.getFullYear();
        const month = this.viewDate.getMonth();

        this.monthYearEl.textContent = `${MONTHS[month]} ${year}`;

        // Primer día del mes (ajustar para que lunes sea 0)
        const firstDay = new Date(year, month, 1);
        let startDay = firstDay.getDay() - 1;
        if (startDay < 0) startDay = 6;

        // Días del mes anterior
        const prevMonth = new Date(year, month, 0);
        const daysInPrevMonth = prevMonth.getDate();

        // Días en el mes actual
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Día actual
        const today = new Date();

        let html = '';

        // Días del mes anterior
        for (let i = startDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            html += `<button type="button" class="versa-calendar-day other-month" data-day="${day}" data-month="${month - 1}">${day}</button>`;
        }

        // Días del mes actual
        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isSelected = day === this.selectedDate.getDate() && month === this.selectedDate.getMonth() && year === this.selectedDate.getFullYear();

            let classes = 'versa-calendar-day';
            if (isToday) classes += ' today';
            if (isSelected) classes += ' selected';

            html += `<button type="button" class="${classes}" data-day="${day}" data-month="${month}">${day}</button>`;
        }

        // Días del mes siguiente
        const totalCells = startDay + daysInMonth;
        const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let day = 1; day <= remaining; day++) {
            html += `<button type="button" class="versa-calendar-day other-month" data-day="${day}" data-month="${month + 1}">${day}</button>`;
        }

        this.daysContainer.innerHTML = html;

        // Añadir eventos a los días
        this.daysContainer.querySelectorAll('.versa-calendar-day').forEach(dayEl => {
            dayEl.addEventListener('click', () => {
                const day = parseInt(dayEl.dataset.day);
                const monthOffset = parseInt(dayEl.dataset.month) - month;

                if (monthOffset !== 0) {
                    this.viewDate.setMonth(this.viewDate.getMonth() + monthOffset);
                }

                this.selectedDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + monthOffset, day);
                this.viewDate = new Date(this.selectedDate);
                this.renderCalendar();
                this.updateHeaderValue();

                // Si es datetime, cambiar a hora automáticamente
                if (this.type === 'datetime') {
                    setTimeout(() => this.switchMainMode('time'), 300);
                }
            });
        });
    }

    // ========== RELOJ ==========
    switchTimeMode(mode) {
        this.currentTimeMode = mode;

        const tabHours = document.getElementById(`${this.modalId}-tab-hours`);
        const tabMinutes = document.getElementById(`${this.modalId}-tab-minutes`);

        tabHours?.classList.toggle('active', mode === 'hours');
        tabMinutes?.classList.toggle('active', mode === 'minutes');

        this.renderClock();
    }

    renderClock() {
        this.clockFace.innerHTML = '';
        const radius = 85;
        const innerRadius = 55;
        const centerX = 110;
        const centerY = 110;

        if (this.currentTimeMode === 'hours') {
            // Horas exteriores (1-12)
            for (let i = 0; i < 12; i++) {
                const hour = i === 0 ? 12 : i;
                const angle = (i * 30 - 90) * (Math.PI / 180);
                const x = centerX + radius * Math.cos(angle) - 18;
                const y = centerY + radius * Math.sin(angle) - 18;

                const num = document.createElement('div');
                num.className = 'versa-clock-number';
                if (hour === this.selectedHour || (hour === 12 && this.selectedHour === 0)) {
                    num.classList.add('selected');
                }
                num.textContent = hour;
                num.style.left = x + 'px';
                num.style.top = y + 'px';
                num.addEventListener('click', () => this.selectHour(hour));
                this.clockFace.appendChild(num);
            }

            // Horas interiores (0, 13-23)
            for (let i = 0; i < 12; i++) {
                const hour = i === 0 ? 0 : i + 12;
                const angle = (i * 30 - 90) * (Math.PI / 180);
                const x = centerX + innerRadius * Math.cos(angle) - 18;
                const y = centerY + innerRadius * Math.sin(angle) - 18;

                const num = document.createElement('div');
                num.className = 'versa-clock-number inner';
                if (hour === this.selectedHour) {
                    num.classList.add('selected');
                }
                num.textContent = hour.toString().padStart(2, '0');
                num.style.left = x + 'px';
                num.style.top = y + 'px';
                num.addEventListener('click', () => this.selectHour(hour));
                this.clockFace.appendChild(num);
            }
        } else {
            // Minutos (0, 5, 10, ... 55)
            for (let i = 0; i < 12; i++) {
                const minute = i * 5;
                const angle = (i * 30 - 90) * (Math.PI / 180);
                const x = centerX + radius * Math.cos(angle) - 18;
                const y = centerY + radius * Math.sin(angle) - 18;

                const num = document.createElement('div');
                num.className = 'versa-clock-number';
                if (minute === this.selectedMinute) {
                    num.classList.add('selected');
                }
                num.textContent = minute.toString().padStart(2, '0');
                num.style.left = x + 'px';
                num.style.top = y + 'px';
                num.addEventListener('click', () => this.selectMinute(minute));
                this.clockFace.appendChild(num);
            }
        }

        this.updateHand();
    }

    updateHand() {
        let angle, length;
        if (this.currentTimeMode === 'hours') {
            const hourForAngle = this.selectedHour % 12;
            angle = hourForAngle * 30;
            length = this.selectedHour >= 12 && this.selectedHour !== 12 ? 45 : 70;
        } else {
            angle = this.selectedMinute * 6;
            length = 70;
        }
        this.hand.style.height = length + 'px';
        this.hand.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    }

    selectHour(hour) {
        this.selectedHour = hour;
        this.renderClock();
        this.updateHeaderValue();
        // Cambiar a minutos automáticamente
        setTimeout(() => this.switchTimeMode('minutes'), 300);
    }

    selectMinute(minute) {
        this.selectedMinute = minute;
        this.renderClock();
        this.updateHeaderValue();
    }
}

// ========================================
// FUNCIONES DE EXPORTACIÓN
// ========================================
export function initDateTimePicker(inputId) {
    return new VersaPicker(inputId, 'datetime');
}

export function initDatePicker(inputId) {
    return new VersaPicker(inputId, 'date');
}

export function initTimePicker(inputId) {
    return new VersaPicker(inputId, 'time');
}

// Para uso sin módulos (script tag normal)
window.VersaDateTimePicker = {
    initDateTimePicker,
    initDatePicker,
    initTimePicker
};
