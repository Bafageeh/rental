import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import EntityDetailsScreen from "../../components/EntityDetailsScreen";
import { apiGet } from "../../lib/api";

type UnitLookupResponse = {
  data?: {
    id?: number | string;
    property_id?: number | string | null;
  };
  id?: number | string;
  property_id?: number | string | null;
};

function extractPropertyId(response: UnitLookupResponse | null | undefined) {
  return response?.data?.property_id ?? response?.property_id ?? null;
}

export default function UnitDetailsRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id || "");
  const [checkingParentProperty, setCheckingParentProperty] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function redirectToPropertyDetails() {
      if (!id) {
        setCheckingParentProperty(false);
        return;
      }

      try {
        const response = (await apiGet(`/units/${id}`)) as UnitLookupResponse;
        const propertyId = extractPropertyId(response);

        if (propertyId) {
          router.replace(`/property/${propertyId}` as never);
          return;
        }
      } catch {
        // عند تعذر قراءة الوحدة نترك شاشة الوحدة كاحتياط بدل تعطيل المسار بالكامل.
      }

      if (mounted) {
        setCheckingParentProperty(false);
      }
    }

    redirectToPropertyDetails();

    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    globalThis.__RENTAL_EDIT_CONTEXT__ = { resource: "units", id };
    return () => {
      if (globalThis.__RENTAL_EDIT_CONTEXT__?.resource === "units" && String(globalThis.__RENTAL_EDIT_CONTEXT__?.id || "") === id) {
        globalThis.__RENTAL_EDIT_CONTEXT__ = undefined;
      }
    };
  }, [id]);

  if (checkingParentProperty) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F6F4" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: "#64748B", fontWeight: "800", textAlign: "center" }}>
            جاري فتح تفاصيل العقار...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return <EntityDetailsScreen entity="unit" id={id} />;
}
