// Installs ACT global helpers on window so that action-step execute() functions
// can use C, $, _$, _$$ without explicit imports — matching the refined-prun
// global pattern declared in ambient.d.ts.
//
// Call setupActGlobals() once before any ActionRunner is created.
// Subsequent calls are no-ops.

import { C, loadPrunCss } from './prun-css';
import { selectWait, selectOne, selectAll } from './select-dom';

let installed = false;

export function setupActGlobals(): void {
  if (installed) return;
  installed = true;

  loadPrunCss();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  w.C = C;
  w.$ = selectWait;
  w._$ = selectOne;
  w._$$ = selectAll;
}
