// Ported from refined-prun src/features/XIT/ACT/action-steps/cont-utils.ts.
// Only the selectMaterial helper is needed for BURNACT/REPAIRACT.
// CONTD draft helpers (createNewDraft, setDraftNameAndPreamble, etc.) are
// not ported — they are not used by the resupply or repair flows.
//
// Uses C, $, _$, _$$ as globals (populated by setupActGlobals() at runtime).

import { focusElement, clickElement, sleep } from '../_compat';
import { setInputValue } from '../../buffer-refresh/dom-helpers';

/**
 * Select a material by ticker inside a MaterialSelector component.
 * Returns true on success, false if the ticker was not found.
 */
/** Convert PrunApi camelCase name to APEX display name: "advancedDeckElements" → "Advanced Deck Elements" */
export function toDisplayName(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

/**
 * Select a material by ticker inside a MaterialSelector component.
 * Types the ticker into the input (APEX accepts ticker or full name).
 */
export async function selectMaterial(container: Element, ticker: string): Promise<boolean> {
  // Mobile APEX renders inputMobile; desktop renders input. Try mobile first.
  let input = (await $(container, C.MaterialSelector.inputMobile, 1000)) as HTMLInputElement | null;
  if (!input) {
    input = (await $(container, C.MaterialSelector.input)) as HTMLInputElement | null;
  }
  if (!input) {
    return false;
  }

  // suggestionsContainer may be absent on some APEX builds — handle gracefully
  const suggestionsContainer = (await $(
    container,
    C.MaterialSelector.suggestionsContainer,
    2000,
  )) as HTMLElement | null;

  // Focus via focus() — we know this works (activeElement confirmed in logs).
  // click() loses focus to body so don't use it.
  input.focus();
  await sleep(100);

  // Type character-by-character with full keyboard event sequence.
  // APEX's autocomplete library listens for keydown/keyup to trigger suggestions;
  // the native-setter + input-event approach used by setInputValue is not enough.
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

  // Clear any stale value left from a previous selection (e.g., buffer reuse
  // after a skipped step). Without this, chars append to the old ticker.
  if (input.value) {
    if (nativeSetter) nativeSetter.call(input, '');
    else input.value = '';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await sleep(50);
  }

  for (const char of ticker) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true, cancelable: true }));
    if (nativeSetter) {
      nativeSetter.call(input, input.value + char);
    } else {
      input.value += char;
    }
    input.dispatchEvent(new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true, cancelable: true }));
    await sleep(30);
  }
  // Suggestions dropdown may render in a React portal at document.body rather
  // than inside the MaterialSelector container — search locally first (fast),
  // then fall back to the full document.
  let suggestionsList = await $(container, C.MaterialSelector.suggestionsList, 2000);
  if (!suggestionsList) {
    suggestionsList = await $(document.body, C.MaterialSelector.suggestionsList, 8000);
  }
  if (!suggestionsList) {
    if (suggestionsContainer) suggestionsContainer.style.display = '';
    return false;
  }

  if (suggestionsContainer) {
    suggestionsContainer.style.display = 'none';
  }

  const entries = _$$(suggestionsList, C.MaterialSelector.suggestionEntry);
  const match = entries.find(
    (entry) => _$(entry, C.ColoredIcon.label)?.textContent === ticker,
  );

  if (!match) {
    if (suggestionsContainer) suggestionsContainer.style.display = '';
    return false;
  }

  await clickElement(match as HTMLElement);
  if (suggestionsContainer) suggestionsContainer.style.display = '';
  await sleep(200);
  return true;
}
