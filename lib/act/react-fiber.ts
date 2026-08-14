import { FIBER_PROBE_EVENT, FIBER_VALUES_ATTR } from './fiber-bridge-main';

// First React-fiber access in the codebase, and deliberately the last resort:
// APEX's mobile transfer modal renders ship stores as nameless labels
// ("Ship  cargo hold" — the name interpolation is empty), so the ONLY reliable
// selector is the store GUID list living in the dropdown component's props.
// Everything else in lib/act stays pure-DOM; use this only where the DOM
// carries no identity.

/**
 * Walks up the React fiber tree from a rendered element until a node's
 * memoizedProps satisfies `predicate`, and returns those props. Returns
 * undefined when the element carries no fiber or nothing matches within
 * `maxDepth` (bounded — the walk must never crawl to the app root).
 */
export function getFiberProps<T = Record<string, unknown>>(
  el: Element,
  predicate: (props: Record<string, unknown>) => boolean,
  maxDepth = 14
): T | undefined {
  const fiberKey = Object.keys(el).find((k) => k.startsWith('__reactFiber'));
  if (!fiberKey) return undefined;
  let fiber = (el as unknown as Record<string, FiberNode | undefined>)[fiberKey];
  for (let depth = 0; fiber && depth < maxDepth; depth++) {
    const props = fiber.memoizedProps;
    if (props && typeof props === 'object' && predicate(props)) {
      return props as T;
    }
    fiber = fiber.return ?? undefined;
  }
  return undefined;
}

interface FiberNode {
  memoizedProps?: Record<string, unknown> | null;
  return?: FiberNode | null;
}

/**
 * Unwraps an Immutable.js collection (APEX is Redux + Immutable — component
 * props carry Immutable Lists) to a plain array; plain arrays pass through.
 */
export function immutableToArray(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  const maybe = value as { toJS?: () => unknown } | null | undefined;
  if (maybe && typeof maybe.toJS === 'function') {
    const js = maybe.toJS();
    return Array.isArray(js) ? js : undefined;
  }
  return undefined;
}

/**
 * Reads a component's fiber `values` list from ANY world. The fiber expando
 * is a page-script property — invisible from the content script's isolated
 * world (device finding 2026-08-14: the direct read works via DevTools but
 * returns nothing on-device). The direct read is tried first (same-world
 * contexts and tests); otherwise the request goes over the fiber bridge:
 * dispatch a probe event on the element and wait for the main-world
 * responder (lib/act/fiber-bridge-main.ts, wired into the interceptor) to
 * write the values into a shared DOM attribute.
 */
export async function readFiberValuesAnyWorld(
  el: Element,
  timeoutMs = 2000
): Promise<unknown[] | undefined> {
  const direct = getFiberProps(el, (p) => 'values' in p && p.values != null);
  if (direct) {
    return immutableToArray((direct as { values: unknown }).values);
  }

  el.removeAttribute(FIBER_VALUES_ATTR);
  // Bubbles so the responder's document-level listener sees it; the element
  // itself stays the addressee (event.target).
  el.dispatchEvent(new Event(FIBER_PROBE_EVENT, { bubbles: true }));

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const raw = el.getAttribute(FIBER_VALUES_ATTR);
    if (raw !== null) {
      el.removeAttribute(FIBER_VALUES_ATTR);
      if (raw === 'null') return undefined; // probe ran, no fiber values
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return undefined; // no responder answered — treat as unavailable
}
