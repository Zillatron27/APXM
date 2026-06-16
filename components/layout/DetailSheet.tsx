import { useEffect, useState } from 'react';
import { useGameState, type DetailView } from '../../stores/gameState';
import { ProductionView } from '../production';
import { BurnDetailView, RepairDetailView } from '../burn';
import { ShipDetailView } from '../fleet';

const detailLabels: Record<DetailView['type'], string> = {
  production: 'Production',
  burn: 'Burn',
  repair: 'Repair',
  ship: 'Ship',
};

/** Sheet title: the ship name for a ship detail, otherwise the site name. */
function detailTitle(detailView: DetailView): string {
  return detailView.type === 'ship' ? detailView.shipName : detailView.siteName;
}

/**
 * Slide-up sheet for base drill-down detail, presented over the current tab.
 * Driven by gameState.detailView — the single source of truth for which
 * detail (if any) is open. A peek you pull up to check status and flick away,
 * not a place you navigate to; the tab bar stays put underneath.
 *
 * Animation: `shown` drives an enter/exit transition. Closing animates the
 * panel down, then clears detailView after the transition. An external clear
 * (e.g. reconnect wiping state) unmounts instantly — acceptable, since there's
 * nothing to animate away from.
 */
export function DetailSheet() {
  const detailView = useGameState((s) => s.detailView);
  const setDetailView = useGameState((s) => s.setDetailView);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!detailView) {
      setShown(false);
      return;
    }
    // Next frame so the enter transition runs from the off-screen start state.
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [detailView]);

  if (!detailView) return null;

  function close() {
    setShown(false);
    // Match the panel transition duration before unmounting.
    setTimeout(() => setDetailView(null), 200);
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      {/* Backdrop — tap to dismiss */}
      <button
        aria-label="Close"
        onClick={close}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 motion-reduce:transition-none ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel */}
      <div
        className={`relative max-h-[85%] flex flex-col bg-apxm-bg border-t border-apxm-surface transition-transform duration-200 ease-out motion-reduce:transition-none ${
          shown ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Header: dimension + base name + close */}
        <div className="flex items-center justify-between gap-2 px-4 h-12 border-b border-apxm-surface shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-apxm-text/40">
              {detailLabels[detailView.type]}
            </p>
            <h2 className="font-semibold text-apxm-text truncate">{detailTitle(detailView)}</h2>
          </div>
          <button
            onClick={close}
            aria-label="Close production view"
            className="min-h-touch px-3 flex items-center text-apxm-text/60 hover:text-prun-yellow text-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {detailView.type === 'production' && (
            <ProductionView siteId={detailView.siteId} siteName={detailView.siteName} />
          )}
          {detailView.type === 'burn' && <BurnDetailView siteId={detailView.siteId} />}
          {detailView.type === 'repair' && <RepairDetailView siteId={detailView.siteId} />}
          {detailView.type === 'ship' && <ShipDetailView shipId={detailView.shipId} />}
        </div>
      </div>
    </div>
  );
}
