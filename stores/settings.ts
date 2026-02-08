import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { browser } from 'wxt/browser';

export interface BurnThresholds {
  critical: number; // days — default 3
  warning: number; // days — default 5
  resupply: number; // days — default 30 (how much to buy)
}

export interface FioConfig {
  apiKey: string | null;
  username: string | null;
  lastFetch: number | null;
}

export type MaterialTheme = 'rprun' | 'prun';

interface SettingsState {
  burnThresholds: BurnThresholds;
  fio: FioConfig;
  materialTheme: MaterialTheme;
}

interface SettingsActions {
  setBurnThresholds: (thresholds: Partial<BurnThresholds>) => void;
  setFioConfig: (config: Partial<FioConfig>) => void;
  setFioLastFetch: (timestamp: number) => void;
  setMaterialTheme: (theme: MaterialTheme) => void;
  reset: () => void;
}

type SettingsStore = SettingsState & SettingsActions;

export const DEFAULT_THRESHOLDS: BurnThresholds = { critical: 3, warning: 5, resupply: 30 };

const DEFAULT_FIO_CONFIG: FioConfig = {
  apiKey: null,
  username: null,
  lastFetch: null,
};

const initialState: SettingsState = {
  burnThresholds: DEFAULT_THRESHOLDS,
  fio: DEFAULT_FIO_CONFIG,
  materialTheme: 'rprun',
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
      return result[name] ?? null;
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

      setFioConfig: (config) =>
        set((state) => ({
          fio: { ...state.fio, ...config },
        })),

      setFioLastFetch: (timestamp) =>
        set((state) => ({
          fio: { ...state.fio, lastFetch: timestamp },
        })),

      setMaterialTheme: (theme) => set({ materialTheme: theme }),

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
