// Dynamically builds the C object from APEX's injected CSS stylesheets.
// Ported from refined-prun src/infrastructure/prun-ui/prun-css.ts.
// Vue reactivity removed; plain MutationObserver used instead.
//
// APEX injects <style data-source="prun"> elements whose CSS contains
// CSS-module hash selectors like ".Button__btn___UJGZ1b7". This module
// parses those rules and populates C so action steps can write
// C.Button.btn instead of hardcoding the hash string.

export const C: Record<string, Record<string, string>> = {};

const processedStylesheets = new WeakSet<HTMLStyleElement>();

function camelize(s: string): string {
  return s.replace(/-./g, x => x[1].toUpperCase());
}

function processStylesheet(style: HTMLStyleElement): void {
  if (style.dataset.source !== 'prun' || processedStylesheets.has(style)) {
    return;
  }
  processedStylesheets.add(style);

  const rules = style.sheet?.cssRules;
  if (!rules) return;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules.item(i) as CSSStyleRule;
    const selector = rule?.selectorText;
    if (!selector?.includes('___')) continue;

    const matches = selector.match(/[\w-]+__[\w-]+___[\w-]+/g);
    for (const match of matches ?? []) {
      // Strip leading '.' if present (selector may be '.Foo__bar___HASH')
      const cssClass = match.replace(/^\./, '');
      const parts = cssClass.replace('__', '.').replace('___', '.').split('.');
      const parent = camelize(parts[0]);
      if (!parent) continue;
      const child = camelize(parts[1]);
      if (!C[parent]) C[parent] = {};
      if (!C[parent][child]) C[parent][child] = cssClass;
    }
  }
}

export function loadPrunCss(): void {
  document.head.querySelectorAll<HTMLStyleElement>('style').forEach(processStylesheet);
  new MutationObserver(() => {
    document.head.querySelectorAll<HTMLStyleElement>('style').forEach(processStylesheet);
  }).observe(document.head, { childList: true });
}
