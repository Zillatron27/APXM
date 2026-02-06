import { useState } from 'react';
import { useGameState } from '../stores/gameState';
import { useConnectionStore } from '../stores/connection';
import {
  useSitesStore,
  useStorageStore,
  useWorkforceStore,
  useProductionStore,
  useShipsStore,
  useFlightsStore,
  useContractsStore,
} from '../stores/entities';
import { useSettingsStore } from '../stores/settings';
import { BurnSummaryList, BurnSummaryCompact } from './burn';
import { populateStoresFromFio, type PopulateResult } from '../lib/fio';

type View = 'status' | 'burns';

export function StatusPanel() {
  const [view, setView] = useState<View>('burns');
  const [fioExpanded, setFioExpanded] = useState(false);
  const [fioLoading, setFioLoading] = useState(false);
  const [fioError, setFioError] = useState<string | null>(null);
  const [fioResult, setFioResult] = useState<PopulateResult | null>(null);

  const overlayVisible = useGameState((s) => s.overlayVisible);
  const setOverlayVisible = useGameState((s) => s.setOverlayVisible);
  const connected = useConnectionStore((s) => s.connected);
  const messageCount = useConnectionStore((s) => s.messageCount);

  // FIO config from settings
  const fioConfig = useSettingsStore((s) => s.fio);
  const setFioConfig = useSettingsStore((s) => s.setFioConfig);
  const setFioLastFetch = useSettingsStore((s) => s.setFioLastFetch);

  // Subscribe to entity counts for debug display
  const sitesCount = useSitesStore((s) => s.entities.size);
  const storageCount = useStorageStore((s) => s.entities.size);
  const workforceCount = useWorkforceStore((s) => s.entities.size);
  const productionCount = useProductionStore((s) => s.entities.size);
  const shipsCount = useShipsStore((s) => s.entities.size);
  const flightsCount = useFlightsStore((s) => s.entities.size);
  const contractsCount = useContractsStore((s) => s.entities.size);

  const hasEntityData =
    sitesCount > 0 ||
    storageCount > 0 ||
    workforceCount > 0 ||
    productionCount > 0 ||
    shipsCount > 0 ||
    flightsCount > 0 ||
    contractsCount > 0;

  const handleFioFetch = async () => {
    if (!fioConfig.apiKey || !fioConfig.username) {
      setFioError('API key and username are required');
      return;
    }

    setFioLoading(true);
    setFioError(null);
    setFioResult(null);

    try {
      const result = await populateStoresFromFio({
        apiKey: fioConfig.apiKey,
        username: fioConfig.username,
      });

      setFioResult(result);
      setFioLastFetch(Date.now());

      if (!result.success && result.errors.length > 0) {
        setFioError(result.errors.join('; '));
      }
    } catch (err) {
      setFioError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setFioLoading(false);
    }
  };

  if (!overlayVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[999999] flex flex-col gap-2 rounded-lg bg-apxm-bg p-4 text-apxm-text shadow-lg max-w-sm max-h-[80vh] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold">APXM v0.1.0-b24</span>
        <div className="flex items-center gap-1">
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
            title={connected ? 'Connected' : 'Disconnected'}
          />
          <button
            onClick={() => setOverlayVisible(false)}
            className="flex h-[44px] w-[44px] items-center justify-center rounded bg-apxm-surface text-xl hover:bg-apxm-accent"
            aria-label="Close APXM overlay"
          >
            ×
          </button>
        </div>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1">
        <button
          onClick={() => setView('burns')}
          className={`flex-1 py-2 px-3 text-sm rounded min-h-[44px] ${
            view === 'burns'
              ? 'bg-apxm-accent text-apxm-text'
              : 'bg-apxm-surface text-apxm-text/70 hover:bg-apxm-accent/50'
          }`}
        >
          Burns
        </button>
        <button
          onClick={() => setView('status')}
          className={`flex-1 py-2 px-3 text-sm rounded min-h-[44px] ${
            view === 'status'
              ? 'bg-apxm-accent text-apxm-text'
              : 'bg-apxm-surface text-apxm-text/70 hover:bg-apxm-accent/50'
          }`}
        >
          Status
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {view === 'burns' && (
          <BurnSummaryList expandFirst />
        )}

        {view === 'status' && (
          <div className="flex flex-col gap-3">
            {messageCount > 0 && (
              <div className="text-xs text-apxm-text/70">Messages: {messageCount}</div>
            )}
            {hasEntityData && (
              <div className="text-xs text-apxm-text/70 space-y-1">
                <div>Sites: {sitesCount} | Storage: {storageCount}</div>
                <div>Ships: {shipsCount} | Flights: {flightsCount}</div>
                {workforceCount > 0 && <div>Workforce: {workforceCount}</div>}
                {productionCount > 0 && <div>Production: {productionCount}</div>}
                {contractsCount > 0 && <div>Contracts: {contractsCount}</div>}
              </div>
            )}
            {!hasEntityData && (
              <div className="text-xs text-apxm-text/50">
                Waiting for game data...
              </div>
            )}

            {/* FIO API Section */}
            <div className="border-t border-apxm-surface pt-3">
              <button
                onClick={() => setFioExpanded(!fioExpanded)}
                className="flex items-center justify-between w-full text-xs text-apxm-text/70 hover:text-apxm-text"
              >
                <span>FIO API</span>
                <span>{fioExpanded ? '−' : '+'}</span>
              </button>

              {fioExpanded && (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    placeholder="Username"
                    value={fioConfig.username ?? ''}
                    onChange={(e) => setFioConfig({ username: e.target.value || null })}
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    className="w-full px-2 py-1.5 text-xs bg-apxm-surface rounded border border-apxm-surface focus:border-apxm-accent outline-none"
                  />
                  <input
                    type="text"
                    placeholder="API Key"
                    value={fioConfig.apiKey ?? ''}
                    onChange={(e) => setFioConfig({ apiKey: e.target.value || null })}
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    className="w-full px-2 py-1.5 text-xs bg-apxm-surface rounded border border-apxm-surface focus:border-apxm-accent outline-none"
                  />
                  <button
                    onClick={handleFioFetch}
                    disabled={fioLoading || !fioConfig.apiKey || !fioConfig.username}
                    className={`w-full py-2 px-3 text-xs rounded min-h-[44px] ${
                      fioLoading || !fioConfig.apiKey || !fioConfig.username
                        ? 'bg-apxm-surface text-apxm-text/50 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {fioLoading ? 'Fetching...' : 'Fetch from FIO'}
                  </button>

                  {fioError && (
                    <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded">
                      {fioError}
                    </div>
                  )}

                  {fioResult && !fioError && (
                    <div className="text-xs text-green-400 bg-green-500/10 p-2 rounded">
                      Loaded: {fioResult.populated.sites} sites,{' '}
                      {fioResult.populated.storage} storage,{' '}
                      {fioResult.populated.workforce} workforce,{' '}
                      {fioResult.populated.production} production
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
