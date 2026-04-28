import { useLocalSearchParams } from "expo-router";
import OwnerDashboardScreen from "../../components/OwnerDashboardScreen";

export default function OwnerDashboardRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  return <OwnerDashboardScreen id={String(params.id || "")} />;
}
