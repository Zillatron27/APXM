import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { browser } from 'wxt/browser';
import { DEFAULT_THEME_ID, type ApxmThemeId } from '../lib/theme';
import type { MaterialTheme } from '../lib/material-colors';

// Re-exported so settings consumers don't need a second import; the palette
// module owns the definition (it changes when palettes are added).
export type { MaterialTheme } from '../lib/material-colors';

export interface BurnThresholds {
  critical: number; // days — default 3
  warning: number; // days — default 5
  resupply: number; // days — default 30 (how much to buy)
}

// rPrun-style XIT REP model: one number per base (days since last repair on
// its production buildings); red at threshold, yellow `offset` days before it.
export interface RepairThresholds {
  threshold: number; // days since last repair → red. default 60
  offset: number; // days before threshold → yellow. default 10
}

export interface FioConfig {
  apiKey: string | null;
  username: string | null;
  lastFetch: number | null;
}

/** The reorderable Status-tab panels, in default display order. The company
 *  (cash) and attention panels are pinned above these and are not reorderable. */
export type StatusPanelId = 'bases' | 'fleet' | 'contracts';
export const STATUS_PANEL_IDS: StatusPanelId[] = ['bases', 'fleet', 'contracts'];

interface SettingsState {
  burnThresholds: BurnThresholds;
  repairThresholds: RepairThresholds;
  fio: FioConfig;
  materialTheme: MaterialTheme;
  uiTheme: ApxmThemeId;
  rprunFeaturesDisabled: boolean;
  /** User's Status-tab panel order. Untrusted (storage) — reconciled against
   *  STATUS_PANEL_IDS by the view, which drops unknowns and appends new panels. */
  statusPanelOrder: string[];
}

interface SettingsActions {
  setBurnThresholds: (thresholds: Partial<BurnThresholds>) => void;
  setRepairThresholds: (thresholds: Partial<RepairThresholds>) => void;
  setFioConfig: (config: Partial<FioConfig>) => void;
  setFioLastFetch: (timestamp: number) => void;
  setMaterialTheme: (theme: MaterialTheme) => void;
  setUiTheme: (theme: ApxmThemeId) => void;
  setRprunFeaturesDisabled: (disabled: boolean) => void;
  setStatusPanelOrder: (order: string[]) => void;
  reset: () => void;
}

type SettingsStore = SettingsState & SettingsActions;

export const DEFAULT_THRESHOLDS: BurnThresholds = { critical: 3, warning: 5, resupply: 30 };

// 60/10 matches the values proven on jackinabox86's fork (red 60d, yellow 50d)
export const DEFAULT_REPAIR_THRESHOLDS: RepairThresholds = { threshold: 60, offset: 10 };

const DEFAULT_FIO_CONFIG: FioConfig = {
  apiKey: null,
  username: null,
  lastFetch: null,
};

const initialState: SettingsState = {
  burnThresholds: DEFAULT_THRESHOLDS,
  repairThresholds: DEFAULT_REPAIR_THRESHOLDS,
  fio: DEFAULT_FIO_CONFIG,
  materialTheme: 'rprun',
  uiTheme: DEFAULT_THEME_ID,
  rprunFeaturesDisabled: false,
  statusPanelOrder: [...STATUS_PANEL_IDS],
};

// Check if browser storage API is available
const isBrowserStorageAvailable = (): boolean => {
  try {
    return typeof browser !== 'undefined' && browser?.storage?.local !== undefined;
  } catch {
    return false;
  }
};

// Chrome MV3: service worker can tear down while the content script is still
// running, making browser.storage.local inaccessible. The pre-check
// (isBrowserStorageAvailable) passes because the object still exists, but the
// async operation rejects with "Extension context invalidated". Wrapping every
// storage call in try/catch handles this race — data persists on the next
// successful write.
function isContextInvalidated(error: unknown): boolean {
  return String(error).includes('Extension context invalidated');
}

// Custom storage adapter for browser.storage.local
// Falls back to no-op storage when browser API isn't available (tests)
const browserStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (!isBrowserStorageAvailable()) return null;
    try {
      const result = await browser.storage.local.get(name);
      // Storage values are untyped at the boundary; persist only ever writes
      // JSON strings, so anything non-string is treated as absent.
      const value = result[name];
      return typeof value === 'string' ? value : null;
    } catch (error) {
      if (isContextInvalidated(error)) return null;
      throw error;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (!isBrowserStorageAvailable()) return;
    try {
      await browser.storage.local.set({ [name]: value });
    } catch (error) {
      if (isContextInvalidated(error)) return;
      throw error;
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (!isBrowserStorageAvailable()) return;
    try {
      await browser.storage.local.remove(name);
    } catch (error) {
      if (isContextInvalidated(error)) return;
      throw error;
    }
  },
};

// Hydration tracking
let resolveHydration: () => void;
const hydrationPromise = new Promise<void>((resolve) => {
  resolveHydration = resolve;
});

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...initialState,

      setBurnThresholds: (thresholds) =>
        set((state) => ({
          burnThresholds: { ...state.burnThresholds, ...thresholds },
        })),

      setRepairThresholds: (thresholds) =>
        set((state) => ({
          repairThresholds: { ...state.repairThresholds, ...thresholds },
        })),

      setFioConfig: (config) =>
        set((state) => ({
          fio: { ...state.fio, ...config },
        })),

      setFioLastFetch: (timestamp) =>
        set((state) => ({
          fio: { ...state.fio, lastFetch: timestamp },
        })),

      setMaterialTheme: (theme) => set({ materialTheme: theme }),

      setUiTheme: (theme) => set({ uiTheme: theme }),

      setRprunFeaturesDisabled: (disabled) => set({ rprunFeaturesDisabled: disabled }),

      setStatusPanelOrder: (order) => set({ statusPanelOrder: order }),

      reset: () => set(initialState),
    }),
    {
      name: 'apxm-settings',
      storage: createJSONStorage(() => browserStorage),
      // Deep-merge nested objects so new fields (e.g. resupply) get their
      // defaults even when rehydrating from storage that predates them.
      merge: (persisted, current) => {
        const state = persisted as Partial<SettingsState> | undefined;
        return {
          ...current,
          ...state,
          burnThresholds: { ...current.burnThresholds, ...state?.burnThresholds },
          repairThresholds: { ...current.repairThresholds, ...state?.repairThresholds },
          fio: { ...current.fio, ...state?.fio },
        };
      },
      onRehydrateStorage: () => () => {
        resolveHydration();
      },
    }
  )
);

/**
 * Returns a promise that resolves when settings have been loaded from storage.
 */
export function waitForSettingsHydration(): Promise<void> {
  return hydrationPromise;
}
