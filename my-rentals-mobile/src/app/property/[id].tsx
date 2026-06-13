import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PropertyDetailScreen from "../../components/PropertyDetailWithContractAccess";
import { apiGet } from "../../lib/api";

function responseList(payload: any) {
  return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
}

function firstUnitId(payload: any) {
  const list = responseList(payload);
  const unit = list.find((item: any) => item?.id);
  return unit?.id ? String(unit.id) : "";
}

export default function PropertyRouteRedirectToUnit() {
  const params = useLocalSearchParams<{ id: string; return_to?: string }>();
  const propertyId = String(params.id || "");
  const [checking, setChecking] = useState(true);
  const [fallbackToProperty, setFallbackToProperty] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function openUnitInsteadOfProperty() {
      if (!propertyId) {
        setChecking(false);
        setFallbackToProperty(true);
        return;
      }

      try {
        const result = await apiGet(`/my/units?property_id=${encodeURIComponent(propertyId)}`).catch(() => apiGet(`/units?property_id=${encodeURIComponent(propertyId)}`));
        const unitId = firstUnitId(result);

        if (!cancelled && unitId) {
          const returnTo = params.return_to || "/properties";
          router.replace(`/unit/${unitId}?return_to=${encodeURIComponent(returnTo)}` as never);
          return;
        }
      } catch {
        // عند عدم وجود وحدة مرتبطة، نعرض شاشة العقار كحل احتياطي فقط.
      }

      if (!cancelled) {
        setFallbackToProperty(true);
        setChecking(false);
      }
    }

    void openUnitInsteadOfProperty();

    return () => {
      cancelled = true;
    };
  }, [propertyId, params.return_to]);

  if (fallbackToProperty) return <PropertyDetailScreen />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.text}>جاري فتح تفاصيل الوحدة...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAF8" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  text: { color: "#64748B", fontWeight: "800" },
});
