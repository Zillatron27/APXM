import { describe, it, expect } from 'vitest';
import { resolveGate, type RequiredStore } from '../DataGate';

function store(name: string, fetched: boolean, canFio: boolean): RequiredStore {
  return { name, fetched, canFio };
}

describe('resolveGate', () => {
  describe('all stores fetched → ready', () => {
    it('returns ready when all stores are fetched', () => {
      const stores = [store('sites', true, true), store('ships', true, false)];
      const result = resolveGate(stores, 'live', true, 10);
      expect(result.state).toBe('ready');
    });

    it('returns ready with empty store list', () => {
      const result = resolveGate([], 'connecting', false, 0);
      expect(result.state).toBe('ready');
    });
  });

  describe('never connected → connecting', () => {
    it('shows connecting message when not connected and no messages received', () => {
      const stores = [store('sites', false, true)];
      const result = resolveGate(stores, 'connecting', false, 0);
      expect(result).toEqual({
        state: 'connecting',
        message: 'Connecting to APEX...',
        pulse: true,
      });
    });
  });

  describe('FIO-only + non-FIO stores → waiting for APEX', () => {
    it('shows waiting message when FIO-only and unfetched stores cannot use FIO', () => {
      const stores = [store('ships', false, false)];
      const result = resolveGate(stores, 'fio', false, 5);
      expect(result).toEqual({
        state: 'waiting-for-apex',
        message: 'Waiting for APEX connection...',
        pulse: false,
      });
    });

    it('shows waiting message for multiple non-FIO stores', () => {
      const stores = [store('ships', false, false), store('contracts', false, false)];
      const result = resolveGate(stores, 'fio', false, 5);
      expect(result.state).toBe('waiting-for-apex');
    });

    it('does NOT show waiting when some unfetched stores can use FIO', () => {
      const stores = [store('sites', false, true), store('ships', false, false)];
      const result = resolveGate(stores, 'fio', false, 5);
      // Mixed: some can FIO, so we show loading, not waiting
      expect(result.state).toBe('loading');
    });

    it('ignores already-fetched non-FIO stores', () => {
      // ships already fetched, contracts not — only contracts matters
      const stores = [store('ships', true, false), store('contracts', false, false)];
      const result = resolveGate(stores, 'fio', false, 5);
      expect(result.state).toBe('waiting-for-apex');
    });
  });

  describe('connected + stores loading → loading', () => {
    it('shows loading with specific store names', () => {
      const stores = [store('sites', false, true), store('fleet', false, false)];
      const result = resolveGate(stores, 'live', true, 10);
      expect(result).toEqual({
        state: 'loading',
        message: 'Loading sites, fleet...',
        pulse: true,
      });
    });

    it('shows loading for single unfetched store', () => {
      const stores = [store('sites', true, true), store('fleet', false, false)];
      const result = resolveGate(stores, 'live', true, 10);
      expect(result).toEqual({
        state: 'loading',
        message: 'Loading fleet...',
        pulse: true,
      });
    });

    it('shows loading when connecting status with messages received', () => {
      const stores = [store('sites', false, true)];
      // Not connected but has received messages before (reconnecting)
      const result = resolveGate(stores, 'connecting', false, 5);
      expect(result.state).toBe('loading');
    });
  });

  describe('custom loadingMessage override', () => {
    it('overrides connecting message', () => {
      const stores = [store('sites', false, true)];
      const result = resolveGate(stores, 'connecting', false, 0, 'Please wait...');
      expect(result).toEqual({
        state: 'connecting',
        message: 'Please wait...',
        pulse: true,
      });
    });

    it('overrides waiting-for-apex message', () => {
      const stores = [store('ships', false, false)];
      const result = resolveGate(stores, 'fio', false, 5, 'Custom wait');
      expect(result).toEqual({
        state: 'waiting-for-apex',
        message: 'Custom wait',
        pulse: false,
      });
    });

    it('overrides loading message', () => {
      const stores = [store('sites', false, true)];
      const result = resolveGate(stores, 'live', true, 10, 'Custom loading');
      expect(result).toEqual({
        state: 'loading',
        message: 'Custom loading',
        pulse: true,
      });
    });
  });
});
