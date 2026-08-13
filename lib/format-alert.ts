import type { PrunApi } from '../types/prun-api';
import { getEntityDisplayName } from './address';

/**
 * Alerts arrive with NO display text — just a type enum and {key, value}
 * data pairs; the game composes the string client-side in the NOTS buffer.
 * rPrun reads the game-rendered DOM instead, but APXM never shows APEX, so
 * we compose our own text here. High-frequency types get explicit templates;
 * everything else falls back to a humanized type name plus whatever salient
 * data values are recognisable.
 */

export type AlertCategory =
  | 'trade'
  | 'production'
  | 'fleet'
  | 'workforce'
  | 'contract'
  | 'base'
  | 'system';

export interface FormattedAlert {
  text: string;
  category: AlertCategory;
}

function value(alert: PrunApi.Alert, key: string): unknown {
  return alert.data.find((d) => d.key === key)?.value;
}

function str(alert: PrunApi.Alert, key: string): string | undefined {
  const v = value(alert, key);
  return typeof v === 'string' ? v : undefined;
}

function num(alert: PrunApi.Alert, key: string): number | undefined {
  const v = value(alert, key);
  return typeof v === 'number' ? v : undefined;
}

/** Keys like planet/address/destination wrap an Address: { address: {...} }. */
function place(alert: PrunApi.Alert, key: string): string | undefined {
  const v = value(alert, key) as { address?: PrunApi.Address } | undefined;
  return v?.address ? getEntityDisplayName(v.address) : undefined;
}

function partner(alert: PrunApi.Alert): string | undefined {
  const v = value(alert, 'partner') as PrunApi.ContractPartner | undefined;
  return v?.name;
}

/** 'GATEWAY_LINK_ESTABLISHED' → 'Gateway link established' */
function humanize(type: string): string {
  const words = type.toLowerCase().split('_');
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + ' ' + words.slice(1).join(' ');
}

function categoryOf(type: PrunApi.AlertType): AlertCategory {
  if (type.startsWith('COMEX_') || type.startsWith('FOREX_') || type.startsWith('LOCAL_MARKET_'))
    return 'trade';
  if (type.startsWith('PRODUCTION_') || type.startsWith('SHIPYARD_')) return 'production';
  if (type.startsWith('SHIP_') || type.startsWith('GATEWAY_')) return 'fleet';
  if (type.startsWith('WORKFORCE_') || type.startsWith('POPULATION_')) return 'workforce';
  if (type.startsWith('CONTRACT_')) return 'contract';
  if (
    type.startsWith('COGC_') ||
    type.startsWith('ADMIN_CENTER_') ||
    type.startsWith('INFRASTRUCTURE_') ||
    type.startsWith('PLANETARY_') ||
    type.startsWith('WAREHOUSE_') ||
    type.startsWith('SITE_')
  )
    return 'base';
  return 'system';
}

/** "quantity x commodity" when both present, else whichever exists. */
function amountOf(alert: PrunApi.Alert, materialKey: 'commodity' | 'material'): string | undefined {
  const mat = str(alert, materialKey);
  const qty = num(alert, 'quantity');
  if (mat && qty !== undefined) return `${qty}x ${mat}`;
  return mat;
}

/** Appends " @ place" / " from partner" style suffixes only when known. */
function suffix(part: string | undefined, sep: string): string {
  return part ? `${sep}${part}` : '';
}

// Verb phrases for the CONTRACT_CONTRACT_* family; the shared shape is
// "Contract <verb-phrase><with/from partner>".
const CONTRACT_PHRASES: Record<string, string> = {
  CONTRACT_CONDITION_FULFILLED: 'condition fulfilled',
  CONTRACT_CONTRACT_BREACHED: 'breached',
  CONTRACT_CONTRACT_CANCELLED: 'cancelled',
  CONTRACT_CONTRACT_CLOSED: 'closed',
  CONTRACT_CONTRACT_EXTENDED: 'extended',
  CONTRACT_CONTRACT_RECEIVED: 'received',
  CONTRACT_CONTRACT_REJECTED: 'rejected',
  CONTRACT_CONTRACT_TERMINATED: 'terminated',
  CONTRACT_CONTRACT_TERMINATION_REQUESTED: 'termination requested',
  CONTRACT_DEADLINE_EXCEEDED_WITH_CONTROL: 'deadline exceeded',
  CONTRACT_DEADLINE_EXCEEDED_WITHOUT_CONTROL: 'deadline exceeded',
};

export function formatAlert(alert: PrunApi.Alert): FormattedAlert {
  const category = categoryOf(alert.type);

  switch (alert.type) {
    case 'COMEX_ORDER_FILLED':
      return { category, text: `CX order filled${suffix(amountOf(alert, 'commodity'), ': ')}` };
    case 'COMEX_TRADE':
      return { category, text: `CX trade${suffix(amountOf(alert, 'commodity'), ': ')}` };
    case 'FOREX_ORDER_FILLED':
      return { category, text: 'FX order filled' };
    case 'FOREX_TRADE':
      return { category, text: 'FX trade' };
    case 'PRODUCTION_ORDER_FINISHED':
      return {
        category,
        text:
          `Production finished` +
          suffix(amountOf(alert, 'material'), ': ') +
          suffix(place(alert, 'planet') ?? place(alert, 'address'), ' @ '),
      };
    case 'SHIP_FLIGHT_ENDED':
      return {
        category,
        text:
          (str(alert, 'registration') ?? 'Ship') +
          ' arrived' +
          suffix(place(alert, 'destination'), ' at '),
      };
    case 'WORKFORCE_LOW_SUPPLIES':
      return {
        category,
        text: `Workforce low on supplies${suffix(place(alert, 'planet') ?? place(alert, 'address'), ' @ ')}`,
      };
    case 'WORKFORCE_OUT_OF_SUPPLIES':
      return {
        category,
        text: `Workforce OUT of supplies${suffix(place(alert, 'planet') ?? place(alert, 'address'), ' @ ')}`,
      };
    case 'WORKFORCE_UNSATISFIED':
      return {
        category,
        text: `Workforce unsatisfied${suffix(place(alert, 'planet') ?? place(alert, 'address'), ' @ ')}`,
      };
    case 'LOCAL_MARKET_AD_ACCEPTED':
      return { category, text: `Local market ad accepted${suffix(place(alert, 'address'), ' @ ')}` };
    case 'LOCAL_MARKET_AD_EXPIRED':
      return { category, text: `Local market ad expired${suffix(place(alert, 'address'), ' @ ')}` };
    case 'WAREHOUSE_STORE_LOCKED_INSUFFICIENT_FUNDS':
      return { category, text: `Warehouse locked — insufficient funds${suffix(place(alert, 'address'), ' @ ')}` };
    case 'WAREHOUSE_STORE_UNLOCKED':
      return { category, text: `Warehouse unlocked${suffix(place(alert, 'address'), ' @ ')}` };
  }

  const contractPhrase = CONTRACT_PHRASES[alert.type];
  if (contractPhrase) {
    return {
      category,
      text: `Contract ${contractPhrase}${suffix(partner(alert), ' — ')}`,
    };
  }

  // Fallback: humanized type name + the most salient recognisable data value.
  const detail =
    amountOf(alert, 'material') ??
    amountOf(alert, 'commodity') ??
    str(alert, 'registration') ??
    place(alert, 'planet') ??
    place(alert, 'address') ??
    str(alert, 'program');
  return { category, text: humanize(alert.type) + suffix(detail, ': ') };
}
