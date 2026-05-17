import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  const [showAddChooser, setShowAddChooser] = useState(false);
  const canManage = auth.isAdmin;

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

      if (ownerId) {
        list = list.filter((property) => propertyOwnerId(property) === ownerId);
      } else if (!auth.isAdmin) {
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

  function ownerQuery() {
    return accountOwnerId ? `?owner_id=${encodeURIComponent(accountOwnerId)}` : "";
  }

  function openAddProperty() {
    if (!canManage) return;
    setShowAddChooser(true);
  }

  function openPdfAdd() {
    setShowAddChooser(false);
    router.push(`/upload-property-deed${ownerQuery()}` as never);
  }

  function openManualAdd() {
    setShowAddChooser(false);
    router.push(`/property-form${ownerQuery()}` as never);
  }

  function openEditProperty(property: PropertyItem) {
    if (!canManage) return;
    router.push(`/property-form?id=${property.id}` as never);
  }

  function openPropertyRepository(property: PropertyItem) {
    const params = new URLSearchParams();
    params.set("property_id", String(property.id));
    params.set("property_name", property.name || `عقار #${property.id}`);
    if (property.owner_id || property.owner?.id) params.set("owner_id", String(property.owner_id || property.owner?.id));
    if (property.owner?.name) params.set("owner_name", property.owner.name);
    router.push(`/files?${params.toString()}` as never);
  }

  function confirmDeleteProperty(property: PropertyItem) {
    if (!canManage) return;
    Alert.alert("حذف العقار", `هل تريد حذف ${property.name || `عقار #${property.id}`}؟\nسيتم حذف الارتباطات التابعة له حسب نظام الحذف الحالي.`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteProperty(property) },
    ]);
  }

  async function deleteProperty(property: PropertyItem) {
    if (!canManage) return;
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0f766e" />}>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            {canManage ? (
              <TouchableOpacity style={styles.addButton} activeOpacity={0.88} onPress={openAddProperty}>
                <Ionicons name="add" size={22} color="#fff" />
                <Text style={styles.addButtonText}>إضافة عقار</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.readOnlyBadge}><Text style={styles.readOnlyBadgeText}>اطلاع فقط</Text></View>
            )}
            <View style={styles.heroTitleBox}>
              <Text style={styles.heroIcon}>🏢</Text>
              <Text style={styles.heroTitle}>عقاراتي</Text>
            </View>
          </View>
          <Text style={styles.heroSubtitle}>{auth.isAdmin ? "تعرض عقارات المدير فقط، ولا تعرض عقارات بقية الملاك." : "تعرض العقارات التابعة لمالك الحساب الحالي فقط بدون صلاحيات تعديل أو حذف."}</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{count(properties.length)}</Text><Text style={styles.summaryLabel}>عقارات</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{count(totalUnits)}</Text><Text style={styles.summaryLabel}>وحدات</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{count(rentedUnits)}</Text><Text style={styles.summaryLabel}>مؤجرة</Text></View>
        </View>

        {loading ? <View style={styles.stateCard}><ActivityIndicator /><Text style={styles.stateText}>جاري تحميل عقاراتك...</Text></View> : null}

        {!loading && properties.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Ionicons name="business-outline" size={26} color="#0F766E" /></View>
            <Text style={styles.emptyTitle}>لا توجد عقارات</Text>
            <Text style={styles.emptyText}>{accountOwnerId || auth.isAdmin ? "لا توجد عقارات مرتبطة مباشرة بهذا الحساب." : "لم يتم العثور على عقارات خاصة بهذا الحساب."}</Text>
            {canManage ? (
              <TouchableOpacity style={styles.emptyAddButton} activeOpacity={0.88} onPress={openAddProperty}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.emptyAddText}>إضافة عقار جديد</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {properties.map((property) => {
          const isDeleting = deletingId === property.id;
          return (
            <TouchableOpacity key={property.id} style={styles.propertyCard} activeOpacity={0.9} onPress={() => router.push(`/property/${property.id}` as never)}>
              <View style={styles.cardHeader}>
                {canManage ? (
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.iconButton} activeOpacity={0.82} onPress={() => openEditProperty(property)}>
                      <Ionicons name="pencil" size={17} color="#4B5563" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconButton, styles.mediaIconButton]} activeOpacity={0.82} onPress={() => openPropertyRepository(property)}>
                      <Ionicons name="folder-open" size={18} color="#0F766E" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconButton, styles.deleteIconButton, isDeleting ? styles.disabledAction : null]} activeOpacity={0.82} disabled={isDeleting} onPress={() => confirmDeleteProperty(property)}>
                      {isDeleting ? <ActivityIndicator size="small" color="#991B1B" /> : <Ionicons name="trash" size={17} color="#991B1B" />}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.readOnlySmall}><Text style={styles.readOnlySmallText}>عرض</Text></View>
                )}
                <View style={styles.cardTitleBox}>
                  <View style={styles.titleLine}>
                    <Text style={styles.typeBadge}>{propertyTypeText(property.property_type)}</Text>
                    <Text style={styles.propertyName}>{property.name || `عقار #${property.id}`}</Text>
                  </View>
                  <Text style={styles.propertyLocation}>{[property.district, property.city].filter(Boolean).join("، ") || "لا يوجد موقع مسجل"}</Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricBox}><MaterialCommunityIcons name="home-city-outline" size={18} color="#0F766E" /><Text style={styles.metricValue}>{count(property.units_count)}</Text><Text style={styles.metricLabel}>وحدات</Text></View>
                <View style={styles.metricBox}><MaterialCommunityIcons name="account-key-outline" size={18} color="#0F766E" /><Text style={styles.metricValue}>{count(property.rented_units_count)}</Text><Text style={styles.metricLabel}>مؤجرة</Text></View>
                <View style={styles.metricBox}><MaterialCommunityIcons name="file-sign" size={18} color="#0F766E" /><Text style={styles.metricValue}>{count(property.active_contracts_count)}</Text><Text style={styles.metricLabel}>عقود</Text></View>
              </View>

              <TouchableOpacity style={styles.repositoryRow} activeOpacity={0.86} onPress={() => openPropertyRepository(property)}>
                <View style={styles.repositoryIcon}><Ionicons name="images-outline" size={18} color="#0F766E" /></View>
                <View style={styles.repositoryTextBox}>
                  <Text style={styles.repositoryTitle}>مستودع الوسائط والملفات</Text>
                  <Text style={styles.repositorySubtitle}>الصكوك، الصور، الملفات الرسمية حسب التصنيف</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.openRow}>
                <Text style={styles.openHint}>اضغط لفتح تفاصيل العقار</Text>
                <View style={styles.openCircle}><Ionicons name="chevron-back" size={18} color="#fff" /></View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={showAddChooser && canManage} transparent animationType="fade" onRequestClose={() => setShowAddChooser(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddChooser(false)}>
          <Pressable style={styles.chooserCard}>
            <View style={styles.chooserHandle} />
            <Text style={styles.chooserTitle}>طريقة إضافة العقار</Text>
            <Text style={styles.chooserSubtitle}>اختر الإدخال اليدوي أو رفع صك PDF، وعند رفع الصك سيتم تحديث العقار الموجود إذا تطابق رقم الصك.</Text>
            <TouchableOpacity style={styles.chooserOption} activeOpacity={0.88} onPress={openPdfAdd}>
              <View style={styles.chooserIconBox}><Ionicons name="document-text-outline" size={25} color="#0F766E" /></View>
              <View style={styles.chooserTextBox}><Text style={styles.chooserOptionTitle}>رفع صك PDF</Text><Text style={styles.chooserOptionText}>قراءة بيانات الصك تلقائيًا ومقارنة رقم الصك للتحديث أو الإنشاء.</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.chooserOption} activeOpacity={0.88} onPress={openManualAdd}>
              <View style={styles.chooserIconBox}><Ionicons name="create-outline" size={25} color="#0F766E" /></View>
              <View style={styles.chooserTextBox}><Text style={styles.chooserOptionTitle}>إدخال يدوي</Text><Text style={styles.chooserOptionText}>فتح شاشة جديدة لإدخال بيانات العقار يدويًا.</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelChooserButton} activeOpacity={0.88} onPress={() => setShowAddChooser(false)}><Text style={styles.cancelChooserText}>إلغاء</Text></TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  readOnlyBadge: { backgroundColor: "#D1FAE5", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  readOnlyBadgeText: { color: "#064E3B", fontWeight: "900" },
  readOnlySmall: { backgroundColor: "#ECFDF5", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, marginTop: 4 },
  readOnlySmallText: { color: "#0F766E", fontWeight: "900", fontSize: 12 },
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
  mediaIconButton: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
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
  repositoryRow: { marginTop: 12, backgroundColor: "#F0FDFA", borderRadius: 18, padding: 11, flexDirection: "row-reverse", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#CCFBF1" },
  repositoryIcon: { width: 38, height: 38, borderRadius: 15, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#A7F3D0" },
  repositoryTextBox: { flex: 1, alignItems: "flex-end" },
  repositoryTitle: { color: "#0F172A", fontWeight: "900", textAlign: "right" },
  repositorySubtitle: { color: "#0F766E", fontWeight: "800", fontSize: 11, marginTop: 3, textAlign: "right" },
  openRow: { marginTop: 12, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111827", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10 },
  openHint: { color: "#E5E7EB", fontWeight: "900", fontSize: 12 },
  openCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#0F766E", alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.50)", justifyContent: "flex-end", padding: 14 },
  chooserCard: { backgroundColor: "#fff", borderRadius: 28, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  chooserHandle: { width: 48, height: 5, borderRadius: 999, backgroundColor: "#CBD5E1", alignSelf: "center", marginBottom: 12 },
  chooserTitle: { color: "#111827", fontSize: 21, fontWeight: "900", textAlign: "right" },
  chooserSubtitle: { color: "#64748B", fontWeight: "800", textAlign: "right", marginTop: 7, lineHeight: 22, marginBottom: 12 },
  chooserOption: { backgroundColor: "#F8FAFC", borderRadius: 20, padding: 13, flexDirection: "row-reverse", alignItems: "center", gap: 11, marginBottom: 9, borderWidth: 1, borderColor: "#E2E8F0" },
  chooserIconBox: { width: 48, height: 48, borderRadius: 18, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  chooserTextBox: { flex: 1, alignItems: "flex-end" },
  chooserOptionTitle: { color: "#111827", fontWeight: "900", fontSize: 16, textAlign: "right" },
  chooserOptionText: { color: "#64748B", fontWeight: "800", fontSize: 12, textAlign: "right", lineHeight: 19, marginTop: 3 },
  cancelChooserButton: { backgroundColor: "#F1F5F9", borderRadius: 17, padding: 13, alignItems: "center", marginTop: 4 },
  cancelChooserText: { color: "#334155", fontWeight: "900" },
});
