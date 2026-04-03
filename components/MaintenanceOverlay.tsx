/**
 * Full-screen overlay shown when Prosperous Universe server is unavailable.
 * Terminal state — no header or tabbar, just the message and retry option.
 */
export function MaintenanceOverlay() {
  return (
    <div className="w-full h-dvh flex flex-col items-center justify-center bg-apxm-bg text-apxm-text pointer-events-auto p-6">
      <h1 className="text-xl font-semibold text-center mb-2">
        Prosperous Universe appears to be unavailable
      </h1>
      <p className="text-apxm-muted text-center mb-8">
        This usually means scheduled maintenance.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-apxm-accent text-apxm-text rounded min-h-touch active:opacity-80"
      >
        Retry
      </button>
    </div>
  );
}
