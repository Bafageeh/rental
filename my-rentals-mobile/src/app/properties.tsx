import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiPost } from "../lib/api";

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

function directOwnerId(account: AccountPayload | null, fallback: AccountPayload | null) {
  return String(account?.owner_id || account?.owner?.id || fallback?.owner_id || fallback?.owner?.id || "");
}

function propertyOwnerId(property: PropertyItem) {
  return String(property.owner_id || property.owner?.id || "");
}

export default function MyPropertiesScreen() {
  const auth = useAuth();
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [accountOwnerId, setAccountOwnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load(refresh = false) {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const meResult = await apiGet("/auth/me").catch(() => null);
      const me = (meResult?.data ?? meResult?.user ?? meResult ?? null) as AccountPayload | null;
      const fallback = auth.user as AccountPayload | null;
      const ownerId = directOwnerId(me, fallback);
      setAccountOwnerId(ownerId);

      const profileResult = await apiGet("/profile/properties").catch(() => []);
      let list = responseList(profileResult) as PropertyItem[];

      // شاشة عقاراتي لا تستخدم المسار العام /properties إطلاقًا حتى لا تظهر عقارات ملاك آخرين.
      // إن كان الحساب مرتبطًا بمالك محدد، نثبت الفلترة على owner_id في الواجهة أيضًا كطبقة أمان إضافية.
      if (ownerId) {
        list = list.filter((property) => propertyOwnerId(property) === ownerId);
      } else if (!auth.isAdmin) {
        // حساب المالك غير المرتبط بمالك لا يجب أن يرى أي عقارات بالخطأ.
        list = [];
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

  function openAddProperty() {
    const ownerQuery = accountOwnerId ? `?owner_id=${encodeURIComponent(accountOwnerId)}` : "";
    router.push(`/upload-property-deed${ownerQuery}` as never);
  }

  function openEditProperty(property: PropertyItem) {
    router.push(`/edit-record?resource=properties&id=${property.id}` as never);
  }

  function confirmDeleteProperty(property: PropertyItem) {
    Alert.alert(
      "حذف العقار",
      `هل تريد حذف ${property.name || `عقار #${property.id}`}؟\nسيتم حذف الارتباطات التابعة له حسب نظام الحذف الحالي.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => deleteProperty(property),
        },
      ],
    );
  }

  async function deleteProperty(property: PropertyItem) {
    try {
      setDeletingId(property.id);
      await apiPost(`/edit-delete-center/properties/${property.id}/delete`, {});
      setProperties((current) => current.filter((item) => item.id !== property.id));
      Alert.alert("تم", "تم حذف العقار وتحديث القائمة.");
    } catch (e) {
      Alert.alert("تعذر الحذف", e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0f766e" />}
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.addButton} activeOpacity={0.88} onPress={openAddProperty}>
              <Ionicons name="add" size={22} color="#fff" />
              <Text style={styles.addButtonText}>إضافة عقار</Text>
            </TouchableOpacity>
            <View style={styles.heroTitleBox}>
              <Text style={styles.heroIcon}>🏢</Text>
              <Text style={styles.heroTitle}>عقاراتي</Text>
            </View>
          </View>
          <Text style={styles.heroSubtitle}>{auth.isAdmin ? "تعرض عقارات المدير فقط، ولا تعرض عقارات بقية الملاك." : "تعرض العقارات التابعة لمالك الحساب الحالي فقط."}</Text>
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
            <View style={styles.emptyIcon}><Ionicons name="business-outline" size={26} color="#0F766E" /></View>
            <Text style={styles.emptyTitle}>لا توجد عقارات</Text>
            <Text style={styles.emptyText}>{accountOwnerId || auth.isAdmin ? "لا توجد عقارات مرتبطة مباشرة بهذا الحساب." : "لم يتم العثور على عقارات خاصة بهذا الحساب."}</Text>
            <TouchableOpacity style={styles.emptyAddButton} activeOpacity={0.88} onPress={openAddProperty}>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.emptyAddText}>إضافة عقار جديد</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {properties.map((property) => {
          const isDeleting = deletingId === property.id;
          return (
            <TouchableOpacity key={property.id} style={styles.propertyCard} activeOpacity={0.9} onPress={() => router.push(`/property/${property.id}` as never)}>
              <View style={styles.cardHeader}>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.iconButton} activeOpacity={0.82} onPress={() => openEditProperty(property)}>
                    <Ionicons name="pencil" size={17} color="#4B5563" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.iconButton, styles.deleteIconButton, isDeleting ? styles.disabledAction : null]} activeOpacity={0.82} disabled={isDeleting} onPress={() => confirmDeleteProperty(property)}>
                    {isDeleting ? <ActivityIndicator size="small" color="#991B1B" /> : <Ionicons name="trash" size={17} color="#991B1B" />}
                  </TouchableOpacity>
                </View>
                <View style={styles.cardTitleBox}>
                  <View style={styles.titleLine}>
                    <Text style={styles.typeBadge}>{propertyTypeText(property.property_type)}</Text>
                    <Text style={styles.propertyName}>{property.name || `عقار #${property.id}`}</Text>
                  </View>
                  <Text style={styles.propertyLocation}>{[property.district, property.city].filter(Boolean).join("، ") || "لا يوجد موقع مسجل"}</Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <MaterialCommunityIcons name="home-city-outline" size={18} color="#0F766E" />
                  <Text style={styles.metricValue}>{count(property.units_count)}</Text>
                  <Text style={styles.metricLabel}>وحدات</Text>
                </View>
                <View style={styles.metricBox}>
                  <MaterialCommunityIcons name="account-key-outline" size={18} color="#0F766E" />
                  <Text style={styles.metricValue}>{count(property.rented_units_count)}</Text>
                  <Text style={styles.metricLabel}>مؤجرة</Text>
                </View>
                <View style={styles.metricBox}>
                  <MaterialCommunityIcons name="file-sign" size={18} color="#0F766E" />
                  <Text style={styles.metricValue}>{count(property.active_contracts_count)}</Text>
                  <Text style={styles.metricLabel}>عقود</Text>
                </View>
              </View>

              <View style={styles.openRow}>
                <Text style={styles.openHint}>اضغط لفتح تفاصيل العقار</Text>
                <View style={styles.openCircle}><Ionicons name="chevron-back" size={18} color="#fff" /></View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  content: { padding: 14, paddingBottom: 44 },
  hero: { backgroundColor: "#111827", borderRadius: 28, padding: 16, marginBottom: 12, alignItems: "stretch" },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  heroTitleBox: { flex: 1, alignItems: "flex-end" },
  heroIcon: { fontSize: 31, marginBottom: 4 },
  heroTitle: { color: "#fff", fontSize: 29, fontWeight: "900", textAlign: "right" },
  heroSubtitle: { color: "#CBD5E1", marginTop: 8, fontWeight: "800", textAlign: "right", lineHeight: 22 },
  addButton: { backgroundColor: "#0F766E", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 11, flexDirection: "row-reverse", alignItems: "center", gap: 6, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 8, elevation: 2 },
  addButtonText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  summaryRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: "#fff", borderRadius: 20, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#ECEFF3" },
  summaryValue: { color: "#111827", fontSize: 20, fontWeight: "900" },
  summaryLabel: { color: "#64748B", fontWeight: "800", marginTop: 5 },
  stateCard: { backgroundColor: "#fff", borderRadius: 22, padding: 18, alignItems: "center" },
  stateText: { color: "#64748B", fontWeight: "800", marginTop: 8 },
  emptyCard: { backgroundColor: "#fff", borderRadius: 24, padding: 18, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: "#ECFDF5", marginBottom: 10 },
  emptyTitle: { color: "#111827", fontSize: 18, fontWeight: "900" },
  emptyText: { color: "#64748B", fontWeight: "800", marginTop: 8, textAlign: "center", lineHeight: 21 },
  emptyAddButton: { marginTop: 14, backgroundColor: "#111827", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row-reverse", alignItems: "center", gap: 7 },
  emptyAddText: { color: "#fff", fontWeight: "900" },
  propertyCard: { backgroundColor: "#fff", borderRadius: 26, padding: 13, marginBottom: 12, borderWidth: 1, borderColor: "#ECEFF3", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardActions: { flexDirection: "row", gap: 7, paddingTop: 2 },
  iconButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  deleteIconButton: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  disabledAction: { opacity: 0.55 },
  cardTitleBox: { flex: 1, alignItems: "flex-end" },
  titleLine: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" },
  propertyName: { color: "#111827", fontSize: 19, fontWeight: "900", textAlign: "right" },
  propertyLocation: { color: "#64748B", fontWeight: "800", marginTop: 5, textAlign: "right" },
  typeBadge: { backgroundColor: "#ECFDF5", color: "#0F766E", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: "hidden", fontWeight: "900", fontSize: 12 },
  metricsRow: { flexDirection: "row-reverse", gap: 8, marginTop: 13 },
  metricBox: { flex: 1, backgroundColor: "#F8FAFC", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center", borderWidth: 1, borderColor: "#EEF2F7" },
  metricValue: { color: "#111827", fontWeight: "900", fontSize: 16, marginTop: 3 },
  metricLabel: { color: "#64748B", fontWeight: "800", fontSize: 11, marginTop: 2 },
  openRow: { marginTop: 12, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111827", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10 },
  openHint: { color: "#E5E7EB", fontWeight: "900", fontSize: 12 },
  openCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#0F766E", alignItems: "center", justifyContent: "center" },
});
