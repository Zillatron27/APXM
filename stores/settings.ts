import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { browser } from 'wxt/browser';

export interface BurnThresholds {
  critical: number; // days — default 3
  warning: number; // days — default 5
}

export interface FioConfig {
  apiKey: string | null;
  username: string | null;
  lastFetch: number | null;
}

interface SettingsState {
  burnThresholds: BurnThresholds;
  fio: FioConfig;
}

interface SettingsActions {
  setBurnThresholds: (thresholds: Partial<BurnThresholds>) => void;
  setFioConfig: (config: Partial<FioConfig>) => void;
  setFioLastFetch: (timestamp: number) => void;
  reset: () => void;
}

type SettingsStore = SettingsState & SettingsActions;

const DEFAULT_THRESHOLDS: BurnThresholds = { critical: 3, warning: 5 };

const DEFAULT_FIO_CONFIG: FioConfig = {
  apiKey: null,
  username: null,
  lastFetch: null,
};

const initialState: SettingsState = {
  burnThresholds: DEFAULT_THRESHOLDS,
  fio: DEFAULT_FIO_CONFIG,
};

// Check if browser storage API is available
const isBrowserStorageAvailable = (): boolean => {
  try {
    return typeof browser !== 'undefined' && browser?.storage?.local !== undefined;
  } catch {
    return false;
  }
};

// Custom storage adapter for browser.storage.local
// Falls back to no-op storage when browser API isn't available (tests)
const browserStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (!isBrowserStorageAvailable()) return null;
    const result = await browser.storage.local.get(name);
    return result[name] ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (!isBrowserStorageAvailable()) return;
    await browser.storage.local.set({ [name]: value });
  },
  removeItem: async (name: string): Promise<void> => {
    if (!isBrowserStorageAvailable()) return;
    await browser.storage.local.remove(name);
  },
};

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

      reset: () => set(initialState),
    }),
    {
      name: 'apxm-settings',
      storage: createJSONStorage(() => browserStorage),
    }
  )
);
