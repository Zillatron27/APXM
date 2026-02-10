# APXM Changelog

## 0.1.2 — Buffer Refresh (2026-02-11)

### Features

- **Per-site buffer refresh** — refresh button on each SiteBurnCard opens the corresponding `BS` buffer in APEX to populate burn data without manual navigation. Replaces the previous "open PRD and WF buffers" workflow.
- **Buffer refresh engine** — programmatic DOM manipulation to open/close APEX buffers, wait for WebSocket data response, and clean up. Same technique rprun uses for XIT BURN.
- **Batch and auto refresh modes** — sequential multi-site refresh and automatic refresh on login, accessible via `?apxm_refresh=batch|auto` URL param for internal testing only. No UI surface in production.

### Changes

- Empty state text updated from "open PRD and WF buffers" to "tap refresh or open BS buffer in APEX"
- Batch "Refresh All" button removed from BasesView (was only visible in batch mode)
- Auto-refresh progress bar removed from Header (was only visible in auto mode)
- Debug panel mode selector removed (function retained in codebase but not wired up)

---

## 0.1.1 — Loading States & Settings (b1–b10)

### Features

- **Unresponsive APEX detection** — 5-second timeout detects when APEX fails to load (maintenance, broken update, network issue). Shows red "APEX isn't responding" instead of indefinite "Connecting to APEX..." pulse. Clears automatically if APEX loads late.
- **Connection-aware loading indicators** — DataGate component and inline mini-list checks distinguish "waiting for data" from "genuinely empty." FIO-only mode shows stable "Waiting for APEX connection..." for non-FIO stores instead of false empty states.
- **Burn threshold settings** — configurable critical/warning/resupply day thresholds in Settings view. Need calculation uses resupply target instead of warning threshold. Validates critical < warning <= resupply.
- **Desktop guard** — APXM only activates on touch devices (`pointer: coarse`). Use `?apxm_force` URL param to override for desktop testing.

### Bug Fixes

- Fix React error #185 (maximum update depth exceeded) during login message burst — entity store shadow batching + macro task scheduling reduces ~60 setState calls to 7 per batch
- Fix debug overlay (`?apxm_debug`) not appearing — replaced 15-second self-healing timer with persistent MutationObserver, re-append overlay after shadow host mount
- Fix Chrome "Extension context invalidated" unhandled promise rejections after service worker teardown — global rejection handler suppresses leaks from WXT framework internals
- Fix burn UI not updating when thresholds change (reactivity)
- Fix settings rehydration dropping new fields — deep-merge persisted settings so new fields get defaults

### Internal

- Decouple message handlers from bridge registration (local Map instead of bridge-registered callbacks)
- `__DEV__` build flag for production log stripping — all logging routed through `logger.ts`
- Entity store batch API (`beginEntityBatch`/`endEntityBatch`) for bulk message processing without per-mutation renders
- Browser storage adapter with context invalidation guard for graceful MV3 lifecycle handling
- `useConnectionStatus` hook for consistent connection state derivation

---

## 0.1.0 — Pre-release (b25)

### Orion Validation (b24–b25)

- Fix interceptor race condition — polling for interceptor readiness now runs unconditionally, not just in debug mode (caused silent failure on Orion)
- Improve empty state messaging — show "Awaiting data..." instead of misleading "All supplies OK" / "No active burns" when stores are unpopulated
- First confirmed working build on Orion (iOS)

---

## 0.1.0 — Pre-release (b23)

First build submitted to Firefox AMO. Mobile-optimized overlay for Prosperous Universe that reads game state via WebSocket interception + FIO REST API.

### Core Infrastructure

- WebSocket interceptor with Socket.IO double-decode (engine.io + socket.io framing)
- Cross-world message bus with Firefox Xray wrapper compatibility
- Zustand entity stores (sites, storage, workforce, production, contracts, flights)
- Message handlers for 20+ PrUn WebSocket message types
- FIO REST API integration with sequential fetch and rate-limit awareness
- Data source tracking (websocket vs FIO) with websocket-always-wins priority
- Desktop guard — mobile-only by default, storage override for desktop testing
- Maintenance/downtime detection
- Diagnostics overlay (URL param activated) for debugging data flow

### Views

- **Status** — connection state, message count, data source indicators
- **Burn** — per-site material burn rates with urgency classification (critical/warning/ok/surplus), inventory days remaining, purchase need calculation
- **Fleet** — ship cards with flight progress and destination
- **Contracts** — contract cards with condition status
- **Settings** — FIO API key management, burn thresholds, theme selection

### UI

- Phone-first navigation shell with tab bar
- Material ticker tiles with PrUn-accurate category colors
- Three color themes (Terminal Green, Amber CRT, Cool Blue)
- SHOW APEX floating bar to toggle back to native APEX
- Touch-optimized: 44pt+ targets, no hover dependencies

### Bug Fixes (b22 → b23)

- Fix FIO data overwriting live websocket data (TOCTOU race in populate guards)
- Fix stale FIO production lines persisting after websocket updates (demolished buildings showing phantom burn)
- Fix PRODUCTION_ORDER_REMOVED silently dropping all messages (wire format mismatch)
- Fix ACTION_COMPLETED dispatch routing
- Fix React error #185 from unbatched setState during login burst
- Fix production order handler format expectations
- Fix SHOW APEX bar regression after overlay changes
