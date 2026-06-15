# APXM Changelog

## 0.2.0-beta3 — Base Drill-Down Sheets (2026-06-15)

Tapping a base's status now drills into detail.

### Features

- **Base drill-down sheets** (#52, #54) — tapping a base's BURN, REPAIR, or PROD tile opens a detail sheet that slides up over the current view. PROD shows a phone-first, read-only production view: each building with its running/capacity count and its orders — producing ones first with a QUEUE divider, then waiting — each with live ETA, % done, and recurring/halted state. BURN opens the material breakdown that used to expand inline. REPAIR is a placeholder for now (the current oldest-building figure), pending its own design
- **Tap the logo to go home** (#51) — the APXM logo in the header returns you to the Status view
- **Clearer tappable tiles** (#53) — status tiles you can drill into now have a raised, physical "key" look that presses in when tapped, so it's obvious which tiles do something (touch has no hover to hint at it)

### Changes

- **Base cards no longer expand inline** — every BURN / REPAIR / PROD tile now drills into its own detail sheet instead. More consistent, and it scales as more detail moves into drill-downs

### Internal

- Removed the dead StatusPanel prototype (the original floating-corner panel, long superseded by the current shell + tabs) and the BurnSummaryList it used
- Friendly building names are derived from the production-line type key, matching APEX's labels
- Tests: 402 → 422

---

## 0.2.0-beta2 — Base Status, Empire Burn & Reference Data (2026-06-13)

Bundles two waves of work shipped since the theme release.

### Features

- **Empire-wide burn aggregation** (#4) — the BASE tab has a SITES / EMPIRE toggle. EMPIRE mode rolls every base into one list, one row per material: total inventory, net daily rate, days remaining, and the total amount to buy across the whole empire. A producing base offsets consumers, so days-remaining is whole-empire stock over whole-empire net rate (not an average of per-site figures), and a net-produced material reads as surplus
- **BURN / REPAIR / PROD base status** (#24) — base cards and the dashboard now show three status indicators per base, not just burn. The BURN tab is renamed BASE. Repair age is tracked per base against configurable threshold/offset settings; production status is shown alongside
- **Capacity-aware production status** (#36) — the PROD indicator reflects how much of a base's production capacity is actually running, surfacing idle CapEx at a glance
- **Indicator-aware base filters** (#37) — the RED / YELLOW / GREEN filters match the worst of any indicator (burn, repair, or production), so the filter answers "which bases need attention for any reason". Unknown indicators never drag a base's tier up or down
- **Company identity & liquidity** (#26) — a company-name header with a condensed, expandable liquidity list (ledger-aligned rows, smooth expand/collapse)
- **Material names in burn rows** (#2, partial) — tapping a burn row expands a detail line with the material's full name and its in/out/workforce rate breakdown. Names come from a cached public FIO materials database, so they resolve even without FIO account credentials configured
- **DryDock material theme** (#34) — a third material-tile theme: neon-sign style with the category colour as a bright border and text on a dark fill. Selectable in Settings alongside PrUn and rPrUn

### Changes

- **Filter selections survive tab switches** (#24) — burn, fleet, and contract filter choices persist as you move between tabs (and reset on reload, so a stale filter can't silently hide data)
- **Settings: Cached Data merged into the FIO Data pane** — the clear-cache control now sits with the FIO refresh as one "data freshness" pane, instead of a separate card

### Internal

- **FIO public reference data** (#2) — anonymous (no-auth) client for the materials and exchange endpoints, cached to extension storage (materials 7 days, CX prices 1 hour) and refetched automatically after an extension update. CX prices are cached and exposed via a lookup for a future inventory-valuation UI. Buildings and recipes remain deferred under #2
- Site and empire burn rows are built by one shared helper, so they classify days-remaining, urgency, and need identically
- The `MaterialTheme` type is now owned in one place (the palette module) and re-exported, removing a duplicate definition
- Tests: 320 → 402

---

## 0.2.0-beta1.4 — Theme System (2026-06-06)

### Features

- **Selectable UI themes** (#22) — five presets (PrUn, DryDock, CRT, Vivid, Colorblind) shared with Helm to unify the visual language across the 27bit tools. Pick a theme in Settings → Theme; the choice persists across sessions and applies instantly
- **CVD-safe burn indicators** — the Colorblind preset remaps critical/warning/ok/surplus burn colours to a CVD-safe Okabe-Ito palette (vermillion / yellow / bluish-green / sky blue), so the ~8% of users with red-green colour vision deficiency get legible burn status

### Internal

- Theme tokens are driven by CSS custom properties on the document root (inherited into the Shadow DOM); Tailwind chrome/status tokens now resolve to those vars
- Burn components migrated from ad-hoc Tailwind colours to the themeable `status-*` tokens

---

## 0.2.0-beta1.1 — Burn Fixes & Desktop Polish (2026-03-30)

### Bug Fixes

- **Burn calculation: exclude started orders** (#12) — started (in-progress) production orders are no longer included in rate calculations. Their inputs are already deducted from inventory; including them double-counted rates for materials both produced and consumed on the same planet
- **Burn display: near-zero net rates** — floating-point noise from balanced production chains no longer produces billion-day countdowns. Net rates below 0.001 units/day are treated as zero
- **Planet name derivation** (#13) — unnamed planets in named systems now display derived names (e.g. "Metis b" instead of "LS-014b") in burn view, fleet view, and desktop bridge data
- **ACTS button reactivity** — ACTS buttons in burn/fleet panel headers now show/hide immediately when rprun features setting changes, without needing to close and reopen the panel
- **Liquidity panel state** — expanded/collapsed state persists across menu close/reopen

### Features

- **Panel settings persistence** — burn and fleet panel filter toggles, sort mode, expand/collapse state, and section collapse all survive page refresh
- **Larger ship chevrons** — chevrons scaled up at all zoom levels for visibility. Status grid cells enlarged to match
- **Liquidity alignment** — amounts left-justified to match menu style

### Internal

- Shared address utility (`lib/address.ts`) consolidates three redundant name resolution functions
- Bump `@27bit/helm` v0.8.0 → v0.10.1
- Tests: 308 → 320

---

## 0.1.2-b8 — Fleet & Burn Panel Polish (2026-03-24)

### Features

- **Fleet panel filter buttons** — IDLE and TRANSIT toggle filters in the header, matching burn panel pattern
- **Fleet panel collapsible sections** — Idle and In Transit sections are individually collapsible with chevron indicators and ship counts. Collapse All / Expand All toolbar button
- **Fleet panel sort** — dropdown selector with ETA (default), Name (alphabetical), and Cargo (weight capacity, largest first) sort modes
- **Burn panel sort** — cycle toggle between Burn (urgency, default) and A–Z (alphabetical by planet name)
- **Ship location names** — fleet panel now shows friendly planet names (e.g. "Agamemnon", "Phobos") for idle ships using Helm's FIO planet search index, instead of raw natural IDs (e.g. "ZV-759d")

### Bug Fixes

- **CX station labels** — `systemDisplayName` now returns the station NaturalId (e.g. "ANT") instead of ComexCode (e.g. "AI1"). FIO data has NaturalId as the human-friendly label. Affects all CX labels: fleet panel, ship panel, ship tooltips, warehouse dropdown, transit routes
- **Burn panel infinity display** — materials with infinite days remaining (net positive production) now show ∞ instead of — (em dash). The `formatDays` function already handled Infinity correctly but the caller was converting Infinity to null before passing it
- **Fleet sort dropdown focus** — select element blurs after value change to prevent stealing Escape key from panel dismiss

### Tests (283 → 303)

- **classifyBurnStatus** — 10 new tests: empty input, all-Infinity consuming, threshold boundary conditions (at/below/above critical and warning), output type exclusion, mixed workforce+input priority
- **Entity store batch mode** — 9 new tests: mutations don't trigger Zustand subscribers during batch, single flush on endBatch, shadow state reads during batch, no-op endBatch, setAll/removeOne/clear/setFetched in batch mode
- **Empire state** — `makeSnapshot` test helper updated with all current BridgeSnapshot fields (screens, screenAssignments, burnThresholds, companyName, primaryCurrency, warehouses, siteBurns, rprunDetected, rprunFeaturesDisabled)
- **useSiteStaleness** — extracted `deriveStaleness()` as a testable pure function, eliminated drifted test copy that had different return shape from the actual hook. Tests now call the real derivation logic

---

## 0.1.2 — Buffer Refresh & Caching (2026-02-11)

### Features

- **Per-site buffer refresh** — refresh button on each SiteBurnCard opens the corresponding `BS` buffer in APEX to populate burn data without manual navigation. Replaces the previous "open PRD and WF buffers" workflow.
- **Buffer refresh engine** — programmatic DOM manipulation to open/close APEX buffers, wait for WebSocket data response, and clean up. Same technique rprun uses for XIT BURN.
- **Batch and auto refresh modes** — sequential multi-site refresh and automatic refresh on login, accessible via `?apxm_refresh=batch|auto` URL param for internal testing only. No UI surface in production.
- **Entity store persistence** — all entity stores now persist to `browser.storage.local` with 24-hour TTL and 2-second debounced writes. Cache rehydration on startup provides instant data while waiting for FIO/WebSocket.
- **Per-site staleness indicators** — each SiteBurnCard shows its own data freshness (cached/FIO/live) independently. Refreshing one base no longer flips all indicators to "updated."
- **Clear cached data** — new button in Settings to purge locally cached entity data.
- **Cash balance pane** — balance display in status view.

### Bug Fixes

- Fix FIO staleness indicator never appearing — conditional clear in `CLIENT_CONNECTION_OPENED` preserves cache/FIO data on first WS connection
- Fix all sites jumping to "updated" when one site is buffer-refreshed — per-site source tracking replaces global store-level `dataSource` for staleness display
- Fix burn view stuck loading without FIO key

### Changes

- Empty state text updated from "open PRD and WF buffers" to "tap refresh or open BS buffer in APEX"
- Batch "Refresh All" button removed from BasesView (was only visible in batch mode)
- Auto-refresh progress bar removed from Header (was only visible in auto mode)
- Debug panel mode selector removed (function retained in codebase but not wired up)
- Clear cache button hover color changed from red to yellow for consistency with other settings buttons
- `BUILD_VERSION` and `formatRelativeTime` extracted to shared modules

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
