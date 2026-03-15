/**
 * Settings Panel — burn threshold configuration for the desktop view.
 *
 * Sends updated thresholds to the extension via bridge postMessage.
 */

import type { EmpireState } from '../empire-state';
import type { BurnThresholds } from '../types/bridge';
import './settings-panel.css';

export interface SettingsPanelCallbacks {
  onSave(thresholds: BurnThresholds): void;
  onRprunToggle(disabled: boolean): void;
  onClose(): void;
}

let panelEl: HTMLDivElement | null = null;
let backdropEl: HTMLDivElement | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

function cleanup(): void {
  if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
  if (backdropEl) {
    backdropEl.remove();
    backdropEl = null;
  }
  if (panelEl) {
    panelEl.remove();
    panelEl = null;
  }
}

export function showSettingsPanel(
  empireState: EmpireState,
  callbacks: SettingsPanelCallbacks,
): void {
  cleanup();

  const thresholds = empireState.getBurnThresholds();

  // Backdrop
  backdropEl = document.createElement('div');
  backdropEl.style.cssText = 'position:fixed;inset:0;z-index:49;background:transparent;';
  backdropEl.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    cleanup();
    callbacks.onClose();
  });
  document.body.appendChild(backdropEl);

  // Panel
  panelEl = document.createElement('div');
  panelEl.className = 'settings-panel';
  panelEl.addEventListener('pointerdown', (e) => e.stopPropagation());

  // Centre the panel
  panelEl.style.top = '50%';
  panelEl.style.left = '50%';
  panelEl.style.transform = 'translate(-50%, -50%)';

  panelEl.innerHTML = `
    <div class="settings-panel-header">
      <h3>Settings</h3>
      <button class="settings-panel-close">\u00D7</button>
    </div>
    <div class="settings-panel-body">
      <div class="settings-section-label">Burn Thresholds</div>
      <div class="settings-field">
        <label>Critical (days)</label>
        <input type="number" id="settings-critical" min="1" step="1" value="${thresholds.critical}">
      </div>
      <div class="settings-field">
        <label>Warning (days)</label>
        <input type="number" id="settings-warning" min="1" step="1" value="${thresholds.warning}">
      </div>
      <div class="settings-field">
        <label>Resupply (days)</label>
        <input type="number" id="settings-resupply" min="1" step="1" value="${thresholds.resupply}">
      </div>
      <div class="settings-validation" id="settings-error"></div>
      <div class="settings-save-row">
        <button class="settings-save-btn" id="settings-save">Save</button>
      </div>
      ${empireState.isRprunDetected() ? `
        <div class="settings-section-label" style="margin-top: 12px">rprun Integration</div>
        <div class="settings-field settings-toggle-field">
          <label for="settings-rprun-disable">Disable rprun features</label>
          <input type="checkbox" id="settings-rprun-disable" ${empireState.isRprunFeaturesDisabled() ? 'checked' : ''}>
        </div>
      ` : ''}
    </div>
  `;

  document.body.appendChild(panelEl);

  const closeBtn = panelEl.querySelector('.settings-panel-close') as HTMLButtonElement;
  closeBtn.addEventListener('click', () => {
    cleanup();
    callbacks.onClose();
  });

  const criticalInput = panelEl.querySelector('#settings-critical') as HTMLInputElement;
  const warningInput = panelEl.querySelector('#settings-warning') as HTMLInputElement;
  const resupplyInput = panelEl.querySelector('#settings-resupply') as HTMLInputElement;
  const errorEl = panelEl.querySelector('#settings-error') as HTMLDivElement;
  const saveBtn = panelEl.querySelector('#settings-save') as HTMLButtonElement;

  function validate(): BurnThresholds | null {
    const c = parseInt(criticalInput.value, 10);
    const w = parseInt(warningInput.value, 10);
    const r = parseInt(resupplyInput.value, 10);

    if (isNaN(c) || isNaN(w) || isNaN(r) || c <= 0 || w <= 0 || r <= 0) {
      errorEl.textContent = 'All values must be positive integers';
      return null;
    }
    if (c >= w) {
      errorEl.textContent = 'Critical must be less than Warning';
      return null;
    }
    if (w > r) {
      errorEl.textContent = 'Warning must not exceed Resupply';
      return null;
    }
    errorEl.textContent = '';
    return { critical: c, warning: w, resupply: r };
  }

  saveBtn.addEventListener('click', () => {
    const result = validate();
    if (result) {
      empireState.setBurnThresholds(result);
      callbacks.onSave(result);
      cleanup();
      callbacks.onClose();
    }
  });

  // rprun features toggle
  const rprunCheckbox = panelEl.querySelector('#settings-rprun-disable') as HTMLInputElement | null;
  if (rprunCheckbox) {
    rprunCheckbox.addEventListener('change', () => {
      callbacks.onRprunToggle(rprunCheckbox.checked);
    });
  }

  // Escape key
  escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
      callbacks.onClose();
    }
  };
  document.addEventListener('keydown', escHandler);
}

export function hideSettingsPanel(): void {
  cleanup();
}
