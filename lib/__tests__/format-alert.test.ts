import { describe, it, expect } from 'vitest';
import { formatAlert } from '../format-alert';
import type { PrunApi } from '../../types/prun-api';
import { createTestAlert, createAddress } from '../../__tests__/fixtures/factories';

function withData(
  type: PrunApi.AlertType,
  data: PrunApi.AlertData[] = []
): PrunApi.Alert {
  return createTestAlert({ type, data });
}

describe('formatAlert — explicit templates', () => {
  it('COMEX_ORDER_FILLED includes quantity and commodity when present', () => {
    const result = formatAlert(
      withData('COMEX_ORDER_FILLED', [
        { key: 'commodity', value: 'RAT' },
        { key: 'quantity', value: 500 },
      ])
    );
    expect(result.text).toBe('CX order filled: 500x RAT');
    expect(result.category).toBe('trade');
  });

  it('COMEX_ORDER_FILLED degrades gracefully without data', () => {
    expect(formatAlert(withData('COMEX_ORDER_FILLED')).text).toBe('CX order filled');
  });

  it('PRODUCTION_ORDER_FINISHED composes material and planet', () => {
    const result = formatAlert(
      withData('PRODUCTION_ORDER_FINISHED', [
        { key: 'material', value: 'PE' },
        { key: 'quantity', value: 200 },
        { key: 'planet', value: { address: createAddress({ planetName: 'Montem' }) } },
      ])
    );
    expect(result.text).toBe('Production finished: 200x PE @ Montem');
    expect(result.category).toBe('production');
  });

  it('SHIP_FLIGHT_ENDED names the ship and destination', () => {
    const result = formatAlert(
      withData('SHIP_FLIGHT_ENDED', [
        { key: 'registration', value: 'AVI-04X21' },
        { key: 'destination', value: { address: createAddress({ planetName: 'Promitor' }) } },
      ])
    );
    expect(result.text).toBe('AVI-04X21 arrived at Promitor');
    expect(result.category).toBe('fleet');
  });

  it('workforce alerts carry the planet and escalate wording', () => {
    const planet = { key: 'planet' as const, value: { address: createAddress({ planetName: 'Vallis' }) } };
    expect(formatAlert(withData('WORKFORCE_LOW_SUPPLIES', [planet])).text).toBe(
      'Workforce low on supplies @ Vallis'
    );
    expect(formatAlert(withData('WORKFORCE_OUT_OF_SUPPLIES', [planet])).text).toBe(
      'Workforce OUT of supplies @ Vallis'
    );
    expect(formatAlert(withData('WORKFORCE_UNSATISFIED', [planet])).category).toBe('workforce');
  });

  it('contract family shares the verb-phrase template with the partner name', () => {
    const result = formatAlert(
      withData('CONTRACT_CONTRACT_RECEIVED', [
        { key: 'partner', value: { name: 'Trade Partner Corp' } },
      ])
    );
    expect(result.text).toBe('Contract received — Trade Partner Corp');
    expect(result.category).toBe('contract');
  });

  it('contract deadline variants both read as deadline exceeded', () => {
    expect(formatAlert(withData('CONTRACT_DEADLINE_EXCEEDED_WITH_CONTROL')).text).toBe(
      'Contract deadline exceeded'
    );
    expect(formatAlert(withData('CONTRACT_DEADLINE_EXCEEDED_WITHOUT_CONTROL')).text).toBe(
      'Contract deadline exceeded'
    );
  });
});

describe('formatAlert — fallback for untemplated types', () => {
  it('humanizes the enum name', () => {
    const result = formatAlert(withData('GATEWAY_LINK_ESTABLISHED'));
    expect(result.text).toBe('Gateway link established');
    expect(result.category).toBe('fleet');
  });

  it('appends a salient data value when one is recognisable', () => {
    const result = formatAlert(
      withData('COGC_PROGRAM_CHANGED', [{ key: 'program', value: 'ADVERTISING_AGRICULTURE' }])
    );
    expect(result.text).toBe('Cogc program changed: ADVERTISING_AGRICULTURE');
    expect(result.category).toBe('base');
  });

  it('never throws on unknown data shapes (boundary rule: hostile input)', () => {
    const result = formatAlert(
      withData('RELEASE_NOTES', [
        { key: 'weird', value: { nested: [1, 2, 3] } },
        { key: 'quantity', value: 'not-a-number' as unknown as number },
      ])
    );
    expect(result.text).toBe('Release notes');
    expect(result.category).toBe('system');
  });
});
