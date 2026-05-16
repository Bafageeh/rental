import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect } from "react";
import { BackHandler } from "react-native";
import ContractDetailsScreen from "../../components/ContractDetailsScreen";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function currentUnitContextId() {
  const context = (globalThis as any).__RENTAL_EDIT_CONTEXT__;
  if (context?.resource === "units" && context?.id) return String(context.id);
  return "";
}

export default function ContractDetailsRoute() {
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id: string; from_unit_id?: string; unit_id?: string }>();
  const id = firstParam(params.id);
  const initialUnitId = firstParam(params.from_unit_id) || firstParam(params.unit_id) || currentUnitContextId();
  const forcedUnitRoute = initialUnitId ? `/unit/${initialUnitId}` : "";

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false } as never);
  }, [navigation]);

  useEffect(() => {
    if (!forcedUnitRoute) return undefined;

    const source = `contract-route-${id}`;
    (globalThis as any).__RENTAL_FORCED_BACK_ROUTE__ = {
      source,
      route: forcedUnitRoute,
    };

    const goToUnit = () => {
      router.replace(forcedUnitRoute as never);
      return true;
    };

    const hardwareSubscription = BackHandler.addEventListener("hardwareBackPress", goToUnit);
    const unsubscribeBeforeRemove = navigation.addListener("beforeRemove" as never, (event: any) => {
      const actionType = String(event?.data?.action?.type || "").toUpperCase();
      const isBackAction = ["GO_BACK", "POP", "POP_TO_TOP", "NAVIGATE"].includes(actionType);
      if (!isBackAction) return;
      event.preventDefault?.();
      goToUnit();
    });

    return () => {
      hardwareSubscription.remove();
      if (typeof unsubscribeBeforeRemove === "function") unsubscribeBeforeRemove();
      const override = (globalThis as any).__RENTAL_FORCED_BACK_ROUTE__;
      if (override?.source === source) {
        (globalThis as any).__RENTAL_FORCED_BACK_ROUTE__ = undefined;
      }
    };
  }, [forcedUnitRoute, id, navigation]);

  return <ContractDetailsScreen id={id} initialUnitId={initialUnitId} />;
}
