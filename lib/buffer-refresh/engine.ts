/**
 * Core single-buffer open sequence.
 *
 * Programmatically opens a BS (base storage) buffer in APEX to trigger
 * the server to send fresh data through the existing WebSocket pipeline.
 * This is the same technique rprun uses for XIT BURN — established,
 * molp-approved community practice.
 *
 * The sequence manipulates APEX's DOM to navigate the Buffer stack UI:
 * click into the stack, add a new card with the BS command, then click
 * the card to trigger the server request. The container is hidden
 * off-screen during this process to avoid visual flash.
 */

import type { BufferRefreshOptions, BufferRefreshStep } from './types';
import { useRefreshState } from '../../stores/refreshState';
import { useSitesStore } from '../../stores/entities';
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
} from './dom-helpers';

export class BufferRefreshError extends Error {
  constructor(
    public readonly step: BufferRefreshStep,
    message: string
  ) {
    super(`[BufferRefresh:${step}] ${message}`);
    this.name = 'BufferRefreshError';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve a siteId (UUID) to an APEX BS buffer command using the planet's naturalId.
 * Falls back to the raw siteId if the site or planet code can't be resolved.
 */
export function buildBufferCommand(siteId: string): string {
  const site = useSitesStore.getState().getById(siteId);
  if (site) {
    for (const line of site.address.lines) {
      if (line.type === 'PLANET' && line.entity) {
        return `BS ${line.entity.naturalId}`;
      }
    }
    for (const line of site.address.lines) {
      if (line.type === 'STATION' && line.entity) {
        return `BS ${line.entity.naturalId}`;
      }
    }
  }
  console.warn(`[APXM BufferRefresh] Could not resolve planet code for site ${siteId}`);
  return `BS ${siteId}`;
}

/**
 * Execute a single buffer refresh: open a BS buffer to populate stores.
 *
 * Returns true on success, false on failure. Always restores container
 * styles in the finally block — no visual leak on error.
 */
export async function executeBufferRefresh(options: BufferRefreshOptions): Promise<boolean> {
  const { siteId, command, stepTimeoutMs = 1500 } = options;
  const store = useRefreshState.getState();

  const container = getContainer();
  if (!container) {
    console.error('[APXM BufferRefresh] #container not found');
    store.updateSiteStatus(siteId, 'error');
    return false;
  }

  // Save styles before any manipulation
  const saved = saveContainerStyles(container);

  try {
    // Step 1: Ensure we're at the stacks top level.
    // Wait for the Buffer stack header first — DOM may not be fully settled yet
    // (e.g., on first run after page load). Only navigate if header doesn't appear.
    if (!isAtStacksTopLevel()) {
      const header = await waitForElement(findBufferStackHeader, stepTimeoutMs);
      if (!header) {
        const reached = await navigateToStacksTopLevel(stepTimeoutMs);
        if (!reached) {
          throw new BufferRefreshError('precondition', 'Could not navigate back to stacks top level');
        }
      }
    }

    store.updateSiteStatus(siteId, 'loading');

    // Step 2-3: Hide container off-screen
    applyRefreshHide(container);

    // Step 4: Click the Buffer stack header to open it
    const stackHeader = findBufferStackHeader();
    if (!stackHeader) {
      throw new BufferRefreshError('click-stack', 'Buffer stack header disappeared');
    }
    stackHeader.click();

    // Step 5: Wait for "Add New Card" button to appear
    const addButton = await waitForElement(findAddNewCardButton, stepTimeoutMs);
    if (!addButton) {
      throw new BufferRefreshError('wait-add-button', 'Add New Card button did not appear');
    }

    // Step 6: Click "Add New Card"
    addButton.click();

    // Step 7: Wait for command input to appear
    const input = await waitForElement(getCommandInput, stepTimeoutMs);
    if (!input) {
      throw new BufferRefreshError('wait-input', 'Command input did not appear');
    }

    // Step 8: Set the command text
    setInputValue(input, command);

    // Step 9: Wait for CREATE button (APEX React renders it after input change)
    const createBtn = await waitForElement(findCreateButton, stepTimeoutMs);
    if (!createBtn) {
      throw new BufferRefreshError('click-create', 'CREATE button not found');
    }
    createBtn.click();

    // Step 10: Wait for the new card to appear
    const card = await waitForElement(
      () => findCardByCommand(command),
      stepTimeoutMs
    );
    if (!card) {
      throw new BufferRefreshError('wait-card', `Card for "${command}" did not appear`);
    }

    // Step 11: Click the card to trigger the server data request
    card.click();

    // Step 12: Wait for server response to propagate through WebSocket pipeline
    await delay(stepTimeoutMs);

    store.updateSiteStatus(siteId, 'success');
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[APXM BufferRefresh]', msg);
    store.updateSiteStatus(siteId, 'error');
    return false;
  } finally {
    // Dismiss any open add-card dialog left behind on error
    const cancelBtn = findCancelButton();
    if (cancelBtn) cancelBtn.click();

    // Navigate back to stacks top level so next run starts clean.
    // Iterative — handles multi-level depth (e.g., PROD buffer → buffer list → stacks).
    if (!isAtStacksTopLevel()) {
      await navigateToStacksTopLevel(stepTimeoutMs);
    }

    // Always restore container styles — no visual leak
    restoreContainerStyles(container, saved);
  }
}
