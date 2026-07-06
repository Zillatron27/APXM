// Ported from refined-prun src/features/XIT/ACT/material-groups/resupply/config.ts.

export type MaterialFilter = 'All' | 'Workforce' | 'Production';

export interface Config {
  planet: string;
  days?: number;
  materialFilter?: MaterialFilter;
}
