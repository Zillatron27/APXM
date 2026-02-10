/** Determines how buffer refreshes are triggered. */
export type RefreshMode = 'manual' | 'batch' | 'auto';

/** Status of a single site's refresh attempt. */
export type SiteRefreshStatus = 'pending' | 'loading' | 'success' | 'error';

/** Named steps in the buffer open sequence, for error reporting. */
export type BufferRefreshStep =
  | 'precondition'
  | 'save-styles'
  | 'apply-hide'
  | 'click-stack'
  | 'wait-add-button'
  | 'click-add'
  | 'wait-input'
  | 'set-command'
  | 'click-create'
  | 'wait-card'
  | 'click-card'
  | 'wait-server';

export interface BufferRefreshOptions {
  /** Internal site ID (UUID) — used for store tracking and progress */
  siteId: string;
  /** APEX buffer command, e.g. "BS NIK" — uses planet naturalId, not UUID */
  command: string;
  /** Timeout per DOM wait step in ms (default 800) */
  stepTimeoutMs?: number;
}

export interface BatchRefreshOptions {
  /** Site IDs to refresh sequentially */
  siteIds: string[];
  /** Delay between individual refreshes in ms (default 300) */
  delayBetweenMs?: number;
  /** Timeout per DOM wait step in ms (default 800) */
  stepTimeoutMs?: number;
  /** Called after each site completes */
  onProgress?: (completed: number, total: number, siteId: string, success: boolean) => void;
}
