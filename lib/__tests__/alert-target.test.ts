import { describe, it, expect, beforeEach } from 'vitest';
import { resolveAlertTarget } from '../alert-target';
import { useShipsStore } from '../../stores/entities/ships';
import { useContractsStore } from '../../stores/entities/contracts';
import { useSitesStore } from '../../stores/entities/sites';
import type { PrunApi } from '../../types/prun-api';
import {
  createTestAlert,
  createTestShip,
  createTestContract,
  createTestSite,
  createAddress,
} from '../../__tests__/fixtures/factories';

function withData(type: PrunApi.AlertType, data: PrunApi.AlertData[] = []): PrunApi.Alert {
  return createTestAlert({ type, data });
}

const address = (key: 'planet' | 'address', planetName: string): PrunApi.AlertData => ({
  key,
  value: { address: createAddress({ planetName }) },
});

beforeEach(() => {
  useShipsStore.getState().clear();
  useContractsStore.getState().clear();
  useSitesStore.getState().clear();
});

describe('resolveAlertTarget — ships', () => {
  it('resolves SHIP_FLIGHT_ENDED via shipId', () => {
    const ship = createTestShip({ name: 'Wanderer' });
    useShipsStore.getState().setOne(ship);

    const target = resolveAlertTarget(withData('SHIP_FLIGHT_ENDED', [{ key: 'shipId', value: ship.id }]));
    expect(target).toEqual({ type: 'ship', shipId: ship.id, shipName: 'Wanderer' });
  });

  it('falls back to a registration scan when shipId is absent or unmatched', () => {
    const ship = createTestShip({ registration: 'XYZ-9999', name: 'Comet' });
    useShipsStore.getState().setOne(ship);

    const target = resolveAlertTarget(
      withData('SHIP_FLIGHT_ENDED', [{ key: 'registration', value: 'XYZ-9999' }])
    );
    expect(target).toEqual({ type: 'ship', shipId: ship.id, shipName: 'Comet' });
  });

  it('returns null when no ship matches', () => {
    const target = resolveAlertTarget(
      withData('SHIP_FLIGHT_ENDED', [{ key: 'registration', value: 'NOPE-1' }])
    );
    expect(target).toBeNull();
  });
});

describe('resolveAlertTarget — contracts', () => {
  it('resolves via contract id', () => {
    const contract = createTestContract({ localId: 'CT-042' });
    useContractsStore.getState().setOne(contract);

    const target = resolveAlertTarget(
      withData('CONTRACT_CONTRACT_RECEIVED', [{ key: 'contract', value: contract.id }])
    );
    expect(target).toEqual({ type: 'contract', contractId: contract.id, contractName: 'CT-042' });
  });

  it('resolves via localId when the wire value is not the id', () => {
    const contract = createTestContract({ localId: 'CT-777' });
    useContractsStore.getState().setOne(contract);

    const target = resolveAlertTarget(
      withData('COMEX_PICKUP_CONTRACT_CREATED', [{ key: 'contract', value: 'CT-777' }])
    );
    expect(target).toEqual({ type: 'contract', contractId: contract.id, contractName: 'CT-777' });
  });

  it('returns null when the contract is absent', () => {
    const target = resolveAlertTarget(
      withData('CONTRACT_CONTRACT_BREACHED', [{ key: 'contract', value: 'nope' }])
    );
    expect(target).toBeNull();
  });
});

describe('resolveAlertTarget — sites', () => {
  it('resolves WORKFORCE alerts to the matching site as a burn target', () => {
    const site = createTestSite({ address: createAddress({ planetName: 'Montem' }) });
    useSitesStore.getState().setOne(site);

    const target = resolveAlertTarget(withData('WORKFORCE_OUT_OF_SUPPLIES', [address('planet', 'Montem')]));
    expect(target).toEqual({ type: 'burn', siteId: site.siteId, siteName: 'Montem' });
  });

  it('falls back to the address data key when planet is absent', () => {
    const site = createTestSite({ address: createAddress({ planetName: 'Promitor' }) });
    useSitesStore.getState().setOne(site);

    const target = resolveAlertTarget(withData('WORKFORCE_UNSATISFIED', [address('address', 'Promitor')]));
    expect(target).toEqual({ type: 'burn', siteId: site.siteId, siteName: 'Promitor' });
  });

  it('resolves PRODUCTION_ORDER_FINISHED to a production target', () => {
    const site = createTestSite({ address: createAddress({ planetName: 'Katoa' }) });
    useSitesStore.getState().setOne(site);

    const target = resolveAlertTarget(withData('PRODUCTION_ORDER_FINISHED', [address('planet', 'Katoa')]));
    expect(target).toEqual({ type: 'production', siteId: site.siteId, siteName: 'Katoa' });
  });

  it('returns null when no site matches the planet', () => {
    const target = resolveAlertTarget(withData('WORKFORCE_LOW_SUPPLIES', [address('planet', 'Nowhere')]));
    expect(target).toBeNull();
  });
});

describe('resolveAlertTarget — non-resolvable and hostile data', () => {
  it('returns null for types with no navigation target', () => {
    expect(resolveAlertTarget(withData('COMEX_TRADE'))).toBeNull();
    expect(resolveAlertTarget(withData('RELEASE_NOTES'))).toBeNull();
  });

  it('returns null instead of throwing on garbage data shapes', () => {
    expect(() =>
      resolveAlertTarget(withData('SHIP_FLIGHT_ENDED', [{ key: 'shipId', value: 12345 as unknown as string }]))
    ).not.toThrow();
    expect(
      resolveAlertTarget(withData('SHIP_FLIGHT_ENDED', [{ key: 'shipId', value: 12345 as unknown as string }]))
    ).toBeNull();

    expect(() =>
      resolveAlertTarget(withData('WORKFORCE_UNSATISFIED', [{ key: 'planet', value: 'not-an-address' }]))
    ).not.toThrow();
    expect(
      resolveAlertTarget(withData('WORKFORCE_UNSATISFIED', [{ key: 'planet', value: 'not-an-address' }]))
    ).toBeNull();

    expect(resolveAlertTarget(withData('CONTRACT_CONTRACT_CANCELLED', []))).toBeNull();
  });
});
