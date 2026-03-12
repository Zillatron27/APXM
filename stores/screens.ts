/**
 * Screens Store
 *
 * Tracks APEX screen definitions (from UI_DATA) and the user's
 * assigned screen preference. Screens array is transient (repopulated
 * on each login); only assignedScreenId is persisted.
 */

import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { browser } from 'wxt/browser';

export interface ScreenInfo {
  id: string;
  name: string;
  hidden: boolean;
}

interface ScreensState {
  screens: ScreenInfo[];
  screenAssignments: Record<string, string>;
}

interface ScreensActions {
  setScreens(screens: ScreenInfo[]): void;
  addScreen(screen: ScreenInfo): void;
  renameScreen(id: string, name: string): void;
  removeScreen(id: string): void;
  setAssignment(planetNaturalId: string, screenId: string | null): void;
  getVisibleScreens(): ScreenInfo[];
  getAssignedScreen(planetNaturalId: string): ScreenInfo | null;
}

type ScreensStore = ScreensState & ScreensActions;

const isBrowserStorageAvailable = (): boolean => {
  try {
    return typeof browser !== 'undefined' && browser?.storage?.local !== undefined;
  } catch {
    return false;
  }
};

function isContextInvalidated(error: unknown): boolean {
  return String(error).includes('Extension context invalidated');
}

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

const initialState: ScreensState = {
  screens: [],
  screenAssignments: {},
};

export const useScreensStore = create<ScreensStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setScreens: (screens) => set({ screens }),

      addScreen: (screen) => set((state) => ({
        screens: [...state.screens, screen],
      })),

      renameScreen: (id, name) => set((state) => ({
        screens: state.screens.map((s) => s.id === id ? { ...s, name } : s),
      })),

      removeScreen: (id) => set((state) => {
        // Clear any assignments pointing to the removed screen
        const cleaned: Record<string, string> = {};
        for (const [planet, screenId] of Object.entries(state.screenAssignments)) {
          if (screenId !== id) cleaned[planet] = screenId;
        }
        return {
          screens: state.screens.filter((s) => s.id !== id),
          screenAssignments: cleaned,
        };
      }),

      setAssignment: (planetNaturalId, screenId) => set((state) => {
        const next = { ...state.screenAssignments };
        if (screenId) {
          next[planetNaturalId] = screenId;
        } else {
          delete next[planetNaturalId];
        }
        return { screenAssignments: next };
      }),

      getVisibleScreens: () => {
        return get().screens
          .filter((s) => !s.hidden)
          .sort((a, b) => a.name.localeCompare(b.name));
      },

      getAssignedScreen: (planetNaturalId) => {
        const { screens, screenAssignments } = get();
        const screenId = screenAssignments[planetNaturalId];
        if (!screenId) return null;
        return screens.find((s) => s.id === screenId) ?? null;
      },
    }),
    {
      name: 'apxm-screens',
      storage: createJSONStorage(() => browserStorage),
      // Only persist per-planet assignments, not the transient screen list
      partialize: (state) => ({ screenAssignments: state.screenAssignments }),
      merge: (persisted, current) => {
        const state = persisted as Partial<ScreensState> | undefined;
        return {
          ...current,
          screenAssignments: state?.screenAssignments ?? current.screenAssignments,
        };
      },
    }
  )
);
