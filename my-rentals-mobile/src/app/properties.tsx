import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { apiGet } from "../lib/api";

type PropertyItem = {
  id: number;
  name?: string | null;
  city?: string | null;
  district?: string | null;
  property_type?: string | null;
  management_type?: string | null;
  deed_owner_name?: string | null;
  units_count?: number;
  rented_units_count?: number;
  active_contracts_count?: number;
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
  return value ? propertyTypeLabels[value] || value : "عقار";
}

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function count(value: unknown) {
  return Math.round(n(value)).toLocaleString("ar-SA");
}

function responseList(payload: any) {
  return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
}

function normalized(value?: string | null) {
  return String(value || "").trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي");
}

function directOwnerId(account: AccountPayload | null, fallback: AccountPayload | null) {
  return String(account?.owner_id || account?.owner?.id || fallback?.owner_id || fallback?.owner?.id || "");
}

function isAhmedOwnedProperty(property: PropertyItem) {
  const ownerName = normalized(property.owner?.name);
  const deedOwnerName = normalized(property.deed_owner_name);
  const propertyName = normalized(property.name);
  const ownerType = normalized(property.owner?.type);
  const managementType = normalized(property.management_type);
  const haystack = `${ownerName} ${deedOwnerName} ${propertyName}`;
  return ownerType === "self" || managementType === "owned" || haystack.includes("احمد") || haystack.includes("ahmed") || haystack.includes("املاكي") || haystack.includes("املاك");
}

export default function MyPropertiesScreen() {
  const auth = useAuth();
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [accountOwnerId, setAccountOwnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(refresh = false) {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const meResult = await apiGet("/auth/me").catch(() => null);
      const me = (meResult?.data ?? meResult?.user ?? meResult ?? null) as AccountPayload | null;
      const fallback = auth.user as AccountPayload | null;
      const ownerId = directOwnerId(me, fallback);
      setAccountOwnerId(ownerId);

      let list: PropertyItem[] = [];
      const profileResult = await apiGet("/profile/properties").catch(() => []);
      list = responseList(profileResult) as PropertyItem[];

      if (auth.isAdmin) {
        if (ownerId) {
          list = list.filter((property) => String(property.owner_id || property.owner?.id || "") === ownerId);
        } else {
          const all = await apiGet("/properties").catch(() => []);
          list = (responseList(all) as PropertyItem[]).filter(isAhmedOwnedProperty);
        }
      } else if (ownerId) {
        list = list.filter((property) => String(property.owner_id || property.owner?.id || "") === ownerId);
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

  const totalUnits = useMemo(() => properties.reduce((sum, item) => sum + n(item.units_count), 0), [properties]);
  const rentedUnits = useMemo(() => properties.reduce((sum, item) => sum + n(item.rented_units_count), 0), [properties]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0f766e" />}
      >
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>🏢</Text>
          <Text style={styles.heroTitle}>عقاراتي</Text>
          <Text style={styles.heroSubtitle}>{auth.isAdmin ? "تعرض عقارات حساب المدير فقط، ولا تعرض عقارات الملاك الآخرين." : "تعرض العقارات التابعة لمالك الحساب الحالي فقط."}</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{count(properties.length)}</Text><Text style={styles.summaryLabel}>عقارات</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{count(totalUnits)}</Text><Text style={styles.summaryLabel}>وحدات</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{count(rentedUnits)}</Text><Text style={styles.summaryLabel}>مؤجرة</Text></View>
        </View>

        {loading ? (
          <View style={styles.stateCard}><ActivityIndicator /><Text style={styles.stateText}>جاري تحميل عقاراتك...</Text></View>
        ) : null}

        {!loading && properties.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>لا توجد عقارات</Text>
            <Text style={styles.emptyText}>{accountOwnerId ? "لا توجد عقارات مرتبطة مباشرة بهذا الحساب." : "لم يتم العثور على عقارات خاصة بهذا الحساب."}</Text>
          </View>
        ) : null}

        {properties.map((property) => (
          <TouchableOpacity key={property.id} style={styles.propertyCard} activeOpacity={0.9} onPress={() => router.push(`/property/${property.id}` as never)}>
            <View style={styles.cardHeader}>
              <Text style={styles.typeBadge}>{propertyTypeText(property.property_type)}</Text>
              <View style={styles.cardTitleBox}>
                <Text style={styles.propertyName}>{property.name || `عقار #${property.id}`}</Text>
                <Text style={styles.propertyLocation}>{[property.district, property.city].filter(Boolean).join("، ") || "لا يوجد موقع مسجل"}</Text>
              </View>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.pill}>الوحدات {count(property.units_count)}</Text>
              <Text style={styles.pill}>المؤجرة {count(property.rented_units_count)}</Text>
              <Text style={styles.pill}>العقود {count(property.active_contracts_count)}</Text>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.openButton} onPress={() => router.push(`/property/${property.id}` as never)}><Text style={styles.openButtonText}>فتح العقار</Text></TouchableOpacity>
              <TouchableOpacity style={styles.editButton} onPress={() => router.push(`/edit-record?resource=properties&id=${property.id}` as never)}><Text style={styles.editButtonText}>تعديل</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  content: { padding: 14, paddingBottom: 44 },
  hero: { backgroundColor: "#111827", borderRadius: 28, padding: 18, marginBottom: 12, alignItems: "flex-end" },
  heroIcon: { fontSize: 34, marginBottom: 8 },
  heroTitle: { color: "#fff", fontSize: 30, fontWeight: "900", textAlign: "right" },
  heroSubtitle: { color: "#CBD5E1", marginTop: 8, fontWeight: "800", textAlign: "right", lineHeight: 22 },
  summaryRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: "#fff", borderRadius: 20, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#ECEFF3" },
  summaryValue: { color: "#111827", fontSize: 20, fontWeight: "900" },
  summaryLabel: { color: "#64748B", fontWeight: "800", marginTop: 5 },
  stateCard: { backgroundColor: "#fff", borderRadius: 22, padding: 18, alignItems: "center" },
  stateText: { color: "#64748B", fontWeight: "800", marginTop: 8 },
  emptyCard: { backgroundColor: "#fff", borderRadius: 22, padding: 18, alignItems: "center" },
  emptyTitle: { color: "#111827", fontSize: 18, fontWeight: "900" },
  emptyText: { color: "#64748B", fontWeight: "800", marginTop: 8, textAlign: "center" },
  propertyCard: { backgroundColor: "#fff", borderRadius: 24, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#ECEFF3", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitleBox: { flex: 1, alignItems: "flex-end" },
  propertyName: { color: "#111827", fontSize: 19, fontWeight: "900", textAlign: "right" },
  propertyLocation: { color: "#64748B", fontWeight: "800", marginTop: 4, textAlign: "right" },
  typeBadge: { backgroundColor: "#ECFDF5", color: "#0F766E", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  cardFooter: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 12 },
  pill: { backgroundColor: "#F1F5F9", color: "#334155", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, overflow: "hidden", fontWeight: "900", fontSize: 12 },
  actionsRow: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  openButton: { flex: 1, backgroundColor: "#111827", borderRadius: 16, padding: 12, alignItems: "center" },
  openButtonText: { color: "#fff", fontWeight: "900" },
  editButton: { width: 90, backgroundColor: "#E0E7FF", borderRadius: 16, padding: 12, alignItems: "center" },
  editButtonText: { color: "#3730A3", fontWeight: "900" },
});
