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
import InlineEditDeleteActions from "../components/InlineEditDeleteActions";
import { SafeAreaView } from "react-native-safe-area-context";

type Property = {
  id: number;
  name?: string | null;
  owner?: {
    name?: string | null;
  } | null;
};

type UtilityBill = {
  id: number;
  property_id?: number;
  bill_type?: string | null;
  provider?: string | null;
  bill_number?: string | null;
  amount?: number;
  bill_date?: string | null;
  due_date?: string | null;
  paid_date?: string | null;
  status?: string | null;
  notes?: string | null;
  property_expense_id?: number | null;
  property?: Property | null;
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function typeLabel(value?: string | null) {
  if (value === "common_electricity") return "كهرباء الخدمات";
  if (value === "water") return "مياه";
  if (value === "internet") return "إنترنت";
  return "أخرى";
}

function statusLabel(value?: string | null) {
  if (value === "paid") return "مدفوعة";
  if (value === "due") return "مستحقة";
  if (value === "overdue") return "متأخرة";
  if (value === "cancelled") return "ملغاة";
  return value || "-";
}

function statusStyle(value?: string | null) {
  if (value === "paid") return styles.statusPaid;
  if (value === "overdue") return styles.statusOverdue;
  if (value === "due") return styles.statusDue;
  return styles.statusNeutral;
}

export default function UtilityBillsScreen() {
  const [items, setItems] = useState<UtilityBill[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [billType, setBillType] = useState("common_electricity");
  const [provider, setProvider] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [billDate, setBillDate] = useState("2026-04-26");
  const [dueDate, setDueDate] = useState("2026-05-01");
  const [notes, setNotes] = useState("");

  async function load() {
    try {
      setLoading(true);

      const [billsResult, propertiesResult] = await Promise.all([
        apiGetScoped("/utility-bills", "/my/utility-bills"),
        apiGetScoped("/properties", "/my/properties"),
      ]);

      const propertyList = Array.isArray(propertiesResult) ? propertiesResult : [];
      setItems(Array.isArray(billsResult) ? billsResult : []);
      setProperties(propertyList);

      if (!propertyId && propertyList.length > 0) {
        setPropertyId(propertyList[0].id);
      }
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل فواتير الخدمات");
    } finally {
      setLoading(false);
    }
  }

  async function saveBill() {
    if (!propertyId) {
      Alert.alert("تنبيه", "اختر العقار");
      return;
    }

    if (!amount.trim()) {
      Alert.alert("تنبيه", "اكتب مبلغ الفاتورة");
      return;
    }

    try {
      setSaving(true);

      await apiPost("/utility-bills", {
        property_id: propertyId,
        bill_type: billType,
        provider: provider.trim() || null,
        bill_number: billNumber.trim() || null,
        amount: Number(amount || 0),
        bill_date: billDate.trim() || null,
        due_date: dueDate.trim() || null,
        status: "due",
        notes: notes.trim() || null,
      });

      setProvider("");
      setBillNumber("");
      setAmount("");
      setNotes("");
      setShowForm(false);

      Alert.alert("تم", "تم إضافة فاتورة الخدمات");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ الفاتورة");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: number, status: string) {
    try {
      setUpdatingId(id);
      await apiPost(`/utility-bills/${id}/status`, { status, create_expense: true });
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحديث حالة الفاتورة");
    } finally {
      setUpdatingId(null);
    }
  }

  async function fixOverdue() {
    try {
      const result = await apiPost("/utility-bills/fix-overdue");
      Alert.alert("تم", result.message || "تم تحديث المتأخر");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحديث المتأخر");
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

  const due = items.filter((item) => item.status === "due");
  const overdue = items.filter((item) => item.status === "overdue");
  const paid = items.filter((item) => item.status === "paid");
  const totalDue = [...due, ...overdue].reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalPaid = paid.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const typeOptions = [
    { value: "common_electricity", label: "كهرباء الخدمات" },
    { value: "water", label: "مياه" },
    { value: "internet", label: "إنترنت" },
    { value: "other", label: "أخرى" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>فواتير الخدمات</Text>
        <Text style={styles.subtitle}>كهرباء الخدمات والمياه والإنترنت لكل عقار</Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>مستحقة: {due.length} | متأخرة: {overdue.length} | مدفوعة: {paid.length}</Text>
          <Text style={styles.summaryText}>إجمالي غير مدفوع: {money(totalDue)}</Text>
          <Text style={styles.summaryText}>إجمالي مدفوع: {money(totalPaid)}</Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setShowForm(!showForm)}>
            <Text style={styles.primaryButtonText}>
              {showForm ? "إغلاق النموذج" : "إضافة فاتورة"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.fixButton} onPress={fixOverdue}>
            <Text style={styles.primaryButtonText}>تحديث المتأخر</Text>
          </TouchableOpacity>
        </View>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>بيانات الفاتورة</Text>

            <Text style={styles.label}>العقار</Text>
            <View style={styles.chips}>
              {properties.map((property) => (
                <TouchableOpacity
                  key={property.id}
                  style={[styles.chip, propertyId === property.id ? styles.chipActive : null]}
                  onPress={() => setPropertyId(property.id)}
                >
                  <Text style={[styles.chipText, propertyId === property.id ? styles.chipTextActive : null]}>
                    {property.name || "عقار"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>نوع الفاتورة</Text>
            <View style={styles.chips}>
              {typeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, billType === option.value ? styles.chipActive : null]}
                  onPress={() => setBillType(option.value)}
                >
                  <Text style={[styles.chipText, billType === option.value ? styles.chipTextActive : null]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="مزود الخدمة"
              value={provider}
              onChangeText={setProvider}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="رقم الفاتورة"
              value={billNumber}
              onChangeText={setBillNumber}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="المبلغ"
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="تاريخ الفاتورة YYYY-MM-DD"
              value={billDate}
              onChangeText={setBillDate}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="تاريخ الاستحقاق YYYY-MM-DD"
              value={dueDate}
              onChangeText={setDueDate}
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

            <TouchableOpacity style={styles.saveButton} onPress={saveBill} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? "جاري الحفظ..." : "حفظ الفاتورة"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل فواتير الخدمات...</Text>
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد فواتير خدمات حاليًا</Text>
          </View>
        ) : null}

        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <InlineEditDeleteActions resource="utility_bills" id={item.id} onChanged={load} />
            <View style={styles.rowBetween}>
              <Text style={[styles.statusBadge, statusStyle(item.status)]}>
                {statusLabel(item.status)}
              </Text>
              <Text style={styles.amount}>{money(item.amount)}</Text>
            </View>

            <Text style={styles.detail}>النوع: {typeLabel(item.bill_type)}</Text>
            <Text style={styles.detail}>العقار: {item.property?.name || "-"}</Text>
            <Text style={styles.detail}>المالك: {item.property?.owner?.name || "-"}</Text>
            <Text style={styles.detail}>المزود: {item.provider || "-"}</Text>
            <Text style={styles.detail}>رقم الفاتورة: {item.bill_number || "-"}</Text>
            <Text style={styles.detail}>تاريخ الفاتورة: {item.bill_date || "-"}</Text>
            <Text style={styles.detail}>الاستحقاق: {item.due_date || "-"}</Text>
            <Text style={styles.detail}>السداد: {item.paid_date || "-"}</Text>
            <Text style={styles.detail}>رقم المصروف المرتبط: {item.property_expense_id || "-"}</Text>
            {item.notes ? <Text style={styles.notes}>ملاحظات: {item.notes}</Text> : null}

            <View style={styles.itemActionsRow}>
              <TouchableOpacity
                style={[styles.itemActionButton, styles.paidButton]}
                onPress={() => updateStatus(item.id, "paid")}
                disabled={updatingId === item.id}
              >
                <Text style={styles.itemActionText}>
                  {updatingId === item.id ? "..." : "مدفوعة"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.itemActionButton, styles.dueButton]}
                onPress={() => updateStatus(item.id, "due")}
                disabled={updatingId === item.id}
              >
                <Text style={styles.itemActionText}>مستحقة</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.itemActionButton, styles.overdueButton]}
                onPress={() => updateStatus(item.id, "overdue")}
                disabled={updatingId === item.id}
              >
                <Text style={styles.itemActionText}>متأخرة</Text>
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
  container: { padding: 12, paddingBottom: 50 },
  title: { fontSize: 30, fontWeight: "800", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", fontSize: 15, textAlign: "right" },
  summaryBox: { backgroundColor: "#111827", borderRadius: 14, padding: 12, marginBottom: 9 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  actionsRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 9 },
  primaryButton: { flex: 1, backgroundColor: "#111827", padding: 13, borderRadius: 14, alignItems: "center" },
  fixButton: { flex: 1, backgroundColor: "#0F9B6F", padding: 13, borderRadius: 14, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  formCard: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 9 },
  formTitle: { fontSize: 17, fontWeight: "800", color: "#111827", textAlign: "right", marginBottom: 8 },
  label: { color: "#374151", fontWeight: "800", textAlign: "right", marginBottom: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 8 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  multilineInput: { minHeight: 70, textAlignVertical: "top" },
  saveButton: { backgroundColor: "#16a34a", padding: 13, borderRadius: 12, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "800" },
  box: { backgroundColor: "#fff", padding: 12, borderRadius: 14, alignItems: "center", marginBottom: 8 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  amount: { color: "#111827", fontSize: 16, fontWeight: "800", textAlign: "right", flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  statusPaid: { backgroundColor: "#dcfce7", color: "#166534" },
  statusOverdue: { backgroundColor: "#fee2e2", color: "#991b1b" },
  statusDue: { backgroundColor: "#fef3c7", color: "#92400e" },
  statusNeutral: { backgroundColor: "#f3f4f6", color: "#374151" },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  notes: { marginTop: 10, color: "#92400e", fontWeight: "700", textAlign: "right" },
  itemActionsRow: { flexDirection: "row-reverse", marginTop: 14 },
  itemActionButton: { flex: 1, padding: 11, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  paidButton: { backgroundColor: "#16a34a" },
  dueButton: { backgroundColor: "#d97706" },
  overdueButton: { backgroundColor: "#dc2626" },
  itemActionText: { color: "#fff", fontWeight: "800" },
});
