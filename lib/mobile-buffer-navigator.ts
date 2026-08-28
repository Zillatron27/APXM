/**
 * Mobile buffer navigator for the ported ACT action runner.
 *
 * Desktop refined-prun opens a dedicated tile per buffer command via its
 * TileAllocator. Mobile APEX has a single serial buffer and a hierarchical
 * Stack UI, so this module drives the same Stack-navigation sequence the
 * buffer-refresh engine already uses (see lib/buffer-refresh/engine.ts) to
 * open an arbitrary buffer command, then waits for the buffer's form to render.
 *
 * Unlike the buffer-refresh engine, the navigator deliberately does NOT restore
 * #container after a successful open: the buffer must stay open (off-screen) so
 * the action runner can drive its form. restoreContainerStyles only happens in
 * closeMobileBuffer (or after a failed open).
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
  getCommandInput,
  findCreateButton,
  findCancelButton,
  findCardByCommand,
  setInputValue,
  waitForElement,
  type SavedStyles,
} from './buffer-refresh/dom-helpers';
import { warn, error } from './debug/logger';
import { openCardList, deleteLastCardMatching, deleteLastCard, exitEditMode, findCardRows } from './buffer-cards';

/** Timeout for each Stack-navigation DOM step. */
const STEP_TIMEOUT_MS = 2000;

/**
 * Timeout for the buffer form to render after the card is clicked. Longer than
 * a navigation step because opening a buffer can involve a server round-trip.
 */
const FORM_TIMEOUT_MS = 10000;

/**
 * Original #container styles, captured by the first openMobileBuffer call and
 * held until closeMobileBuffer restores them. Subsequent openMobileBuffer calls
 * (one per buffer command in a multi-step action package) must NOT recapture —
 * that would record the already-hidden styles and leak them on restore.
 */
let savedStyles: SavedStyles | null = null;

/**
 * Commands of cards created by openMobileBuffer since the last close. Cards
 * are SERVER-SYNCED — leaving them behind litters the user's Buffer stack
 * (#84) — so closeMobileBuffer deletes them on the way out.
 */
let createdCardCommands: string[] = [];

/**
 * Card-list row count captured just before openMobileBuffer creates its own
 * card (i.e. the count of cards that already existed). Used only by
 * closeMobileBuffer's opt-in sweepAppended cleanup (see there for why) — null
 * whenever no open is in flight or the buffer hasn't recorded it yet.
 */
let cardCountAtOpen: number | null = null;

/**
 * The buffer form sentinel. APEX renders a FormComponent container element
 * inside an open buffer; its CSS-module class (FormComponent__containerActive
 * / Passive / Command and the Mobile variants) is identical on mobile and
 * desktop. Matching the class prefix avoids depending on a build-time hash map.
 */
function findBufferForm(): HTMLElement | null {
  const container = getContainer();
  if (!container) {
    return null;
  }
  return container.querySelector<HTMLElement>('[class*="FormComponent__container"]');
}

/**
 * Open an APEX buffer for `command` by driving the mobile Stack UI.
 *
 * Mirrors lib/buffer-refresh/engine.ts steps 1-8, then waits for the buffer's
 * content to render. #container is hidden off-screen and stays hidden on
 * success — the caller drives the buffer via the off-screen DOM and calls
 * closeMobileBuffer when done. On failure the page is restored before
 * returning false.
 *
 * `findReady` is the content sentinel: it must return an element once the
 * buffer has rendered. The default matches a FormComponent, which every FORM
 * buffer (CONT, SFC, CXPO, ...) renders — but LIST buffers (FLT) contain no
 * form, so those callers pass their own sentinel (device finding 2026-08-14:
 * the form default times out on FLT and reports a false failure while the
 * buffer is actually open).
 */
export async function openMobileBuffer(
  command: string,
  findReady: () => HTMLElement | null = findBufferForm
): Promise<boolean> {
  const container = getContainer();
  if (!container) {
    error('openMobileBuffer: #container not found');
    return false;
  }

  // Capture the pristine styles once. Later calls reuse them so a multi-buffer
  // action package restores the real styles, not the off-screen ones.
  if (savedStyles === null) {
    savedStyles = saveContainerStyles(container);
  }

  try {
    // Step 1-2: ensure we're at the Stacks top level (Buffer stack header visible).
    if (!isAtStacksTopLevel()) {
      const header = await waitForElement(findBufferStackHeader, STEP_TIMEOUT_MS);
      if (!header) {
        const reached = await navigateToStacksTopLevel(STEP_TIMEOUT_MS);
        if (!reached) {
          throw new Error('Could not navigate to Stacks top level');
        }
      }
    }

    // Step 3: hide #container off-screen (React keeps the DOM alive).
    applyRefreshHide(container);

    // Step 4: open the Buffer stack.
    const stackHeader = findBufferStackHeader();
    if (!stackHeader) {
      throw new Error('Buffer stack header disappeared');
    }
    stackHeader.click();

    // Step 5: add a new card.
    const addButton = await waitForElement(findAddNewCardButton, STEP_TIMEOUT_MS);
    if (!addButton) {
      throw new Error('Add New Card button did not appear');
    }
    addButton.click();

    // Step 6: enter the buffer command.
    const input = await waitForElement(getCommandInput, STEP_TIMEOUT_MS);
    if (!input) {
      throw new Error('Command input did not appear');
    }
    setInputValue(input, command);

    // Step 7: confirm card creation. Record the pre-existing card count right
    // before this click creates ours — closeMobileBuffer's sweepAppended
    // option needs this baseline to spot a further card opened later by a
    // driven click inside the buffer (e.g. a NOTS row), which is nobody's
    // tracked command and so invisible to the createdCardCommands cleanup.
    const createBtn = await waitForElement(findCreateButton, STEP_TIMEOUT_MS);
    if (!createBtn) {
      throw new Error('CREATE button did not appear');
    }
    cardCountAtOpen = findCardRows().length;
    createBtn.click();

    // Step 8: open the freshly created card. It exists from here on, so it
    // is queued for deletion at close whatever happens next.
    const card = await waitForElement(() => findCardByCommand(command), STEP_TIMEOUT_MS);
    if (!card) {
      throw new Error(`Card for "${command}" did not appear`);
    }
    createdCardCommands.push(command);
    card.click();

    // Step 9: wait for the buffer's content to render.
    const ready = await waitForElement(findReady, FORM_TIMEOUT_MS);
    if (!ready) {
      throw new Error(`Buffer content for "${command}" did not render`);
    }

    return true;
  } catch (err) {
    error('openMobileBuffer:', err instanceof Error ? err.message : String(err));
    // Restore the page so a failed open never leaves APEX hidden off-screen.
    await closeMobileBuffer();
    return false;
  }
}

export interface CloseMobileBufferOptions {
  /**
   * Also delete any card left in the list beyond the count recorded at open
   * time, on top of the normal command-based cleanup. ADDITIVE ONLY — the
   * default (omitted/false) path is byte-for-byte the pre-existing behaviour.
   *
   * Why this exists: a driven click INSIDE an already-open buffer can itself
   * open a further buffer as a new appended card — e.g. clicking a NOTS row
   * both marks the alert read and opens its target buffer as a new Stack
   * card (device finding 2026-08-27). No command of ours created that card,
   * so createdCardCommands never sees it and it survives as litter (#84).
   *
   * Why opt-in: contract/ship actions never trigger this side effect —
   * their buffers don't spawn further cards on click — so their cleanup
   * must stay exactly as it was rather than pay for a sweep they don't need.
   */
  sweepAppended?: boolean;
}

/** Ceiling on the appended-card sweep loop — never delete unboundedly. */
const MAX_APPENDED_SWEEP = 5;

/**
 * Close the current buffer: dismiss any leftover add-card dialog, navigate back
 * to the Stacks top level, and restore #container to its pre-open styles.
 *
 * Safe to call when no buffer is open — every step is a no-op in that case.
 */
export async function closeMobileBuffer(options?: CloseMobileBufferOptions): Promise<void> {
  // Dismiss a half-finished add-card dialog left behind by a failed open.
  const cancelBtn = findCancelButton();
  if (cancelBtn) {
    cancelBtn.click();
  }

  // Navigate back out of any open buffer to the Stacks top level.
  if (!isAtStacksTopLevel()) {
    const reached = await navigateToStacksTopLevel(STEP_TIMEOUT_MS);
    if (!reached) {
      warn('closeMobileBuffer: could not navigate back to Stacks top level');
    }
  }

  // Delete the cards this run created (#84), plus any appended card when
  // asked to. Best-effort: a failed sweep must never block restoring APEX —
  // leftover cards are litter, not harm.
  const sweepAppended = options?.sweepAppended === true && cardCountAtOpen !== null;
  if (createdCardCommands.length > 0 || sweepAppended) {
    const pending = createdCardCommands;
    createdCardCommands = [];
    try {
      if (await openCardList()) {
        for (const command of pending) {
          if (!(await deleteLastCardMatching(command))) {
            warn(`closeMobileBuffer: could not delete created card "${command}"`);
          }
        }
        if (sweepAppended) {
          // cardCountAtOpen is the baseline captured before OUR card was
          // created; the command-based loop above already removed it (and
          // any other tracked cards), so anything still past the baseline
          // is the untracked appended card(s).
          const baseline = cardCountAtOpen as number;
          for (let i = 0; i < MAX_APPENDED_SWEEP && findCardRows().length > baseline; i++) {
            // deleteLastCard already verifies the row count actually dropped
            // (removeCardRow's waitForCardCount) — a false here means the
            // click didn't take, so stop rather than hammer a stuck DOM.
            if (!(await deleteLastCard())) {
              warn('closeMobileBuffer: appended-card sweep delete failed, stopping');
              break;
            }
          }
        }
        // BtnRemove clicks drop APEX into edit mode; leaving it on blocks
        // all later Stack navigation (device 2026-08-19).
        await exitEditMode();
        if (!isAtStacksTopLevel()) {
          await navigateToStacksTopLevel(STEP_TIMEOUT_MS);
        }
      } else {
        warn('closeMobileBuffer: card cleanup could not open the Buffer stack');
      }
    } catch (err) {
      warn('closeMobileBuffer: card cleanup failed:', err instanceof Error ? err.message : String(err));
    }
  }

  // Restore #container so APEX is visible again.
  const container = getContainer();
  if (container && savedStyles) {
    restoreContainerStyles(container, savedStyles);
  }
  savedStyles = null;
  cardCountAtOpen = null;
}
