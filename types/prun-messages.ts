/**
 * Basic Prun API message types
 *
 * These are the common message types from the Prun server.
 * More specific types will be added as needed.
 */

/** Base message structure from Prun */
export interface PrunMessage {
  messageType: string;
  payload?: unknown;
}

/** Common inbound message types */
export type InboundMessageType =
  | 'SITE_SITES'
  | 'STORAGE_STORAGES'
  | 'WORKFORCE_WORKFORCES'
  | 'PRODUCTION_SITE_PRODUCTION_LINES'
  | 'CONTRACTS_CONTRACTS'
  | 'MARKET_DATA'
  | 'COMEX_BROKER_DATA'
  | 'CLIENT_CONNECTION_OPENED'
  | 'WORLD_MATERIAL_CATEGORIES'
  | 'WORLD_BUILDING_CATEGORIES';

/** Common outbound message types */
export type OutboundMessageType =
  | 'FLT_SUBMIT'
  | 'SFC_TRANSFER'
  | 'PRODQ_ORDER'
  | 'CONTRACTS_ACTION';
