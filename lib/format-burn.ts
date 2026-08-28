/**
 * Burn-sheet number formatting. Workforce consumables burn in fractions of a
 * unit per day and the game tracks stock to match, so a base can legitimately
 * hold 0.59 WS burning at 0.01/d (#102). Truncating either to one place
 * reads as "empty" / "not consuming" — a false alarm that outranks real
 * shortages in the sorted list. Precision scales with magnitude so large
 * stacks stay terse.
 */

/** Stock on hand: whole units when ≥ 10, else one decimal (0.59 → "0.6"). */
export function formatInventory(amount: number): string {
  if (amount >= 10 || Number.isInteger(amount)) return String(Math.floor(amount));
  return amount.toFixed(1);
}

/** Signed daily rate: one decimal, two when the rate would otherwise show as 0.0. */
export function formatDailyRate(rate: number): string {
  const decimals = rate !== 0 && Math.abs(rate) < 0.1 ? 2 : 1;
  const text = rate.toFixed(decimals);
  return rate >= 0 ? `+${text}` : text;
}
