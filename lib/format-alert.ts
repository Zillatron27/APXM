import type { PrunApi } from '../types/prun-api';
import { getEntityDisplayName } from './address';
import { useMaterialsStore } from '../stores/reference';

/**
 * Alerts arrive with NO display text — just a type enum and {key, value}
 * data pairs; the game composes the string client-side in the NOTS buffer.
 * rPrun reads the game-rendered DOM instead, but APXM never shows APEX, so
 * we compose our own text here. Every member of the AlertType union has a
 * template; the humanized fallback only catches types the game adds later.
 *
 * The label/tone tables adopt the editorial decisions of refined-prun's
 * NOTS features (MIT) — short type labels, colour by family, terse
 * wording — mapped onto APXM's theme tokens rather than hardcoded colours.
 */

/** Short family label shown in the row's label column (rPrun's table). */
export type AlertLabel =
  | 'MOTION'
  | 'ELECTION'
  | 'CONTRACT'
  | 'ORDER'
  | 'TRADE'
  | 'PRODUCED'
  | 'EXPERT'
  | 'SHIP'
  | 'COGC'
  | 'POPI'
  | 'INFRA'
  | 'GATEWAY'
  | 'ARRIVAL'
  | 'POPR'
  | 'ADVERT'
  | 'SUPPLIES'
  | 'WAR'
  | 'CORP'
  | 'HELLO'
  | 'APEX';

/**
 * Severity, resolved through the theme's status tokens so every preset
 * (Colorblind included) renders it. 'neutral' = the muted text colour.
 */
export type AlertTone = 'critical' | 'warning' | 'ok' | 'info' | 'neutral';

export interface AlertMaterial {
  /** Resolved ticker when the wire value could be matched; renders a tile. */
  ticker?: string;
  /** The raw wire value — always present so a lookup miss still shows text. */
  name: string;
  quantity?: number;
}

export interface FormattedAlert {
  text: string;
  label: AlertLabel;
  tone: AlertTone;
  material?: AlertMaterial;
}

interface LabelEntry {
  types: PrunApi.AlertType[];
  label: AlertLabel;
  tone: AlertTone;
}

// Label table lifted from refined-prun's nots-notification-type-label
// (MIT). Tones are APXM's: rPrun paints each family a distinct hex; we map
// families onto the four status tokens by what the alert asks of the user.
const LABELS: LabelEntry[] = [
  {
    types: [
      'ADMIN_CENTER_MOTION_ENDED',
      'ADMIN_CENTER_MOTION_PASSED',
      'ADMIN_CENTER_MOTION_VOTING_STARTED',
    ],
    label: 'MOTION',
    tone: 'info',
  },
  {
    types: [
      'ADMIN_CENTER_ELECTION_REMINDER',
      'ADMIN_CENTER_ELECTION_STARTED',
      'ADMIN_CENTER_GOVERNOR_ELECTED',
      'ADMIN_CENTER_NO_GOVERNOR_ELECTED',
      'ADMIN_CENTER_RUN_SUCCEEDED',
    ],
    label: 'ELECTION',
    tone: 'info',
  },
  {
    types: [
      'CONTRACT_CONDITION_FULFILLED',
      'CONTRACT_CONTRACT_BREACHED',
      'CONTRACT_CONTRACT_CANCELLED',
      'CONTRACT_CONTRACT_CLOSED',
      'CONTRACT_CONTRACT_EXTENDED',
      'CONTRACT_CONTRACT_RECEIVED',
      'CONTRACT_CONTRACT_REJECTED',
      'CONTRACT_CONTRACT_TERMINATED',
      'CONTRACT_CONTRACT_TERMINATION_REQUESTED',
      'CONTRACT_DEADLINE_EXCEEDED_WITH_CONTROL',
      'CONTRACT_DEADLINE_EXCEEDED_WITHOUT_CONTROL',
      'COMEX_PICKUP_CONTRACT_CREATED',
    ],
    label: 'CONTRACT',
    tone: 'warning',
  },
  // A filled order wants collecting; that is attention, not alarm.
  { types: ['COMEX_ORDER_FILLED', 'FOREX_ORDER_FILLED'], label: 'ORDER', tone: 'warning' },
  { types: ['COMEX_TRADE', 'FOREX_TRADE'], label: 'TRADE', tone: 'ok' },
  { types: ['PRODUCTION_ORDER_FINISHED'], label: 'PRODUCED', tone: 'ok' },
  { types: ['SITE_EXPERT_DROPPED'], label: 'EXPERT', tone: 'warning' },
  { types: ['SHIPYARD_PROJECT_FINISHED'], label: 'SHIP', tone: 'warning' },
  { types: ['COGC_PROGRAM_CHANGED', 'COGC_STATUS_CHANGED', 'COGC_UPKEEP_STARTED'], label: 'COGC', tone: 'info' },
  { types: ['POPULATION_PROJECT_UPGRADED'], label: 'POPI', tone: 'info' },
  {
    types: [
      'PLANETARY_PROJECT_FINISHED',
      'INFRASTRUCTURE_OPERATIONAL_STATE_CHANGED',
      'INFRASTRUCTURE_PROJECT_COMPLETED',
      'INFRASTRUCTURE_UPGRADE_COMPLETED',
      'INFRASTRUCTURE_UPKEEP_PHASE_STARTED',
    ],
    label: 'INFRA',
    tone: 'info',
  },
  {
    types: [
      'GATEWAY_JUMP_ABORTED_LINK_CHANGED',
      'GATEWAY_JUMP_ABORTED_LINK_NOT_ESTABLISHED',
      'GATEWAY_JUMP_ABORTED_MISSING_FUNDS',
      'GATEWAY_JUMP_ABORTED_NO_CAPACITY',
      'GATEWAY_JUMP_ABORTED_NO_FUEL',
      'GATEWAY_JUMP_ABORTED_NOT_OPERATIONAL',
      'GATEWAY_LINK_ESTABLISHED',
      'GATEWAY_LINK_REQUEST_RECEIVED',
      'GATEWAY_LINK_UNLINKED',
    ],
    label: 'GATEWAY',
    tone: 'info',
  },
  { types: ['SHIP_FLIGHT_ENDED'], label: 'ARRIVAL', tone: 'info' },
  { types: ['POPULATION_REPORT_AVAILABLE'], label: 'POPR', tone: 'info' },
  { types: ['LOCAL_MARKET_AD_ACCEPTED', 'LOCAL_MARKET_AD_EXPIRED'], label: 'ADVERT', tone: 'ok' },
  {
    types: ['WORKFORCE_LOW_SUPPLIES', 'WORKFORCE_OUT_OF_SUPPLIES', 'WORKFORCE_UNSATISFIED'],
    label: 'SUPPLIES',
    tone: 'warning',
  },
  { types: ['WAREHOUSE_STORE_LOCKED_INSUFFICIENT_FUNDS', 'WAREHOUSE_STORE_UNLOCKED'], label: 'WAR', tone: 'ok' },
  {
    types: [
      'CORPORATION_MANAGER_INVITE_ACCEPTED',
      'CORPORATION_MANAGER_INVITE_REJECTED',
      'CORPORATION_MANAGER_SHAREHOLDER_LEFT',
      'CORPORATION_PROJECT_FINISHED',
      'CORPORATION_SHAREHOLDER_DIVIDEND_RECEIVED',
      'CORPORATION_SHAREHOLDER_INVITE_RECEIVED',
    ],
    label: 'CORP',
    tone: 'neutral',
  },
  { types: ['TUTORIAL_TASK_FINISHED', 'WELCOME'], label: 'HELLO', tone: 'neutral' },
  {
    types: [
      'RELEASE_NOTES',
      'USER_CONVERSION_REMINDER_LICENSE',
      'USER_LICENSE_ABOUT_TO_EXPIRE',
      'USER_LICENSE_EXPIRED',
      'USER_LICENSE_GIFT_RECEIVED',
      'USER_STEAM_REVIEW',
    ],
    label: 'APEX',
    tone: 'neutral',
  },
];

// Per-type severity that outranks the family default. Out-of-supplies stalls
// production and a locked warehouse strands stock — those must not read
// like a completed trade. Gateway aborts are failed actions, not news.
const TONE_OVERRIDES: Partial<Record<PrunApi.AlertType, AlertTone>> = {
  WORKFORCE_OUT_OF_SUPPLIES: 'critical',
  WAREHOUSE_STORE_LOCKED_INSUFFICIENT_FUNDS: 'critical',
  CONTRACT_CONTRACT_BREACHED: 'critical',
  CONTRACT_DEADLINE_EXCEEDED_WITH_CONTROL: 'critical',
  USER_LICENSE_EXPIRED: 'critical',
  GATEWAY_JUMP_ABORTED_LINK_CHANGED: 'warning',
  GATEWAY_JUMP_ABORTED_LINK_NOT_ESTABLISHED: 'warning',
  GATEWAY_JUMP_ABORTED_MISSING_FUNDS: 'warning',
  GATEWAY_JUMP_ABORTED_NO_CAPACITY: 'warning',
  GATEWAY_JUMP_ABORTED_NO_FUEL: 'warning',
  GATEWAY_JUMP_ABORTED_NOT_OPERATIONAL: 'warning',
  USER_LICENSE_ABOUT_TO_EXPIRE: 'warning',
};

const LABEL_BY_TYPE = new Map<string, LabelEntry>(
  LABELS.flatMap((entry) => entry.types.map((t) => [t, entry] as const))
);

/** Exported so a test can assert the table covers the whole AlertType union. */
export function labelFor(type: PrunApi.AlertType): { label: AlertLabel; tone: AlertTone } | undefined {
  const entry = LABEL_BY_TYPE.get(type);
  if (!entry) return undefined;
  return { label: entry.label, tone: TONE_OVERRIDES[type] ?? entry.tone };
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

/** First known place on the alert, whichever key the game used. */
function anyPlace(alert: PrunApi.Alert): string | undefined {
  return place(alert, 'planet') ?? place(alert, 'address') ?? place(alert, 'destination');
}

function partner(alert: PrunApi.Alert): string | undefined {
  const v = value(alert, 'partner') as PrunApi.ContractPartner | undefined;
  return v?.name;
}

/** 'GATEWAY_LINK_ESTABLISHED' → 'Gateway link established' */
function humanize(type: string): string {
  const phrase = type.toLowerCase().split('_').join(' ');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/** 'ADVERTISING_AGRICULTURE' → 'Advertising agriculture' */
function humanizeValue(v: string | undefined): string | undefined {
  return v ? humanize(v) : undefined;
}

/** Appends " @ place" / " from partner" style suffixes only when known. */
function suffix(part: string | undefined, sep: string): string {
  return part ? `${sep}${part}` : '';
}

/** Reverse index of the FIO materials database, rebuilt when the store changes. */
let nameToTicker: Map<string, string> | undefined;
let indexedEntities: unknown;

function tickerForName(name: string): string | undefined {
  const state = useMaterialsStore.getState();
  if (indexedEntities !== state.entities) {
    nameToTicker = new Map(
      Array.from(state.entities.values()).map((m) => [m.name.toLowerCase(), m.ticker])
    );
    indexedEntities = state.entities;
  }
  return nameToTicker?.get(name.toLowerCase());
}

/**
 * Resolve the alert's material reference. The wire value may be a ticker or
 * a display name (unconfirmed on device), and APEX names drift from FIO's
 * ("Beryl Crystals" vs "beryl"), so: exact ticker → name lookup → unresolved.
 * The raw value is always kept so a miss still renders as text.
 */
function materialOf(alert: PrunApi.Alert, key: 'commodity' | 'material'): AlertMaterial | undefined {
  const raw = str(alert, key);
  if (!raw) return undefined;
  const store = useMaterialsStore.getState();
  const ticker = store.getById(raw.toUpperCase())?.ticker ?? tickerForName(raw);
  return { ticker, name: raw, quantity: num(alert, 'quantity') };
}

/** "200x PE" / "200x Beryl Crystals" for the text line. */
function amountText(m: AlertMaterial | undefined): string | undefined {
  if (!m) return undefined;
  const shown = m.ticker ?? m.name;
  return m.quantity !== undefined ? `${m.quantity}x ${shown}` : shown;
}

// Verb phrases for the CONTRACT_CONTRACT_* family; the shared shape is
// "Contract <verb-phrase> — <partner>".
const CONTRACT_PHRASES: Partial<Record<PrunApi.AlertType, string>> = {
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

// Fixed-text families: types whose meaning is fully carried by the type
// itself; the place (when the game attaches one) is appended uniformly.
const FIXED_TEXT: Partial<Record<PrunApi.AlertType, string>> = {
  ADMIN_CENTER_ELECTION_REMINDER: 'Election reminder',
  ADMIN_CENTER_ELECTION_STARTED: 'Election started',
  ADMIN_CENTER_GOVERNOR_ELECTED: 'Governor elected',
  ADMIN_CENTER_NO_GOVERNOR_ELECTED: 'No governor elected',
  ADMIN_CENTER_RUN_SUCCEEDED: 'Your election run succeeded',
  ADMIN_CENTER_MOTION_ENDED: 'Motion ended',
  ADMIN_CENTER_MOTION_PASSED: 'Motion passed',
  ADMIN_CENTER_MOTION_VOTING_STARTED: 'Motion voting started',
  COGC_STATUS_CHANGED: 'COGC status changed',
  COGC_UPKEEP_STARTED: 'COGC upkeep started',
  INFRASTRUCTURE_OPERATIONAL_STATE_CHANGED: 'Infrastructure state changed',
  INFRASTRUCTURE_PROJECT_COMPLETED: 'Infrastructure project completed',
  INFRASTRUCTURE_UPGRADE_COMPLETED: 'Infrastructure upgrade completed',
  INFRASTRUCTURE_UPKEEP_PHASE_STARTED: 'Infrastructure upkeep started',
  PLANETARY_PROJECT_FINISHED: 'Planetary project finished',
  POPULATION_PROJECT_UPGRADED: 'POPI upgraded',
  POPULATION_REPORT_AVAILABLE: 'Population report available',
  GATEWAY_JUMP_ABORTED_LINK_CHANGED: 'Jump aborted — link changed',
  GATEWAY_JUMP_ABORTED_LINK_NOT_ESTABLISHED: 'Jump aborted — link not established',
  GATEWAY_JUMP_ABORTED_MISSING_FUNDS: 'Jump aborted — missing funds',
  GATEWAY_JUMP_ABORTED_NO_CAPACITY: 'Jump aborted — no capacity',
  GATEWAY_JUMP_ABORTED_NO_FUEL: 'Jump aborted — no fuel',
  GATEWAY_JUMP_ABORTED_NOT_OPERATIONAL: 'Jump aborted — gateway not operational',
  GATEWAY_LINK_ESTABLISHED: 'Gateway link established',
  GATEWAY_LINK_REQUEST_RECEIVED: 'Gateway link request received',
  GATEWAY_LINK_UNLINKED: 'Gateway unlinked',
  CORPORATION_MANAGER_INVITE_ACCEPTED: 'Corporation invite accepted',
  CORPORATION_MANAGER_INVITE_REJECTED: 'Corporation invite rejected',
  CORPORATION_MANAGER_SHAREHOLDER_LEFT: 'Shareholder left the corporation',
  CORPORATION_PROJECT_FINISHED: 'Corporation project finished',
  CORPORATION_SHAREHOLDER_DIVIDEND_RECEIVED: 'Dividend received',
  CORPORATION_SHAREHOLDER_INVITE_RECEIVED: 'Corporation invite received',
  SHIPYARD_PROJECT_FINISHED: 'Ship built',
  COMEX_PICKUP_CONTRACT_CREATED: 'CX pickup contract created',
  LOCAL_MARKET_AD_ACCEPTED: 'Local market ad accepted',
  LOCAL_MARKET_AD_EXPIRED: 'Local market ad expired',
  WAREHOUSE_STORE_LOCKED_INSUFFICIENT_FUNDS: 'Warehouse locked — insufficient funds',
  WAREHOUSE_STORE_UNLOCKED: 'Warehouse unlocked',
  WORKFORCE_LOW_SUPPLIES: 'Workforce low on supplies',
  WORKFORCE_OUT_OF_SUPPLIES: 'Workforce OUT of supplies',
  WORKFORCE_UNSATISFIED: 'Workforce unsatisfied',
  RELEASE_NOTES: 'Release notes',
  USER_CONVERSION_REMINDER_LICENSE: 'Licence reminder',
  USER_LICENSE_ABOUT_TO_EXPIRE: 'Licence about to expire',
  USER_LICENSE_EXPIRED: 'Licence expired',
  USER_LICENSE_GIFT_RECEIVED: 'Licence gift received',
  USER_STEAM_REVIEW: 'Steam review request',
  TUTORIAL_TASK_FINISHED: 'Tutorial task finished',
  WELCOME: 'Welcome to APEX',
};

export function formatAlert(alert: PrunApi.Alert): FormattedAlert {
  const { label, tone } = labelFor(alert.type) ?? { label: 'APEX' as const, tone: 'neutral' as const };
  const base = { label, tone };

  switch (alert.type) {
    case 'COMEX_ORDER_FILLED': {
      const material = materialOf(alert, 'commodity');
      return { ...base, material, text: `CX order filled${suffix(amountText(material), ': ')}` };
    }
    case 'COMEX_TRADE': {
      const material = materialOf(alert, 'commodity');
      return { ...base, material, text: `CX trade${suffix(amountText(material), ': ')}` };
    }
    case 'FOREX_ORDER_FILLED':
      return { ...base, text: 'FX order filled' };
    case 'FOREX_TRADE':
      return { ...base, text: 'FX trade' };
    case 'PRODUCTION_ORDER_FINISHED': {
      const material = materialOf(alert, 'material');
      return {
        ...base,
        material,
        text: `Production finished${suffix(amountText(material), ': ')}${suffix(anyPlace(alert), ' @ ')}`,
      };
    }
    case 'SHIP_FLIGHT_ENDED':
      return {
        ...base,
        text: (str(alert, 'registration') ?? 'Ship') + ' arrived' + suffix(place(alert, 'destination'), ' at '),
      };
    case 'COGC_PROGRAM_CHANGED':
      return {
        ...base,
        text: `COGC program${suffix(humanizeValue(str(alert, 'program')), ': ')}${suffix(anyPlace(alert), ' @ ')}`,
      };
    case 'SITE_EXPERT_DROPPED':
      return {
        ...base,
        text: `Expert dropped${suffix(humanizeValue(str(alert, 'expertiseCategory')), ': ')}${suffix(anyPlace(alert), ' @ ')}`,
      };
  }

  const contractPhrase = CONTRACT_PHRASES[alert.type];
  if (contractPhrase) {
    return { ...base, text: `Contract ${contractPhrase}${suffix(partner(alert), ' — ')}` };
  }

  const fixed = FIXED_TEXT[alert.type];
  if (fixed) {
    return { ...base, text: fixed + suffix(anyPlace(alert), ' @ ') };
  }

  // Fallback for types the game adds after this table was written:
  // humanized type name + the most salient recognisable data value.
  const detail =
    amountText(materialOf(alert, 'material')) ??
    amountText(materialOf(alert, 'commodity')) ??
    str(alert, 'registration') ??
    anyPlace(alert) ??
    str(alert, 'program');
  return { ...base, text: humanize(alert.type) + suffix(detail, ': ') };
}
