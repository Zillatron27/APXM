/**
 * Desktop Bridge Protocol Types
 *
 * Message protocol and summary types for postMessage communication
 * between the APXM content script and the shell page (iframe).
 * Single source of truth — imported by both extension and shell builds.
 */

// ============================================================================
// Summary Types (flat, serializable, no PrunApi dependency)
// ============================================================================

export interface SiteSummary {
  siteId: string;
  planetName: string | null;
  planetNaturalId: string | null;
  systemNaturalId: string | null;
  platformCount: number;
  area: number;
}

export interface ShipSummary {
  shipId: string;
  name: string;
  registration: string;
  status: string;
  locationSystemNaturalId: string | null;
}

export interface FlightSummary {
  flightId: string;
  shipId: string;
  originSystemNaturalId: string | null;
  destinationSystemNaturalId: string | null;
  departureTimestamp: number;
  arrivalTimestamp: number;
  segmentCount: number;
  currentSegmentIndex: number;
}

export interface StorageSummary {
  storageId: string;
  addressableId: string;
  type: string;
  weightUsed: number;
  weightCapacity: number;
  volumeUsed: number;
  volumeCapacity: number;
}

export interface ProductionSummary {
  siteId: string;
  planetNaturalId: string | null;
  systemNaturalId: string | null;
  totalLines: number;
  activeLines: number;
  idleLines: number;
  nextCompletionTimestamp: number | null;
}

export interface WorkforceSummary {
  siteId: string;
  planetNaturalId: string | null;
  systemNaturalId: string | null;
  overallSatisfaction: number;
  burnStatus: 'critical' | 'warning' | 'ok' | 'unknown';
  lowestBurnDays: number | null;
}

export interface ContractSummary {
  contractId: string;
  localId: string;
  partnerName: string;
  status: string;
  dueDateTimestamp: number | null;
  isOverdue: boolean;
}

export interface CurrencyAmount {
  currency: string;
  amount: number;
}

// ============================================================================
// Full Snapshot (sent on init and reconnect)
// ============================================================================

export interface BridgeSnapshot {
  sites: SiteSummary[];
  ships: ShipSummary[];
  flights: FlightSummary[];
  storage: StorageSummary[];
  production: ProductionSummary[];
  workforce: WorkforceSummary[];
  contracts: ContractSummary[];
  balances: CurrencyAmount[];
  timestamp: number;
}

// ============================================================================
// Incremental Update
// ============================================================================

export type BridgeEntityType = keyof Omit<BridgeSnapshot, 'timestamp'>;

export interface BridgeUpdate {
  entityType: BridgeEntityType;
  data:
    | SiteSummary[]
    | ShipSummary[]
    | FlightSummary[]
    | StorageSummary[]
    | ProductionSummary[]
    | WorkforceSummary[]
    | ContractSummary[]
    | CurrencyAmount[];
  timestamp: number;
}

// ============================================================================
// Message Protocol
// ============================================================================

export interface ApxmHelloMessage {
  type: 'apxm-hello';
  version: string;
}

export interface ApxmHelloAckMessage {
  type: 'apxm-hello-ack';
  version: string;
}

export interface ApxmInitMessage {
  type: 'apxm-init';
  snapshot: BridgeSnapshot;
}

export interface ApxmUpdateMessage {
  type: 'apxm-update';
  update: BridgeUpdate;
}

export interface ApxmBufferCommandMessage {
  type: 'apxm-buffer-command';
  command: string;
}

export type ApxmBridgeMessage =
  | ApxmHelloMessage
  | ApxmHelloAckMessage
  | ApxmInitMessage
  | ApxmUpdateMessage
  | ApxmBufferCommandMessage;
