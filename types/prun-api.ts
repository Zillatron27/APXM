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
}
