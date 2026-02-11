import { useState, useEffect } from 'react';

/**
 * Returns a counter that increments at the given interval,
 * forcing a re-render so relative timestamps stay fresh.
 */
export function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}
