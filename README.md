# APXM

A browser extension for [Prosperous Universe](https://prosperousuniverse.com) that provides a mobile-optimised touch interface. APXM observes WebSocket traffic and displays your empire status auto-magically.

Part of the [27Bit Industries](https://27bit.dev) tool suite for Prosperous Universe.

## Mobile View

### Features

Overlays the APEX mobile interface with a touch-focused UI while the underlying game client keeps running.

- **Status Dashboard** — at-a-glance summaries of bases, fleet and contracts. Drill-down to full views.
- **Burn tracking** — per-site material burn rates with urgency indicators (critical/warning/ok). Purchase need calculation with resupply targets. Configurable thresholds.
- **Fleet overview** — ship status, destinations, ETA countdowns.
- **Contract monitoring** — active contracts with condition status and deadlines.
- **FIO integration** — auto-fetches data from the FIO REST API on startup if credentials are configured.
- **Buffer refresh** — per-site data refresh without switching back to APEX.

## Technical Stuff

APXM intercepts the WebSocket connection between APEX and the game server using a main-world content script injected before Prun loads. Messages are decoded through Socket.IO's double-encoding layer (engine.io + socket.io framing) and fed into typed Zustand stores. The React UI (mobile) and postMessage bridge (desktop) render from those stores.

The interception and message bus code lives in the [@prun/link](https://github.com/Zillatron27/PrUn-Link) library.

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

| Platform | Browser 
|----------|---------|
| iOS / iPadOS | Orion (Kagi) |
| Android | Firefox |
| Desktop | Chrome / Firefox | Desktop view active, mobile view can be enabled with `?apxm_force` |

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
- React 19 + TypeScript
- Zustand — state management
- Tailwind CSS — mobile-first styling
- Vitest — unit tests

## Acknowledgments

APXM is inspired by and built on the shoulders of giants — it wouldn't exist without the work that came before it.

**[Refined PrUn (rprun)](https://github.com/refined-prun/refined-prun)** — APXM's understanding of APEX's internal message protocol, DOM structure, and buffer management draws from rprun's prior work.

**[FIO (Prosperous Universe Community API)](https://doc.fnar.net)** — FIO provides the game data (materials, buildings, recipes, planet data, exchange prices) that makes tools like APXM, Helm and others possible.


## License

MIT
