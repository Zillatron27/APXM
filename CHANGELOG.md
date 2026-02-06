# APXM Changelog

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
