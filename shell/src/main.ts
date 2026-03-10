/**
 * Shell Page Entry Point
 *
 * Starts in landing mode. When the APXM extension sends apxm-hello,
 * replies with ack, hides landing, lazy-loads the map module.
 */

import { initLanding } from './landing';
import type { ApxmHelloMessage } from './types/bridge';

const SHELL_VERSION = '0.1.0';

// Allowed extension origins for message validation
const ALLOWED_ORIGINS = ['https://apex.prosperousuniverse.com'];

function isAllowedOrigin(origin: string): boolean {
  // In dev mode, also allow localhost origins (the extension runs on apex)
  return ALLOWED_ORIGINS.includes(origin) || origin.startsWith('https://apex.');
}

function showLoading(): void {
  const landing = document.getElementById('landing');
  const loading = document.getElementById('loading');
  if (landing) landing.style.display = 'none';
  if (loading) {
    loading.style.display = 'flex';
    loading.textContent = 'Connecting to APXM...';
  }
}

async function activateMap(): Promise<void> {
  const loading = document.getElementById('loading');
  const mapContainer = document.getElementById('map-container');

  // Lazy-import map module (avoids loading Pixi/Helm on landing page)
  const { initMap } = await import('./map');

  if (loading) loading.style.display = 'none';
  if (mapContainer) {
    mapContainer.style.display = 'block';
    initMap(mapContainer);
  }
}

let handshakeComplete = false;

function handleMessage(event: MessageEvent): void {
  if (!isAllowedOrigin(event.origin)) return;

  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'apxm-hello' && !handshakeComplete) {
    const hello = data as ApxmHelloMessage;
    handshakeComplete = true;
    console.log(`[APXM Shell] Received hello from extension (v${hello.version})`);

    // Reply with ack
    event.source?.postMessage(
      { type: 'apxm-hello-ack', version: SHELL_VERSION },
      { targetOrigin: event.origin },
    );

    showLoading();
    activateMap().catch((err) => {
      console.error('[APXM Shell] Failed to initialize map:', err);
    });
  }
}

// Boot
initLanding();
window.addEventListener('message', handleMessage);
console.log('[APXM Shell] Landing page ready, waiting for extension...');
