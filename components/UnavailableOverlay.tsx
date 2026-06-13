interface UnavailableOverlayProps {
  /** Why APXM has no data to show. */
  reason: 'maintenance' | 'starved';
  /** A competing @prun/link interceptor was confirmed (vs. merely suspected). */
  conflictConfirmed: boolean;
}

/**
 * Full-screen overlay shown when APXM has no data. Terminal state — no header
 * or tabbar. The copy tells the truth about what is known: genuine server
 * maintenance (APEX said so) vs. data starvation (we only know nothing is
 * arriving), and names a competing extension when one was detected.
 */
export function UnavailableOverlay({ reason, conflictConfirmed }: UnavailableOverlayProps) {
  const { heading, body } =
    reason === 'maintenance'
      ? {
          heading: 'Prosperous Universe appears to be unavailable',
          body: 'This usually means scheduled maintenance.',
        }
      : conflictConfirmed
        ? {
            heading: 'APXM isn’t receiving game data',
            body: 'Another Prosperous Universe extension (e.g. the Helm extension or rprun) is intercepting the connection. Only one can run at a time — disable the others and reload.',
          }
        : {
            heading: 'APXM isn’t receiving game data',
            body: 'The game may still be loading, or another Prosperous Universe extension (e.g. Helm or rprun) is intercepting the connection. Try disabling other PrUn extensions and reload.',
          };

  return (
    <div className="w-full h-dvh flex flex-col items-center justify-center bg-apxm-bg text-apxm-text pointer-events-auto p-6">
      <h1 className="text-xl font-semibold text-center mb-2">{heading}</h1>
      <p className="text-apxm-muted text-center mb-8 max-w-sm">{body}</p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-apxm-accent text-apxm-text rounded min-h-touch active:opacity-80"
      >
        Retry
      </button>
    </div>
  );
}
