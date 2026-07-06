// Ported from refined-prun src/store/user-data.types.d.ts
// ACT-relevant subset only. Kept as a global `UserData` namespace to mirror the
// rprun source so the ported runner files match verbatim.

declare namespace UserData {
  export type Exchange = 'AI1' | 'CI1' | 'CI2' | 'IC1' | 'NC1' | 'NC2';

  interface ActionPackageData {
    groups: MaterialGroupData[];
    actions: ActionData[];
    global: {
      name: string;
    };
  }

  type MaterialGroupType = 'Manual' | 'Resupply' | 'Repair' | 'Paste';

  interface MaterialGroupData {
    type: MaterialGroupType;
    name?: string;
    days?: number | string;
    advanceDays?: number | string;
    planet?: string;
    useBaseInv?: boolean;
    materials?: Record<string, number>;
    exclusions?: string[];
    consumablesOnly?: boolean;
  }

  type ActionType = 'CX Buy' | 'MTRA' | 'Refuel' | 'CONT Ship' | 'CONT Trade';

  interface ActionData {
    type: ActionType;

    name?: string;
    group?: string;
    skippable?: boolean;

    allowUnfilled?: boolean;
    buyPartial?: boolean;
    exchange?: string;
    useCXInv?: boolean;
    priceLimits?: Record<string, number>;

    buyMissingFuel?: boolean;

    origin?: string;
    dest?: string;

    // CONT Ship specific
    currency?: string;
    contractNote?: string;
    paymentPerTon?: number;
    daysToFulfill?: number;
    contOrigin?: string;
    contDest?: string;
    autoProvision?: boolean;

    // CONT Trade specific
    contTradeType?: 'BUYING' | 'SELLING';
    contLocation?: string;
  }
}
