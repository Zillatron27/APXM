# APXM (APEX Mobile)

Browser extension: mobile-optimized interface for Prosperous Universe. Replaces APEX UI on mobile while the underlying client stays running for data and action confirmation.

## Tech Stack

- **Framework:** WXT (wxt.dev) — Vite-based cross-browser extension builder
- **UI:** React + Tailwind CSS (mobile-first, touch-first)
- **State:** Zustand — game state store is single source of truth
- **Language:** TypeScript (strict mode)
- **Tests:** Vitest
- **Extension:** Manifest V3

## Commands

```bash
pnpm run dev            # Dev server with hot reload (Chrome)
pnpm run dev:firefox    # Dev server (Firefox)
pnpm run build          # Production build (Chrome) → .output/chrome-mv3/
pnpm run build:firefox  # Production build (Firefox) → .output/firefox-mv2/
pnpm run test           # Test suite (vitest)
```

**Firefox Flatpak:** Firefox Flatpak cannot access `.output/` due to sandbox restrictions. After building, copy to `~/Downloads`:
```bash
rm -rf ~/Downloads/apxm-firefox && cp -r .output/firefox-mv2 ~/Downloads/apxm-firefox
```
Then load from `~/Downloads/apxm-firefox` in `about:debugging`.

**AMO Upload:** To build and prepare both files needed for AMO submission:
```bash
pnpm run zip:firefox
cp .output/apxm-*-firefox.zip .output/apxm-*-sources.zip ~/Downloads/
```
AMO requires both the extension zip and the sources zip. Note: Firefox manifest versions must be dot-separated integers only (e.g., `0.1.0.23`), not semver pre-release tags (e.g., `0.1.0-b23`). The human-readable version in `StatusPanel.tsx` can use any format.

## Architecture

### Data Flow

1. **WebSocket Interceptor** — hooks `WebSocket.prototype` in main-world content script, MUST run before Prun's scripts load (`run_at: document_start`)
2. **Socket.IO Decoder** — CRITICAL: Prun uses Socket.IO, NOT raw WebSocket. Messages are double-encoded: engine.io-parser (transport framing) → socket.io-parser (event framing) → game messages. Must decode both layers. rprun imports both parsers.
3. **Game State Store** (Zustand) — typed, indexed, queryable. Built from WebSocket + FIO REST data.
4. **APXM Overlay** (React) — phones: full-screen overlay, APEX hidden via `display:none`. Tablets: split view option.
5. **DOM Action Dispatcher** — opens APEX buffers, pre-fills fields, hands control back to user.

### HARD RULE: Action Dispatch

APXM NEVER clicks confirm/submit on behalf of the user. APXM NEVER sends raw WebSocket messages to the game server. The extension prepares actions; the human commits them. This is the line between QoL tooling and automation. Do not violate this under any circumstances.

### Staleness

IMPORTANT: All data displays must include staleness indicators — timestamp of last confirmed server message, visual degradation when data is stale. Burn rate calculations on stale data can be actively harmful.

On `CLIENT_CONNECTION_OPENED` message (reconnect): ALL stores must clear immediately. Stale data from a previous session is worse than no data.

### Cross-World Message Bus (Main-World ↔ Content Script)

The message bus bridges the main-world script (ws-interceptor.js) and content script (content.tsx). This is browser-specific due to security models:

**Chrome:** `CustomEvent.detail` works directly. Main-world dispatches `CustomEvent('apxm-message', { detail })`, content script reads `e.detail`.

**Firefox:** Xray wrappers block `CustomEvent.detail` from main-world events. Content script sees `e.detail` as `undefined`. Workaround: try `e.wrappedJSObject.detail` (Firefox-specific API that bypasses Xray).

**CRITICAL RULE:** When fixing browser-specific issues, ADD a conditional path for the broken browser. NEVER replace working code for other browsers. The Chrome CustomEvent.detail path works — leave it alone. Add Firefox-specific handling alongside it, not instead of it.

Files involved:
- `lib/message-bus/main-world.ts` — emits messages (runs in main-world)
- `lib/message-bus/content-bridge.ts` — receives messages (runs in content script)
- `lib/message-bus/types.ts` — shared type definitions

### APEX DOM Structure

APEX's root element is `#container`, NOT `#app`. When manipulating APEX visibility or layout:
- Target `document.getElementById('container')`
- APEX uses `position: relative` layout, not `position: fixed` — simple margin/padding offsets work
- The FloatingReturn bar adds `marginTop: 2.75rem` to push APEX below the bar

## Key Constraints

- Target platforms: iOS (Orion by Kagi), Android (Firefox/Kiwi), Desktop (Chrome/Firefox). Orion has ~70% WebExtension API coverage — main-world content script execution is the critical unknown validated in Phase 0.
- rprun (MIT, 1,200+ commits) is the established community extension. APXM complements, not competes. Reference rprun source at `src/infrastructure/prun-api/data/*.types.d.ts` for type definitions.
- Information density over whitespace — management tool, not consumer app. Touch targets ≥ 44pt.
- Monochrome with accent color only for status (red/amber/green burn indicators). Match Prun's dark terminal aesthetic.

## Related Projects

- **FIO API Reference:** `../FIO-API-Reference/FIO-API-Refrence.md` — full endpoint documentation for rest.fnar.net (supplements WebSocket data)
- **Context docs:** `../context/apxm-project-context.md` — full implementation plan, architecture diagrams, phase breakdown
- **rprun source:** Reference for game message types and Socket.IO parsing

## Repo Info

- **GitHub:** Zillatron27/APXM (private, will go public)
- **When public:** Move CLAUDE.md to context/, symlink back, add to .gitignore
