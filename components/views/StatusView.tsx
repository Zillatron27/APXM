import { Fragment, type ReactNode } from 'react';
import {
  BasesMiniList,
  FleetMiniList,
  ContractsMiniList,
  CashBalancePane,
  AttentionPanel,
  DragHandle,
  useStatusReorder,
} from '../status';
import { useSettingsStore, type StatusPanelId } from '../../stores/settings';
import { reconcileOrder } from '../status/reorder-utils';

// The reorderable panels. Cash (company) + attention are pinned above these.
const PANELS: Record<StatusPanelId, (handle: ReactNode) => ReactNode> = {
  bases: (handle) => <BasesMiniList handle={handle} />,
  fleet: (handle) => <FleetMiniList handle={handle} />,
  contracts: (handle) => <ContractsMiniList handle={handle} />,
};

export function StatusView() {
  const stored = useSettingsStore((s) => s.statusPanelOrder);
  const setStatusPanelOrder = useSettingsStore((s) => s.setStatusPanelOrder);
  const order = reconcileOrder(stored);

  const { setItemRef, getHandleProps, itemStyle, showLineAt, draggingId } = useStatusReorder(
    order,
    setStatusPanelOrder
  );

  return (
    <div className="space-y-4">
      {/* Pinned, non-reorderable: company identity + the at-a-glance attention bar. */}
      <CashBalancePane />
      <AttentionPanel />

      {/* Reorderable: drag a panel's titlebar handle to reorder; order persists. */}
      {order.map((id, i) => (
        <Fragment key={id}>
          {showLineAt(i) && <div className="h-0.5 -my-2 bg-prun-yellow" />}
          <div
            ref={setItemRef(id)}
            style={itemStyle(id)}
            className={draggingId === id ? 'shadow-[0_6px_16px_rgba(0,0,0,0.5)]' : ''}
          >
            {PANELS[id](<DragHandle {...getHandleProps(id)} />)}
          </div>
        </Fragment>
      ))}
      {showLineAt(order.length) && <div className="h-0.5 -mt-2 bg-prun-yellow" />}
    </div>
  );
}
