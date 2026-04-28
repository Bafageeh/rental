import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGetScoped, apiPost } from "../lib/api";
import InlineEditDeleteActions from "../components/InlineEditDeleteActions";
import { SafeAreaView } from "react-native-safe-area-context";

type ServiceProvider = {
  id: number;
  name?: string | null;
  provider_type?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  email?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
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
  status?: string | null;
  request_date?: string | null;
  scheduled_date?: string | null;
  property_name?: string | null;
  unit_number?: string | null;
  tenant_name?: string | null;
  service_provider_id?: number | null;
  service_provider_name?: string | null;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  description?: string | null;
};

function providerTypeLabel(value?: string | null) {
  if (value === "plumbing") return "سباكة";
  if (value === "electricity") return "كهرباء";
  if (value === "ac") return "مكيفات";
  if (value === "cleaning") return "نظافة";
  if (value === "security") return "حراسة";
  if (value === "internet") return "إنترنت";
  if (value === "elevator") return "مصاعد";
  if (value === "general") return "عام";
  return value || "-";
}

function priorityLabel(value?: string | null) {
  if (value === "urgent") return "طارئ";
  if (value === "high") return "عالي";
  if (value === "normal") return "عادي";
  if (value === "low") return "منخفض";
  return value || "-";
}

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

export default function ServiceProvidersScreen() {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null);

  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState("general");
  const [phone, setPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [defaultVisitFee, setDefaultVisitFee] = useState("");
  const [rating, setRating] = useState("5");
  const [isPreferred, setIsPreferred] = useState(false);
  const [notes, setNotes] = useState("");

  const [assignRequestId, setAssignRequestId] = useState<number | null>(null);
  const [assignProviderId, setAssignProviderId] = useState<number | null>(null);

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/service-providers/data",
        "/my/service-providers/data"
      );

      setProviders(Array.isArray(result.providers) ? result.providers : []);
      setMaintenance(Array.isArray(result.maintenance_requests) ? result.maintenance_requests : []);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل مقدمي الخدمة");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingProvider(null);
    setName("");
    setProviderType("general");
    setPhone("");
    setAlternatePhone("");
    setEmail("");
    setCity("");
    setDistrict("");
    setDefaultVisitFee("");
    setRating("5");
    setIsPreferred(false);
    setNotes("");
  }

  function startEdit(provider: ServiceProvider) {
    setEditingProvider(provider);
    setName(provider.name || "");
    setProviderType(provider.provider_type || "general");
    setPhone(provider.phone || "");
    setAlternatePhone(provider.alternate_phone || "");
    setEmail(provider.email || "");
    setCity(provider.city || "");
    setDistrict(provider.district || "");
    setDefaultVisitFee(String(provider.default_visit_fee || ""));
    setRating(String(provider.rating || "5"));
    setIsPreferred(Boolean(provider.is_preferred));
    setNotes(provider.notes || "");
    setShowForm(true);
  }

  async function saveProvider() {
    if (!name.trim()) {
      Alert.alert("تنبيه", "اكتب اسم مقدم الخدمة");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: name.trim(),
        provider_type: providerType,
        phone: phone.trim() || null,
        alternate_phone: alternatePhone.trim() || null,
        email: email.trim() || null,
        city: city.trim() || null,
        district: district.trim() || null,
        default_visit_fee: Number(defaultVisitFee || 0),
        rating: rating ? Number(rating) : null,
        is_preferred: isPreferred,
        is_active: true,
        notes: notes.trim() || null,
      };

      if (editingProvider) {
        await apiPost(`/service-providers/${editingProvider.id}/update`, payload);
      } else {
        await apiPost("/service-providers", payload);
      }

      Alert.alert("تم", editingProvider ? "تم تحديث مقدم الخدمة" : "تم إضافة مقدم الخدمة");
      resetForm();
      setShowForm(false);
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ مقدم الخدمة");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(provider: ServiceProvider) {
    try {
      await apiPost(`/service-providers/${provider.id}/toggle-active`);
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تغيير حالة مقدم الخدمة");
    }
  }

  async function togglePreferred(provider: ServiceProvider) {
    try {
      await apiPost(`/service-providers/${provider.id}/toggle-preferred`);
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تغيير تفضيل مقدم الخدمة");
    }
  }

  async function assignProvider() {
    if (!assignRequestId) {
      Alert.alert("تنبيه", "اختر طلب صيانة");
      return;
    }

    try {
      await apiPost(`/maintenance-requests/${assignRequestId}/assign-provider`, {
        service_provider_id: assignProviderId,
      });

      Alert.alert("تم", "تم ربط مقدم الخدمة بطلب الصيانة");
      setAssignRequestId(null);
      setAssignProviderId(null);
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر ربط مقدم الخدمة");
    }
  }

  async function callProvider(provider: ServiceProvider) {
    const number = provider.phone || provider.alternate_phone;

    if (!number) {
      Alert.alert("تنبيه", "لا يوجد رقم اتصال");
      return;
    }

    const url = `tel:${number}`;
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      Alert.alert("تنبيه", "تعذر فتح الاتصال من هذا الجهاز");
      return;
    }

    await Linking.openURL(url);
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
    load();
  }, []);

  const activeProviders = providers.filter((item) => item.is_active);
  const preferredProviders = providers.filter((item) => item.is_preferred);
  const unassignedOpen = maintenance.filter((item) => !item.service_provider_id);

  const providerTypes = [
    { value: "general", label: "عام" },
    { value: "plumbing", label: "سباكة" },
    { value: "electricity", label: "كهرباء" },
    { value: "ac", label: "مكيفات" },
    { value: "cleaning", label: "نظافة" },
    { value: "security", label: "حراسة" },
    { value: "internet", label: "إنترنت" },
    { value: "elevator", label: "مصاعد" },
  ];

  const selectedRequest = useMemo(() => {
    return maintenance.find((item) => item.id === assignRequestId);
  }, [maintenance, assignRequestId]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>مقدمو الخدمة</Text>
        <Text style={styles.subtitle}>
          سجل مقاولي الصيانة والخدمات مع ربطهم بطلبات الصيانة المفتوحة
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>إجمالي مقدمي الخدمة: {providers.length}</Text>
          <Text style={styles.summaryText}>النشطون: {activeProviders.length}</Text>
          <Text style={styles.summaryText}>المفضلون: {preferredProviders.length}</Text>
          <Text style={styles.summaryText}>طلبات صيانة مفتوحة: {maintenance.length}</Text>
          <Text style={styles.summaryText}>طلبات غير مسندة: {unassignedOpen.length}</Text>
        </View>

        <View style={styles.topActionsRow}>
<TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              resetForm();
              setShowForm(!showForm);
            }}
          >
            <Text style={styles.primaryButtonText}>
              {showForm ? "إغلاق النموذج" : "إضافة مقدم خدمة"}
            </Text>
          </TouchableOpacity>
        </View>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingProvider ? "تعديل مقدم خدمة" : "مقدم خدمة جديد"}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="اسم مقدم الخدمة / المؤسسة"
              value={name}
              onChangeText={setName}
              textAlign="right"
            />

            <Text style={styles.label}>نوع الخدمة</Text>
            <View style={styles.chips}>
              {providerTypes.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.chip, providerType === item.value ? styles.chipActive : null]}
                  onPress={() => setProviderType(item.value)}
                >
                  <Text style={[styles.chipText, providerType === item.value ? styles.chipTextActive : null]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput style={styles.input} placeholder="رقم الجوال" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textAlign="right" />
            <TextInput style={styles.input} placeholder="رقم بديل" value={alternatePhone} onChangeText={setAlternatePhone} keyboardType="phone-pad" textAlign="right" />
            <TextInput style={styles.input} placeholder="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" textAlign="right" />

            <View style={styles.twoColumns}>
              <TextInput style={[styles.input, styles.halfInput]} placeholder="المدينة" value={city} onChangeText={setCity} textAlign="right" />
              <TextInput style={[styles.input, styles.halfInput]} placeholder="الحي" value={district} onChangeText={setDistrict} textAlign="right" />
            </View>

            <View style={styles.twoColumns}>
              <TextInput style={[styles.input, styles.halfInput]} placeholder="رسوم الزيارة" value={defaultVisitFee} onChangeText={setDefaultVisitFee} keyboardType="number-pad" textAlign="right" />
              <TextInput style={[styles.input, styles.halfInput]} placeholder="التقييم 1-5" value={rating} onChangeText={setRating} keyboardType="number-pad" textAlign="right" />
            </View>

            <TouchableOpacity
              style={[styles.preferredToggle, isPreferred ? styles.preferredToggleActive : null]}
              onPress={() => setIsPreferred(!isPreferred)}
            >
              <Text style={[styles.preferredToggleText, isPreferred ? styles.preferredToggleTextActive : null]}>
                {isPreferred ? "مقدم خدمة مفضل" : "اجعله مقدم خدمة مفضل"}
              </Text>
            </TouchableOpacity>

            <TextInput style={[styles.input, styles.multilineInput]} placeholder="ملاحظات" value={notes} onChangeText={setNotes} multiline textAlign="right" />

            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => { resetForm(); setShowForm(false); }}>
                <Text style={styles.actionText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.saveButton]} onPress={saveProvider} disabled={saving}>
                <Text style={styles.actionText}>{saving ? "جاري الحفظ..." : "حفظ"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {maintenance.length > 0 ? (
          <View style={styles.assignCard}>
            <Text style={styles.sectionTitle}>إسناد طلب صيانة</Text>

            <Text style={styles.label}>طلب الصيانة</Text>
            <View style={styles.chips}>
              {maintenance.slice(0, 20).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.chip, assignRequestId === item.id ? styles.chipActive : null]}
                  onPress={() => setAssignRequestId(item.id)}
                >
                  <Text style={[styles.chipText, assignRequestId === item.id ? styles.chipTextActive : null]}>
                    #{item.id} {item.title || "صيانة"} — {priorityLabel(item.priority)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedRequest ? (
              <Text style={styles.assignHint}>
                {selectedRequest.property_name || "-"} — {selectedRequest.unit_number || "-"} — الحالي: {selectedRequest.service_provider_name || "غير مسند"}
              </Text>
            ) : null}

            <Text style={styles.label}>مقدم الخدمة</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, assignProviderId === null ? styles.chipActive : null]}
                onPress={() => setAssignProviderId(null)}
              >
                <Text style={[styles.chipText, assignProviderId === null ? styles.chipTextActive : null]}>
                  إلغاء الإسناد
                </Text>
              </TouchableOpacity>

              {activeProviders.map((provider) => (
                <TouchableOpacity
                  key={provider.id}
                  style={[styles.chip, assignProviderId === provider.id ? styles.chipActive : null]}
                  onPress={() => setAssignProviderId(provider.id)}
                >
                  <Text style={[styles.chipText, assignProviderId === provider.id ? styles.chipTextActive : null]}>
                    {provider.name || "مقدم خدمة"} {provider.is_preferred ? "★" : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.assignButton} onPress={assignProvider}>
              <Text style={styles.assignButtonText}>حفظ الإسناد</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل مقدمي الخدمة...</Text>
          </View>
        ) : null}

        {!loading && providers.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا يوجد مقدمو خدمة حاليًا</Text>
          </View>
        ) : null}

        {providers.map((provider) => (
          <View key={provider.id} style={styles.card}>
            <InlineEditDeleteActions resource="service_providers" id={provider.id} onChanged={load} />
            <View style={styles.rowBetween}>
              <Text style={[styles.statusBadge, provider.is_active ? styles.statusActive : styles.statusInactive]}>
                {provider.is_active ? "نشط" : "معطل"}
              </Text>
              <Text style={styles.cardTitle}>
                {provider.name || "مقدم خدمة"} {provider.is_preferred ? "★" : ""}
              </Text>
            </View>

            <Text style={styles.detail}>النوع: {providerTypeLabel(provider.provider_type)}</Text>
            <Text style={styles.detail}>الجوال: {provider.phone || "-"}</Text>
            <Text style={styles.detail}>رقم بديل: {provider.alternate_phone || "-"}</Text>
            <Text style={styles.detail}>البريد: {provider.email || "-"}</Text>
            <Text style={styles.detail}>الموقع: {provider.city || "-"} / {provider.district || "-"}</Text>
            <Text style={styles.detail}>رسوم الزيارة: {money(provider.default_visit_fee)}</Text>
            <Text style={styles.detail}>التقييم: {provider.rating || "-"}/5</Text>
            <Text style={styles.detail}>طلبات مفتوحة مسندة: {provider.open_maintenance_requests_count ?? 0}</Text>
            {provider.notes ? <Text style={styles.notes}>ملاحظات: {provider.notes}</Text> : null}

            <View style={styles.itemActionsRow}>
              <TouchableOpacity style={[styles.itemButton, styles.callButton]} onPress={() => callProvider(provider)}>
                <Text style={styles.itemButtonText}>اتصال</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.itemButton, styles.editButton]} onPress={() => startEdit(provider)}>
                <Text style={styles.itemButtonText}>تعديل</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.itemButton, styles.favoriteButton]} onPress={() => togglePreferred(provider)}>
                <Text style={styles.itemButtonText}>تفضيل</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.itemButton, provider.is_active ? styles.disableButton : styles.enableButton]}
                onPress={() => toggleActive(provider)}
              >
                <Text style={styles.itemButtonText}>{provider.is_active ? "تعطيل" : "تفعيل"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            استخدم هذه الشاشة لتكوين دليل مقاولي الصيانة والخدمات ثم إسناد طلبات الصيانة المفتوحة لهم.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 12, paddingBottom: 50 },
  title: { fontSize: 30, fontWeight: "900", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", fontSize: 15, textAlign: "right", lineHeight: 22 },
  summaryBox: { backgroundColor: "#111827", borderRadius: 14, padding: 12, marginBottom: 9 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  topActionsRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 9 },
  primaryButton: { flex: 1, backgroundColor: "#0F9B6F", padding: 13, borderRadius: 14, alignItems: "center" },
  addButton: { flex: 1, backgroundColor: "#16a34a", padding: 13, borderRadius: 14, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "900" },
  formCard: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 9 },
  assignCard: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 9 },
  formTitle: { fontSize: 16, fontWeight: "900", color: "#111827", textAlign: "right", marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827", textAlign: "right", marginBottom: 8 },
  label: { color: "#374151", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 8 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "800" },
  chipTextActive: { color: "#fff" },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  multilineInput: { minHeight: 70, textAlignVertical: "top" },
  twoColumns: { flexDirection: "row-reverse", gap: 8 },
  halfInput: { flex: 1 },
  preferredToggle: { backgroundColor: "#eff6ff", borderRadius: 12, padding: 12, alignItems: "center", marginBottom: 10 },
  preferredToggleActive: { backgroundColor: "#16a34a" },
  preferredToggleText: { color: "#065F44", fontWeight: "900" },
  preferredToggleTextActive: { color: "#fff" },
  actionsRow: { flexDirection: "row-reverse", marginTop: 8 },
  actionButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  cancelButton: { backgroundColor: "#7A766F" },
  saveButton: { backgroundColor: "#16a34a" },
  actionText: { color: "#fff", fontWeight: "900" },
  assignHint: { backgroundColor: "#eff6ff", color: "#065F44", fontWeight: "800", textAlign: "right", padding: 10, borderRadius: 12, marginBottom: 10 },
  assignButton: { backgroundColor: "#0F9B6F", padding: 13, borderRadius: 12, alignItems: "center" },
  assignButtonText: { color: "#fff", fontWeight: "900" },
  box: { backgroundColor: "#fff", padding: 12, borderRadius: 14, alignItems: "center", marginBottom: 8 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  statusActive: { backgroundColor: "#dcfce7", color: "#166534" },
  statusInactive: { backgroundColor: "#fee2e2", color: "#991b1b" },
  cardTitle: { color: "#111827", fontSize: 16, fontWeight: "900", textAlign: "right", flex: 1 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  notes: { marginTop: 10, color: "#92400e", fontWeight: "700", textAlign: "right", lineHeight: 22 },
  itemActionsRow: { flexDirection: "row-reverse", marginTop: 14 },
  itemButton: { flex: 1, padding: 11, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  callButton: { backgroundColor: "#16a34a" },
  editButton: { backgroundColor: "#0F9B6F" },
  favoriteButton: { backgroundColor: "#111827" },
  disableButton: { backgroundColor: "#dc2626" },
  enableButton: { backgroundColor: "#16a34a" },
  itemButtonText: { color: "#fff", fontWeight: "900" },
  noteBox: { backgroundColor: "#fffbeb", borderRadius: 14, padding: 10, marginTop: 4 },
  noteText: { color: "#92400e", fontWeight: "700", textAlign: "right", lineHeight: 22 },
});
