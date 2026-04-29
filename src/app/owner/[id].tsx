import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import OwnerDashboardScreen from "../../components/OwnerDashboardScreen";

export default function OwnerDashboardRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id || "");
  const isFocused = useIsFocused();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (isFocused) {
      setRefreshKey((value) => value + 1);
    }
  }, [isFocused]);

  return <OwnerDashboardScreen key={`${id}-${refreshKey}`} id={id} />;
}
