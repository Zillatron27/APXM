/**
 * Landing Page
 *
 * Static promo page shown when the APXM extension is not connected.
 * Pure HTML/CSS — no heavy dependencies loaded.
 */

import './landing.css';

export function initLanding(): void {
  const container = document.getElementById('landing');
  if (!container) return;

  container.innerHTML = `
    <h1>APX<span class="accent">M</span></h1>
    <p class="tagline">Desktop view for Prosperous Universe</p>
    <div class="links">
      <a href="https://helm.27bit.dev" target="_blank" rel="noopener">Helm Galaxy Map</a>
      <a href="https://github.com/Zillatron27/APXM" target="_blank" rel="noopener">Install Extension</a>
    </div>
  `;
}
