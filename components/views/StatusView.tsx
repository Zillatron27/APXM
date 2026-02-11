import { BasesMiniList, FleetMiniList, ContractsMiniList, CashBalancePane } from '../status';

export function StatusView() {
  return (
    <div className="space-y-4">
      <CashBalancePane />
      <BasesMiniList />
      <FleetMiniList />
      <ContractsMiniList />
    </div>
  );
}
