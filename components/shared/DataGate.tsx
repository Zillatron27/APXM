import type { ReactNode } from 'react';
import { useConnectionStore } from '../../stores/connection';
import { useConnectionStatus, type ConnectionStatus } from '../../hooks/useConnectionStatus';

export interface RequiredStore {
  fetched: boolean;
  name: string;
  canFio: boolean;
}

interface DataGateProps {
  requiredStores: RequiredStore[];
  children: ReactNode;
  loadingMessage?: string;
}

export type GateResult =
  | { state: 'ready' }
  | { state: 'connecting'; message: string; pulse: true }
  | { state: 'unresponsive'; message: string; pulse: false }
  | { state: 'waiting-for-apex'; message: string; pulse: false }
  | { state: 'loading'; message: string; pulse: true };

/**
 * Pure logic: determines what to show based on store readiness and connection state.
 * Exported for testing without React rendering.
 */
export function resolveGate(
  requiredStores: RequiredStore[],
  connectionStatus: ConnectionStatus,
  connected: boolean,
  messageCount: number,
  apexUnresponsive: boolean,
  loadingMessage?: string,
): GateResult {
  if (requiredStores.every((s) => s.fetched)) {
    return { state: 'ready' };
  }

  // APEX not responding — timed out waiting for initial WebSocket activity
  if (!connected && messageCount === 0 && apexUnresponsive) {
    return {
      state: 'unresponsive',
      message: loadingMessage ?? "APEX isn't responding — try refreshing the page",
      pulse: false,
    };
  }

  // Never connected — still establishing initial connection
  if (!connected && messageCount === 0) {
    return {
      state: 'connecting',
      message: loadingMessage ?? 'Connecting to APEX...',
      pulse: true,
    };
  }

  // FIO-only mode and all unfetched stores can't be populated by FIO
  const unfetchedStores = requiredStores.filter((s) => !s.fetched);
  if (connectionStatus === 'fio' && unfetchedStores.every((s) => !s.canFio)) {
    return {
      state: 'waiting-for-apex',
      message: loadingMessage ?? 'Waiting for APEX connection...',
      pulse: false,
    };
  }

  // Connected or connecting — actively loading
  const storeNames = unfetchedStores.map((s) => s.name).join(', ');
  return {
    state: 'loading',
    message: loadingMessage ?? `Loading ${storeNames}...`,
    pulse: true,
  };
}

/**
 * Gates children rendering until required stores have received data.
 * Shows connection-aware loading messages instead of misleading empty states.
 */
export function DataGate({ requiredStores, children, loadingMessage }: DataGateProps) {
  const connectionStatus = useConnectionStatus();
  const connected = useConnectionStore((s) => s.connected);
  const messageCount = useConnectionStore((s) => s.messageCount);
  const apexUnresponsive = useConnectionStore((s) => s.apexUnresponsive);

  const result = resolveGate(requiredStores, connectionStatus, connected, messageCount, apexUnresponsive, loadingMessage);

  if (result.state === 'ready') {
    return <>{children}</>;
  }

  if (result.state === 'unresponsive') {
    return (
      <p className="text-sm text-status-critical py-4 text-center">
        {result.message}
      </p>
    );
  }

  return (
    <p className={`text-sm text-apxm-muted py-4 text-center ${result.pulse ? 'animate-pulse' : ''}`}>
      {result.message}
    </p>
  );
}
