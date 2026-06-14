import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { apiGetScoped, apiPost } from "../lib/api";

type ServiceProvider = {
  id: number;
  name?: string | null;
  provider_type?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  email?: string | null;
  city?: string | null;
  district?: string | null;
  default_visit_fee?: number | string | null;
  rating?: number | null;
  is_preferred?: boolean;
  is_active?: boolean;
  notes?: string | null;
  maintenance_requests_count?: number;
  open_maintenance_requests_count?: number;
};

type MaintenanceItem = {
  id: number;
  title?: string | null;
  priority?: string | null;
  property_name?: string | null;
  unit_number?: string | null;
  service_provider_id?: number | null;
  service_provider_name?: string | null;
};

const providerTypes = [
  { value: "general", label: "عام", icon: "construct-outline" as const },
  { value: "plumbing", label: "سباكة", icon: "water-outline" as const },
  { value: "electricity", label: "كهرباء", icon: "flash-outline" as const },
  { value: "ac", label: "مكيفات", icon: "snow-outline" as const },
  { value: "cleaning", label: "نظافة", icon: "sparkles-outline" as const },
  { value: "security", label: "حراسة", icon: "shield-checkmark-outline" as const },
  { value: "internet", label: "إنترنت", icon: "wifi-outline" as const },
  { value: "elevator", label: "مصاعد", icon: "swap-vertical-outline" as const },
];

function providerTypeLabel(value?: string | null) {
  return providerTypes.find((item) => item.value === value)?.label || value || "عام";
}

function providerIcon(value?: string | null) {
  return providerTypes.find((item) => item.value === value)?.icon || "construct-outline";
}

function priorityLabel(value?: string | null) {
  if (value === "urgent") return "طارئ";
  if (value === "high") return "عالي";
  if (value === "low") return "منخفض";
  return "عادي";
}

function money(value: unknown) {
  const number = Number(String(value ?? 0).replace(/,/g, ""));
  return `${Math.round(Number.isFinite(number) ? number : 0).toLocaleString("ar-SA")} ريال`;
}

function val(value?: string | null) {
  return value && String(value).trim() ? String(value).trim() : "-";
}

function isManagerRole(user: any) {
  return String(user?.role ?? "").trim().toLowerCase() === "manager";
}

function SummaryTile({ label, value, icon, danger = false }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; danger?: boolean }) {
  return (
    <View style={[styles.summaryTile, danger ? styles.summaryTileDanger : null]}>
      <View style={[styles.summaryIcon, danger ? styles.summaryIconDanger : null]}>
        <Ionicons name={icon} size={19} color={danger ? "#DC2626" : "#0F766E"} />
      </View>
      <Text style={[styles.summaryValue, danger ? styles.summaryValueDanger : null]}>{value.toLocaleString("ar-SA")}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

export default function ServiceProvidersScreen() {
  const { loading: authLoading, loggedIn, user } = useAuth();
  const isManager = loggedIn && isManagerRole(user);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null);
  const [openProviderId, setOpenProviderId] = useState<number | null>(null);
  const [assignRequestId, setAssignRequestId] = useState<number | null>(null);
  const [assignProviderId, setAssignProviderId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", provider_type: "general", phone: "", alternate_phone: "", email: "", city: "", district: "", default_visit_fee: "", rating: "5", is_preferred: false, notes: "" });

  const activeProviders = useMemo(() => providers.filter((item) => item.is_active), [providers]);
  const preferredProviders = useMemo(() => providers.filter((item) => item.is_preferred), [providers]);
  const unassignedOpen = useMemo(() => maintenance.filter((item) => !item.service_provider_id), [maintenance]);
  const selectedRequest = useMemo(() => maintenance.find((item) => item.id === assignRequestId), [maintenance, assignRequestId]);

  function setField(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEditingProvider(null);
    setForm({ name: "", provider_type: "general", phone: "", alternate_phone: "", email: "", city: "", district: "", default_visit_fee: "", rating: "5", is_preferred: false, notes: "" });
  }

  async function load() {
    if (!isManager) return;
    try {
      setLoading(true);
      const result = await apiGetScoped("/service-providers/data", "/my/service-providers/data");
      setProviders(Array.isArray(result.providers) ? result.providers : []);
      setMaintenance(Array.isArray(result.maintenance_requests) ? result.maintenance_requests : []);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل مقدمي الخدمة");
    } finally {
      setLoading(false);
    }
  }

  async function refreshScreen() {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!isManager) {
      setLoading(false);
      return;
    }
    void load();
  }, [authLoading, isManager]);

  function openAddForm() {
    resetForm();
    setOpenProviderId(null);
    setShowForm(true);
  }

  function startEdit(provider: ServiceProvider) {
    setEditingProvider(provider);
    setOpenProviderId(null);
    setForm({
      name: provider.name || "",
      provider_type: provider.provider_type || "general",
      phone: provider.phone || "",
      alternate_phone: provider.alternate_phone || "",
      email: provider.email || "",
      city: provider.city || "",
      district: provider.district || "",
      default_visit_fee: String(provider.default_visit_fee || ""),
      rating: String(provider.rating || "5"),
      is_preferred: Boolean(provider.is_preferred),
      notes: provider.notes || "",
    });
    setShowForm(true);
  }

  async function saveProvider() {
    if (!form.name.trim()) {
      Alert.alert("تنبيه", "اكتب اسم مقدم الخدمة");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        provider_type: form.provider_type,
        phone: form.phone.trim() || null,
        alternate_phone: form.alternate_phone.trim() || null,
        email: form.email.trim() || null,
        city: form.city.trim() || null,
        district: form.district.trim() || null,
        default_visit_fee: Number(form.default_visit_fee || 0),
        rating: form.rating ? Number(form.rating) : null,
        is_preferred: form.is_preferred,
        is_active: true,
        notes: form.notes.trim() || null,
      };

      if (editingProvider) await apiPost(`/service-providers/${editingProvider.id}/update`, payload);
      else await apiPost("/service-providers", payload);

      Alert.alert("تم", editingProvider ? "تم تحديث مقدم الخدمة" : "تم إضافة مقدم الخدمة");
      resetForm();
      setShowForm(false);
      await load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ مقدم الخدمة");
    } finally {
      setSaving(false);
    }
  }

  async function callProvider(provider: ServiceProvider) {
    const number = provider.phone || provider.alternate_phone;
    if (!number) {
      Alert.alert("تنبيه", "لا يوجد رقم اتصال");
      return;
    }
    const url = `tel:${number}`;
    if (!(await Linking.canOpenURL(url))) {
      Alert.alert("تنبيه", "تعذر فتح الاتصال من هذا الجهاز");
      return;
    }
    await Linking.openURL(url);
  }

  async function toggleActive(provider: ServiceProvider) {
    try {
      await apiPost(`/service-providers/${provider.id}/toggle-active`);
      await load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تغيير الحالة");
    }
  }

  async function togglePreferred(provider: ServiceProvider) {
    try {
      await apiPost(`/service-providers/${provider.id}/toggle-preferred`);
      await load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تغيير التفضيل");
    }
  }

  async function assignProvider() {
    if (!assignRequestId) {
      Alert.alert("تنبيه", "اختر طلب صيانة");
      return;
    }
    try {
      await apiPost(`/maintenance-requests/${assignRequestId}/assign-provider`, { service_provider_id: assignProviderId });
      Alert.alert("تم", "تم تحديث إسناد طلب الصيانة");
      setAssignRequestId(null);
      setAssignProviderId(null);
      await load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر ربط مقدم الخدمة");
    }
  }

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: "مقدمو الخدمة" }} />
        <View style={styles.centerBox}><ActivityIndicator /><Text style={styles.centerText}>جاري تحميل مقدمي الخدمة...</Text></View>
      </SafeAreaView>
    );
  }

  if (!isManager) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: "مقدمو الخدمة" }} />
        <View style={styles.centerBox}>
          <Ionicons name="lock-closed-outline" size={42} color="#DC2626" />
          <Text style={styles.lockTitle}>خاص بمدير العقارات فقط</Text>
          <Text style={styles.centerText}>هذه الشاشة لإدارة مقدمي الخدمة وربطهم بطلبات الصيانة الخاصة بمدير العقارات.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/more" as never)}><Text style={styles.backButtonText}>رجوع</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: "مقدمو الخدمة" }} />
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.addTopButton} onPress={openAddForm} activeOpacity={0.88}><Ionicons name="add" size={23} color="#fff" /><Text style={styles.addTopText}>إضافة</Text></TouchableOpacity>
          <View style={styles.headerTextBox}>
            <Text style={styles.title}>مقدمو الخدمة</Text>
            <Text style={styles.subtitle}>دليل مقاولي الصيانة والخدمات، خاص ببيانات مدير العقارات فقط.</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryTile icon="people-outline" label="الإجمالي" value={providers.length} />
          <SummaryTile icon="checkmark-circle-outline" label="النشطون" value={activeProviders.length} />
          <SummaryTile icon="star-outline" label="المفضلون" value={preferredProviders.length} />
          <SummaryTile icon="alert-circle-outline" label="غير مسندة" value={unassignedOpen.length} danger={unassignedOpen.length > 0} />
        </View>

        {maintenance.length > 0 ? (
          <View style={styles.assignCard}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>إسناد طلب صيانة</Text><Text style={styles.sectionHint}>اختر طلبًا ثم مقدم خدمة</Text></View>
            <View style={styles.chips}>{maintenance.slice(0, 12).map((item) => <TouchableOpacity key={item.id} style={[styles.chip, assignRequestId === item.id ? styles.chipActive : null]} onPress={() => setAssignRequestId(item.id)}><Text style={[styles.chipText, assignRequestId === item.id ? styles.chipTextActive : null]}>#{item.id} {item.title || "صيانة"} - {priorityLabel(item.priority)}</Text></TouchableOpacity>)}</View>
            {selectedRequest ? <Text style={styles.assignHint}>{selectedRequest.property_name || "-"} - {selectedRequest.unit_number || "-"} - الحالي: {selectedRequest.service_provider_name || "غير مسند"}</Text> : null}
            <View style={styles.chips}>
              <TouchableOpacity style={[styles.chip, assignProviderId === null ? styles.chipActive : null]} onPress={() => setAssignProviderId(null)}><Text style={[styles.chipText, assignProviderId === null ? styles.chipTextActive : null]}>إلغاء الإسناد</Text></TouchableOpacity>
              {activeProviders.map((provider) => <TouchableOpacity key={provider.id} style={[styles.chip, assignProviderId === provider.id ? styles.chipActive : null]} onPress={() => setAssignProviderId(provider.id)}><Text style={[styles.chipText, assignProviderId === provider.id ? styles.chipTextActive : null]}>{provider.name || "مقدم خدمة"}{provider.is_preferred ? " ★" : ""}</Text></TouchableOpacity>)}
            </View>
            <TouchableOpacity style={styles.assignButton} onPress={assignProvider}><Text style={styles.assignButtonText}>حفظ الإسناد</Text></TouchableOpacity>
          </View>
        ) : null}

        {providers.length === 0 ? <View style={styles.emptyBox}><Text style={styles.emptyText}>لا يوجد مقدمو خدمة حاليًا</Text><Text style={styles.emptyHint}>اضغط إضافة لإنشاء أول مقدم خدمة.</Text></View> : null}

        {providers.map((provider) => (
          <View key={provider.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.iconButton} onPress={() => setOpenProviderId(openProviderId === provider.id ? null : provider.id)}><Ionicons name="ellipsis-vertical" size={20} color="#0F172A" /></TouchableOpacity>
                <TouchableOpacity style={styles.iconButtonGreen} onPress={() => callProvider(provider)}><Ionicons name="call-outline" size={19} color="#0F766E" /></TouchableOpacity>
              </View>
              <View style={styles.providerTitleBox}>
                <Text style={styles.cardTitle}>{provider.name || "مقدم خدمة"}{provider.is_preferred ? " ★" : ""}</Text>
                <Text style={styles.cardSubtitle}>{providerTypeLabel(provider.provider_type)} • {provider.is_active ? "نشط" : "معطل"}</Text>
              </View>
              <View style={styles.providerIcon}><Ionicons name={providerIcon(provider.provider_type)} size={24} color="#0F766E" /></View>
            </View>
            {openProviderId === provider.id ? (
              <View style={styles.menuBox}>
                <TouchableOpacity style={styles.menuItem} onPress={() => startEdit(provider)}><Ionicons name="create-outline" size={18} color="#0F766E" /><Text style={styles.menuText}>تعديل</Text></TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => togglePreferred(provider)}><Ionicons name="star-outline" size={18} color="#0F766E" /><Text style={styles.menuText}>{provider.is_preferred ? "إلغاء التفضيل" : "تفضيل"}</Text></TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => toggleActive(provider)}><Ionicons name={provider.is_active ? "pause-circle-outline" : "checkmark-circle-outline"} size={18} color={provider.is_active ? "#DC2626" : "#0F766E"} /><Text style={[styles.menuText, provider.is_active ? styles.menuDanger : null]}>{provider.is_active ? "تعطيل" : "تفعيل"}</Text></TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.infoGrid}>
              <InfoLine icon="call-outline" label="الجوال" value={val(provider.phone)} />
              <InfoLine icon="mail-outline" label="البريد" value={val(provider.email)} />
              <InfoLine icon="location-outline" label="الموقع" value={`${val(provider.city)} / ${val(provider.district)}`} />
              <InfoLine icon="cash-outline" label="رسوم الزيارة" value={money(provider.default_visit_fee)} />
            </View>
            <View style={styles.providerStatsRow}>
              <Text style={styles.smallStat}>طلبات مفتوحة: {provider.open_maintenance_requests_count ?? 0}</Text>
              <Text style={styles.smallStat}>التقييم: {provider.rating || "-"}/5</Text>
            </View>
            {provider.notes ? <Text style={styles.notes}>ملاحظات: {provider.notes}</Text> : null}
          </View>
        ))}
        <View style={{ height: 72 }} />
      </ScrollView>

      <Modal visible={showForm} transparent animationType="fade" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalLayer}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowForm(false)} />
          <View style={styles.formCard}>
            <View style={styles.formHeader}><TouchableOpacity style={styles.closeButton} onPress={() => setShowForm(false)}><Ionicons name="close" size={20} color="#0F172A" /></TouchableOpacity><Text style={styles.formTitle}>{editingProvider ? "تعديل مقدم خدمة" : "مقدم خدمة جديد"}</Text></View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
              <TextInput style={styles.input} placeholder="اسم مقدم الخدمة / المؤسسة" value={form.name} onChangeText={(text) => setField("name", text)} textAlign="right" />
              <Text style={styles.label}>نوع الخدمة</Text>
              <View style={styles.chips}>{providerTypes.map((item) => <TouchableOpacity key={item.value} style={[styles.chip, form.provider_type === item.value ? styles.chipActive : null]} onPress={() => setField("provider_type", item.value)}><Text style={[styles.chipText, form.provider_type === item.value ? styles.chipTextActive : null]}>{item.label}</Text></TouchableOpacity>)}</View>
              <TextInput style={styles.input} placeholder="رقم الجوال" value={form.phone} onChangeText={(text) => setField("phone", text)} keyboardType="phone-pad" textAlign="right" />
              <TextInput style={styles.input} placeholder="رقم بديل" value={form.alternate_phone} onChangeText={(text) => setField("alternate_phone", text)} keyboardType="phone-pad" textAlign="right" />
              <TextInput style={styles.input} placeholder="البريد الإلكتروني" value={form.email} onChangeText={(text) => setField("email", text)} keyboardType="email-address" autoCapitalize="none" textAlign="right" />
              <View style={styles.twoColumns}><TextInput style={[styles.input, styles.halfInput]} placeholder="المدينة" value={form.city} onChangeText={(text) => setField("city", text)} textAlign="right" /><TextInput style={[styles.input, styles.halfInput]} placeholder="الحي" value={form.district} onChangeText={(text) => setField("district", text)} textAlign="right" /></View>
              <View style={styles.twoColumns}><TextInput style={[styles.input, styles.halfInput]} placeholder="رسوم الزيارة" value={form.default_visit_fee} onChangeText={(text) => setField("default_visit_fee", text)} keyboardType="decimal-pad" textAlign="right" /><TextInput style={[styles.input, styles.halfInput]} placeholder="التقييم 1-5" value={form.rating} onChangeText={(text) => setField("rating", text)} keyboardType="number-pad" textAlign="right" /></View>
              <TouchableOpacity style={[styles.preferredToggle, form.is_preferred ? styles.preferredToggleActive : null]} onPress={() => setField("is_preferred", !form.is_preferred)}><Ionicons name="star-outline" size={18} color={form.is_preferred ? "#fff" : "#0F766E"} /><Text style={[styles.preferredToggleText, form.is_preferred ? styles.preferredToggleTextActive : null]}>{form.is_preferred ? "مقدم خدمة مفضل" : "اجعله مقدم خدمة مفضل"}</Text></TouchableOpacity>
              <TextInput style={[styles.input, styles.multilineInput]} placeholder="ملاحظات" value={form.notes} onChangeText={(text) => setField("notes", text)} multiline textAlign="right" />
              <TouchableOpacity style={styles.saveButton} onPress={saveProvider} disabled={saving}><Text style={styles.saveButtonText}>{saving ? "جاري الحفظ..." : "حفظ"}</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InfoLine({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.infoLine}><View style={styles.infoIcon}><Ionicons name={icon} size={15} color="#0F766E" /></View><View style={styles.infoTextBox}><Text style={styles.infoLabel}>{label}</Text><Text numberOfLines={1} style={styles.infoValue}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8F6" },
  container: { padding: 14, paddingBottom: 44 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  centerText: { marginTop: 10, color: "#64748B", fontWeight: "800", textAlign: "center", lineHeight: 22 },
  lockTitle: { color: "#111827", fontWeight: "900", fontSize: 20, marginTop: 14 },
  backButton: { marginTop: 18, backgroundColor: "#0F766E", borderRadius: 16, paddingHorizontal: 28, paddingVertical: 12 },
  backButtonText: { color: "#fff", fontWeight: "900" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  addTopButton: { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: "#0F9B6F", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 },
  addTopText: { color: "#fff", fontWeight: "900" },
  headerTextBox: { flex: 1, alignItems: "flex-end" },
  title: { fontSize: 27, fontWeight: "900", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 5, color: "#64748B", fontSize: 13, textAlign: "right", lineHeight: 20, fontWeight: "800" },
  summaryGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  summaryTile: { width: "48.6%", backgroundColor: "#fff", borderRadius: 18, padding: 12, minHeight: 92, borderWidth: 1, borderColor: "#E6EEE9", alignItems: "center", justifyContent: "center" },
  summaryTileDanger: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" },
  summaryIcon: { width: 36, height: 36, borderRadius: 15, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  summaryIconDanger: { backgroundColor: "#FEE2E2" },
  summaryValue: { color: "#111827", fontWeight: "900", fontSize: 20 },
  summaryValueDanger: { color: "#DC2626" },
  summaryLabel: { color: "#64748B", fontWeight: "900", marginTop: 2, fontSize: 12 },
  sectionHeader: { alignItems: "flex-end", marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: "#111827", textAlign: "right" },
  sectionHint: { color: "#64748B", fontWeight: "800", marginTop: 3, fontSize: 12 },
  assignCard: { backgroundColor: "#fff", borderRadius: 22, padding: 13, marginBottom: 12, borderWidth: 1, borderColor: "#E6EEE9" },
  assignHint: { color: "#0F766E", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  assignButton: { backgroundColor: "#0F766E", borderRadius: 15, padding: 12, alignItems: "center", marginTop: 4 },
  assignButtonText: { color: "#fff", fontWeight: "900" },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginBottom: 10 },
  chip: { backgroundColor: "#F3F4F6", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: "#F3F4F6" },
  chipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  chipText: { color: "#374151", fontWeight: "900" },
  chipTextActive: { color: "#fff" },
  emptyBox: { backgroundColor: "#fff", borderRadius: 22, padding: 20, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#E6EEE9" },
  emptyText: { color: "#111827", fontWeight: "900", fontSize: 16 },
  emptyHint: { color: "#64748B", fontWeight: "800", marginTop: 6 },
  card: { backgroundColor: "#fff", borderRadius: 22, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E6EEE9", shadowColor: "#0F172A", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardActions: { flexDirection: "row", gap: 7 },
  iconButton: { width: 40, height: 40, borderRadius: 18, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  iconButtonGreen: { width: 40, height: 40, borderRadius: 18, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0", alignItems: "center", justifyContent: "center" },
  providerTitleBox: { flex: 1, alignItems: "flex-end" },
  providerIcon: { width: 48, height: 48, borderRadius: 19, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  cardTitle: { color: "#111827", fontSize: 19, fontWeight: "900", textAlign: "right" },
  cardSubtitle: { color: "#64748B", fontWeight: "800", marginTop: 3, textAlign: "right" },
  menuBox: { marginTop: 10, backgroundColor: "#F8FAFC", borderRadius: 16, padding: 6, flexDirection: "row-reverse", justifyContent: "space-around" },
  menuItem: { flexDirection: "row-reverse", alignItems: "center", gap: 5, padding: 8 },
  menuText: { color: "#0F766E", fontWeight: "900", fontSize: 12 },
  menuDanger: { color: "#DC2626" },
  infoGrid: { marginTop: 11, flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  infoLine: { width: "48.6%", minHeight: 46, backgroundColor: "#FAFAF9", borderRadius: 15, borderWidth: 1, borderColor: "#EEF2F4", paddingHorizontal: 8, flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  infoIcon: { width: 28, height: 28, borderRadius: 12, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  infoTextBox: { flex: 1, alignItems: "flex-end" },
  infoLabel: { color: "#94A3B8", fontWeight: "900", fontSize: 10 },
  infoValue: { color: "#111827", fontWeight: "900", fontSize: 12, marginTop: 2 },
  providerStatsRow: { flexDirection: "row-reverse", gap: 8, marginTop: 10 },
  smallStat: { flex: 1, textAlign: "center", color: "#0F766E", backgroundColor: "#ECFDF5", borderRadius: 999, paddingVertical: 8, fontWeight: "900", overflow: "hidden" },
  notes: { color: "#64748B", fontWeight: "800", textAlign: "right", marginTop: 10, lineHeight: 20 },
  modalLayer: { flex: 1, justifyContent: "center", padding: 16 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.35)" },
  formCard: { maxHeight: "88%", backgroundColor: "#fff", borderRadius: 24, padding: 14, borderWidth: 1, borderColor: "#E6EEE9" },
  formScroll: { paddingBottom: 8 },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  closeButton: { width: 38, height: 38, borderRadius: 18, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  formTitle: { fontSize: 19, fontWeight: "900", color: "#111827", textAlign: "right" },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 15, padding: 12, marginBottom: 10, color: "#111827", fontWeight: "800" },
  label: { color: "#374151", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  twoColumns: { flexDirection: "row", gap: 8 },
  halfInput: { flex: 1 },
  preferredToggle: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#ECFDF5", borderRadius: 15, padding: 12, borderWidth: 1, borderColor: "#A7F3D0", marginBottom: 10 },
  preferredToggleActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" },
  preferredToggleText: { color: "#0F766E", fontWeight: "900" },
  preferredToggleTextActive: { color: "#fff" },
  multilineInput: { minHeight: 78, textAlignVertical: "top" },
  saveButton: { backgroundColor: "#0F9B6F", padding: 13, borderRadius: 15, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "900" },
});
