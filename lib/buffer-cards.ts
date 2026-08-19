/**
 * Buffer-card cleanup engine (dev tooling for the #84 remedy side).
 *
 * Driven actions create cards in APEX's Buffer stack and leave them behind;
 * debugging sessions pile up dozens. This module scans the stack's card list
 * and bulk-deletes cards by command group. Cards are SERVER-SYNCED — a delete
 * is a real state change, so deletion only ever runs from an explicit
 * user-tapped button that carries the count.
 *
 * DOM facts (spike capture 2026-08-14, ship-actions-spike.md): card rows are
 * `li > BtnRemove__btnRemove + BtnOpen__btnOpen + h4.Stack__commandSubTitle
 * (command) + .Stack__commandTitle > h3 (title)`; edit mode adds `Stack__edit`;
 * BtnRemove click deletes with NO confirmation.
 */

import {
  getContainer,
  isAtStacksTopLevel,
  navigateToStacksTopLevel,
  saveContainerStyles,
  applyRefreshHide,
  restoreContainerStyles,
  findBufferStackHeader,
  findAddNewCardButton,
  waitForElement,
} from './buffer-refresh/dom-helpers';
import { acquireActionLock, releaseActionLock } from './act/action-lock';
import { error as logError } from './debug/logger';

const STEP_TIMEOUT_MS = 2000;
/** Poll interval / ceiling for a card row disappearing after a delete click. */
const DELETE_SETTLE_MS = 3000;

export interface BufferCard {
  command: string;
  title: string;
}

export type BufferCardsResult =
  | { ok: true; cards: BufferCard[] }
  | { ok: false; error: string };

export interface DeleteCardsResult {
  ok: boolean;
  /** Cards actually removed (the list count dropped for each). */
  deleted: number;
  error?: string;
}

/** First whitespace token of the command, uppercased — the grouping key. */
export function commandPrefix(command: string): string {
  return command.trim().split(/\s+/)[0]?.toUpperCase() ?? '';
}

function findCardRows(): HTMLElement[] {
  const container = getContainer();
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>('li')).filter((li) =>
    li.querySelector('[class*="Stack__commandSubTitle"]')
  );
}

function readCard(li: HTMLElement): BufferCard {
  return {
    command:
      li.querySelector('[class*="Stack__commandSubTitle"]')?.textContent?.trim() ?? '',
    title: li.querySelector('[class*="Stack__commandTitle"]')?.textContent?.trim() ?? '',
  };
}

/**
 * Navigate into the Buffer stack's card list. Mirrors openMobileBuffer steps
 * 1–4 but stops at the list — no card is created. Returns false with the page
 * restored on failure.
 */
export async function openCardList(): Promise<boolean> {
  const container = getContainer();
  if (!container) return false;

  if (!isAtStacksTopLevel()) {
    const reached = await navigateToStacksTopLevel(STEP_TIMEOUT_MS);
    if (!reached) return false;
  }

  const stackHeader = findBufferStackHeader();
  if (!stackHeader) return false;
  stackHeader.click();

  // The card list is open once ADD NEW CARD renders (present even when the
  // stack holds zero cards, unlike the rows themselves).
  const add = await waitForElement(findAddNewCardButton, STEP_TIMEOUT_MS);
  return add !== null;
}

async function closeCardList(saved: ReturnType<typeof saveContainerStyles>): Promise<void> {
  if (!isAtStacksTopLevel()) {
    await navigateToStacksTopLevel(STEP_TIMEOUT_MS);
  }
  const container = getContainer();
  if (container) restoreContainerStyles(container, saved);
}

/** Enumerate the Buffer stack's cards. Read-only — navigates in and back out. */
export async function scanBufferCards(): Promise<BufferCardsResult> {
  if (!acquireActionLock()) {
    return { ok: false, error: 'Another action is in progress' };
  }
  const container = getContainer();
  if (!container) {
    releaseActionLock();
    return { ok: false, error: 'APEX container not found' };
  }
  const saved = saveContainerStyles(container);
  applyRefreshHide(container);
  try {
    if (!(await openCardList())) {
      return { ok: false, error: 'Could not open the Buffer stack' };
    }
    return { ok: true, cards: findCardRows().map(readCard) };
  } finally {
    await closeCardList(saved);
    releaseActionLock();
  }
}

/**
 * The remove control on a card row. Tried directly first; if APEX only renders
 * it in edit mode, the caller toggles edit and retries.
 */
function findRemoveButton(li: HTMLElement): HTMLElement | null {
  return li.querySelector<HTMLElement>('[class*="BtnRemove"]');
}

/** A control matching one of `labels` by trimmed text, case-insensitive (CSS
 *  uppercases APEX labels — never match what's on screen). Searched across the
 *  document minus APXM's own overlay: APEX renders the edit bar outside the
 *  card list. */
function findControlByText(labels: string[]): HTMLElement | null {
  for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
    if (el.closest('apxm-overlay')) continue;
    if (el.children.length === 0) {
      const text = el.textContent?.trim().toLowerCase() ?? '';
      if (labels.includes(text)) return el;
    }
  }
  return null;
}

/** The card list's enter-edit toggle. */
function findEditToggle(): HTMLElement | null {
  return findControlByText(['edit', 'start editing']);
}

/** The exit control — a bottom-bar STOP EDITING button (device 2026-08-19). */
function findStopEditingButton(): HTMLElement | null {
  return findControlByText(['stop editing', 'done']);
}

/**
 * Leave edit mode if the list is in it, whatever put it there — a BtnRemove
 * click can enter edit implicitly, so this keys off the live DOM (the exit
 * button / Stack__edit marker), never off whether WE toggled edit. Leaving
 * APEX stuck editing blocks all Stack navigation for every later action
 * (device 2026-08-19).
 */
export async function exitEditMode(): Promise<void> {
  const stop = findStopEditingButton();
  const editing = stop !== null || getContainer()?.querySelector('[class*="Stack__edit"]');
  if (!editing) return;
  if (!stop) {
    logError('exitEditMode: editing but no stop-editing control found');
    return;
  }
  stop.click();
  await waitForElement(
    () => (findStopEditingButton() === null ? document.body : null),
    STEP_TIMEOUT_MS
  );
}

function waitForCardCount(below: number): Promise<HTMLElement | null> {
  // waitForElement wants an element; hand back any row once the count drops.
  return waitForElement(
    () => (findCardRows().length < below ? getContainer() : null),
    DELETE_SETTLE_MS
  );
}


type RemoveRowResult =
  | { done: true }
  | { done: false; ok: true }
  | { done: false; ok: false; error: string };

/**
 * Remove ONE card row picked by `select` from the open card list, with the
 * edit-mode fallback and the count-shrink verification. `done` = no row
 * matched (nothing left to do). Assumes the card list is already open.
 */
async function removeCardRow(
  select: (rows: HTMLElement[]) => HTMLElement | null
): Promise<RemoveRowResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const rows = findCardRows();
    const target = select(rows);
    if (!target) return { done: true };

    const remove = findRemoveButton(target);
    if (!remove) {
      // BtnRemove may only render in edit mode — toggle once and re-query.
      const toggle = attempt === 0 ? findEditToggle() : null;
      if (!toggle) {
        return {
          done: false,
          ok: false,
          error: 'No remove button on card rows (edit mode not reachable?)',
        };
      }
      toggle.click();
      await waitForElement(() => (findCardRows()[0] ? getContainer() : null), STEP_TIMEOUT_MS);
      continue;
    }

    remove.click();
    const shrank = await waitForCardCount(rows.length);
    if (!shrank) {
      return {
        done: false,
        ok: false,
        error: `Delete click did not remove "${readCard(target).command}"`,
      };
    }
    return { done: false, ok: true };
  }
  return { done: false, ok: false, error: 'Edit mode revealed no remove button' };
}

/**
 * Delete the LAST card whose text matches `command` (case-insensitive) from
 * the open card list. Cards append at the end, so on a stack that already
 * held a user card with the same command, the last match is the one a driven
 * action just created (#84 prevention). Lock-free — for callers already
 * inside a locked action; assumes the card list is open.
 */
export async function deleteLastCardMatching(command: string): Promise<boolean> {
  const needle = command.toLowerCase();
  const result = await removeCardRow((rows) => {
    const matches = rows.filter((li) => li.textContent?.toLowerCase().includes(needle));
    return matches[matches.length - 1] ?? null;
  });
  return result.done ? false : result.ok;
}

/**
 * Delete every card whose command prefix is in `prefixes`. Re-queries the list
 * after each click and requires the row count to drop before the next delete —
 * a click that doesn't shrink the list aborts the run rather than hammering a
 * re-rendered DOM. Returns how many cards were verifiably removed.
 */
export async function deleteBufferCards(prefixes: Set<string>): Promise<DeleteCardsResult> {
  if (!acquireActionLock()) {
    return { ok: false, deleted: 0, error: 'Another action is in progress' };
  }
  const container = getContainer();
  if (!container) {
    releaseActionLock();
    return { ok: false, deleted: 0, error: 'APEX container not found' };
  }
  const saved = saveContainerStyles(container);
  applyRefreshHide(container);
  let deleted = 0;
  try {
    if (!(await openCardList())) {
      return { ok: false, deleted, error: 'Could not open the Buffer stack' };
    }

    for (;;) {
      const removed = await removeCardRow((rows) =>
        rows.find((li) => prefixes.has(commandPrefix(readCard(li).command))) ?? null
      );
      if (removed.done) break;
      if (!removed.ok) return { ok: false, deleted, error: removed.error };
      deleted++;
    }

    return { ok: true, deleted };
  } catch (err) {
    logError('deleteBufferCards:', err instanceof Error ? err.message : String(err));
    return { ok: false, deleted, error: err instanceof Error ? err.message : String(err) };
  } finally {
    // On EVERY exit path: leave edit mode first (an editing Stack blocks all
    // navigation), then navigate out and restore APEX.
    await exitEditMode();
    await closeCardList(saved);
    releaseActionLock();
  }
}
