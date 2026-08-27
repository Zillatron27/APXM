import { create } from 'zustand';
import type { PrunApi } from '../types/prun-api';

/**
 * User identity/context data from the USER_DATA login message.
 * Not persisted — repopulated from USER_DATA on every login, and cleared on
 * reconnect like all other game state.
 *
 * `contexts` is the set of contexts (company + any corporations) the user
 * can reach. `companyContextId` is derived from it: the context whose
 * `type === 'COMPANY'`, i.e. the player's own context as opposed to a
 * corporation context. Both feed lib/alert-scope.ts's own/other/unreachable
 * classification.
 */
interface UserState {
  contexts: PrunApi.UserContext[];
  companyContextId: string | undefined;
  setUser: (contexts: PrunApi.UserContext[]) => void;
  clear: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  contexts: [],
  companyContextId: undefined,
  setUser: (contexts) =>
    set({
      contexts,
      companyContextId: contexts.find((c) => c.type === 'COMPANY')?.id,
    }),
  clear: () => set({ contexts: [], companyContextId: undefined }),
}));
