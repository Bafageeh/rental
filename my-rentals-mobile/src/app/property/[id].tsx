import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PropertyDetailScreen from "../../components/PropertyDetailWithContractAccess";
import { apiGet } from "../../lib/api";

function responseData(payload: any) {
  return payload?.data && !Array.isArray(payload.data) ? payload.data : payload;
}

function responseList(payload: any) {
  return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
}

function firstUnitId(payload: any) {
  const list = responseList(payload);
  const unit = list.find((item: any) => item?.id);
  return unit?.id ? String(unit.id) : "";
}

function isApartmentProperty(value: unknown) {
  const type = String(value || "").trim().toLowerCase();
  return type === "apartment" || type === "شقة";
}

export default function PropertyRouteRedirectToUnit() {
  const params = useLocalSearchParams<{ id: string; return_to?: string }>();
  const propertyId = String(params.id || "");
  const [fallbackToProperty, setFallbackToProperty] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function openCorrectDetailsScreen() {
      if (!propertyId) {
        setFallbackToProperty(true);
        return;
      }

      try {
        const propertyResponse = await apiGet(`/properties/${encodeURIComponent(propertyId)}`).catch(() => apiGet(`/my/properties/${encodeURIComponent(propertyId)}`));
        const property = responseData(propertyResponse);
        const propertyType = property?.property_type ?? property?.type;

        // العمارات والعقارات التي تحتوي وحدات لا تفتح وحدة عشوائية؛ تعرض تفاصيل العقار نفسه.
        if (!isApartmentProperty(propertyType)) {
          if (!cancelled) setFallbackToProperty(true);
          return;
        }

        // الشقة المستقلة فقط تفتح شاشة تفاصيل الوحدة المرتبطة بها.
        const result = await apiGet(`/my/units?property_id=${encodeURIComponent(propertyId)}`).catch(() => apiGet(`/units?property_id=${encodeURIComponent(propertyId)}`));
        const unitId = firstUnitId(result);

        if (!cancelled && unitId) {
          const returnTo = params.return_to || "/properties";
          router.replace(`/unit/${unitId}?return_to=${encodeURIComponent(returnTo)}` as never);
          return;
        }
      } catch {
        // عند تعذر تحديد النوع أو عدم وجود وحدة مرتبطة، نعرض شاشة العقار كحل احتياطي.
      }

      if (!cancelled) {
        setFallbackToProperty(true);
      }
    }

    void openCorrectDetailsScreen();

    return () => {
      cancelled = true;
    };
  }, [propertyId, params.return_to]);

  if (fallbackToProperty) return <PropertyDetailScreen />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.text}>جاري فتح التفاصيل...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAF8" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  text: { color: "#64748B", fontWeight: "800" },
});
