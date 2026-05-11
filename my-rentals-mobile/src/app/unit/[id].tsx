import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGet } from "../../lib/api";

type UnitLookupResponse = {
  data?: {
    id?: number | string;
    property_id?: number | string | null;
  };
  id?: number | string;
  property_id?: number | string | null;
};

type UnitListItem = {
  id?: number | string;
  property_id?: number | string | null;
};

function extractPropertyId(response: UnitLookupResponse | null | undefined) {
  return response?.data?.property_id ?? response?.property_id ?? null;
}

function unwrapUnits(response: any): UnitListItem[] {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
}

function sameId(a: unknown, b: unknown) {
  return String(a ?? "") === String(b ?? "");
}

export default function UnitDetailsRoute() {
  const params = useLocalSearchParams<{ id: string; property_id?: string; propertyId?: string }>();
  const id = String(params.id || "");

  useEffect(() => {
    let cancelled = false;

    async function openPropertyDetailsOnly() {
      const directPropertyId = params.property_id || params.propertyId;
      if (directPropertyId) {
        router.replace(`/property/${directPropertyId}` as never);
        return;
      }

      if (!id) {
        router.replace("/properties" as never);
        return;
      }

      try {
        const response = (await apiGet(`/units/${id}`)) as UnitLookupResponse;
        const propertyId = extractPropertyId(response);

        if (!cancelled && propertyId) {
          router.replace(`/property/${propertyId}` as never);
          return;
        }
      } catch {
        // نستمر بخطة احتياطية بدون فتح شاشة تفاصيل الوحدة نهائيًا.
      }

      try {
        const unitsResponse = await apiGet("/units");
        const unit = unwrapUnits(unitsResponse).find((item) => sameId(item.id, id));

        if (!cancelled && unit?.property_id) {
          router.replace(`/property/${unit.property_id}` as never);
          return;
        }
      } catch {
        // لا نعرض شاشة الوحدة حتى لو فشل البحث.
      }

      if (!cancelled) {
        router.replace("/properties" as never);
      }
    }

    openPropertyDetailsOnly();

    return () => {
      cancelled = true;
    };
  }, [id, params.propertyId, params.property_id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F6F4" }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10, color: "#64748B", fontWeight: "900", textAlign: "center" }}>
          جاري فتح تفاصيل العقار...
        </Text>
      </View>
    </SafeAreaView>
  );
}
