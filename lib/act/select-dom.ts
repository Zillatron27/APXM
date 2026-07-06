// DOM selector helpers matching refined-prun's $ / _$ / _$$ interface.
// Ported from refined-prun src/utils/select-dom.ts.
//
// Uses getElementsByClassName (live HTMLCollection) for CSS-module class names
// and getElementsByTagName for HTML tag names — same strategy as rprun so that
// C.* selectors and plain element tags both work without querySelector overhead.

import { waitForElement } from '../buffer-refresh/dom-helpers';

const TAG_NAMES = new Set([
  'div', 'input', 'span', 'button', 'select', 'form',
  'li', 'ul', 'ol', 'table', 'tr', 'td', 'th',
  'h1', 'h2', 'h3', 'h4', 'p', 'a', 'label',
  'textarea', 'option', 'style', 'progress',
]);

function getCollection<T extends Element>(
  root: Element | Document,
  selector: string,
): HTMLCollectionOf<T> {
  if (TAG_NAMES.has(selector)) {
    return root.getElementsByTagName(selector) as HTMLCollectionOf<T>;
  }
  return root.getElementsByClassName(selector) as HTMLCollectionOf<T>;
}

/** Synchronous — returns first matching element or null. */
export function selectOne<T extends HTMLElement = HTMLElement>(
  root: Element | Document,
  selector: string,
): T | null {
  const col = getCollection<T>(root, selector);
  return col.length > 0 ? col[0] : null;
}

/** Synchronous — returns all matching elements. */
export function selectAll<T extends HTMLElement = HTMLElement>(
  root: Element | Document,
  selector: string,
): T[] {
  return Array.from(getCollection<T>(root, selector));
}

/**
 * Async — waits up to timeoutMs for the element to appear and returns it,
 * or null if the timeout expires. Callers that receive null will naturally
 * produce a TypeError when they access properties on it; the step-machine's
 * try-catch handles those as step failures.
 */
export async function selectWait<T extends HTMLElement = HTMLElement>(
  root: Element | Document,
  selector: string,
  timeoutMs = 10000,
): Promise<T | null> {
  return waitForElement(() => selectOne<T>(root, selector), timeoutMs);
}
