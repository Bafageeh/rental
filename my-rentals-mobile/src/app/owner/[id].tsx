import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import OwnerAssetsDashboardScreen from "../../components/OwnerAssetsDashboardCompactScreen";

export default function OwnerDashboardRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id || "");
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, [id])
  );

  return <OwnerAssetsDashboardScreen key={`${id}-${refreshKey}`} id={id} />;
}
