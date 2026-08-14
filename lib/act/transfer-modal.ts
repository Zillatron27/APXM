// Driver for APEX's mobile material-transfer wizard (device-captured and
// live-validated 2026-08-14 — three real transfers committed during capture):
//   Start transfer (on a StoreView) → MobileTransferStoreAndItemSelectionModal
//   (Material DropDownBox → Target store DropDownBox → Continue)
//   → MobileMaterialTransferModal (number input, pre-filled by APEX with
//   min(target deficit, source stock)) → "transfer selected amount".
// The commit is SILENT: no ActionFeedback overlay ever appears; the modal
// closes itself and the store delta arrives over the WebSocket. Callers must
// confirm success via the store delta, not a feedback overlay.

import { setInputValue, waitForElement } from '../buffer-refresh/dom-helpers';
import { isApexButtonDisabled } from './apex-button';
import { openDropDown, selectDropDownLabel, selectDropDownValue } from './dropdown';

export interface TransferRequest {
  /** Display name of the material (e.g. "STL Fuel") — the material dropdown
   *  is label-addressed (its fiber values are material GUIDs APXM doesn't
   *  track; labels are unique display names). */
  materialName: string;
  /** GUID of the target store — the target dropdown is GUID-addressed via its
   *  fiber `values` (labels are nameless: "Ship  STL fuel store"). */
  targetStoreId: string;
  /** Units to transfer. APEX pre-fills min(deficit, stock); this overrides it
   *  so the committed amount is exactly what APXM showed the user. */
  amount: number;
}

export type TransferResult = { ok: true } | { ok: false; error: string };

const STEP_TIMEOUT_MS = 5000;

function findSelectionModal(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[class*="MobileTransferStoreAndItemSelectionModal"]');
}

function findAmountModal(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[class*="MobileMaterialTransferModal"]');
}

function findButtonByText(root: HTMLElement, text: string): HTMLElement | undefined {
  return Array.from(root.getElementsByTagName('button')).find(
    (b) => b.textContent?.trim().toLowerCase() === text
  );
}

/** Abandons the wizard at whatever step it's on (the × dismiss works on both
 *  modals). Safe to call when nothing is open. */
export function dismissTransferModal(root: HTMLElement): void {
  const dismiss =
    root.querySelector<HTMLElement>('[class*="Modal__btnDismiss"]') ??
    Array.from(root.querySelectorAll<HTMLElement>('*')).find(
      (el) => el.children.length === 0 && /^×?\s*dismiss$/i.test(el.textContent?.trim() ?? '')
    );
  dismiss?.click();
}

/**
 * Drives the wizard from Start transfer through the commit click, inside an
 * already-open source-store buffer (`root` = the buffer anchor, #container).
 * On any failure the wizard is dismissed before returning, so the buffer is
 * left clean for the caller's close/restore.
 */
export async function runTransfer(
  root: HTMLElement,
  request: TransferRequest
): Promise<TransferResult> {
  const fail = (error: string): TransferResult => {
    dismissTransferModal(root);
    return { ok: false, error };
  };

  const start = Array.from(root.getElementsByTagName('button')).find((b) =>
    /^start transfer$/i.test(b.textContent?.trim() ?? '')
  );
  if (!start) return { ok: false, error: 'No Start transfer button in the store buffer' };
  if (isApexButtonDisabled(start)) return { ok: false, error: 'Transfer not available in APEX' };
  start.click();

  const modal = await waitForElement(() => findSelectionModal(root), STEP_TIMEOUT_MS);
  if (!modal) return { ok: false, error: 'Transfer dialog did not open' };

  const boxes = () =>
    Array.from(modal.querySelectorAll<HTMLElement>('[class*="DropDownBox__container"]'));

  const materialBox = boxes()[0];
  if (!materialBox || !(await openDropDown(materialBox))) {
    return fail('Material list did not open');
  }
  if (!selectDropDownLabel(materialBox, request.materialName)) {
    return fail(`${request.materialName} not found in the source store`);
  }

  const targetBox = await waitForElement(() => boxes()[1] ?? null, STEP_TIMEOUT_MS);
  if (!targetBox || !(await openDropDown(targetBox))) {
    return fail('Target store list did not open');
  }
  if (!selectDropDownValue(targetBox, request.targetStoreId)) {
    // The GUID-addressed path refused — never fall back to labels/ordinals
    // here: every ship store renders with the same nameless label.
    return fail('Target store could not be identified in APEX');
  }

  const cont = findButtonByText(modal, 'continue');
  if (!cont) return fail('No Continue button');
  if (isApexButtonDisabled(cont)) return fail('Continue not enabled in APEX');
  cont.click();

  const amountModal = await waitForElement(() => findAmountModal(root), STEP_TIMEOUT_MS);
  if (!amountModal) return fail('Amount step did not open');
  const input = amountModal.querySelector<HTMLInputElement>(
    '[class*="numberInput"] input, input[type="number"]'
  );
  if (!input) return fail('No amount input');
  setInputValue(input, String(request.amount));

  const commit = findButtonByText(amountModal, 'transfer selected amount');
  if (!commit) return fail('No transfer button');
  if (isApexButtonDisabled(commit)) return fail('Transfer not enabled in APEX');
  commit.click();

  // Silent commit: success shows as the wizard closing itself.
  const closed = await waitForElement(
    () => (findAmountModal(root) || findSelectionModal(root) ? null : root),
    STEP_TIMEOUT_MS
  );
  if (!closed) return fail('Transfer dialog did not close after commit');
  return { ok: true };
}
