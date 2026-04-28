import { useLocalSearchParams } from "expo-router";
import EntityDetailsScreen from "../../components/EntityDetailsScreen";

export default function TenantDetailsRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  return <EntityDetailsScreen entity="tenant" id={String(params.id || "")} />;
}
