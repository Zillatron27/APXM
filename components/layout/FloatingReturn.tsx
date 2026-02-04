import { useGameState } from '../../stores/gameState';

export function FloatingReturn() {
  const { setApexVisible } = useGameState();

  return (
    <button
      onClick={() => setApexVisible(false)}
      className="fixed top-0 left-0 right-0 z-[999999] h-11 min-h-touch px-4 bg-apxm-bg text-apxm-text text-sm font-semibold flex items-center justify-end border-b border-apxm-surface hover:bg-apxm-surface pointer-events-auto"
      aria-label="Return to APXM"
    >
      <span className="text-prun-yellow">←</span>
      <span className="ml-2">Show APXM</span>
    </button>
  );
}
