/**
 * Landing Page
 *
 * Static promo page shown when the APXM extension is not connected.
 * Pure HTML/CSS — no heavy dependencies loaded.
 */

import './landing.css';
import iconUrl from './apxm-icon.svg';

export function initLanding(): void {
  const container = document.getElementById('landing');
  if (!container) return;

  container.innerHTML = `
    <img class="logo" src="${iconUrl}" alt="APXM" />
    <p class="tagline">Empire HUD for Prosperous Universe</p>
    <div class="links">
      <a href="https://helm.27bit.dev" target="_blank" rel="noopener">Helm Galaxy Map</a>
      <a href="https://github.com/Zillatron27/APXM" target="_blank" rel="noopener">Install Extension</a>
    </div>
  `;
}
