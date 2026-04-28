import { useLocalSearchParams } from "expo-router";
import EntityDetailsScreen from "../../components/EntityDetailsScreen";

export default function ContractDetailsRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  return <EntityDetailsScreen entity="contract" id={String(params.id || "")} />;
}
