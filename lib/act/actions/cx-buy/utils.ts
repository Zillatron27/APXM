// Ported verbatim from refined-prun
// src/features/XIT/ACT/actions/cx-buy/utils.ts.
// Imports adapted to APXM layout via ../../_compat.

import { cxobStore, isFiniteOrder } from '../../_compat';

export function fillAmount(cxTicker: string, amount: number, priceLimit: number) {
  const orderBook = cxobStore.getByTicker(cxTicker);
  if (!orderBook) {
    return undefined;
  }

  const filled = {
    amount: 0,
    priceLimit: 0,
    cost: 0,
  };
  const orders = orderBook.sellingOrders.slice().sort((a, b) => a.limit.amount - b.limit.amount);
  for (const order of orders) {
    const orderPrice = order.limit.amount;
    if (priceLimit < orderPrice) {
      break;
    }
    const orderAmount = isFiniteOrder(order) ? (order.amount as number) : Infinity;
    const remaining = amount - filled.amount;
    const filledByOrder = Math.min(remaining, orderAmount);
    filled.priceLimit = orderPrice;
    filled.amount += filledByOrder;
    filled.cost += filledByOrder * orderPrice;
    if (filled.amount === amount) {
      break;
    }
  }

  return filled;
}
