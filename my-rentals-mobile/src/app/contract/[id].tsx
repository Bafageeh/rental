import { useLocalSearchParams } from "expo-router";
import ContractDetailsScreen from "../../components/ContractDetailsScreen";

export default function ContractDetailsRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  return <ContractDetailsScreen id={String(params.id || "")} />;
}
