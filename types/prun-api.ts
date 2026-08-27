/**
 * PrunApi Type Definitions
 *
 * Ported from refined-prun's type declarations.
 * These interfaces match the wire protocol from Prosperous Universe's WebSocket API.
 */

export namespace PrunApi {
  // ============================================================================
  // Core Primitives
  // ============================================================================

  export interface DateTime {
    timestamp: number;
  }

  export interface TimeSpan {
    millis: number;
  }

  export interface CurrencyAmount {
    currency: string;
    amount: number;
  }

  export interface Position {
    x: number;
    y: number;
    z: number;
  }

  export interface Currency {
    numericCode: number;
    code: string;
    name: string;
    decimals: number;
  }

  export interface ExchangeEntity {
    id: string;
    name: string;
    code: string;
  }

  // ============================================================================
  // Address Types
  // ============================================================================

  export interface Address {
    lines: AddressLine[];
  }

  export interface UnknownAddressLine {
    type: string;
    entity?: AddressEntity;
    orbit?: AddressOrbit;
  }

  export interface SystemAddressLine extends UnknownAddressLine {
    type: 'SYSTEM';
    entity: AddressEntity;
  }

  export interface StationAddressLine extends UnknownAddressLine {
    type: 'STATION';
    entity: AddressEntity;
  }

  export interface PlanetAddressLine extends UnknownAddressLine {
    type: 'PLANET';
    entity: AddressEntity;
  }

  export interface OrbitAddressLine extends UnknownAddressLine {
    type: 'ORBIT';
    orbit: AddressOrbit;
  }

  export type AddressLine =
    | SystemAddressLine
    | StationAddressLine
    | PlanetAddressLine
    | OrbitAddressLine
    | UnknownAddressLine;

  export interface AddressEntity {
    id: string;
    naturalId: string;
    name: string;
  }

  export interface AddressOrbit {
    semiMajorAxis: number;
    eccentricity: number;
    inclination: number;
    rightAscension: number;
    periapsis: number;
  }

  // ============================================================================
  // Material Types
  // ============================================================================

  export interface Material {
    name: string;
    id: string;
    ticker: string;
    category: string;
    weight: number;
    volume: number;
    resource: boolean;
  }

  export interface MaterialAmount {
    material: Material;
    amount: number;
  }

  export interface MaterialQuantities {
    quantities: MaterialAmount[];
  }

  export interface MaterialAmountLimit {
    material: Material;
    amount: number;
    limit: number;
  }

  export interface ProjectInventory {
    items: MaterialAmountLimit[];
  }

  export interface MaterialAmountValue {
    value: CurrencyAmount;
    material: Material;
    amount: number;
  }

  export interface MaterialCategory {
    name: string;
    id: string;
    materials: Material[];
  }

  // ============================================================================
  // Commodity Exchange Order Book (COMEX_BROKER_DATA)
  // ============================================================================

  export interface CXOrder {
    /** Units offered/requested. null = a market maker's infinite order. */
    amount: number | null;
    limit: { amount: number };
  }

  export interface CXOrderBook {
    sellingOrders: CXOrder[];
    buyingOrders: CXOrder[];
  }

  // ============================================================================
  // Site Types
  // ============================================================================

  export interface Site {
    siteId: string;
    address: Address;
    founded: DateTime;
    platforms: Platform[];
    buildOptions: BuildOptions;
    area: number;
    investedPermits: number;
    maximumPermits: number;
  }

  export interface BuildOptions {
    options: BuildOption[];
  }

  export interface BuildOption {
    id: string;
    name: string;
    area: number;
    ticker: string;
    expertiseCategory: ExpertiseCategory | null;
    needsFertileSoil: boolean;
    type: PlatformModuleType;
    workforceCapacities: WorkforceCapacity[];
    materials: MaterialQuantities;
  }

  export type ExpertiseCategory =
    | 'AGRICULTURE'
    | 'CHEMISTRY'
    | 'CONSTRUCTION'
    | 'ELECTRONICS'
    | 'FOOD_INDUSTRIES'
    | 'FUEL_REFINING'
    | 'MANUFACTURING'
    | 'METALLURGY'
    | 'RESOURCE_EXTRACTION';

  export type PlatformModuleType =
    | 'CORE'
    | 'HABITATION'
    | 'PRODUCTION'
    | 'RESOURCES'
    | 'STORAGE';

  export interface WorkforceCapacity {
    level: WorkforceLevel;
    capacity: number;
  }

  export type WorkforceLevel =
    | 'ENGINEER'
    | 'PIONEER'
    | 'SCIENTIST'
    | 'SETTLER'
    | 'TECHNICIAN';

  export interface Platform {
    siteId: string;
    id: string;
    module: PlatformModule;
    area: number;
    creationTime: DateTime;
    reclaimableMaterials: MaterialAmount[];
    repairMaterials: MaterialAmount[];
    repairMaterials24: MaterialAmount[];
    repairMaterials48: MaterialAmount[];
    bookValue: CurrencyAmount;
    condition: number;
    lastRepair: DateTime | null;
  }

  export interface PlatformModule {
    id: string;
    platformId: string;
    reactorId: string;
    reactorName: string;
    reactorTicker: string;
    type: PlatformModuleType;
  }

  // ============================================================================
  // Storage Types
  // ============================================================================

  export interface Store {
    id: string;
    addressableId: string;
    name: string | null;
    weightLoad: number;
    weightCapacity: number;
    volumeLoad: number;
    volumeCapacity: number;
    items: StoreItem[];
    fixed: boolean;
    tradeStore: boolean;
    rank: number;
    locked: boolean;
    type: StoreType;
  }

  export interface StoreItem {
    quantity?: MaterialAmountValue | null;
    id: string;
    type: 'INVENTORY' | 'SHIPMENT';
    weight: number;
    volume: number;
  }

  export type StoreType =
    | 'STORE'
    | 'SHIP_STORE'
    | 'STL_FUEL_STORE'
    | 'FTL_FUEL_STORE'
    | 'WAREHOUSE_STORE'
    | 'CONSTRUCTION_STORE'
    | 'UPKEEP_STORE'
    | 'VORTEX_FUEL_STORE';

  // ============================================================================
  // Workforce Types
  // ============================================================================

  export interface Workforce {
    level: string;
    population: number;
    reserve: number;
    capacity: number;
    required: number;
    satisfaction: number;
    needs: Need[];
  }

  export interface Need {
    category: NeedCategory;
    essential: boolean;
    material: Material;
    satisfaction: number;
    unitsPerInterval: number;
    unitsPer100: number;
  }

  export type NeedCategory = 'CLOTHING' | 'FOOD' | 'HEALTH' | 'TOOLS' | 'WATER';

  // ============================================================================
  // Production Types
  // ============================================================================

  export interface ProductionLine {
    id: string;
    siteId: string;
    address: Address;
    type: string;
    capacity: number;
    slots: number;
    efficiency: number;
    condition: number;
    workforces: ProductionWorkforce[];
    orders: ProductionOrder[];
    productionTemplates: ProductionTemplate[];
    efficiencyFactors: EfficiencyFactor[];
  }

  export interface EfficiencyFactor {
    expertiseCategory?: string;
    type: EfficiencyFactorType;
    effectivity: number;
    value: number;
  }

  export type EfficiencyFactorType =
    | 'EXPERTS'
    | 'COGC_PROGRAM'
    | 'PRODUCTION_LINE_CONDITION';

  export interface ProductionOrder {
    id: string;
    productionLineId: string;
    inputs: MaterialAmountValue[];
    outputs: MaterialAmountValue[];
    created: DateTime;
    started: DateTime | null;
    completion: DateTime | null;
    duration: TimeSpan | null;
    lastUpdated: DateTime | null;
    completed: number;
    halted: boolean;
    productionFee: CurrencyAmount;
    productionFeeCollector: ProductionFeeCollector;
    recurring: boolean;
    recipeId: string;
  }

  export interface ProductionFeeCollector {
    currency: Currency;
  }

  export interface ProductionTemplate {
    id: string;
    name: string;
    inputFactors: ProductionFactor[];
    outputFactors: ProductionFactor[];
    experience: number;
    effortFactor: number;
    efficiency: number;
    duration: TimeSpan;
    productionFeeFactor: CurrencyAmount;
    productionFeeCollector: ProductionFeeCollector;
  }

  export interface ProductionFactor {
    material: Material;
    factor: number;
  }

  export interface ProductionWorkforce {
    level: string;
    efficiency: number;
  }

  // ============================================================================
  // Ship Types
  // ============================================================================

  export interface Ship {
    id: string;
    idShipStore: string;
    idStlFuelStore: string;
    idFtlFuelStore: string;
    registration: string;
    name: string;
    commissioningTime: DateTime;
    blueprintNaturalId: string;
    address: Address | null;
    flightId: string | null;
    acceleration: number;
    thrust: number;
    mass: number;
    operatingEmptyMass: number;
    volume: number;
    reactorPower: number;
    emitterPower: number;
    stlFuelStoreId: string;
    stlFuelFlowRate: number;
    ftlFuelStoreId: string;
    operatingTimeStl: TimeSpan;
    operatingTimeFtl: TimeSpan;
    condition: number;
    lastRepair: DateTime | null;
    repairMaterials: MaterialAmount[];
    status: string;
  }

  // ============================================================================
  // Flight Types
  // ============================================================================

  export interface Flight {
    id: string;
    shipId: string;
    origin: Address;
    destination: Address;
    departure: DateTime;
    arrival: DateTime;
    segments: FlightSegment[];
    currentSegmentIndex: number;
    stlDistance: number;
    ftlDistance: number;
    aborted: boolean;
  }

  export interface FlightSegment {
    type: SegmentType;
    origin: Address;
    departure: DateTime;
    destination: Address;
    arrival: DateTime;
    stlDistance: number | null;
    stlFuelConsumption: number | null;
    transferEllipse: TransferEllipse | null;
    ftlDistance: number | null;
    ftlFuelConsumption: number | null;
    damage: number;
  }

  export interface TransferEllipse {
    startPosition: Position;
    targetPosition: Position;
    center: Position;
    alpha: number;
    semiMajorAxis: number;
    semiMinorAxis: number;
  }

  export type SegmentType =
    | 'TAKE_OFF'
    | 'DEPARTURE'
    | 'TRANSIT'
    | 'CHARGE'
    | 'JUMP'
    | 'FLOAT'
    | 'APPROACH'
    | 'LANDING'
    | 'LOCK'
    | 'DECAY'
    | 'JUMP_GATEWAY';

  // ============================================================================
  // Contract Types
  // ============================================================================

  export interface Contract {
    id: string;
    localId: string;
    date: DateTime;
    party: ContractParty;
    partner: ContractPartner;
    status: ContractStatus;
    conditions: ContractCondition[];
    extensionDeadline: null;
    canExtend: boolean;
    canRequestTermination: boolean;
    dueDate: DateTime | null;
    name: string | null;
    preamble: string | null;
    terminationSent: boolean;
    terminationReceived: boolean;
    agentContract: boolean;
    relatedContracts: string[];
    contractType: string | null;
  }

  export interface ContractCondition {
    quantity?: MaterialAmount | null;
    address?: Address;
    blockId?: string | null;
    type: ContractConditionType;
    id: string;
    party: ContractParty;
    index: number;
    status: ContractConditionStatus;
    dependencies: string[];
    deadlineDuration: TimeSpan | null;
    deadline: DateTime | null;
    amount?: CurrencyAmount;
    pickedUp?: MaterialAmount;
    weight?: number;
    volume?: number;
    autoProvisionStoreId?: string | null;
    destination?: Address;
    shipmentItemId?: string;
    countryId?: string;
    reputationChange?: number;
    interest?: CurrencyAmount;
    repayment?: CurrencyAmount;
    total?: CurrencyAmount;
  }

  export type ContractParty = 'CUSTOMER' | 'PROVIDER';

  export type ContractConditionStatus =
    | 'PENDING'
    | 'IN_PROGRESS'
    | 'FULFILLED'
    | 'PARTLY_FULFILLED'
    | 'FULFILLMENT_ATTEMPTED'
    | 'VIOLATED';

  export type ContractConditionType =
    | 'BASE_CONSTRUCTION'
    | 'COMEX_PURCHASE_PICKUP'
    | 'CONSTRUCT_SHIP'
    | 'CONTRIBUTION'
    | 'DELIVERY'
    | 'DELIVERY_SHIPMENT'
    | 'EXPLORATION'
    | 'FINISH_FLIGHT'
    | 'LOAN_INSTALLMENT'
    | 'LOAN_PAYOUT'
    | 'PAYMENT'
    | 'PICKUP_SHIPMENT'
    | 'PLACE_ORDER'
    | 'PRODUCTION_ORDER_COMPLETED'
    | 'PRODUCTION_RUN'
    | 'PROVISION'
    | 'PROVISION_SHIPMENT'
    | 'REPUTATION'
    | 'START_FLIGHT'
    | 'HEADQUARTERS_UPGRADE'
    | 'POWER'
    | 'REPAIR_SHIP';

  export interface ContractPartner {
    id?: string;
    name: string;
    code?: string | null;
    agentId?: string;
    countryId?: string;
    countryCode?: string;
    type?: ContractPartnerType;
    currency?: Currency;
  }

  export type ContractPartnerType = 'EXPLORATION' | 'GOVERNANCE' | 'LOGISTICS';

  export type ContractStatus =
    | 'OPEN'
    | 'CLOSED'
    | 'CANCELLED'
    | 'FULFILLED'
    | 'PARTIALLY_FULFILLED'
    | 'REJECTED'
    | 'DEADLINE_EXCEEDED'
    | 'BREACHED'
    | 'TERMINATED';

  // ============================================================================
  // Accounting Types
  // ============================================================================

  export interface CurrencyAccount {
    category: string;
    type: number;
    number: number;
    bookBalance: CurrencyAmount;
    currencyBalance: CurrencyAmount;
  }

  export interface BookingItem {
    accountCategory: string;
    accountType: number;
    debit: boolean;
    type: string;
    bookAmount: CurrencyAmount;
    amount: CurrencyAmount;
    bookBalance: CurrencyAmount;
    balance: CurrencyAmount;
    time: { timestamp: number };
    cash: boolean;
  }

  // ============================================================================
  // User / Context Types (from the USER_DATA login message, refined-prun's
  // user-data model). Only the fields APXM consumes are declared here — the
  // real USER_DATA message carries many more (profile, settings, etc).
  // ============================================================================

  /** One context the user can reach: their own COMPANY, or a corporation. */
  export interface UserContext {
    id: string;
    type: string;
  }

  export interface UserData {
    contexts: UserContext[];
  }

  // ============================================================================
  // Alert Types (the NOTS buffer's data — shapes from refined-prun's
  // alerts.types.d.ts). Alerts carry NO display text: the game composes the
  // string client-side from `type` + `data`, so APXM does the same
  // (lib/format-alert.ts).
  // ============================================================================

  export interface Alert {
    id: string;
    type: AlertType;
    contextId: string;
    naturalId: string;
    time: DateTime;
    data: AlertData[];
    /** Server-side flags: seen = surfaced in the NOTS list, read = opened. */
    seen: boolean;
    read: boolean;
  }

  export type AlertType =
    | 'ADMIN_CENTER_ELECTION_REMINDER'
    | 'ADMIN_CENTER_ELECTION_STARTED'
    | 'ADMIN_CENTER_GOVERNOR_ELECTED'
    | 'ADMIN_CENTER_MOTION_ENDED'
    | 'ADMIN_CENTER_MOTION_PASSED'
    | 'ADMIN_CENTER_MOTION_VOTING_STARTED'
    | 'ADMIN_CENTER_NO_GOVERNOR_ELECTED'
    | 'ADMIN_CENTER_RUN_SUCCEEDED'
    | 'COGC_PROGRAM_CHANGED'
    | 'COGC_STATUS_CHANGED'
    | 'COGC_UPKEEP_STARTED'
    | 'COMEX_ORDER_FILLED'
    | 'COMEX_PICKUP_CONTRACT_CREATED'
    | 'COMEX_TRADE'
    | 'CONTRACT_CONDITION_FULFILLED'
    | 'CONTRACT_CONTRACT_BREACHED'
    | 'CONTRACT_CONTRACT_CANCELLED'
    | 'CONTRACT_CONTRACT_CLOSED'
    | 'CONTRACT_CONTRACT_EXTENDED'
    | 'CONTRACT_CONTRACT_RECEIVED'
    | 'CONTRACT_CONTRACT_REJECTED'
    | 'CONTRACT_CONTRACT_TERMINATED'
    | 'CONTRACT_CONTRACT_TERMINATION_REQUESTED'
    | 'CONTRACT_DEADLINE_EXCEEDED_WITH_CONTROL'
    | 'CONTRACT_DEADLINE_EXCEEDED_WITHOUT_CONTROL'
    | 'CORPORATION_MANAGER_INVITE_ACCEPTED'
    | 'CORPORATION_MANAGER_INVITE_REJECTED'
    | 'CORPORATION_MANAGER_SHAREHOLDER_LEFT'
    | 'CORPORATION_PROJECT_FINISHED'
    | 'CORPORATION_SHAREHOLDER_DIVIDEND_RECEIVED'
    | 'CORPORATION_SHAREHOLDER_INVITE_RECEIVED'
    | 'FOREX_ORDER_FILLED'
    | 'FOREX_TRADE'
    | 'GATEWAY_JUMP_ABORTED_LINK_CHANGED'
    | 'GATEWAY_JUMP_ABORTED_LINK_NOT_ESTABLISHED'
    | 'GATEWAY_JUMP_ABORTED_MISSING_FUNDS'
    | 'GATEWAY_JUMP_ABORTED_NO_CAPACITY'
    | 'GATEWAY_JUMP_ABORTED_NO_FUEL'
    | 'GATEWAY_JUMP_ABORTED_NOT_OPERATIONAL'
    | 'GATEWAY_LINK_ESTABLISHED'
    | 'GATEWAY_LINK_REQUEST_RECEIVED'
    | 'GATEWAY_LINK_UNLINKED'
    | 'INFRASTRUCTURE_OPERATIONAL_STATE_CHANGED'
    | 'INFRASTRUCTURE_PROJECT_COMPLETED'
    | 'INFRASTRUCTURE_UPGRADE_COMPLETED'
    | 'INFRASTRUCTURE_UPKEEP_PHASE_STARTED'
    | 'LOCAL_MARKET_AD_ACCEPTED'
    | 'LOCAL_MARKET_AD_EXPIRED'
    | 'PLANETARY_PROJECT_FINISHED'
    | 'POPULATION_PROJECT_UPGRADED'
    | 'POPULATION_REPORT_AVAILABLE'
    | 'PRODUCTION_ORDER_FINISHED'
    | 'RELEASE_NOTES'
    | 'SHIP_FLIGHT_ENDED'
    | 'SHIPYARD_PROJECT_FINISHED'
    | 'SITE_EXPERT_DROPPED'
    | 'TUTORIAL_TASK_FINISHED'
    | 'USER_CONVERSION_REMINDER_LICENSE'
    | 'USER_LICENSE_ABOUT_TO_EXPIRE'
    | 'USER_LICENSE_EXPIRED'
    | 'USER_LICENSE_GIFT_RECEIVED'
    | 'USER_STEAM_REVIEW'
    | 'WAREHOUSE_STORE_LOCKED_INSUFFICIENT_FUNDS'
    | 'WAREHOUSE_STORE_UNLOCKED'
    | 'WELCOME'
    | 'WORKFORCE_LOW_SUPPLIES'
    | 'WORKFORCE_OUT_OF_SUPPLIES'
    | 'WORKFORCE_UNSATISFIED';

  export type AlertData =
    | { key: 'commodity'; value: string }
    | { key: 'quantity'; value: number }
    | { key: 'address'; value: { address: Address } }
    | { key: 'material'; value: string }
    | { key: 'expertiseCategory'; value: string }
    | { key: 'planet'; value: { address: Address } }
    | { key: 'program'; value: string }
    | { key: 'destination'; value: { address: Address } }
    | { key: 'registration'; value: string }
    | { key: 'shipId'; value: string }
    | { key: 'trades'; value: number }
    | { key: 'partner'; value: ContractPartner }
    | { key: 'contract'; value: string }
    | { key: 'ticker'; value: string }
    | { key: 'level'; value: number }
    // Catch-all: exchange operators, admin-center motions, and any keys the
    // game adds — the formatter treats unknown values as opaque.
    | { key: string; value: unknown };
}
