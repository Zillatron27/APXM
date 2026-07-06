// Ported from refined-prun src/features/XIT/ACT/action-steps/MTRA_TRANSFER.ts.
//
// Vue adaptations:
//   computed(() => X)               → inline getter () => X
//   watchWhile(() => cond)          → await waitUntil(() => !cond)
//   changeInputValue(el, val)       → setInputValue(el, val)
//   destinationAmount.value         → destinationAmount()
//
// Scope: all DOM queries are scoped to tile.anchor (#container on mobile).

import { act } from '../act-registry';
import { serializeStorage } from '../actions/utils';
import { fixed0, clickElement, waitUntil } from '../_compat';
import { setInputValue } from '../../buffer-refresh/dom-helpers';
import { storagesStore, materialsStore } from '../_compat';
import type { AssertFn } from '../shared-types';
import { selectMaterial } from './cont-utils';

interface Data {
  from: string;
  to: string;
  ticker: string;
  amount: number;
}

// Tracks the MTRA buffer command that is currently open (off-screen) so
// consecutive MTRA_TRANSFER steps for the same origin/dest can skip the
// full buffer-open navigation and reuse the already-open form.
let lastMtraCommand: string | null = null;

export function clearMtraBufferCache(): void {
  lastMtraCommand = null;
}

export const MTRA_TRANSFER = act.addActionStep<Data>({
  type: 'MTRA_TRANSFER',
  preProcessData: data => ({ ...data, ticker: data.ticker.toUpperCase() }),
  totalMaterials: data => ({ [data.ticker]: data.amount }),
  description: data => {
    const from = storagesStore.getById(data.from);
    const to = storagesStore.getById(data.to);
    const fromName = from ? serializeStorage(from) : 'NOT FOUND';
    const toName = to ? serializeStorage(to) : 'NOT FOUND';
    return `Transfer ${fixed0(data.amount)} ${data.ticker} from ${fromName} to ${toName}`;
  },
  execute: async ctx => {
    const { data, log, setStatus, requestTile, waitAct, waitActionFeedback, complete, skip, fail } =
      ctx;
    const assert: AssertFn = ctx.assert;
    const { ticker, amount } = data;

    const from = storagesStore.getById(data.from);
    assert(from, 'Origin inventory not found');
    const to = storagesStore.getById(data.to);
    assert(to, 'Destination inventory not found');

    if (!from.items.find(x => x.quantity?.material.ticker === ticker)) {
      log.warning(`No ${ticker} was transferred (not present in origin)`);
      skip();
      return;
    }

    if (amount <= 0) {
      log.warning(`No ${ticker} was transferred (target amount is 0)`);
      skip();
      return;
    }

    const material = materialsStore.getByTicker(ticker);
    assert(material, `Unknown material ${ticker}`);

    // Check if at least one unit fits in the destination.
    const epsilon = 0.000001;
    const canFitWeight = to.weightCapacity - to.weightLoad - material.weight + epsilon >= 0;
    const canFitVolume = to.volumeCapacity - to.volumeLoad - material.volume + epsilon >= 0;
    if (!canFitWeight || !canFitVolume) {
      log.warning(`No ${ticker} was transferred (no space)`);
      skip();
      return;
    }

    const command = `MTRA from-${from.id.substring(0, 8)} to-${to.id.substring(0, 8)}`;

    let tile: import('../runtime-types').PrunTile;
    if (lastMtraCommand === command) {
      // Same origin/dest as the previous transfer — the MTRA form is still open
      // off-screen, so skip the buffer-open navigation and the "Open …" ACT press.
      const anchor = document.getElementById('container') as HTMLElement | null;
      assert(anchor, 'MTRA buffer anchor (#container) not found');
      tile = { anchor };
      setStatus('Reusing MTRA buffer...');
    } else {
      const newTile = await requestTile(command);
      if (!newTile) return;
      tile = newTile;
      lastMtraCommand = command;
    }

    setStatus('Setting up MTRA buffer...');
    const container = await $(tile.anchor, C.MaterialSelector.container);

    // Bring the buffer on-screen for material selection: WebKit won't focus or
    // deliver input events to elements that are off-screen or visibility:hidden.
    const bufContainer = tile.anchor as HTMLElement;
    const prevVisibility = bufContainer.style.visibility;
    const prevLeft = bufContainer.style.left;
    bufContainer.style.visibility = 'visible';
    bufContainer.style.left = '0px';
    const ok = await selectMaterial(container!, ticker);

    if (!ok) {
      bufContainer.style.left = prevLeft;
      bufContainer.style.visibility = prevVisibility;
      fail(`Ticker ${ticker} not found in the material selector`);
      return;
    }

    const sliderNumbers = _$$(tile.anchor, 'rc-slider-mark-text').map(x =>
      Number(x.textContent ?? 0),
    );
    const maxAmount = Math.max(...sliderNumbers);
    const allInputs = _$$<HTMLInputElement>(tile.anchor, 'input');
    const amountInput = allInputs[1];
    assert(amountInput !== undefined, 'Amount input not found');

    if (amount > maxAmount) {
      const leftover = amount - maxAmount;
      log.warning(
        `${fixed0(leftover)} ${ticker} not transferred ` +
          `(${fixed0(maxAmount)} of ${fixed0(amount)} transferred)`,
      );
      if (maxAmount === 0) {
        bufContainer.style.left = prevLeft;
        bufContainer.style.visibility = prevVisibility;
        skip();
        return;
      }
    }
    setInputValue(amountInput, Math.min(amount, maxAmount).toString());

    // Find the Transfer button by text — C.Button.btn matches all APEX buttons
    // in #container and the first one may not be the Transfer button.
    const allBtns = _$$<HTMLElement>(tile.anchor, C.Button.btn);
    const transferButton = allBtns.find(
      btn => btn.textContent?.trim().toUpperCase() === 'TRANSFER',
    );

    await waitAct();

    // Getter captures current state; Zustand store is updated by the message handler
    // when the game server confirms the transfer.
    const getDestinationAmount = () => {
      const store = storagesStore.getById(data.to);
      return (
        store?.items
          .filter(x => x.quantity !== null && x.quantity !== undefined)
          .find(x => x.quantity!.material.ticker === ticker)?.quantity?.amount ?? 0
      );
    };
    const currentAmount = getDestinationAmount();

    // Keep buffer on-screen through click and feedback: clicking a hidden/off-screen
    // button can cause unintended navigation or form submission on mobile WebKit.
    assert(transferButton, 'Transfer button not found');
    await clickElement(transferButton);
    await waitActionFeedback(tile);
    bufContainer.style.left = prevLeft;
    bufContainer.style.visibility = prevVisibility;
    await waitUntil(() => getDestinationAmount() !== currentAmount);

    complete();
  },
});
