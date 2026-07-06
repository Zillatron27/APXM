import { describe, it, expect, beforeEach } from 'vitest';
import type { PrunApi } from '../prun-api';
import {
  createTestSite,
  createTestStorage,
  createTestWorkforce,
  createTestProductionLine,
  createTestShip,
  createTestFlight,
  createTestContract,
  createMaterial,
  createAddress,
  resetIdCounter,
} from '../../__tests__/fixtures/factories';

/**
 * What this file does and does NOT guard — be honest about the contract:
 *
 * - It does NOT verify the types match the game server's wire format. Types
 *   are erased at runtime, and no captured wire data is checked here. If the
 *   server's format drifts, nothing in this repo turns red automatically;
 *   the diagnostics overlay's unknown-message tracking and manual testing
 *   are the actual detection paths.
 * - The typed literals below ARE checked — at compile time, by the
 *   `npx tsc --noEmit` gate (the vitest run itself strips types unchecked;
 *   see the CLAUDE.md typecheck gotcha). They pin that our own type
 *   definitions stay assignable from realistically-shaped objects, so a
 *   type edit that breaks an established shape fails the typecheck.
 * - The factory assertions guard the shared test fixtures: every suite in
 *   the repo builds its inputs from these factories, so a factory that
 *   silently stopped producing platforms/segments/conditions would weaken
 *   many tests at once. Assertions here pin the structural invariants the
 *   other suites rely on.
 */
describe('PrunApi types and fixture factories', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('compile-time wire-shape literals (checked by tsc, not vitest)', () => {
    it('representative entity shapes stay assignable', () => {
      const material: PrunApi.Material = {
        id: 'mat-123',
        name: 'Basic Rations',
        ticker: 'RAT',
        category: 'consumables (basic)',
        weight: 0.21,
        volume: 0.1,
        resource: false,
      };

      const address: PrunApi.Address = {
        lines: [
          { type: 'SYSTEM', entity: { id: 'sys-1', naturalId: 'ZV-307', name: 'Moria' } },
          {
            type: 'PLANET',
            entity: { id: 'pl-1', naturalId: 'ZV-307b', name: 'Metis b' },
            orbit: null,
          } as unknown as PrunApi.AddressLine,
        ],
      };

      const site: PrunApi.Site = {
        siteId: 'site-123',
        address,
        founded: { timestamp: 1700000000000 },
        platforms: [],
        buildOptions: { options: [] },
        area: 500,
        investedPermits: 1,
        maximumPermits: 10,
      };

      const store: PrunApi.Store = {
        id: 'store-1',
        addressableId: 'site-123',
        name: null,
        weightLoad: 10,
        weightCapacity: 500,
        volumeLoad: 8,
        volumeCapacity: 500,
        items: [],
        fixed: true,
        tradeStore: false,
        rank: 0,
        locked: false,
        type: 'STORE',
      };

      // Touch the values so the literals aren't dead code; the real check is
      // that the annotations above compile.
      expect([material.ticker, site.siteId, store.type, address.lines.length]).toEqual([
        'RAT',
        'site-123',
        'STORE',
        2,
      ]);
    });
  });

  describe('fixture factory invariants (what the other suites rely on)', () => {
    it('createMaterial produces a complete material with physical properties', () => {
      const material = createMaterial();
      expect(material.id).not.toBe('');
      expect(material.ticker).not.toBe('');
      expect(material.weight).toBeGreaterThan(0);
      expect(material.volume).toBeGreaterThan(0);
    });

    it('createAddress produces resolvable lines (address display code depends on this)', () => {
      const address = createAddress();
      expect(address.lines.length).toBeGreaterThan(0);
      for (const line of address.lines) {
        expect(line.entity).toBeDefined();
        expect(line.entity?.naturalId).not.toBe('');
      }
    });

    it('createTestSite produces platforms with reactor modules (repair engine depends on this)', () => {
      const site = createTestSite();
      expect(site.platforms.length).toBeGreaterThan(0);
      expect(site.platforms[0].module.reactorTicker).not.toBe('');
      expect(site.platforms[0].module.reactorName).not.toBe('');
    });

    it('createTestStorage defaults to the STORE type (burn engine counts only STORE)', () => {
      expect(createTestStorage().type).toBe('STORE');
    });

    it('createTestWorkforce carries needs (burn workforce consumption depends on this)', () => {
      const wf = createTestWorkforce();
      expect(wf.workforces.length).toBeGreaterThan(0);
      expect(wf.workforces[0].needs.length).toBeGreaterThan(0);
    });

    it('createTestProductionLine carries typed orders', () => {
      const line = createTestProductionLine();
      expect(line.capacity).toBeGreaterThan(0);
      expect(Array.isArray(line.orders)).toBe(true);
    });

    it('createTestShip and createTestFlight produce linked, segmented flight data', () => {
      const ship = createTestShip();
      const flight = createTestFlight();
      expect(ship.id).not.toBe('');
      expect(flight.segments.length).toBeGreaterThan(0);
    });

    it('createTestContract produces conditions with ids (dependency logic depends on this)', () => {
      const contract = createTestContract();
      expect(contract.conditions.length).toBeGreaterThan(0);
      for (const cond of contract.conditions) {
        expect(cond.id).not.toBe('');
      }
    });

    it('resetIdCounter makes factory ids deterministic across tests', () => {
      const first = createTestSite().siteId;
      resetIdCounter();
      const second = createTestSite().siteId;
      expect(second).toBe(first);
    });
  });
});
