import { useState, useEffect } from 'react';
import { Card, MaterialTile } from '../shared';
import { useSettingsStore, type MaterialTheme } from '../../stores/settings';
import { testConnection, populateStoresFromFio, type FioProgressStep } from '../../lib/fio';

type ConnectionStatus = 'untested' | 'testing' | 'valid' | 'invalid';

const STEP_LABELS: Record<FioProgressStep, string> = {
  sites: 'Sites',
  workforce: 'Workforce',
  storage: 'Storage',
  production: 'Production',
};

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function SettingsView() {
  const { fio, setFioConfig, setFioLastFetch, materialTheme, setMaterialTheme } = useSettingsStore();

  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('untested');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStep, setRefreshStep] = useState<FioProgressStep | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Initialize form from stored config
  useEffect(() => {
    setUsername(fio.username ?? '');
    setApiKey(fio.apiKey ?? '');
  }, [fio.username, fio.apiKey]);

  const handleSave = () => {
    setFioConfig({
      username: username || null,
      apiKey: apiKey || null,
    });
    setConnectionStatus('untested');
    setConnectionError(null);
  };

  const handleTestConnection = async () => {
    if (!username || !apiKey) {
      setConnectionStatus('invalid');
      setConnectionError('Username and API key required');
      return;
    }

    setConnectionStatus('testing');
    setConnectionError(null);

    const result = await testConnection({ username, apiKey });

    if (result.ok) {
      setConnectionStatus('valid');
      setConnectionError(null);
    } else {
      setConnectionStatus('invalid');
      setConnectionError(result.error.message);
    }
  };

  const handleRefresh = async () => {
    const storedFio = useSettingsStore.getState().fio;
    if (!storedFio.username || !storedFio.apiKey) {
      setRefreshError('Save credentials first');
      return;
    }

    setIsRefreshing(true);
    setRefreshError(null);
    setRefreshStep(null);

    const result = await populateStoresFromFio(
      {
        username: storedFio.username,
        apiKey: storedFio.apiKey,
      },
      {
        onProgress: setRefreshStep,
      }
    );

    setIsRefreshing(false);
    setRefreshStep(null);

    if (result.success) {
      setFioLastFetch(Date.now());
    } else {
      setRefreshError(result.errors.join(', '));
    }
  };

  const hasUnsavedChanges =
    username !== (fio.username ?? '') || apiKey !== (fio.apiKey ?? '');

  return (
    <div className="space-y-4">
      {/* FIO API Key Section */}
      <Card>
        <h2 className="text-prun-yellow text-sm font-semibold mb-3">FIO API Key</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-apxm-muted text-xs mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="FIO username"
              className="w-full min-h-touch px-3 py-2 text-sm bg-apxm-bg border border-apxm-accent rounded text-apxm-text placeholder:text-apxm-muted/50 outline-none focus:border-prun-yellow"
            />
          </div>

          <div>
            <label className="block text-apxm-muted text-xs mb-1">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Your FIO API key"
              className="w-full min-h-touch px-3 py-2 text-sm bg-apxm-bg border border-apxm-accent rounded text-apxm-text placeholder:text-apxm-muted/50 outline-none focus:border-prun-yellow font-mono"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
              className="flex-1 min-h-touch px-4 py-2 text-sm rounded bg-prun-yellow text-apxm-bg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
            <button
              onClick={handleTestConnection}
              disabled={connectionStatus === 'testing'}
              className="flex-1 min-h-touch px-4 py-2 text-sm rounded border border-prun-yellow text-prun-yellow font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {/* Connection Status */}
          {connectionStatus !== 'untested' && connectionStatus !== 'testing' && (
            <div className="flex items-center gap-2 text-sm">
              {connectionStatus === 'valid' ? (
                <>
                  <span className="text-status-ok">✓</span>
                  <span className="text-status-ok">Valid</span>
                </>
              ) : (
                <>
                  <span className="text-status-critical">✗</span>
                  <span className="text-status-critical">
                    Invalid{connectionError ? `: ${connectionError}` : ''}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* FIO Data Section */}
      <Card>
        <h2 className="text-prun-yellow text-sm font-semibold mb-3">FIO Data</h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-apxm-muted">Last refresh:</span>
            <span className="text-apxm-text">
              {fio.lastFetch ? formatRelativeTime(fio.lastFetch) : 'Never'}
            </span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing || !fio.apiKey || !fio.username}
            className="w-full min-h-touch px-4 py-2 text-sm rounded border border-prun-yellow text-prun-yellow font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefreshing && refreshStep
              ? `Fetching ${STEP_LABELS[refreshStep]}...`
              : isRefreshing
                ? 'Starting...'
                : 'Refresh FIO Data'}
          </button>

          {refreshError && (
            <div className="text-sm text-status-critical">{refreshError}</div>
          )}
        </div>
      </Card>

      {/* Material Theme Section */}
      <Card>
        <h2 className="text-prun-yellow text-sm font-semibold mb-3">Material Theme</h2>

        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setMaterialTheme('rprun')}
              className={`flex-1 min-h-touch px-4 py-2 text-sm rounded font-semibold ${
                materialTheme === 'rprun'
                  ? 'bg-prun-yellow text-apxm-bg'
                  : 'border border-apxm-accent text-apxm-muted'
              }`}
            >
              rPrUn
            </button>
            <button
              onClick={() => setMaterialTheme('prun')}
              className={`flex-1 min-h-touch px-4 py-2 text-sm rounded font-semibold ${
                materialTheme === 'prun'
                  ? 'bg-prun-yellow text-apxm-bg'
                  : 'border border-apxm-accent text-apxm-muted'
              }`}
            >
              PrUn
            </button>
          </div>

          {/* Preview tiles */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-apxm-muted">Preview:</span>
            <MaterialTile ticker="RAT" category="consumables-basic" size="sm" />
            <MaterialTile ticker="H2O" category="liquids" size="sm" />
            <MaterialTile ticker="FE" category="metals" size="sm" />
          </div>
        </div>
      </Card>
    </div>
  );
}
