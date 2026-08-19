import { useState, useEffect } from 'react';
import { Panel, MaterialTile, btnPrimary, btnSecondary, btnSegment } from '../shared';
import {
  useSettingsStore,
  DEFAULT_THRESHOLDS,
  DEFAULT_REPAIR_THRESHOLDS,
  type MaterialTheme,
} from '../../stores/settings';
import { testConnection, populateStoresFromFio, type FioProgressStep } from '../../lib/fio';
import { clearAllCache } from '../../stores/cache';
import { formatRelativeTimeVerbose } from '../../lib/format-time';
import { themePresets } from '../../lib/theme';
import {
  setRefreshMode as applyRefreshMode,
  executeBatchRefresh,
  type RefreshMode,
} from '../../lib/buffer-refresh';
import { useRefreshState } from '../../stores/refreshState';
import { useSitesStore } from '../../stores/entities';
import {
  scanBufferCards,
  deleteBufferCards,
  commandPrefix,
  type BufferCard,
} from '../../lib/buffer-cards';

const materialThemeOptions: { id: MaterialTheme; label: string }[] = [
  { id: 'rprun', label: 'rPrUn' },
  { id: 'prun', label: 'PrUn' },
  { id: 'drydock', label: 'DryDock' },
];

const refreshModeOptions: { id: RefreshMode; label: string }[] = [
  { id: 'manual', label: 'Manual' },
  { id: 'batch', label: 'Batch' },
  { id: 'auto', label: 'Auto' },
];

// PrUn's currency set is fixed (ECD excluded — legacy, not spendable).
// null = derive from the company's faction (the unchanged default).
const primaryCurrencyOptions: { id: string | null; label: string }[] = [
  { id: null, label: 'Auto' },
  { id: 'AIC', label: 'AIC' },
  { id: 'CIS', label: 'CIS' },
  { id: 'ICA', label: 'ICA' },
  { id: 'NCC', label: 'NCC' },
];

/** 24-bit hex number → CSS hex string, for inline preset-preview swatches. */
function toCssHex(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

type ConnectionStatus = 'untested' | 'testing' | 'valid' | 'invalid';

/**
 * Dev-build-only refresh mode picker. Surfaces the batch/auto modes that are
 * otherwise URL-param-gated (?apxm_refresh=…) so device testing doesn't need
 * URL editing. Dev builds honour the persisted choice at startup
 * (initRefreshMode); production ignores it and always starts manual.
 */
function DevRefreshModePane() {
  const mode = useRefreshState((s) => s.mode);
  const isRefreshing = useRefreshState((s) => s.isRefreshing);
  const completedCount = useRefreshState((s) => s.completedCount);
  const totalCount = useRefreshState((s) => s.totalCount);
  const persistRefreshMode = useSettingsStore((s) => s.setRefreshMode);

  function selectMode(next: RefreshMode): void {
    applyRefreshMode(next); // runtime: module var + refreshState store
    persistRefreshMode(next); // storage: read back at next startup (dev only)
  }

  function handleRefreshAll(): void {
    if (isRefreshing) return;
    const siteIds = useSitesStore
      .getState()
      .getAll()
      .map((s) => s.siteId);
    if (siteIds.length === 0) return;
    executeBatchRefresh({ siteIds });
  }

  return (
    <Panel title="Refresh Mode" code="DEV">
      <div className="space-y-3">
        <div className="flex gap-2">
          {refreshModeOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => selectMode(option.id)}
              className={`flex-1 min-h-touch px-4 py-2 ${btnSegment(mode === option.id)}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-apxm-muted">
          Manual: per-base refresh buttons. Batch: adds Refresh All below. Auto:
          refreshes every base after login — applies from the next reload.
        </p>

        {mode === 'batch' && (
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className={`${btnSecondary} w-full min-h-touch`}
          >
            {isRefreshing
              ? `Refreshing ${completedCount}/${totalCount}…`
              : 'Refresh all bases'}
          </button>
        )}
      </div>
    </Panel>
  );
}

/** Cards grouped by command prefix, largest group first. */
export function groupCards(cards: BufferCard[]): { prefix: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const prefix = commandPrefix(card.command) || '(blank)';
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  return Array.from(counts, ([prefix, count]) => ({ prefix, count })).sort(
    (a, b) => b.count - a.count || a.prefix.localeCompare(b.prefix)
  );
}

/**
 * Dev-build-only buffer-card sweeper (#84 remedy): scan the Buffer stack,
 * pick command groups, bulk-delete. Deletions are server-synced and APEX asks
 * no confirmation, so the delete button carries the count — that tap is the
 * informed commit. Nothing is pre-selected.
 */
function DevBufferCardsPane() {
  const [cards, setCards] = useState<BufferCard[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState<'scan' | 'delete' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleScan(): Promise<void> {
    if (working) return;
    setWorking('scan');
    setMessage(null);
    setSelected(new Set());
    const result = await scanBufferCards();
    if (result.ok) {
      setCards(result.cards);
      if (result.cards.length === 0) setMessage('Buffer stack is empty.');
    } else {
      setMessage(result.error);
    }
    setWorking(null);
  }

  async function handleDelete(): Promise<void> {
    if (working || selected.size === 0) return;
    setWorking('delete');
    setMessage(null);
    const result = await deleteBufferCards(selected);
    setMessage(
      result.ok
        ? `Deleted ${result.deleted} card${result.deleted === 1 ? '' : 's'}.`
        : `Deleted ${result.deleted}, then failed: ${result.error}`
    );
    // Rescan is authoritative after any deletes; drop the stale inventory.
    setCards(null);
    setSelected(new Set());
    setWorking(null);
  }

  function toggleGroup(prefix: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  }

  const groups = cards ? groupCards(cards) : [];
  const selectedCount = cards
    ? cards.filter((c) => selected.has(commandPrefix(c.command) || '(blank)')).length
    : 0;

  return (
    <Panel title="Buffer Cards" code="DEV">
      <div className="space-y-3">
        <p className="text-xs text-apxm-muted">
          Driven actions leave junk cards in the BUFFER stack. Scan, pick
          command groups, delete. Deletion is immediate — APEX asks no
          confirmation.
        </p>

        <button
          onClick={handleScan}
          disabled={working !== null}
          className={`${btnSecondary} w-full min-h-touch`}
        >
          {working === 'scan' ? 'Scanning…' : 'Scan buffer cards'}
        </button>

        {groups.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <button
                  key={g.prefix}
                  onClick={() => toggleGroup(g.prefix)}
                  disabled={working !== null}
                  className={`min-h-touch px-3 py-2 ${btnSegment(selected.has(g.prefix))}`}
                >
                  {g.prefix} ×{g.count}
                </button>
              ))}
            </div>
            <button
              onClick={handleDelete}
              disabled={working !== null || selectedCount === 0}
              className={`${btnPrimary} w-full min-h-touch disabled:opacity-30`}
            >
              {working === 'delete'
                ? 'Deleting…'
                : `Delete ${selectedCount} card${selectedCount === 1 ? '' : 's'}`}
            </button>
          </>
        )}

        {message && <p className="text-xs font-mono text-apxm-text">{message}</p>}
      </div>
    </Panel>
  );
}

const STEP_LABELS: Record<FioProgressStep, string> = {
  sites: 'Sites',
  workforce: 'Workforce',
  storage: 'Storage',
  production: 'Production',
};

export function validateThresholds(
  critical: number,
  warning: number,
  resupply: number
): string | null {
  if (critical <= 0 || warning <= 0 || resupply <= 0) {
    return 'All values must be greater than 0';
  }
  if (critical >= warning) {
    return 'Critical must be less than warning';
  }
  if (resupply < warning) {
    return 'Resupply target must be at least the warning threshold';
  }
  return null;
}

export function validateRepairThresholds(
  threshold: number,
  offset: number
): string | null {
  if (threshold <= 0 || offset <= 0) {
    return 'All values must be greater than 0';
  }
  if (offset >= threshold) {
    return 'Offset must be less than the threshold';
  }
  return null;
}

export function SettingsView() {
  const { fio, setFioConfig, setFioLastFetch, materialTheme, setMaterialTheme, uiTheme, setUiTheme, burnThresholds, setBurnThresholds, preferredCurrency, setPreferredCurrency } = useSettingsStore();

  // Burn threshold local state — strings for free-form editing, persist on valid input
  const [critical, setCritical] = useState(String(burnThresholds.critical));
  const [warning, setWarning] = useState(String(burnThresholds.warning));
  const [resupply, setResupply] = useState(String(burnThresholds.resupply));
  const [thresholdError, setThresholdError] = useState<string | null>(null);

  // Sync local state when store changes (e.g. reset to defaults)
  useEffect(() => {
    setCritical(String(burnThresholds.critical));
    setWarning(String(burnThresholds.warning));
    setResupply(String(burnThresholds.resupply));
  }, [burnThresholds.critical, burnThresholds.warning, burnThresholds.resupply]);

  const handleThresholdChange = (
    field: 'critical' | 'warning' | 'resupply',
    value: string
  ) => {
    // Always update the display string so the user can type freely
    if (field === 'critical') setCritical(value);
    if (field === 'warning') setWarning(value);
    if (field === 'resupply') setResupply(value);

    const num = parseFloat(value);
    if (isNaN(num) || value.trim() === '') {
      setThresholdError(null);
      return;
    }

    const current = {
      critical: parseFloat(critical),
      warning: parseFloat(warning),
      resupply: parseFloat(resupply),
      [field]: num,
    };

    const error = validateThresholds(current.critical, current.warning, current.resupply);
    setThresholdError(error);

    if (!error) {
      setBurnThresholds({ [field]: num });
    }
  };

  const handleResetThresholds = () => {
    setBurnThresholds(DEFAULT_THRESHOLDS);
    setThresholdError(null);
  };

  // Repair threshold local state — same string-edit pattern as burn thresholds
  const { repairThresholds, setRepairThresholds } = useSettingsStore();
  const [repairThreshold, setRepairThreshold] = useState(String(repairThresholds.threshold));
  const [repairOffset, setRepairOffset] = useState(String(repairThresholds.offset));
  const [repairError, setRepairError] = useState<string | null>(null);

  useEffect(() => {
    setRepairThreshold(String(repairThresholds.threshold));
    setRepairOffset(String(repairThresholds.offset));
  }, [repairThresholds.threshold, repairThresholds.offset]);

  const handleRepairChange = (field: 'threshold' | 'offset', value: string) => {
    if (field === 'threshold') setRepairThreshold(value);
    if (field === 'offset') setRepairOffset(value);

    const num = parseFloat(value);
    if (isNaN(num) || value.trim() === '') {
      setRepairError(null);
      return;
    }

    const current = {
      threshold: parseFloat(repairThreshold),
      offset: parseFloat(repairOffset),
      [field]: num,
    };

    const error = validateRepairThresholds(current.threshold, current.offset);
    setRepairError(error);

    if (!error) {
      setRepairThresholds({ [field]: num });
    }
  };

  const handleResetRepairThresholds = () => {
    setRepairThresholds(DEFAULT_REPAIR_THRESHOLDS);
    setRepairError(null);
  };

  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('untested');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStep, setRefreshStep] = useState<FioProgressStep | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

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

  const handleClearCache = async () => {
    setIsClearing(true);
    await clearAllCache();
    setIsClearing(false);
  };

  const hasUnsavedChanges =
    username !== (fio.username ?? '') || apiKey !== (fio.apiKey ?? '');

  return (
    <div className="space-y-4">
      {/* Burn Thresholds Section */}
      <Panel title="Burn Thresholds">
        <p className="text-xs text-apxm-muted mb-3">All fields in days</p>

        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block font-mono text-[10px] uppercase tracking-wide text-apxm-muted mb-1">Critical (red)</label>
              <input
                type="number"
                value={critical}
                onChange={(e) => handleThresholdChange('critical', e.target.value)}
                className="w-full min-h-touch px-3 py-2 text-sm font-mono bg-apxm-bg border border-apxm-accent text-apxm-text outline-none focus:border-prun-yellow"
              />
            </div>

            <div className="flex-1">
              <label className="block font-mono text-[10px] uppercase tracking-wide text-apxm-muted mb-1">Warning (yellow)</label>
              <input
                type="number"
                value={warning}
                onChange={(e) => handleThresholdChange('warning', e.target.value)}
                className="w-full min-h-touch px-3 py-2 text-sm font-mono bg-apxm-bg border border-apxm-accent text-apxm-text outline-none focus:border-prun-yellow"
              />
            </div>

            <div className="flex-1">
              <label className="block font-mono text-[10px] uppercase tracking-wide text-apxm-muted mb-1">Resupply</label>
              <input
                type="number"
                value={resupply}
                onChange={(e) => handleThresholdChange('resupply', e.target.value)}
                className="w-full min-h-touch px-3 py-2 text-sm font-mono bg-apxm-bg border border-apxm-accent text-apxm-text outline-none focus:border-prun-yellow"
              />
            </div>
          </div>

          <p className="text-xs text-apxm-muted">Resupply: target amount of supply for the burn 'Need' column</p>

          {thresholdError && (
            <p className="text-xs text-status-critical">{thresholdError}</p>
          )}

          <button
            onClick={handleResetThresholds}
            className={`w-full min-h-touch px-4 py-2 ${btnSecondary}`}
          >
            Reset to Defaults
          </button>
        </div>
      </Panel>

      {/* Repair Thresholds Section */}
      <Panel title="Repair Thresholds">
        <p className="text-xs text-apxm-muted mb-3">
          Days since last repair on a base's production buildings
        </p>

        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block font-mono text-[10px] uppercase tracking-wide text-apxm-muted mb-1">Threshold (red)</label>
              <input
                type="number"
                value={repairThreshold}
                onChange={(e) => handleRepairChange('threshold', e.target.value)}
                className="w-full min-h-touch px-3 py-2 text-sm font-mono bg-apxm-bg border border-apxm-accent text-apxm-text outline-none focus:border-prun-yellow"
              />
            </div>

            <div className="flex-1">
              <label className="block font-mono text-[10px] uppercase tracking-wide text-apxm-muted mb-1">Offset (yellow)</label>
              <input
                type="number"
                value={repairOffset}
                onChange={(e) => handleRepairChange('offset', e.target.value)}
                className="w-full min-h-touch px-3 py-2 text-sm font-mono bg-apxm-bg border border-apxm-accent text-apxm-text outline-none focus:border-prun-yellow"
              />
            </div>
          </div>

          <p className="text-xs text-apxm-muted">
            Offset: turns yellow this many days before the threshold (e.g. 60/10 → yellow at 50d, red at 60d)
          </p>

          {repairError && <p className="text-xs text-status-critical">{repairError}</p>}

          <button
            onClick={handleResetRepairThresholds}
            className={`w-full min-h-touch px-4 py-2 ${btnSecondary}`}
          >
            Reset to Defaults
          </button>
        </div>
      </Panel>

      {/* FIO API Key Section */}
      <Panel title="FIO API Key">

        <div className="space-y-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wide text-apxm-muted mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="FIO username"
              className="w-full min-h-touch px-3 py-2 text-sm bg-apxm-bg border border-apxm-accent text-apxm-text placeholder:text-apxm-muted/50 outline-none focus:border-prun-yellow"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wide text-apxm-muted mb-1">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Your FIO API key"
              className="w-full min-h-touch px-3 py-2 text-sm bg-apxm-bg border border-apxm-accent text-apxm-text placeholder:text-apxm-muted/50 outline-none focus:border-prun-yellow font-mono"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
              className={`flex-1 min-h-touch px-4 py-2 ${btnPrimary} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Save
            </button>
            <button
              onClick={handleTestConnection}
              disabled={connectionStatus === 'testing'}
              className={`flex-1 min-h-touch px-4 py-2 ${btnSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
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
      </Panel>

      {/* FIO Data Section */}
      <Panel title="FIO Data">

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-apxm-muted">Last refresh:</span>
            <span className="text-apxm-text">
              {fio.lastFetch ? formatRelativeTimeVerbose(fio.lastFetch) : 'Never'}
            </span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing || !fio.apiKey || !fio.username}
            className={`w-full min-h-touch px-4 py-2 ${btnSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
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

          {/* Local cache controls live alongside the FIO refresh — both are
              "data freshness" actions, so they share one pane. */}
          <div className="pt-3 border-t border-apxm-accent/40 space-y-3">
            <p className="text-xs text-apxm-muted">
              Entity data is cached locally to speed up page loads.
              Clear if you experience stale or incorrect data.
            </p>
            <button
              onClick={handleClearCache}
              disabled={isClearing}
              className={`w-full min-h-touch px-4 py-2 ${btnSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isClearing ? 'Clearing...' : 'Clear Cached Data'}
            </button>
          </div>
        </div>
      </Panel>

      {/* Primary Currency Section */}
      <Panel title="Primary Currency">
        <div className="space-y-3">
          <div className="flex gap-2">
            {primaryCurrencyOptions.map((option) => (
              <button
                key={option.label}
                onClick={() => setPreferredCurrency(option.id)}
                className={`flex-1 min-h-touch px-2 py-2 ${btnSegment(preferredCurrency === option.id)}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-apxm-muted">
            The headline balance on the Status tab. Auto uses your company&apos;s
            faction currency.
          </p>
        </div>
      </Panel>

      {/* UI Theme Section */}
      <Panel title="Theme">

        <div className="grid grid-cols-2 gap-2">
          {themePresets.map((preset, index) => {
            const selected = uiTheme === preset.id;
            const { tokens } = preset;
            // A lone trailing item (odd count) spans both columns and centres
            // itself at a single column's width, rather than sitting left.
            const isLoneLast =
              index === themePresets.length - 1 && themePresets.length % 2 === 1;
            return (
              <button
                key={preset.id}
                onClick={() => setUiTheme(preset.id)}
                aria-pressed={selected}
                className={`min-h-touch flex flex-col items-start gap-2 p-2 border ${
                  isLoneLast ? 'col-span-2 justify-self-center w-[calc(50%-0.25rem)]' : ''
                } ${selected ? 'border-prun-yellow' : 'border-apxm-accent'}`}
                style={{ backgroundColor: toCssHex(tokens.bg) }}
              >
                <span
                  className="text-xs font-semibold"
                  style={{ color: selected ? toCssHex(tokens.highlight) : toCssHex(tokens.text) }}
                >
                  {selected ? '✓ ' : ''}{preset.name}
                </span>
                {/* Authentic per-preset swatches (inline styles, not theme tokens) */}
                <span className="flex gap-1">
                  {[tokens.highlight, tokens.statusOk, tokens.statusWarning, tokens.statusCritical].map(
                    (c, i) => (
                      <span
                        key={i}
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: toCssHex(c) }}
                      />
                    )
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* Material Theme Section */}
      <Panel title="Material Theme">

        <div className="space-y-3">
          <div className="flex gap-2">
            {materialThemeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setMaterialTheme(option.id)}
                className={`flex-1 min-h-touch px-4 py-2 ${btnSegment(materialTheme === option.id)}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Preview tiles */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <MaterialTile ticker="GRN" category="agricultural-products" size="sm" />
            <MaterialTile ticker="RAT" category="consumables-basic" size="sm" />
            <MaterialTile ticker="FF" category="fuels" size="sm" />
            <MaterialTile ticker="H2O" category="liquids" size="sm" />
            <MaterialTile ticker="PE" category="plastics" size="sm" />
            <MaterialTile ticker="FE" category="metals" size="sm" />
            <MaterialTile ticker="MCG" category="construction-materials" size="sm" />
            <MaterialTile ticker="SAR" category="electronic-devices" size="sm" />
          </div>
        </div>
      </Panel>

      {__DEV__ && <DevRefreshModePane />}
      {__DEV__ && <DevBufferCardsPane />}
    </div>
  );
}
