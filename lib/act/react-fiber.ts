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
