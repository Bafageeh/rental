import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGetScoped, apiPost } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type Property = {
  id: number;
  name?: string | null;
  owner?: {
    name?: string | null;
  } | null;
};

type Unit = {
  id: number;
  property_id?: number | null;
  unit_number?: string | null;
  property?: Property | null;
};

type Tenant = {
  id: number;
  name?: string | null;
  phone?: string | null;
};

type FollowUpTask = {
  id: number;
  property_id?: number | null;
  unit_id?: number | null;
  tenant_id?: number | null;
  contract_id?: number | null;
  title?: string | null;
  task_type?: string | null;
  priority?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  status?: string | null;
  assigned_to_name?: string | null;
  notes?: string | null;
  property?: Property | null;
  unit?: Unit | null;
  tenant?: Tenant | null;
  contract?: {
    id?: number;
    contract_number?: string | null;
    government_contract_number?: string | null;
    tenant?: Tenant | null;
    unit?: Unit | null;
  } | null;
};

function typeLabel(value?: string | null) {
  if (value === "payment") return "دفعة";
  if (value === "maintenance") return "صيانة";
  if (value === "contract") return "عقد";
  if (value === "tenant") return "مستأجر";
  if (value === "document") return "مستند";
  return "عام";
}

function priorityLabel(value?: string | null) {
  if (value === "low") return "منخفض";
  if (value === "normal") return "عادي";
  if (value === "high") return "عالي";
  if (value === "urgent") return "طارئ";
  return value || "-";
}

function statusLabel(value?: string | null) {
  if (value === "open") return "مفتوحة";
  if (value === "done") return "منجزة";
  if (value === "cancelled") return "ملغاة";
  return value || "-";
}

function priorityStyle(value?: string | null) {
  if (value === "urgent") return styles.priorityUrgent;
  if (value === "high") return styles.priorityHigh;
  if (value === "low") return styles.priorityLow;
  return styles.priorityNormal;
}

export default function FollowUpsScreen() {
  const [items, setItems] = useState<FollowUpTask[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [dueDate, setDueDate] = useState("2026-04-30");
  const [assignedToName, setAssignedToName] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    try {
      setLoading(true);

      const [tasksResult, propertiesResult, unitsResult, tenantsResult] = await Promise.all([
        apiGetScoped("/follow-up-tasks", "/my/follow-up-tasks"),
        apiGetScoped("/properties", "/my/properties"),
        apiGetScoped("/units", "/my/units"),
        apiGetScoped("/tenants", "/my/tenants"),
      ]);

      const propertyList = Array.isArray(propertiesResult) ? propertiesResult : [];
      const unitList = Array.isArray(unitsResult) ? unitsResult : [];

      setItems(Array.isArray(tasksResult) ? tasksResult : []);
      setProperties(propertyList);
      setUnits(unitList);
      setTenants(Array.isArray(tenantsResult) ? tenantsResult : []);

      if (!propertyId && propertyList.length > 0) {
        setPropertyId(propertyList[0].id);
      }
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل المتابعات");
    } finally {
      setLoading(false);
    }
  }

  async function saveTask() {
    if (!title.trim()) {
      Alert.alert("تنبيه", "اكتب عنوان مهمة المتابعة");
      return;
    }

    try {
      setSaving(true);

      await apiPost("/follow-up-tasks", {
        property_id: propertyId,
        unit_id: unitId,
        tenant_id: tenantId,
        title: title.trim(),
        task_type: taskType,
        priority,
        due_date: dueDate.trim() || null,
        assigned_to_name: assignedToName.trim() || null,
        notes: notes.trim() || null,
      });

      setTitle("");
      setAssignedToName("");
      setNotes("");
      setTaskType("general");
      setPriority("normal");
      setUnitId(null);
      setTenantId(null);
      setShowForm(false);

      Alert.alert("تم", "تم إضافة مهمة المتابعة");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ مهمة المتابعة");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: number, status: string) {
    try {
      await apiPost(`/follow-up-tasks/${id}/status`, { status });
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحديث حالة المتابعة");
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
    load();
  }, []);

  const open = items.filter((item) => item.status === "open");
  const urgent = open.filter((item) => item.priority === "urgent" || item.priority === "high");
  const done = items.filter((item) => item.status === "done");

  const typeOptions = [
    { value: "general", label: "عام" },
    { value: "payment", label: "دفعة" },
    { value: "maintenance", label: "صيانة" },
    { value: "contract", label: "عقد" },
    { value: "tenant", label: "مستأجر" },
    { value: "document", label: "مستند" },
  ];

  const priorityOptions = [
    { value: "low", label: "منخفض" },
    { value: "normal", label: "عادي" },
    { value: "high", label: "عالي" },
    { value: "urgent", label: "طارئ" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>المتابعات والمهام</Text>
        <Text style={styles.subtitle}>
          متابعة الأعمال اليومية المرتبطة بالعقارات والعقود والمستأجرين
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>المفتوحة: {open.length}</Text>
          <Text style={styles.summaryText}>العاجلة/العالية: {urgent.length}</Text>
          <Text style={styles.summaryText}>المنجزة: {done.length}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setShowForm(!showForm)}>
          <Text style={styles.primaryButtonText}>
            {showForm ? "إغلاق نموذج الإضافة" : "إضافة متابعة"}
          </Text>
        </TouchableOpacity>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>بيانات المتابعة</Text>

            <Text style={styles.label}>العقار اختياري</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, propertyId === null ? styles.chipActive : null]}
                onPress={() => {
                  setPropertyId(null);
                  setUnitId(null);
                }}
              >
                <Text style={[styles.chipText, propertyId === null ? styles.chipTextActive : null]}>
                  بدون عقار
                </Text>
              </TouchableOpacity>

              {properties.map((property) => (
                <TouchableOpacity
                  key={property.id}
                  style={[styles.chip, propertyId === property.id ? styles.chipActive : null]}
                  onPress={() => {
                    setPropertyId(property.id);
                    setUnitId(null);
                  }}
                >
                  <Text style={[styles.chipText, propertyId === property.id ? styles.chipTextActive : null]}>
                    {property.name || "عقار"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>الوحدة اختياري</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, unitId === null ? styles.chipActive : null]}
                onPress={() => setUnitId(null)}
              >
                <Text style={[styles.chipText, unitId === null ? styles.chipTextActive : null]}>
                  بدون وحدة
                </Text>
              </TouchableOpacity>

              {units
                .filter((unit) => !propertyId || unit.property_id === propertyId || unit.property?.id === propertyId)
                .map((unit) => (
                  <TouchableOpacity
                    key={unit.id}
                    style={[styles.chip, unitId === unit.id ? styles.chipActive : null]}
                    onPress={() => setUnitId(unit.id)}
                  >
                    <Text style={[styles.chipText, unitId === unit.id ? styles.chipTextActive : null]}>
                      {unit.unit_number || "وحدة"}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>المستأجر اختياري</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, tenantId === null ? styles.chipActive : null]}
                onPress={() => setTenantId(null)}
              >
                <Text style={[styles.chipText, tenantId === null ? styles.chipTextActive : null]}>
                  بدون مستأجر
                </Text>
              </TouchableOpacity>

              {tenants.slice(0, 20).map((tenant) => (
                <TouchableOpacity
                  key={tenant.id}
                  style={[styles.chip, tenantId === tenant.id ? styles.chipActive : null]}
                  onPress={() => setTenantId(tenant.id)}
                >
                  <Text style={[styles.chipText, tenantId === tenant.id ? styles.chipTextActive : null]}>
                    {tenant.name || "مستأجر"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="عنوان المهمة"
              value={title}
              onChangeText={setTitle}
              textAlign="right"
            />

            <Text style={styles.label}>نوع المتابعة</Text>
            <View style={styles.chips}>
              {typeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, taskType === option.value ? styles.chipActive : null]}
                  onPress={() => setTaskType(option.value)}
                >
                  <Text style={[styles.chipText, taskType === option.value ? styles.chipTextActive : null]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>الأولوية</Text>
            <View style={styles.chips}>
              {priorityOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, priority === option.value ? styles.chipActive : null]}
                  onPress={() => setPriority(option.value)}
                >
                  <Text style={[styles.chipText, priority === option.value ? styles.chipTextActive : null]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="تاريخ المتابعة YYYY-MM-DD"
              value={dueDate}
              onChangeText={setDueDate}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="مسؤول المتابعة"
              value={assignedToName}
              onChangeText={setAssignedToName}
              textAlign="right"
            />

            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="ملاحظات"
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlign="right"
            />

            <TouchableOpacity style={styles.saveButton} onPress={saveTask} disabled={saving}>
              <Text style={styles.saveButtonText}>
                {saving ? "جاري الحفظ..." : "حفظ المتابعة"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل المتابعات...</Text>
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد مهام متابعة حاليًا</Text>
          </View>
        ) : null}

        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[styles.priorityBadge, priorityStyle(item.priority)]}>
                {priorityLabel(item.priority)}
              </Text>
              <Text style={styles.cardTitle}>{item.title || "متابعة"}</Text>
            </View>

            <Text style={styles.detail}>الحالة: {statusLabel(item.status)}</Text>
            <Text style={styles.detail}>النوع: {typeLabel(item.task_type)}</Text>
            <Text style={styles.detail}>تاريخ المتابعة: {item.due_date || "-"}</Text>
            <Text style={styles.detail}>المسؤول: {item.assigned_to_name || "-"}</Text>
            <Text style={styles.detail}>العقار: {item.property?.name || item.unit?.property?.name || item.contract?.unit?.property?.name || "-"}</Text>
            <Text style={styles.detail}>الوحدة: {item.unit?.unit_number || item.contract?.unit?.unit_number || "-"}</Text>
            <Text style={styles.detail}>المستأجر: {item.tenant?.name || item.contract?.tenant?.name || "-"}</Text>
            {item.notes ? <Text style={styles.notes}>ملاحظات: {item.notes}</Text> : null}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.doneButton]}
                onPress={() => updateStatus(item.id, "done")}
              >
                <Text style={styles.actionText}>إنجاز</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.openButton]}
                onPress={() => updateStatus(item.id, "open")}
              >
                <Text style={styles.actionText}>فتح</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => updateStatus(item.id, "cancelled")}
              >
                <Text style={styles.actionText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 18, paddingBottom: 50 },
  title: { fontSize: 30, fontWeight: "800", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", fontSize: 15, textAlign: "right", lineHeight: 22 },
  summaryBox: { backgroundColor: "#111827", borderRadius: 18, padding: 16, marginBottom: 14 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  primaryButton: { backgroundColor: "#0F9B6F", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  formCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14 },
  formTitle: { fontSize: 19, fontWeight: "800", color: "#111827", textAlign: "right", marginBottom: 12 },
  label: { color: "#374151", fontWeight: "800", textAlign: "right", marginBottom: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 12 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  multilineInput: { minHeight: 70, textAlignVertical: "top" },
  saveButton: { backgroundColor: "#16a34a", padding: 13, borderRadius: 12, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "800" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  priorityUrgent: { backgroundColor: "#fee2e2", color: "#991b1b" },
  priorityHigh: { backgroundColor: "#fef3c7", color: "#92400e" },
  priorityNormal: { backgroundColor: "#dbeafe", color: "#065F44" },
  priorityLow: { backgroundColor: "#f3f4f6", color: "#374151" },
  cardTitle: { fontSize: 19, fontWeight: "800", color: "#111827", textAlign: "right", flex: 1 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  notes: { marginTop: 10, color: "#92400e", fontWeight: "700", textAlign: "right" },
  actionsRow: { flexDirection: "row-reverse", marginTop: 14 },
  actionButton: { flex: 1, padding: 11, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  doneButton: { backgroundColor: "#16a34a" },
  openButton: { backgroundColor: "#0F9B6F" },
  cancelButton: { backgroundColor: "#7A766F" },
  actionText: { color: "#fff", fontWeight: "800" },
});
