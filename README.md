# APXM

A browser extension for [Prosperous Universe](https://prosperousuniverse.com) that provides both a mobile-optimised touch interface and a desktop empire HUD powered by the [Helm](https://helm.27bit.dev) galaxy map.

**Read-only.** APXM observes WebSocket traffic and displays your empire status. It never sends messages to the game server or clicks anything on your behalf.

Part of the [27Bit Industries](https://27bit.dev) tool suite for Prosperous Universe.

## Desktop View

The desktop view embeds a live empire overlay on the Helm galaxy map. Open it in APEX with:

```
XIT WEB apxm.27bit.dev
```

Requires the APXM extension installed. Without the extension, the page shows a landing page linking to Helm.

### What you get

- **Empire overlay** — owned systems highlighted with burn-coloured rings (green/amber/red) on the galaxy map and in system view
- **Live ship tracking** — idle ship markers at systems, in-transit ships interpolated along flight paths in real time
- **Burn panel** (B key) — draggable floating panel with per-base burn status, expandable material-level detail, urgency filtering, sort by urgency or alphabetical
- **Fleet panel** (F key) — all ships with cargo/fuel bars, IDLE/TRANSIT filters, sort by ETA/name/cargo, click-to-zoom on any ship
- **Warehouse markers** — orange dots at CX stations where you have a warehouse, click to open inventory
- **Empire dim** (E key) — dims the galaxy to highlight only your systems and nearby CXs
- **Gateway toggle** (G key) — show/hide gateway indicators
- **Warehouse dropdown** (W key) — quick access to CX warehouse inventories
- **Base panels** — click any owned planet in system view for production, storage, workforce, burn status, and buffer command buttons
- **Ship panels** — click any ship for cargo manifest, fuel, flight segments, and Fly/Cargo/Fuel action buttons
- **Screen switching** — assign APEX screens to planets for quick navigation
- **Theme picker** — five Helm colour themes
- **Buffer bridging** — panel buttons open the corresponding APEX buffer (BS, INV, PROD, SHP, CXM, FLT)
- **rprun detection** — detects Refined PrUn and offers ACTS button integration

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| B | Toggle burn panel |
| F | Toggle fleet panel |
| W | Toggle warehouse dropdown |
| G | Toggle gateway indicators |
| E | Toggle empire dim |
| Esc | Close current panel/menu |

## Mobile View

Replaces the APEX web interface on phones with a touch-first UI while the underlying game client keeps running.

- **Burn tracking** — per-site material burn rates with urgency indicators (critical/warning/ok). Configurable thresholds. Purchase "need" calculation with resupply targets.
- **Fleet overview** — ship status, destinations, ETA countdowns.
- **Contract monitoring** — active contracts with condition status and deadlines.
- **Dashboard** — at-a-glance summaries of bases, fleet, and contracts with drill-through to full views.
- **FIO integration** — auto-fetches data from the FIO REST API on startup if credentials are configured.
- **Buffer refresh** — per-site data refresh by programmatically opening BS buffers in APEX.

## How It Works

APXM intercepts the WebSocket connection between APEX and the game server using a main-world content script injected before Prun loads. Messages are decoded through Socket.IO's double-encoding layer (engine.io + socket.io framing) and fed into typed Zustand stores. The React UI (mobile) and postMessage bridge (desktop) render from those stores.

The interception and message bus code lives in the shared [@prun/link](https://github.com/Zillatron27/PrUn-Link) library.

```
APEX <-> Game Server (WebSocket/Socket.IO)
          | (observed, never modified)
     @prun/link decoder
          |
     Zustand stores
          |
     ├── APXM React UI (mobile)
     └── postMessage bridge → Helm shell (desktop)
```

## Platforms

| Platform | Browser | Status |
|----------|---------|--------|
| iOS / iPadOS | Orion (Kagi) | Validated |
| Android | Firefox | TBA |
| Android | Kiwi Browser | TBA |
| Desktop | Chrome / Firefox | Desktop view active, mobile view uses `?apxm_force` |

## Install

Firefox: [Firefox Add-ons (AMO)](https://addons.mozilla.org/en-US/firefox/addon/apxm/).

Chrome: available soon on the Chrome Web Store.

## Build From Source

Requires Node.js 22+ and pnpm 10+.

```bash
pnpm install
pnpm run build            # Chrome MV3 -> .output/chrome-mv3/
pnpm run build:firefox    # Firefox MV2 -> .output/firefox-mv2/
pnpm run test             # Run test suite (303 tests)
```

### Development

```bash
pnpm run dev              # Chrome with hot reload
pnpm run dev:firefox      # Firefox with hot reload
```

### Desktop Shell (apxm.27bit.dev)

The desktop view shell page is a separate Vite app deployed to Cloudflare:

```bash
cd shell
pnpm install
pnpm run build            # Build to shell/dist/
npx wrangler deploy       # Deploy to Cloudflare
```

### Package for Distribution

```bash
pnpm run zip              # Chrome zip
pnpm run zip:firefox      # Firefox zip + sources zip (for AMO)
```

## Beta Testing

Found a bug or have a feature idea? [Open an issue](https://github.com/Zillatron27/APXM/issues/new/choose) — there are templates for bug reports and feature requests.

## Tech Stack

- [WXT](https://wxt.dev) — cross-browser extension framework (Vite-based)
- [Helm](https://helm.27bit.dev) — interactive galaxy map (Pixi.js)
- [@prun/link](https://github.com/Zillatron27/PrUn-Link) — shared WebSocket interception library
- React 19 + TypeScript (strict mode)
- Zustand — state management
- Tailwind CSS — mobile-first styling
- Vitest — unit tests

## Acknowledgments

APXM builds on the shoulders of the Prosperous Universe community tooling ecosystem. Two projects in particular deserve recognition:

**[Refined PrUn (rprun)](https://github.com/refined-prun/refined-prun)** — the primary desktop extension for Prosperous Universe (MIT, 1,200+ commits). rprun pioneered the WebSocket interception and Socket.IO decoding patterns that the entire community extension ecosystem now relies on. APXM's understanding of APEX's internal message protocol, DOM structure, and buffer management draws heavily from rprun's prior art. APXM targets a different surface — the two projects are complementary, not competing.

**[FIO (Prosperous Universe Data API)](https://doc.fnar.net)** — the community REST API maintained by Kovus (Illumindale) and contributors. FIO provides the public game data layer (materials, buildings, recipes, planet data, exchange prices) that makes tools like APXM possible.

WebSocket observation is established community practice in the PrUn ecosystem, explicitly approved by the game developer (Simulogics / molp).

## License

ISC
