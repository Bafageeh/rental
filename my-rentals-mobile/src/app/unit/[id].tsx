import { useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import EntityDetailsScreen from "../../components/EntityDetailsScreen";

export default function UnitDetailsRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id || "");

  useEffect(() => {
    globalThis.__RENTAL_EDIT_CONTEXT__ = { resource: "units", id };
    return () => {
      if (globalThis.__RENTAL_EDIT_CONTEXT__?.resource === "units" && String(globalThis.__RENTAL_EDIT_CONTEXT__?.id || "") === id) {
        globalThis.__RENTAL_EDIT_CONTEXT__ = undefined;
      }
    };
  }, [id]);

  return <EntityDetailsScreen entity="unit" id={id} />;
}
