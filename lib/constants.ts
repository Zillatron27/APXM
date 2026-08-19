export const BUILD_VERSION = 'v1.2.0';

/**
 * In-session silence threshold (#7): APEX chatters continuously during a live
 * session, so this long a gap on a nominally open connection is a strong
 * message-loss signal (backgrounded tab, suspended page, silent network blip).
 * Deliberately a constant, not a user setting.
 */
export const WS_SILENCE_THRESHOLD_MS = 10 * 60 * 1000;
