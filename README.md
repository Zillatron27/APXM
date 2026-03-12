# APXM (APEX Mobile)

A mobile browser extension for [Prosperous Universe](https://prosperousuniverse.com). Replaces the APEX web interface on phones with a touch-first UI while the underlying game client keeps running.

**Read-only.** APXM observes WebSocket traffic and displays your empire status. It never sends messages to the game server or clicks anything on your behalf.

## What It Does

- **Burn tracking** — per-site material burn rates with urgency indicators (critical/warning/ok). Configurable thresholds. Purchase "need" calculation with resupply targets.
- **Fleet overview** — ship status, destinations, ETA countdowns.
- **Contract monitoring** — active contracts with condition status and deadlines.
- **FIO integration** — auto-fetches data from the FIO REST API on startup if credentials are configured. Supplements WebSocket data.
- **Dashboard** — at-a-glance summaries of bases, fleet, and contracts with drill-through to full views.

## How It Works

APXM intercepts the WebSocket connection between APEX and the game server using a main-world content script injected before Prun loads. Messages are decoded through Socket.IO's double-encoding layer (engine.io + socket.io framing) and fed into typed Zustand stores. The React UI renders from those stores.

The interception and message bus code lives in the shared [@prun/link](https://github.com/Zillatron27/PrUn-Link) library.

```
APEX <-> Game Server (WebSocket/Socket.IO)
          | (observed, never modified)
     @prun/link decoder
          |
     Zustand stores
          |
     APXM React UI
```

## Platforms

| Platform | Browser | Status |
|----------|---------|--------|
| iOS / iPadOS | Orion (Kagi) | Validated |
| Android | Firefox | TBA |
| Android | Kiwi Browser | TBA |
| Desktop | Chrome / Firefox | Works (mobile-only by default, use `?apxm_force` to override) |

## Install

Firefox: [Firefox Add-ons (AMO)](https://addons.mozilla.org/en-US/firefox/addon/apxm/).

Chrome: will be availble on the Chrome Web Store soon.

## Build From Source

Requires Node.js 22+ and pnpm 10+.

```bash
pnpm install
pnpm run build            # Chrome MV3 -> .output/chrome-mv3/
pnpm run build:firefox    # Firefox MV2 -> .output/firefox-mv2/
pnpm run test             # Run test suite
```

### Development

```bash
pnpm run dev              # Chrome with hot reload
pnpm run dev:firefox      # Firefox with hot reload
```

### Package for Distribution

```bash
pnpm run zip              # Chrome zip
pnpm run zip:firefox      # Firefox zip + sources zip (for AMO)
```

Load as an unpacked/temporary extension from the `.output/` directory.

## Tech Stack

- [WXT](https://wxt.dev) — cross-browser extension framework (Vite-based)
- React 19 + TypeScript (strict mode)
- Zustand — state management
- Tailwind CSS — mobile-first styling
- Vitest — unit tests

## Acknowledgments

APXM builds on the shoulders of the Prosperous Universe community tooling ecosystem. Two projects in particular deserve recognition:

**[Refined PrUn (rprun)](https://github.com/refined-prun/refined-prun)** — the primary desktop extension for Prosperous Universe (MIT, 1,200+ commits). rprun pioneered the WebSocket interception and Socket.IO decoding patterns that the entire community extension ecosystem now relies on. APXM's understanding of APEX's internal message protocol, DOM structure, and buffer management draws heavily from rprun's prior art. APXM targets mobile where rprun doesn't operate — the two projects are complementary, not competing.

**[FIO (Prosperous Universe Data API)](https://doc.fnar.net)** — the community REST API maintained by Kovus (Illumindale) and contributors. FIO provides the public game data layer (materials, buildings, recipes, planet data, exchange prices) that makes tools like APXM possible. Without FIO, every extension would need to independently reconstruct this data from raw WebSocket traffic. APXM uses FIO for material metadata, recipe lookups, and planet information on startup.

WebSocket observation is established community practice in the PrUn ecosystem, explicitly approved by the game developer (Simulogics / molp).

## License

ISC
