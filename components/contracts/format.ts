/**
 * Contract time formatting shared by the list row and the detail sheet.
 * Lifted verbatim from the retired ContractCard so the row and sheet read the
 * deadline identically.
 */

/** Time remaining to a deadline: 'Overdue', '<1h', '5h', '2d 3h', '4d', or '--'. */
export function formatDeadline(dueDateMs: number | null): string {
  if (!dueDateMs) return '--';
  const diffMs = dueDateMs - Date.now();

  if (diffMs < 0) return 'Overdue';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days === 0) {
    return hours < 1 ? '<1h' : `${hours}h`;
  }
  if (days < 7 && remainingHours > 0) {
    return `${days}d ${remainingHours}h`;
  }
  return `${days}d`;
}

/** How long ago a contract was created: '<1h ago', '5h ago', '4d ago'. */
export function formatCreated(createdMs: number): string {
  const diffMs = Date.now() - createdMs;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days === 0) {
    return hours < 1 ? '<1h ago' : `${hours}h ago`;
  }
  return `${days}d ago`;
}
