// Driver for APEX's custom DropDownBox (device-captured 2026-08-14:
// DropDownBox__{container,item,currentItem,itemName,toggle}, options are
// li elements inside the opened box). Selection clicks the option's DOM node
// so React's own onSelection runs; identity comes from the component's fiber
// `values` prop (Immutable List, index-aligned with the option list, null
// head for the "--" placeholder) because option labels are not unique — see
// lib/act/react-fiber.ts.

import { waitForElement } from '../buffer-refresh/dom-helpers';
import { readFiberValuesAnyWorld } from './react-fiber';

/** Options render as li elements once the box is open. */
function optionItems(box: HTMLElement): HTMLElement[] {
  return Array.from(box.querySelectorAll<HTMLElement>('li'));
}

/** Clicks the box's toggle and waits for the option list to render. */
export async function openDropDown(box: HTMLElement, timeoutMs = 4000): Promise<boolean> {
  const toggle = box.querySelector<HTMLElement>('[class*="DropDownBox__toggle"]');
  if (!toggle) return false;
  toggle.click();
  const first = await waitForElement(() => optionItems(box)[0] ?? null, timeoutMs);
  return first !== null;
}

/**
 * The box's `values` prop: one entry per option, index-aligned, unwrapped to
 * a plain array. Read through the fiber bridge (the fiber expando is
 * invisible from the content-script world — device finding 2026-08-14).
 * Undefined when the fiber or the prop can't be found — the caller must
 * refuse to select rather than guess.
 */
export function getDropDownValues(box: HTMLElement): Promise<unknown[] | undefined> {
  const item = optionItems(box)[0] ?? box;
  return readFiberValuesAnyWorld(item);
}

/**
 * Selects the option whose `values` entry equals `value` (the GUID-addressed
 * path — used for stores, whose labels are nameless). Refuses (false) when
 * the values prop is unavailable, the value is absent, or the option list
 * doesn't line up with it.
 */
export async function selectDropDownValue(box: HTMLElement, value: unknown): Promise<boolean> {
  const values = await getDropDownValues(box);
  if (!values) return false;
  const index = values.indexOf(value);
  if (index < 0) return false;
  const item = optionItems(box)[index];
  if (!item) return false;
  item.click();
  return true;
}

/**
 * Selects the option whose visible label matches (trimmed, case-insensitive —
 * FIO-derived names casualise acronyms, "Stl Fuel" vs APEX's "STL Fuel", and
 * CSS text-transform makes visible case meaningless anyway). Used for the
 * material dropdown, whose labels ARE unique display names (the fiber values
 * there are material GUIDs APXM doesn't track). Refuses on zero or multiple
 * matches.
 */
export function selectDropDownLabel(box: HTMLElement, label: string): boolean {
  const wanted = label.trim().toLowerCase();
  const matches = optionItems(box).filter(
    (li) =>
      li
        .querySelector<HTMLElement>('[class*="DropDownBox__itemName"]')
        ?.textContent?.trim()
        .toLowerCase() === wanted
  );
  if (matches.length !== 1) return false;
  matches[0].click();
  return true;
}
