/**
 * Empire Dim — BFS computation for highlighted systems.
 *
 * Computes the set of "bright" systems: owned systems plus
 * nearby CX systems (within 3 jumps). All other systems get dimmed.
 */

import {
  getSystemByNaturalId, getAllCxStations, getNeighbours,
} from '@27bit/helm';
import type { EmpireState } from '../empire-state';

const BFS_MAX_DEPTH = 3;

/** Compute Helm system UUIDs that should stay bright. */
export function computeBrightSystems(ownedNaturalIds: string[]): Set<string> {
  const bright = new Set<string>();

  // Resolve owned naturalIds to UUIDs
  const ownedUuids: string[] = [];
  for (const nid of ownedNaturalIds) {
    const sys = getSystemByNaturalId(nid);
    if (sys) {
      ownedUuids.push(sys.id);
      bright.add(sys.id);
    }
  }

  // BFS from each owned system to find nearby CX systems
  const cxSystemIds = new Set<string>();
  for (const station of getAllCxStations()) {
    cxSystemIds.add(station.SystemId);
  }

  // BFS frontier: [systemId, depth]
  const visited = new Set<string>(ownedUuids);
  const queue: Array<[string, number]> = ownedUuids.map(id => [id, 0]);

  while (queue.length > 0) {
    const [current, depth] = queue.shift()!;

    // If this system has a CX, add it to bright set
    if (cxSystemIds.has(current)) {
      bright.add(current);
    }

    if (depth >= BFS_MAX_DEPTH) continue;

    const neighbourIds = getNeighbours(current);
    for (const neighbourId of neighbourIds) {
      if (!visited.has(neighbourId)) {
        visited.add(neighbourId);
        queue.push([neighbourId, depth + 1]);
      }
    }
  }

  return bright;
}

let cachedBright: Set<string> | null = null;
let cachedOwnedIds: string | null = null;

/** Get bright systems, recomputing only when owned systems change. */
export function getBrightSystems(empireState: EmpireState): Set<string> {
  const ownedIds = empireState.getOwnedSystemNaturalIds();
  const key = ownedIds.join(',');

  if (cachedOwnedIds === key && cachedBright) {
    return cachedBright;
  }

  cachedBright = computeBrightSystems(ownedIds);
  cachedOwnedIds = key;
  return cachedBright;
}

/** Clear the cache (e.g. on empire state reset). */
export function clearBrightCache(): void {
  cachedBright = null;
  cachedOwnedIds = null;
}
