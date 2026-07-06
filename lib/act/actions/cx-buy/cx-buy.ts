// Ported from refined-prun src/features/XIT/ACT/actions/cx-buy/cx-buy.ts.
// Edit.vue and Configure.vue omitted — desktop-only UI, not needed to run.
// userData.settings.noBuy replaced with useSettingsStore.getState().noBuy.

import { act } from '../../act-registry';
import { CXPO_BUY } from '../../action-steps/CXPO_BUY';
import type { Config } from './config';
import { fixed0, fixed02 } from '../../_compat';
import { fillAmount } from './utils';
import type { AssertFn } from '../../shared-types';
import { configurableValue } from '../../shared-types';
import { useSettingsStore } from '../../../../stores/settings';

act.addAction<Config>({
  type: 'CX Buy',
  shortDescription: 'Buy materials from a commodity exchange',
  description: (action, config) => {
    if (!action.group || !action.exchange) {
      return '--';
    }
    const exchange =
      action.exchange === configurableValue
        ? (config?.exchange ?? 'configured exchange')
        : action.exchange;
    return 'Buying group ' + action.group + ' from ' + exchange;
  },
  editComponent: undefined,
  configureComponent: undefined,
  needsConfigure: data => data.exchange === configurableValue,
  isValidConfig: (data, config) =>
    !!(data.skippable && config.skip) ||
    data.exchange !== configurableValue ||
    config.exchange !== undefined,
  generateSteps: async ctx => {
    const { data, config, state, log, fail, getMaterialGroup, emitStep } = ctx;

    if (data.skippable && config.skip) {
      return;
    }
    const assert: AssertFn = ctx.assert;
    const allowUnfilled = data.allowUnfilled ?? false;
    const buyPartial = data.buyPartial ?? false;

    const materials = await getMaterialGroup(data.group);
    assert(materials, 'Invalid material group');

    const exchange = data.exchange === configurableValue ? config.exchange : data.exchange;
    assert(exchange, 'Missing exchange');

    // Subtract materials already in the CX warehouse from the buy list.
    if ((data.useCXInv ?? true) && exchange) {
      for (const mat of Object.keys(materials)) {
        for (const CXMat of Object.keys(state.WAR[exchange] ?? {})) {
          if (CXMat === mat) {
            const used = Math.min(materials[mat], state.WAR[exchange][CXMat]);
            materials[mat] -= used;
            state.WAR[exchange][CXMat] -= used;
            if (state.WAR[exchange][mat] <= 0) {
              delete state.WAR[exchange][CXMat];
            }
          }
        }
        if (materials[mat] <= 0) {
          delete materials[mat];
        }
      }
    }

    const noBuy = new Set(useSettingsStore.getState().noBuy);
    for (const ticker of Object.keys(materials)) {
      if (noBuy.has(ticker)) {
        continue;
      }
      const amount = materials[ticker];
      const priceLimit = data.priceLimits?.[ticker] ?? Infinity;
      if (isNaN(priceLimit)) {
        log.error('Non-numerical price limit on ' + ticker);
        continue;
      }

      const cxTicker = `${ticker}.${exchange}`;
      const filled = fillAmount(cxTicker, amount, priceLimit);
      let bidAmount = amount;

      if (filled && filled.amount < amount && !allowUnfilled) {
        if (!buyPartial) {
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
          continue;
        }

        bidAmount = filled.amount;
      }

      emitStep(
        CXPO_BUY({
          exchange,
          ticker,
          amount: bidAmount,
          priceLimit,
          buyPartial,
          allowUnfilled,
        }),
      );
    }
  },
});
