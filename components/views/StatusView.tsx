import { BasesMiniList, FleetMiniList, ContractsMiniList } from '../status';

export function StatusView() {
  return (
    <div className="space-y-4">
      <BasesMiniList />
      <FleetMiniList />
      <ContractsMiniList />
    </div>
  );
}
