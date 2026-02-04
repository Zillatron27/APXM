import { useGameState } from '../../stores/gameState';

export function FloatingReturn() {
  const { setApexVisible } = useGameState();

  return (
    <button
      onClick={() => setApexVisible(false)}
      className="fixed bottom-4 right-4 z-[999999] min-h-touch px-4 bg-prun-yellow text-apxm-bg text-sm font-semibold flex items-center justify-center hover:bg-prun-yellow/90 pointer-events-auto"
      aria-label="Return to APXM"
    >
      APXM
    </button>
  );
}
