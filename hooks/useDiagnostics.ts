import { useConnectionStore } from '../stores/connection';

/**
 * Hook for accessing connection diagnostic information.
 * Useful for debugging message handling issues and monitoring
 * for unexpected payload structures.
 */
export function useDiagnostics() {
  const discardedMessages = useConnectionStore((s) => s.discardedMessages);
  const unknownMessageTypes = useConnectionStore((s) => s.unknownMessageTypes);
  const messageCount = useConnectionStore((s) => s.messageCount);
  const reconnectCount = useConnectionStore((s) => s.reconnectCount);

  return {
    discardedMessages,
    unknownMessageTypes,
    messageCount,
    reconnectCount,
    hasIssues: discardedMessages > 0 || unknownMessageTypes.length > 0,
  };
}
