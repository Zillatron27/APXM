import { useState } from 'react';
import { btnSecondary } from '../shared';
import { useContractDetail } from '../views/hooks';
import { runContractAction } from '../../lib/contract-actions';

/**
 * Compact "request termination" passthrough for the contract sheet HEADER —
 * deliberately out of the main flow (device ruling: a full-width button at
 * the bottom was too prominent and mis-tappable). Self-contained state; the
 * module-level in-flight guard in contract-actions serialises it against the
 * body's ACCEPT/REJECT/FULFILL buttons. Hidden once termination is sent or
 * when the server doesn't offer it; the body renders the sent/received
 * status lines.
 */
export function ContractTerminateButton({ contractId }: { contractId: string }) {
  const contract = useContractDetail(contractId);
  const [running, setRunning] = useState(false);
  const [gameDisabled, setGameDisabled] = useState(false);

  if (!contract || !contract.canRequestTermination || contract.terminationSent) return null;

  async function handleTap(): Promise<void> {
    if (running || !contract) return;
    setRunning(true);
    const result = await runContractAction(contract.localId, { kind: 'terminate' });
    setRunning(false);
    if (!result.ok && result.disabledInApex) setGameDisabled(true);
  }

  return (
    <button
      onClick={handleTap}
      disabled={running || gameDisabled}
      className={`shrink-0 min-h-touch px-2 text-[10px] ${btnSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      Request Termination
    </button>
  );
}
