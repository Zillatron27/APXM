import { useMaterialsStore } from '../stores/reference';

/**
 * Resolve a material reference from the wire to its ticker.
 *
 * RULE (#103): APXM never displays a material's internal identifier. The
 * `name` the game and FIO carry (`pioneerLuxuryDrink`, `drinkingWater`) is a
 * code, not a name — APEX never shows it and players don't know it. Every
 * material reference resolves to its ticker and renders as the ticker /
 * MaterialTile; on a miss the caller shows a neutral placeholder with the
 * identifier in a title/aria attribute only. Do not derive display words
 * from the identifier.
 *
 * Accepts a ticker or an internal name, case-insensitively. Undefined when
 * the materials database hasn't loaded or the identifier is unknown.
 */
export function resolveMaterialTicker(reference: string): string | undefined {
  const store = useMaterialsStore.getState();
  return store.getById(reference.toUpperCase())?.ticker ?? tickerForName(store.entities, reference);
}

// Reverse index (lower-cased internal name → ticker), rebuilt only when the
// materials store's entity map identity changes.
let nameToTicker: Map<string, string> | undefined;
let indexedEntities: unknown;

function tickerForName(entities: Map<string, { name: string; ticker: string }>, name: string): string | undefined {
  if (indexedEntities !== entities) {
    nameToTicker = new Map(Array.from(entities.values()).map((m) => [m.name.toLowerCase(), m.ticker]));
    indexedEntities = entities;
  }
  return nameToTicker?.get(name.toLowerCase());
}
