import { useLocalSearchParams } from "expo-router";
import ContractDetailsScreen from "../../components/ContractDetailsScreen";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default function ContractDetailsRoute() {
  const params = useLocalSearchParams<{ id: string; from_unit_id?: string; unit_id?: string }>();
  const id = firstParam(params.id);
  const initialUnitId = firstParam(params.from_unit_id) || firstParam(params.unit_id);
  return <ContractDetailsScreen id={id} initialUnitId={initialUnitId} />;
}
