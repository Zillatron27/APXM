import { describe, it, expect, beforeEach } from 'vitest';
import { useFlightsStore, getFlightByShipId } from '../flights';
import { createTestFlight } from '../../../__tests__/fixtures/factories';

describe('flights store', () => {
  beforeEach(() => {
    useFlightsStore.getState().clear();
  });

  describe('getFlightByShipId', () => {
    it('returns the active flight for a ship', () => {
      const shipId = 'ship-123';
      const flights = [
        createTestFlight({ id: 'flight-1', shipId }),
        createTestFlight({ id: 'flight-2', shipId: 'other-ship' }),
      ];

      useFlightsStore.getState().setAll(flights);

      const result = getFlightByShipId(shipId);

      expect(result).toBeDefined();
      expect(result?.id).toBe('flight-1');
    });

    it('returns undefined when ship has no active flight', () => {
      useFlightsStore.getState().setAll([
        createTestFlight({ shipId: 'other-ship' }),
      ]);

      const result = getFlightByShipId('nonexistent');

      expect(result).toBeUndefined();
    });
  });
});
