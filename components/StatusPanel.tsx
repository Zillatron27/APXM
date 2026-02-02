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

export function StatusPanel() {
  const { overlayVisible, setOverlayVisible } = useGameState();
  const { connected, messageCount } = useConnectionStore();

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

  if (!overlayVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[999999] flex flex-col gap-2 rounded-lg bg-apxm-bg p-4 text-apxm-text shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold">APXM v0.1.0</span>
        <button
          onClick={() => setOverlayVisible(false)}
          className="flex h-[44px] w-[44px] items-center justify-center rounded bg-apxm-surface text-xl hover:bg-apxm-accent"
          aria-label="Close APXM overlay"
        >
          ×
        </button>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      {messageCount > 0 && (
        <div className="text-xs text-apxm-text/70">Messages: {messageCount}</div>
      )}
      {hasEntityData && (
        <div className="text-xs text-apxm-text/70">
          Sites: {sitesCount} | Storage: {storageCount} | Ships: {shipsCount}
          {workforceCount > 0 && ` | WF: ${workforceCount}`}
          {productionCount > 0 && ` | Prod: ${productionCount}`}
          {flightsCount > 0 && ` | Flights: ${flightsCount}`}
          {contractsCount > 0 && ` | Contracts: ${contractsCount}`}
        </div>
      )}
    </div>
  );
}
