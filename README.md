# APXM

A browser extension for [Prosperous Universe](https://prosperousuniverse.com) that provides a mobile-optimised touch interface. APXM observes WebSocket traffic and displays your empire status auto-magically.

Part of the [27Bit Industries](https://27bit.dev) tool suite for Prosperous Universe.

## Features

Overlays the APEX mobile interface with a touch-focused UI while the underlying game client keeps running.

- **Status dashboard** — at-a-glance summaries of bases, fleet, contracts and burn rates.
- **Notifications** — a bell in the header with an unread count opens a full NOTS list. Alerts colour-coded type labels (like rPrUn) and a material tiles. Action buttons to open the associated APXM detail panel.
- **Base status** — BURN / REPAIR / PROD indicators per base: days of supplies remaining, days since last repair and production utilisation.
- **Burn tracking** — per-base material burn rates with urgency indicators (critical/warning/ok). Purchase need calculation with configurable resupply targets.
- **Fleet overview** — ship status, destinations, ETA countdowns, cargo and fuel.
- **Ship actions** — unload, refuel, load cargo through a capacity-aware picker and send ships with tappable reactor and fuel-usage controls. NO SLIDERS >:|
- **Contract monitoring** — active contracts with condition status, deadlines and locations.
- **Contract actions** — ACCEPT / REJECT / FULFILL from the contract sheet.
- **Company & liquidity** — company identity and cash balances with configurable preferred-currency.
- **Staleness indicators** — data surfaces show their source (live WebSocket / FIO / cache) and age.
- **UI themes** — five presets shared with Helm (PrUn, DryDock, CRT, Vivid, Colorblind), including a CVD-safe burn status palette.
- **FIO integration** — auto-fetches data from the FIO REST API on startup if credentials are configured.
- **Buffer refresh** — per-base data refresh without switching back to APEX.

## How It Works

Install the extension, open [prosperousuniverse.com](https://prosperousuniverse.com) and log in as normal. On a touch device APXM takes over the screen; the APEX client keeps running underneath. **SHOW APEX** in the header drops you back to the game's own UI at any time.

## Technical Stuff

APXM intercepts the WebSocket connection between APEX and the game server using a main-world content script injected before PrUn loads. Messages are decoded through Socket.IO's double-encoding layer (engine.io + socket.io framing) and fed into typed Zustand stores. The React overlay renders from those stores.

The interception and message bus code lives in `@prun/link`, a shared library from the 27Bit toolset (currently private).

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

| Platform | Browser | Notes |
|----------|---------|-------|
| iOS / iPadOS | Orion (Kagi) | Install via the AMO listing |
| Android | Firefox | Install via the AMO listing |
| Android | Kiwi | Install via the Chrome Web Store |


## Install

Firefox (Android) and Orion (iOS): [Firefox Add-ons (AMO)](https://addons.mozilla.org/en-US/firefox/addon/apxm/)

Chrome and Kiwi (Android): [Chrome Web Store](https://chromewebstore.google.com/detail/apxm/ioiiigjopajjdhfcdmdhlcmkhbpdfdec)

Release history: [CHANGELOG.md](CHANGELOG.md) · [GitHub Releases](https://github.com/Zillatron27/APXM/releases)

## Build From Source

Requires Node.js 22+ and pnpm 10+ (`corepack enable` picks up the pinned version).

> **Note:** the `@prun/link` dependency is currently a private repository, so building from source is limited to collaborators for now. The AMO listing includes the reviewed source bundle for each release.

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

## Feedback

Found a bug or have a feature idea? [Open an issue](https://github.com/Zillatron27/APXM/issues/new/choose)

## Tech Stack

- [WXT](https://wxt.dev) — cross-browser extension framework (Vite-based)
- `@prun/link` — shared WebSocket interception library (private)
- React 19 + TypeScript
- Zustand — state management
- Tailwind CSS — mobile-first styling
- Vitest — unit tests

## Acknowledgments

APXM is inspired by and built on the shoulders of giants — it wouldn't exist without the work that came before it.

**[Refined PrUn (rprun)](https://github.com/refined-prun/refined-prun)** — APXM's understanding of APEX's internal message protocol, DOM structure, and buffer management draws from rprun's prior work.

**[FIO (Prosperous Universe Community API)](https://doc.fnar.net)** — FIO provides the game data (materials, buildings, recipes, planet data, exchange prices) that makes tools like APXM, Helm and others possible.

**[jackinabox86](https://github.com/jackinabox86)** — the repair and production status engines, the ACT action engine and the mobile buffer navigator are adapted from his APXM fork.

## License

MIT
