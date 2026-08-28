import type { PrunApi } from '../types/prun-api';
import type { DetailView } from '../stores/gameState';
import { useShipsStore } from '../stores/entities/ships';
import { useContractsStore } from '../stores/entities/contracts';
import { useSitesStore } from '../stores/entities/sites';
import { extractPlanetNaturalId } from './address';
import { getSiteNameFromAddress } from '../core/burn';

/**
 * Resolves an alert to the detail sheet it should open on tap, or null when
 * there is nothing to open.
 *
 * Resolution happens at RENDER time, not once when the alert arrives: the
 * ship/contract/site an alert points to may since have been sold, closed, or
 * dropped from the store, and a stale WebSocket message's target may never
 * have existed in this session's stores at all. Re-checking on every render
 * means the tap affordance (the row becomes a button) only appears when a
 * tap will actually land somewhere — a row that promises a destination it
 * can't reach is worse than a plain row.
 *
 * There is deliberately NO "open the owning tab with nothing selected"
 * fallback for a miss. Landing on the Fleet tab with no ship highlighted
 * doesn't tell the user anything more than staying put would, and it costs
 * them a navigation they didn't ask for. A flat, non-interactive row is the
 * honest representation of "this alert doesn't lead anywhere right now."
 */
export function resolveAlertTarget(alert: PrunApi.Alert): DetailView | null {
  switch (alert.type) {
    case 'SHIP_FLIGHT_ENDED':
    // A finished shipyard project is a new ship; it resolves only once the
    // fleet store has it (same shipId/registration scan as an arrival).
    case 'SHIPYARD_PROJECT_FINISHED':
      return resolveShipTarget(alert);

    case 'COMEX_PICKUP_CONTRACT_CREATED':
      return resolveContractTarget(alert);

    case 'PRODUCTION_ORDER_FINISHED':
      return resolveSiteTarget(alert, 'production');

    case 'WORKFORCE_LOW_SUPPLIES':
    case 'WORKFORCE_OUT_OF_SUPPLIES':
    case 'WORKFORCE_UNSATISFIED':
      return resolveSiteTarget(alert, 'burn');

    default:
      // Every CONTRACT_* type shares the same 'contract' data key.
      if (alert.type.startsWith('CONTRACT_')) return resolveContractTarget(alert);
      return null;
  }
}

function dataValue(alert: PrunApi.Alert, key: string): unknown {
  return alert.data.find((d) => d.key === key)?.value;
}

function dataString(alert: PrunApi.Alert, key: string): string | undefined {
  const v = dataValue(alert, key);
  return typeof v === 'string' ? v : undefined;
}

/** Keys like planet/address wrap an Address: { address: {...} }. */
function dataAddress(alert: PrunApi.Alert, key: string): PrunApi.Address | undefined {
  const v = dataValue(alert, key) as { address?: PrunApi.Address } | undefined;
  return v?.address;
}

function resolveShipTarget(alert: PrunApi.Alert): DetailView | null {
  const shipId = dataString(alert, 'shipId');
  const ships = useShipsStore.getState();

  let ship = shipId ? ships.getById(shipId) : undefined;

  // shipId is the typed key, but whether every SHIP_FLIGHT_ENDED payload
  // carries it is unconfirmed on the wire — registration is the other
  // identifier the alert can carry, so scan for it rather than assume.
  if (!ship) {
    const registration = dataString(alert, 'registration');
    if (!registration) return null;
    ship = ships.getAll().find((s) => s.registration === registration);
  }

  if (!ship) return null;
  return { type: 'ship', shipId: ship.id, shipName: ship.name };
}

function resolveContractTarget(alert: PrunApi.Alert): DetailView | null {
  const value = dataString(alert, 'contract');
  if (!value) return null;

  const contracts = useContractsStore.getState();
  // Unconfirmed on the wire whether 'contract' carries the id or the
  // human-facing localId — try both rather than assume.
  const contract = contracts.getById(value) ?? contracts.getAll().find((c) => c.localId === value);
  if (!contract) return null;

  return { type: 'contract', contractId: contract.id, contractName: contract.localId };
}

function resolveSiteTarget(
  alert: PrunApi.Alert,
  type: 'burn' | 'production'
): DetailView | null {
  const address = dataAddress(alert, 'planet') ?? dataAddress(alert, 'address');
  if (!address) return null;

  const naturalId = extractPlanetNaturalId(address);
  if (!naturalId) return null;

  const site = useSitesStore
    .getState()
    .getAll()
    .find((s) => extractPlanetNaturalId(s.address) === naturalId);
  if (!site) return null;

  return { type, siteId: site.siteId, siteName: getSiteNameFromAddress(site.address) };
}
