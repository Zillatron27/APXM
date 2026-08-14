// MAIN-WORLD half of the input bridge. Synthetic keyboard/input events
// constructed in the content-script world update an input's VALUE but do not
// drive APEX's React the way page-context events do (device finding
// 2026-08-14: the AddressSelector's suggestions never populate from
// content-world typing, while the identical sequence from the page context
// works). This responder performs the requested input sequence in the main
// world; request and ack travel via shared DOM only (event + data
// attributes), like the fiber bridge.

export const INPUT_DRIVE_EVENT = 'apxm-input-drive';
export const INPUT_REQUEST_ATTR = 'data-apxm-input-request';
export const INPUT_DONE_ATTR = 'data-apxm-input-done';

type InputRequest =
  | { kind: 'type'; text: string }
  | { kind: 'key'; key: string }
  | { kind: 'click' }
  /** mousedown/up at a horizontal fraction of the element's rect — how a
   *  value is set on an rc-slider rail (arbitrary positions, not just the
   *  rendered marks). */
  | { kind: 'clickAt'; xFrac: number };

async function performType(input: HTMLInputElement, text: string): Promise<void> {
  input.focus();
  await sleep(80);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (input.value) {
    setter?.call(input, '');
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await sleep(50);
  }
  for (const ch of text) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: ch, bubbles: true, cancelable: true }));
    setter?.call(input, input.value + ch);
    input.dispatchEvent(new InputEvent('input', { data: ch, inputType: 'insertText', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true, cancelable: true }));
    await sleep(40);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Installs the main-world responder. Idempotent per document. */
export function installInputBridge(): void {
  document.addEventListener(INPUT_DRIVE_EVENT, (event) => {
    const el = event.target;
    if (!(el instanceof HTMLElement)) return;
    const raw = el.getAttribute(INPUT_REQUEST_ATTR);
    if (!raw) return;
    el.removeAttribute(INPUT_REQUEST_ATTR);
    let request: InputRequest;
    try {
      request = JSON.parse(raw) as InputRequest;
    } catch {
      el.setAttribute(INPUT_DONE_ATTR, 'error');
      return;
    }
    void (async () => {
      try {
        if (request.kind === 'type' && el instanceof HTMLInputElement) {
          await performType(el, request.text);
        } else if (request.kind === 'key') {
          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: request.key, code: request.key, bubbles: true, cancelable: true })
          );
          el.dispatchEvent(
            new KeyboardEvent('keyup', { key: request.key, code: request.key, bubbles: true, cancelable: true })
          );
        } else if (request.kind === 'click') {
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          el.click();
        } else if (request.kind === 'clickAt') {
          // rc-slider's drag model: value is set on mousedown at the position;
          // the drag ends with a mouseup on the DOCUMENT (where the slider
          // registers its move/up listeners). A same-element mouseup + click
          // breaks the lifecycle and the value reverts on the next re-render
          // (device finding 2026-08-14).
          const rect = el.getBoundingClientRect();
          const x = rect.left + rect.width * Math.min(Math.max(request.xFrac, 0), 1);
          const y = rect.top + rect.height / 2;
          const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y };
          el.dispatchEvent(new MouseEvent('mousedown', opts));
          await sleep(100);
          document.dispatchEvent(new MouseEvent('mouseup', opts));
        }
        el.setAttribute(INPUT_DONE_ATTR, 'ok');
      } catch {
        el.setAttribute(INPUT_DONE_ATTR, 'error');
      }
    })();
  });
}
