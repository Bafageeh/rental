import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { apiGet } from "../lib/api";
import { colors, spacing } from "../constants/theme";

type PropertyItem = {
  id: number;
  name?: string | null;
  city?: string | null;
  district?: string | null;
  property_type?: string | null;
  units_count?: number;
  owner?: { id?: number; name?: string | null } | null;
};

const propertyTypeLabels: Record<string, string> = {
  building: "عمارة",
  apartment: "شقة مستقلة",
  villa: "فيلا",
  land: "أرض",
  commercial: "تجاري",
  shop: "محل",
  office: "مكتب",
  mixed: "مختلط",
};

function propertyTypeText(value?: string | null) {
  if (!value) return "عقار";
  return propertyTypeLabels[value] || value;
}

function valueOrDash(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

export default function ProfilePropertiesScreen() {
  const auth = useAuth();
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const result = await apiGet("/my/properties");
      const list = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
      setProperties(list as PropertyItem[]);
    } catch (e) {
      Alert.alert("تعذر التحميل", e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(false);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroIcon}>🏢</Text>
          <Text style={styles.heroTitle}>عقاراتي</Text>
          <Text style={styles.heroSubtitle}>اضغط على أي عقار للدخول إلى تفاصيله.</Text>
          <Text style={styles.countBadge}>{properties.length.toLocaleString("ar-SA")} عقار</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>جاري تحميل العقارات...</Text>
          </View>
        ) : null}

        {!loading && properties.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>لا توجد عقارات</Text>
            <Text style={styles.emptyText}>لا توجد عقارات مرتبطة بهذا الحساب حاليًا.</Text>
          </View>
        ) : null}

        {properties.map((property) => (
          <TouchableOpacity key={property.id} style={styles.propertyCard} activeOpacity={0.88} onPress={() => router.push(`/property/${property.id}` as any)}>
            <View style={styles.propertyTopRow}>
              <Text style={styles.propertyType}>{propertyTypeText(property.property_type)}</Text>
              <View style={styles.propertyTitleWrap}>
                <Text style={styles.propertyName}>{property.name || `عقار #${property.id}`}</Text>
                <Text style={styles.propertyMeta}>{[property.district, property.city].filter(Boolean).join("، ") || "لا يوجد موقع مسجل"}</Text>
              </View>
            </View>
            <View style={styles.propertyFooter}>
              <Text style={styles.propertyFooterText}>الوحدات: {valueOrDash(property.units_count)}</Text>
              <Text style={styles.propertyFooterText}>المالك: {property.owner?.name || auth.user?.name || "-"}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 110 },
  heroCard: { backgroundColor: "#111827", borderRadius: 26, padding: spacing.lg, marginBottom: spacing.md, alignItems: "flex-end" },
  heroIcon: { fontSize: 34, marginBottom: 8 },
  heroTitle: { color: "#FFFFFF", fontSize: 25, fontWeight: "900", textAlign: "right" },
  heroSubtitle: { color: "rgba(255,255,255,0.75)", marginTop: 7, fontWeight: "800", textAlign: "right", lineHeight: 22 },
  countBadge: { marginTop: 12, color: "#064E3B", backgroundColor: "#D1FAE5", borderRadius: 999, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 6, fontWeight: "900" },
  loadingBox: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg, alignItems: "center", marginBottom: spacing.md },
  loadingText: { color: colors.textSecondary, marginTop: 8, fontWeight: "800" },
  propertyCard: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.borderLight },
  propertyTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  propertyType: { color: colors.primary, backgroundColor: colors.primaryLight, borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5, fontWeight: "900", fontSize: 12 },
  propertyTitleWrap: { flex: 1, alignItems: "flex-end" },
  propertyName: { color: colors.text, fontSize: 18, fontWeight: "900", textAlign: "right" },
  propertyMeta: { color: colors.textSecondary, fontWeight: "800", textAlign: "right", marginTop: 4 },
  propertyFooter: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 12, gap: spacing.sm },
  propertyFooterText: { color: colors.textSecondary, fontWeight: "800", fontSize: 12 },
  emptyBox: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg, alignItems: "center" },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  emptyText: { color: colors.textSecondary, textAlign: "center", marginTop: 6, fontWeight: "800" },
});
