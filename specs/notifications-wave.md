# Notifications Wave — Build Plan

Issues: #90 (rendering), #91 (tap-through), #92 (context/count), #93 (mark-as-read), #94 (dedicated surface). Supersedes the "notification pass-through" line in #30.

Goal: turn the AlertsPanel from a log into a real notifications surface — attention flows in (tap-through), is triaged fast (labels/colour/tickers), and clears out (mark-as-read) — then give it a first-class home (header button + full view).

Source material: rPrun's five NOTS features (refined-prun, MIT — credit in code where tables are lifted). rPrun patches the game-rendered DOM; APXM composes text from wire data, so we adopt their editorial tables and behaviours, not their code.

## Build order

Ordered so each phase ships independently and the UI phase lands last on top of finished content.

### Phase 1 — Rendering (#90)
Pure `lib/format-alert.ts` + AlertsPanel row work. No store/nav/ACT changes.

1. Replace the 7-bucket `AlertCategory` with rPrun's label table (~60 types → `{label, tone}`); tones resolve through APXM theme tokens (all 5 presets, Colorblind included), never hardcoded hex.
2. Add terse templates for families currently hitting the humanized fallback (COGC, POPI, admin-centre, gateway, corporation, shipyard, expert, POPR, pickup contracts, licence/system) — rPrun's clean-notifications patch list is the checklist.
3. Material ticker chips: FIO reference store name→ticker lookup, `MaterialTile` in the row; tolerate lookup misses (FIO/APEX name drift), fall back to raw name.
4. Severity: OUT_OF_SUPPLIES / warehouse-locked class renders status-critical.

Risk: low. Test-heavy (formatter is pure). Device check: row density at 320pt with chip + label + time.

### Phase 2 — Tap-through (#91)
Alert row → existing `detailView`/`DetailSheet` surfaces. Ship → ShipDetailView, contract → ContractDetailView, workforce → base burn sheet, production → base prod sheet; COMEX/FOREX inert. Resolution tolerates absent entities (closed contract etc.) → no-op or owning tab. Affordance only on rows with a target.

Risk: low-medium (entity resolution edge cases). Depends on Phase 1 only for row layout stability.

### Phase 3 — Context + count (#92)
1. Audit what the store's unread list does with other-context (CORP) alerts today; make it deliberate: own-context primary, other-context as a separate count (rPrun `reachableAlerts` model). Needs the context id source (company store / UI data) confirmed on device.
2. Expose a single unread-count selector as the source for AttentionPanel/header. Where it renders finalises in Phase 5; an AttentionPanel entry can ship here cheaply (`reconcileOrder` makes Status additions migration-free).

Risk: medium — context semantics need live wire data to verify.

### Phase 4 — Mark-as-read (#93)
Discovery session first (device + CDP harness): does the driven NOTS buffer expose per-alert dismiss? mark-all? does simply rendering NOTS mark alerts read? what delta comes back (expect ALERTS_ALERT read=true)?

Then: per-alert dismiss (+ mark-all if available) through the ACT DOM layer (mobile-buffer-navigator, apex-button, action-lock — the contract-actions pattern). User-initiated per tap (HARD RULE). #84 card-prevention sweep on exit. Store updates via the natural delta; no optimistic mutation unless the delta proves unreliable.

Risk: highest — gated on discovery. If NOTS turns out to mark-read-by-rendering, scope may collapse to a much simpler "open NOTS silently" action; if no control exists, the feature dies and the panel stays display-only. Either outcome is fine; find out before building.

### Phase 5 — Dedicated surface (#94)
Header NOTS button with unread badge (count from Phase 3) + full alerts view (DetailSheet variant or dedicated view — pick against existing patterns). Decide AlertsPanel disposition: retire, or keep as top-N mini-list like BasesMiniList. Constraints: 320pt header space, ≥44pt touch target.

Risk: low mechanically; the design decisions are the work. Last because it hosts everything the earlier phases built.

## Release shape

Phases 1–3 are releasable as a point release if Phase 4 discovery stalls. The full wave (1–5) is the natural next minor (v1.3.0, "the notifications release"). Management actions (#25 Phase D / #28) start after this wave; Phase 4 doubles as a warm-up for that work (same drive-a-buffer pattern, low stakes).
