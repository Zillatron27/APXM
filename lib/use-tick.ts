import { useState, useEffect } from 'react';

/**
 * Hook that triggers a re-render at a specified interval.
 * Returns the current timestamp (can be ignored, just forces re-render).
 */
export function useTick(intervalMs: number = 60000): number {
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(Date.now());
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return tick;
}
