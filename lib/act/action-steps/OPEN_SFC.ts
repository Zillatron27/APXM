// Ported from refined-prun src/features/XIT/ACT/action-steps/OPEN_SFC.ts.
//
// OPEN_SFC only fires when MTRA transfers material into a ship store (the
// auto-SFC flow). Base resupply and repair flows never trigger it. The full
// desktop implementation opens a split SFC tile and optionally sets a
// destination — both require desktop-only Window.window / tile.frame APIs
// that do not exist on mobile.
//
// Mobile: log an informational message and complete automatically so the user
// knows to send the ship manually via APEX.

import { act } from '../act-registry';
import { useShipsStore } from '../../../stores/entities/ships';

interface Data {
  shipId: string;
  destination?: string;
  label?: string;
}

function buildMessage(data: Data): string {
  const ship = useShipsStore.getState().getById(data.shipId);
  const shipLabel = ship?.name ?? ship?.registration ?? data.shipId;
  const label = data.label ?? 'Resupply';
  return data.destination
    ? `${label} loaded onto ${shipLabel}. Manually send to ${data.destination} in APEX.`
    : `${label} loaded onto ${shipLabel}. Manually send ship in APEX.`;
}

export const OPEN_SFC = act.addActionStep<Data>({
  type: 'OPEN_SFC',
  description: data => buildMessage(data),
  execute: async ctx => {
    ctx.complete();
  },
});
