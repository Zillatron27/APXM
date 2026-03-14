import { create } from 'zustand';

export interface CompanyInfo {
  name: string;
  code: string;
  countryId: string;
}

interface CompanyState {
  company: CompanyInfo | null;
  setCompany: (info: CompanyInfo) => void;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  company: null,
  setCompany: (company) => set({ company }),
}));
