import { create } from 'zustand';

/**
 * Company identity from the COMPANY_DATA login message.
 * Not persisted — repopulated from COMPANY_DATA on every login,
 * and cleared on reconnect like all other game state.
 */
export interface CompanyInfo {
  name: string;
  code: string;
  countryId: string;
}

interface CompanyState {
  company: CompanyInfo | null;
  setCompany: (info: CompanyInfo) => void;
  clear: () => void;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  company: null,
  setCompany: (company) => set({ company }),
  clear: () => set({ company: null }),
}));
