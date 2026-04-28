import { useLocalSearchParams } from "expo-router";
import EntityDetailsScreen from "../../components/EntityDetailsScreen";

export default function UnitDetailsRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  return <EntityDetailsScreen entity="unit" id={String(params.id || "")} />;
}
