// DropDownBox driver + the fiber-addressed selection path. Fixtures fake the
// React fiber (a __reactFiber$ key whose chain carries memoizedProps.values,
// Immutable-style {toJS}) exactly as APEX renders it (captured 2026-08-14).

import { describe, it, expect, beforeAll } from 'vitest';
import { getFiberProps, immutableToArray, readFiberValuesAnyWorld } from '../react-fiber';
import { installFiberBridge } from '../fiber-bridge-main';
import { getDropDownValues, selectDropDownValue, selectDropDownLabel, openDropDown } from '../dropdown';

// jsdom is single-world: the direct fiber read succeeds when a fake fiber is
// present. The bridge responder is installed anyway so the no-fiber path gets
// a fast definitive 'null' answer instead of the probe timeout.
beforeAll(() => {
  installFiberBridge();
});

function buildBox(opts: {
  labels: string[];
  values?: unknown[] | { toJS: () => unknown[] };
  open?: boolean;
}): { box: HTMLElement; clicks: number[] } {
  const box = document.createElement('div');
  box.className = 'DropDownBox__container___hash';
  const toggle = document.createElement('div');
  toggle.className = 'DropDownBox__toggle___hash';
  box.appendChild(toggle);
  const clicks: number[] = [];
  const addOptions = () => {
    const ul = document.createElement('ul');
    opts.labels.forEach((label, i) => {
      const li = document.createElement('li');
      const name = document.createElement('div');
      name.className = 'DropDownBox__itemName___hash';
      name.textContent = label;
      li.appendChild(name);
      li.addEventListener('click', () => clicks.push(i));
      if (opts.values) {
        // The fiber chain: li -> parent component whose props carry `values`.
        (li as unknown as Record<string, unknown>)['__reactFiber$test'] = {
          memoizedProps: { className: 'x' },
          return: { memoizedProps: { values: opts.values, onSelection: () => {} }, return: null },
        };
      }
      ul.appendChild(li);
    });
    box.appendChild(ul);
  };
  if (opts.open !== false) addOptions();
  else toggle.addEventListener('click', addOptions);
  document.body.appendChild(box);
  return { box, clicks };
}

describe('react-fiber helpers', () => {
  it('walks the fiber chain to the props matching the predicate', () => {
    const { box } = buildBox({ labels: ['--', 'A'], values: ['x', 'y'] });
    const li = box.querySelector('li') as HTMLElement;
    const props = getFiberProps(li, (p) => 'values' in p);
    expect(props).toBeDefined();
  });

  it('returns undefined without a fiber key', () => {
    const el = document.createElement('div');
    expect(getFiberProps(el, () => true)).toBeUndefined();
  });

  it('unwraps Immutable-style collections and passes arrays through', () => {
    expect(immutableToArray({ toJS: () => [1, 2] })).toEqual([1, 2]);
    expect(immutableToArray([3])).toEqual([3]);
    expect(immutableToArray({})).toBeUndefined();
  });
});

describe('dropdown driver', () => {
  it('openDropDown clicks the toggle and sees the options render', async () => {
    const { box } = buildBox({ labels: ['--', 'A'], open: false });
    expect(await openDropDown(box, 500)).toBe(true);
  });

  it('reads GUID values via the fiber (Immutable list)', async () => {
    const guids = [null, 'guid-a', 'guid-b'];
    const { box } = buildBox({ labels: ['--', 'A', 'B'], values: { toJS: () => guids } });
    expect(await getDropDownValues(box)).toEqual(guids);
  });

  it('selects the option index-aligned with the requested GUID', async () => {
    const { box, clicks } = buildBox({
      labels: ['--', 'Ship  STL fuel store', 'Ship  STL fuel store'],
      values: { toJS: () => [null, 'guid-a', 'guid-b'] },
    });
    expect(await selectDropDownValue(box, 'guid-b')).toBe(true);
    expect(clicks).toEqual([2]);
  });

  it('refuses when the GUID is absent (never falls back to labels)', async () => {
    const { box, clicks } = buildBox({
      labels: ['--', 'Ship  STL fuel store'],
      values: { toJS: () => [null, 'guid-a'] },
    });
    expect(await selectDropDownValue(box, 'guid-missing')).toBe(false);
    expect(clicks).toEqual([]);
  });

  it('refuses when the fiber values are unavailable (bridge answers null)', async () => {
    const { box, clicks } = buildBox({ labels: ['--', 'A'] });
    expect(await selectDropDownValue(box, 'anything')).toBe(false);
    expect(clicks).toEqual([]);
  });

  it('bridge responder answers a probe by writing the values attribute', () => {
    // jsdom can't hide expandos across worlds, so the responder's success
    // branch is exercised directly: dispatch the probe, assert the shared
    // attribute (what the content side would poll for on-device).
    const li = document.createElement('li');
    (li as unknown as Record<string, unknown>)['__reactFiber$w'] = {
      memoizedProps: { values: { toJS: () => ['a', 'b'] } },
      return: null,
    };
    document.body.appendChild(li);
    li.dispatchEvent(new Event('apxm-fiber-probe', { bubbles: true }));
    expect(li.getAttribute('data-apxm-fiber-values')).toBe('["a","b"]');
  });

  it('readFiberValuesAnyWorld resolves via the direct read when same-world', async () => {
    const li = document.createElement('li');
    (li as unknown as Record<string, unknown>)['__reactFiber$w'] = {
      memoizedProps: { values: { toJS: () => ['a', 'b'] } },
      return: null,
    };
    document.body.appendChild(li);
    expect(await readFiberValuesAnyWorld(li, 1000)).toEqual(['a', 'b']);
  });

  it('selects by label case-insensitively, refusing ambiguity', () => {
    const { box, clicks } = buildBox({ labels: ['--', 'STL Fuel', 'FTL Fuel'] });
    expect(selectDropDownLabel(box, 'Stl Fuel')).toBe(true);
    expect(clicks).toEqual([1]);
    const dup = buildBox({ labels: ['STL Fuel', 'STL Fuel'] });
    expect(selectDropDownLabel(dup.box, 'STL Fuel')).toBe(false);
  });
});
