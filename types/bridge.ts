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

export interface CargoItem {
  ticker: string;
  category: string;
  amount: number;
  weight: number;
  volume: number;
}

export interface FlightSegmentSummary {
  type: string;
  originSystemNaturalId: string | null;
  destinationSystemNaturalId: string | null;
  originPlanetNaturalId: string | null;
  destinationPlanetNaturalId: string | null;
  departureTimestamp: number;
  arrivalTimestamp: number;
}

export interface ShipSummary {
  shipId: string;
  name: string;
  registration: string;
  blueprintNaturalId: string;
  condition: number;
  status: string;
  locationSystemNaturalId: string | null;
  locationPlanetNaturalId: string | null;
  cargo: {
    weightUsed: number;
    weightCapacity: number;
    volumeUsed: number;
    volumeCapacity: number;
    items: CargoItem[];
  } | null;
  fuel: {
    stlUnits: number;
    stlUnitCapacity: number;
    ftlUnits: number;
    ftlUnitCapacity: number;
  } | null;
}

export interface FlightSummary {
  flightId: string;
  shipId: string;
  originSystemNaturalId: string | null;
  destinationSystemNaturalId: string | null;
  originPlanetNaturalId: string | null;
  destinationPlanetNaturalId: string | null;
  departureTimestamp: number;
  arrivalTimestamp: number;
  segments: FlightSegmentSummary[];
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

export interface ScreenInfo {
  id: string;
  name: string;
  hidden: boolean;
}

// ============================================================================
// Settings Types (mirrored from extension settings store)
// ============================================================================

export interface BurnThresholds {
  critical: number;
  warning: number;
  resupply: number;
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
  screens: ScreenInfo[];
  screenAssignments: Record<string, string>;
  burnThresholds: BurnThresholds;
  companyName: string | null;
  primaryCurrency: string | null;
  timestamp: number;
}

// ============================================================================
// Incremental Update
// ============================================================================

export type BridgeEntityType = keyof Omit<BridgeSnapshot, 'timestamp' | 'screenAssignments' | 'burnThresholds' | 'companyName' | 'primaryCurrency'>;

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
    | CurrencyAmount[]
    | ScreenInfo[];
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

export interface ApxmScreenSwitchMessage {
  type: 'apxm-screen-switch';
  screenId: string;
}

export interface ApxmScreenAssignMessage {
  type: 'apxm-screen-assign';
  planetNaturalId: string;
  screenId: string | null;
}

export interface ApxmSettingsUpdateMessage {
  type: 'apxm-settings-update';
  settings: {
    burnThresholds: BurnThresholds;
  };
}

export type ApxmBridgeMessage =
  | ApxmHelloMessage
  | ApxmHelloAckMessage
  | ApxmInitMessage
  | ApxmUpdateMessage
  | ApxmBufferCommandMessage
  | ApxmScreenSwitchMessage
  | ApxmScreenAssignMessage
  | ApxmSettingsUpdateMessage;
