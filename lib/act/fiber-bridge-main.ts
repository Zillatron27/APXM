// MAIN-WORLD half of the fiber bridge. React's __reactFiber$ expando is a
// page-script property, invisible from the content script's isolated world
// (Chrome) / behind Xray wrappers (Firefox) — the same wall as the
// CustomEvent.detail issue in @prun/link. This responder runs in the main
// world (wired into entrypoints/ws-interceptor.ts), where the fiber IS
// visible, and answers probes using only shared DOM: the request arrives as
// an event on a marked element, the response is written into a data
// attribute on that element. No cross-world JS objects ever travel.

export const FIBER_PROBE_EVENT = 'apxm-fiber-probe';
export const FIBER_VALUES_ATTR = 'data-apxm-fiber-values';

interface FiberNode {
  memoizedProps?: Record<string, unknown> | null;
  return?: FiberNode | null;
}

function readFiberValues(el: Element, maxDepth: number): unknown[] | undefined {
  const fiberKey = Object.keys(el).find((k) => k.startsWith('__reactFiber'));
  if (!fiberKey) return undefined;
  let fiber = (el as unknown as Record<string, FiberNode | undefined>)[fiberKey];
  for (let depth = 0; fiber && depth < maxDepth; depth++) {
    const props = fiber.memoizedProps;
    if (props && typeof props === 'object' && 'values' in props && props.values != null) {
      const v = props.values as { toJS?: () => unknown };
      const arr = typeof v.toJS === 'function' ? v.toJS() : props.values;
      return Array.isArray(arr) ? arr : undefined;
    }
    fiber = fiber.return ?? undefined;
  }
  return undefined;
}

/** Installs the main-world responder. Idempotent per document. */
export function installFiberBridge(): void {
  document.addEventListener(FIBER_PROBE_EVENT, (event) => {
    const el = event.target;
    if (!(el instanceof Element)) return;
    const values = readFiberValues(el, 14);
    // "null" (vs attribute absent) tells the content side the probe RAN and
    // found nothing — a definitive refusal, not a timeout.
    el.setAttribute(FIBER_VALUES_ATTR, values === undefined ? 'null' : JSON.stringify(values));
  });
}
