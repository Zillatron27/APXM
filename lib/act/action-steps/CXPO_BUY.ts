// Ported from refined-prun src/features/XIT/ACT/action-steps/CXPO_BUY.ts.
//
// Vue adaptations:
//   watchEffect(fill inputs reactively) → plain function called once before waitAct
//   computed(() => cxWarehouse)         → inline getter () => cxWarehouse
//   watchWhile(() => cond)              → await waitUntil(() => !cond)
//   changeInputValue(el, val)           → setInputValue(el, val)
//   warehouseAmount.value               → warehouseAmount()
//   unwatch()                           → removed (no subscription to clean up)

import { act } from '../act-registry';
import { fixed0, fixed02, fixed1, clickElement, waitUntil, cxobStore } from '../_compat';
import { setInputValue } from '../../buffer-refresh/dom-helpers';
import { fillAmount } from '../actions/cx-buy/utils';
import { storagesStore, exchangesStore, warehousesStore, materialsStore } from '../_compat';
import type { AssertFn } from '../shared-types';

interface Data {
  exchange: string;
  ticker: string;
  amount: number;
  priceLimit: number;
  buyPartial: boolean;
  allowUnfilled: boolean;
}

export const CXPO_BUY = act.addActionStep<Data>({
  type: 'CXPO_BUY',
  preProcessData: data => ({ ...data, ticker: data.ticker.toUpperCase() }),
  description: data => {
    const { ticker, exchange } = data;
    const cxTicker = `${ticker}.${exchange}`;
    const filled = fillAmount(cxTicker, data.amount, data.priceLimit);
    const amount = filled?.amount ?? data.amount;
    const priceLimit = filled?.priceLimit ?? data.priceLimit;
    const allowUnfilled = data.allowUnfilled ?? false;
    const willFillCompletely = filled && filled.amount === data.amount;

    if (!willFillCompletely && allowUnfilled) {
      let description = `Bid for ${fixed0(data.amount)} ${ticker} on ${exchange}`;
      if (isFinite(priceLimit)) {
        description += ` at price ${fixed02(data.priceLimit)}`;
        description += ` (tot: ${fixed1(data.amount * data.priceLimit)})`;
      }
      return description;
    }

    let description = `Buy ${fixed0(amount)} ${ticker} on ${exchange}`;
    if (isFinite(priceLimit)) {
      description += ` with price limit ${fixed02(priceLimit)}`;
    }
    if (filled) {
      description += ` (tot: ${fixed1(filled.cost)})`;
    } else {
      description += ' (no price data yet)';
    }
    return description;
  },
  execute: async ctx => {
    const { data, log, setStatus, requestTile, waitAct, waitActionFeedback, complete, skip, fail } =
      ctx;
    const assert: AssertFn = ctx.assert;
    const { amount, ticker, exchange, priceLimit } = data;
    const cxTicker = `${ticker}.${exchange}`;

    // Getter reads current Zustand state each time it is called.
    const getCxWarehouse = () => {
      const naturalId = exchangesStore.getNaturalIdFromCode(exchange);
      const warehouse = warehousesStore.getByEntityNaturalId(naturalId);
      return storagesStore.getById(warehouse?.storeId);
    };
    assert(getCxWarehouse(), `CX warehouse not found for ${exchange}`);

    if (amount <= 0) {
      log.warning(`No ${ticker} was bought (target amount is 0)`);
      skip();
      return;
    }

    const material = materialsStore.getByTicker(ticker);
    assert(material, `Unknown material ${ticker}`);

    const warehouse = getCxWarehouse()!;
    const canFitWeight =
      material.weight * amount <= warehouse.weightCapacity - warehouse.weightLoad;
    const canFitVolume =
      material.volume * amount <= warehouse.volumeCapacity - warehouse.volumeLoad;
    assert(
      canFitWeight && canFitVolume,
      `Cannot buy ${fixed0(amount)} ${ticker} (will not fit in the warehouse)`,
    );

    const tile = await requestTile(`CXPO ${cxTicker}`);
    if (!tile) {
      return;
    }

    setStatus('Setting up CXPO buffer...');

    const buyButton = await $(tile.anchor, C.Button.success);
    const form = await $(tile.anchor, C.ComExPlaceOrderForm.form);
    const inputs = _$$<HTMLInputElement>(form!, 'input');
    const quantityInput = inputs[0];
    assert(quantityInput !== undefined, 'Missing quantity input');
    const priceInput = inputs[1];
    assert(priceInput !== undefined, 'Missing price input');

    // Opening the CXPO tile triggers COMEX_BROKER_DATA which populates the
    // order book asynchronously. Wait for it — this replaces Vue's watchEffect
    // which re-ran reactively whenever the store changed.
    await waitUntil(() => cxobStore.getByTicker(cxTicker) !== undefined, 100, 8000)
      .catch(() => {});

    const filled = fillAmount(cxTicker, amount, priceLimit);

    if (!filled) {
      fail(`Missing ${cxTicker} order book data`);
      return;
    }

    if (filled.amount < amount && !data.allowUnfilled) {
      if (!data.buyPartial) {
        let message = `Not enough materials on ${exchange} to buy ${fixed0(amount)} ${ticker}`;
        if (isFinite(priceLimit)) {
          message += ` with price limit ${fixed02(priceLimit)}/u`;
        }
        fail(message);
        return;
      }

      const leftover = amount - filled.amount;
      let message =
        `${fixed0(leftover)} ${ticker} will not be bought on ${exchange} ` +
        `(${fixed0(filled.amount)} of ${fixed0(amount)} available`;
      if (isFinite(priceLimit)) {
        message += ` with price limit ${fixed02(priceLimit)}/u`;
      }
      message += ')';
      log.warning(message);

      if (filled.amount === 0) {
        skip();
        return;
      }
    }

    if (data.allowUnfilled) {
      setInputValue(quantityInput, data.amount.toString());
      setInputValue(priceInput, fixed02(data.priceLimit));
    } else {
      setInputValue(quantityInput, filled.amount.toString());
      setInputValue(priceInput, fixed02(filled.priceLimit));
    }

    // Cache description before clicking buy — order book changes after submission.
    ctx.cacheDescription();

    // Allow the user to override the auto-filled values before confirming.
    function onManualInput(event: Event) {
      if (event.isTrusted) {
        log.info('Manual input detected; keeping user-entered quantity and price');
      }
    }
    quantityInput.addEventListener('input', onManualInput);
    priceInput.addEventListener('input', onManualInput);

    await waitAct();
    quantityInput.removeEventListener('input', onManualInput);
    priceInput.removeEventListener('input', onManualInput);

    // Getter for warehouse amount — reads live Zustand state.
    const getWarehouseAmount = () => {
      return (
        getCxWarehouse()
          ?.items.filter(x => x.quantity !== null && x.quantity !== undefined)
          .find(x => x.quantity!.material.ticker === ticker)?.quantity?.amount ?? 0
      );
    };
    const currentAmount = getWarehouseAmount();
    const amountToFill = fillAmount(cxTicker, amount, priceLimit)?.amount ?? 0;
    const shouldWaitForUpdate = amountToFill > 0;

    await clickElement(buyButton!);
    await waitActionFeedback(tile);

    if (shouldWaitForUpdate) {
      setStatus('Waiting for storage update...');
      await waitUntil(() => getWarehouseAmount() !== currentAmount);
    } else {
      setStatus('Bid order created');
    }

    complete();
  },
});
