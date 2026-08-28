import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatAlert, labelFor } from '../format-alert';
import { useMaterialsStore } from '../../stores/reference';
import type { PrunApi } from '../../types/prun-api';
import { createTestAlert, createAddress } from '../../__tests__/fixtures/factories';

function withData(type: PrunApi.AlertType, data: PrunApi.AlertData[] = []): PrunApi.Alert {
  return createTestAlert({ type, data });
}

const planet = (name: string): PrunApi.AlertData => ({
  key: 'planet',
  value: { address: createAddress({ planetName: name }) },
});

beforeEach(() => {
  useMaterialsStore.getState().setAll([]);
});

describe('formatAlert — label table', () => {
  it('covers every member of the AlertType union', () => {
    // The union is erased at runtime, so read it back out of the source:
    // a type the game adds must get a label, not fall through to APEX/neutral.
    const src = readFileSync(resolve(__dirname, '../../types/prun-api.ts'), 'utf8');
    const union = src.slice(src.indexOf('export type AlertType ='));
    const body = union.slice(0, union.indexOf(';'));
    const types = Array.from(body.matchAll(/'([A-Z_]+)'/g), (m) => m[1] as PrunApi.AlertType);
    expect(types.length).toBeGreaterThan(50);
    const missing = types.filter((t) => labelFor(t) === undefined);
    expect(missing).toEqual([]);
  });

  it('assigns family labels and tones', () => {
    expect(formatAlert(withData('COMEX_TRADE'))).toMatchObject({ label: 'TRADE', tone: 'ok' });
    expect(formatAlert(withData('COMEX_ORDER_FILLED'))).toMatchObject({ label: 'ORDER', tone: 'warning' });
    expect(formatAlert(withData('SHIP_FLIGHT_ENDED'))).toMatchObject({ label: 'ARRIVAL', tone: 'info' });
    expect(formatAlert(withData('CORPORATION_PROJECT_FINISHED'))).toMatchObject({ label: 'CORP', tone: 'neutral' });
  });

  it('escalates per-type severity above the family default', () => {
    expect(formatAlert(withData('WORKFORCE_LOW_SUPPLIES')).tone).toBe('warning');
    expect(formatAlert(withData('WORKFORCE_OUT_OF_SUPPLIES')).tone).toBe('critical');
    expect(formatAlert(withData('WAREHOUSE_STORE_LOCKED_INSUFFICIENT_FUNDS')).tone).toBe('critical');
    expect(formatAlert(withData('WAREHOUSE_STORE_UNLOCKED')).tone).toBe('ok');
    expect(formatAlert(withData('GATEWAY_JUMP_ABORTED_NO_FUEL')).tone).toBe('warning');
    expect(formatAlert(withData('GATEWAY_LINK_ESTABLISHED')).tone).toBe('info');
  });
});

describe('formatAlert — material chips', () => {
  it('resolves an exact ticker the materials database knows', () => {
    useMaterialsStore.getState().setAll([
      { ticker: 'RAT', name: 'Rations', category: 'consumables (basic)', weight: 1, volume: 1 },
    ]);
    const result = formatAlert(
      withData('COMEX_ORDER_FILLED', [
        { key: 'commodity', value: 'RAT' },
        { key: 'quantity', value: 500 },
      ])
    );
    expect(result.text).toBe('CX order filled: 500x RAT');
    expect(result.material).toEqual({ ticker: 'RAT', name: 'RAT', quantity: 500 });
  });

  it('resolves a display name through the materials database, case-insensitively', () => {
    useMaterialsStore.getState().setAll([
      { ticker: 'BER', name: 'Beryl Crystals', category: 'minerals', weight: 1, volume: 1 },
    ]);
    const result = formatAlert(
      withData('PRODUCTION_ORDER_FINISHED', [
        { key: 'material', value: 'beryl crystals' },
        { key: 'quantity', value: 20 },
        planet('Montem'),
      ])
    );
    expect(result.material?.ticker).toBe('BER');
    expect(result.text).toBe('Production finished: 20x BER @ Montem');
  });

  it('resolves the wire form seen on device: camelCase internal names matching FIO MaterialName', () => {
    useMaterialsStore.getState().setAll([
      { ticker: 'PWO', name: 'pioneerLuxuryDrink', category: 'consumables (luxury)', weight: 1, volume: 1 },
    ]);
    const result = formatAlert(
      withData('COMEX_TRADE', [{ key: 'commodity', value: 'pioneerLuxuryDrink' }, { key: 'quantity', value: 40 }])
    );
    expect(result.material?.ticker).toBe('PWO');
    expect(result.text).toBe('CX trade: 40x PWO');
  });

  it('never shows the wire identifier when the lookup misses — placeholder in text, identifier kept for aria', () => {
    useMaterialsStore.getState().setAll([
      { ticker: 'BER', name: 'beryl', category: 'minerals', weight: 1, volume: 1 },
    ]);
    const result = formatAlert(
      withData('PRODUCTION_ORDER_FINISHED', [{ key: 'material', value: 'Beryl Crystals' }])
    );
    expect(result.material).toEqual({ ticker: undefined, name: 'Beryl Crystals', quantity: undefined });
    expect(result.text).toBe('Production finished: ?');
    expect(result.text).not.toContain('Beryl');
  });

  it('COMEX_ORDER_FILLED degrades gracefully without data', () => {
    const result = formatAlert(withData('COMEX_ORDER_FILLED'));
    expect(result.text).toBe('CX order filled');
    expect(result.material).toBeUndefined();
  });
});

describe('formatAlert — templates', () => {
  it('SHIP_FLIGHT_ENDED names the ship and destination', () => {
    const result = formatAlert(
      withData('SHIP_FLIGHT_ENDED', [
        { key: 'registration', value: 'AVI-04X21' },
        { key: 'destination', value: { address: createAddress({ planetName: 'Promitor' }) } },
      ])
    );
    expect(result.text).toBe('AVI-04X21 arrived at Promitor');
  });

  it('SHIP_FLIGHT_ENDED prefers a resolved ship name over the registration', () => {
    const alert = withData('SHIP_FLIGHT_ENDED', [
      { key: 'registration', value: 'AVI-04X21' },
      { key: 'destination', value: { address: createAddress({ planetName: 'Promitor' }) } },
    ]);
    expect(formatAlert(alert, { shipName: 'Wanderer' }).text).toBe('Wanderer arrived at Promitor');
  });

  it('workforce alerts carry the planet and escalate wording', () => {
    expect(formatAlert(withData('WORKFORCE_LOW_SUPPLIES', [planet('Vallis')])).text).toBe(
      'Workforce low on supplies @ Vallis'
    );
    expect(formatAlert(withData('WORKFORCE_OUT_OF_SUPPLIES', [planet('Vallis')])).text).toBe(
      'Workforce OUT of supplies @ Vallis'
    );
  });

  it('contract family shares the verb-phrase template with the partner name', () => {
    const result = formatAlert(
      withData('CONTRACT_CONTRACT_RECEIVED', [{ key: 'partner', value: { name: 'Trade Partner Corp' } }])
    );
    expect(result.text).toBe('Contract received — Trade Partner Corp');
    expect(result.label).toBe('CONTRACT');
  });

  it('contract deadline variants both read as deadline exceeded', () => {
    expect(formatAlert(withData('CONTRACT_DEADLINE_EXCEEDED_WITH_CONTROL')).text).toBe('Contract deadline exceeded');
    expect(formatAlert(withData('CONTRACT_DEADLINE_EXCEEDED_WITHOUT_CONTROL')).text).toBe('Contract deadline exceeded');
  });

  it('COGC program change humanizes the program and names the place', () => {
    const result = formatAlert(
      withData('COGC_PROGRAM_CHANGED', [{ key: 'program', value: 'ADVERTISING_AGRICULTURE' }, planet('Montem')])
    );
    expect(result.text).toBe('COGC program: Advertising agriculture @ Montem');
    expect(result.label).toBe('COGC');
  });

  it('expert dropped names the expertise and place', () => {
    const result = formatAlert(
      withData('SITE_EXPERT_DROPPED', [{ key: 'expertiseCategory', value: 'METALLURGY' }, planet('Vallis')])
    );
    expect(result.text).toBe('Expert dropped: Metallurgy @ Vallis');
  });

  it('fixed-text families append the place when the game attaches one', () => {
    expect(formatAlert(withData('GATEWAY_JUMP_ABORTED_NO_FUEL')).text).toBe('Jump aborted — no fuel');
    expect(formatAlert(withData('POPULATION_PROJECT_UPGRADED', [planet('Montem')])).text).toBe(
      'POPI upgraded @ Montem'
    );
    expect(formatAlert(withData('ADMIN_CENTER_MOTION_PASSED', [{ key: 'address', value: { address: createAddress({ planetName: 'Promitor' }) } }])).text).toBe(
      'Motion passed @ Promitor'
    );
    expect(formatAlert(withData('CORPORATION_SHAREHOLDER_DIVIDEND_RECEIVED')).text).toBe('Dividend received');
    expect(formatAlert(withData('SHIPYARD_PROJECT_FINISHED')).text).toBe('Ship built');
    expect(formatAlert(withData('USER_LICENSE_EXPIRED'))).toMatchObject({ text: 'Licence expired', tone: 'critical' });
  });

  it('never throws on unknown data shapes (boundary rule: hostile input)', () => {
    const result = formatAlert(
      withData('RELEASE_NOTES', [
        { key: 'weird', value: { nested: [1, 2, 3] } },
        { key: 'quantity', value: 'not-a-number' as unknown as number },
      ])
    );
    expect(result.text).toBe('Release notes');
    expect(result.label).toBe('APEX');
  });

  it('humanizes a type the table does not know', () => {
    const result = formatAlert(withData('SOME_FUTURE_ALERT' as PrunApi.AlertType, [planet('Vallis')]));
    expect(result.text).toBe('Some future alert: Vallis');
    expect(result).toMatchObject({ label: 'APEX', tone: 'neutral' });
  });
});
