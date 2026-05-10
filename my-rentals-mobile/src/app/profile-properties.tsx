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
  management_type?: string | null;
  deed_owner_name?: string | null;
  units_count?: number;
  owner_id?: number | string | null;
  owner?: { id?: number | string | null; name?: string | null; type?: string | null } | null;
};

type AccountPayload = {
  id?: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  is_admin?: boolean;
  owner_id?: number | string | null;
  owner?: { id?: number | string | null; name?: string | null; type?: string | null } | null;
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

function directOwnerId(account: AccountPayload | null, fallback: AccountPayload | null) {
  return String(account?.owner_id || account?.owner?.id || fallback?.owner_id || fallback?.owner?.id || "");
}

function onlyDirectOwnerProperties(list: PropertyItem[], ownerId: string) {
  if (!ownerId) return list;
  return list.filter((property) => String(property.owner_id || property.owner?.id || "") === ownerId);
}

function responseList(payload: any) {
  return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
}

function normalizedText(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي");
}

function isAdminAccount(account: AccountPayload | null, fallback: AccountPayload | null) {
  const role = normalizedText(account?.role || fallback?.role || "");
  return Boolean(account?.is_admin || fallback?.is_admin || ["admin", "manager", "super_admin", "administrator"].includes(role));
}

function isAhmedOwnedProperty(property: PropertyItem) {
  const ownerName = normalizedText(property.owner?.name);
  const deedOwnerName = normalizedText(property.deed_owner_name);
  const propertyName = normalizedText(property.name);
  const ownerType = normalizedText(property.owner?.type);
  const managementType = normalizedText(property.management_type);
  const haystack = `${ownerName} ${deedOwnerName} ${propertyName}`;

  return (
    ownerType === "self" ||
    managementType === "owned" ||
    haystack.includes("احمد") ||
    haystack.includes("ahmed") ||
    haystack.includes("املاكي") ||
    haystack.includes("املاك")
  );
}

export default function ProfilePropertiesScreen() {
  const auth = useAuth();
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [accountOwnerId, setAccountOwnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const meResult = await apiGet("/auth/me").catch(() => null);
      const me = (meResult?.data ?? meResult?.user ?? meResult ?? null) as AccountPayload | null;
      const fallbackUser = auth.user as AccountPayload | null;
      const ownerId = directOwnerId(me, fallbackUser);
      const adminAccount = isAdminAccount(me, fallbackUser);
      setAccountOwnerId(ownerId);

      const profileResult = await apiGet("/profile/properties").catch(() => []);
      let list = responseList(profileResult) as PropertyItem[];

      if (list.length === 0 && ownerId) {
        const fallbackResult = await apiGet("/my/properties").catch(() => []);
        list = onlyDirectOwnerProperties(responseList(fallbackResult) as PropertyItem[], ownerId);
      }

      if (list.length === 0 && adminAccount) {
        const allPropertiesResult = await apiGet("/properties").catch(() => []);
        list = (responseList(allPropertiesResult) as PropertyItem[]).filter(isAhmedOwnedProperty);
      }

      setProperties(list);
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
          <Text style={styles.heroSubtitle}>تعرض هذه الشاشة العقارات الخاصة بأحمد أو المرتبطة مباشرة بمالك الحساب فقط.</Text>
          <Text style={styles.countBadge}>{properties.length.toLocaleString("ar-SA")} عقار</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>جاري تحميل عقارات صاحب الحساب...</Text>
          </View>
        ) : null}

        {!loading && properties.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>لا توجد عقارات</Text>
            <Text style={styles.emptyText}>{accountOwnerId ? "لا توجد عقارات مرتبطة مباشرة بمالك هذا الحساب." : "لم يتم العثور على عقارات خاصة باسم أحمد."}</Text>
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
