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

type ReceiptPayment = {
  id: number;
  amount?: number;
  received_amount?: number;
  remaining_amount?: number;
  due_date?: string | null;
  status?: string | null;
  tenant_name?: string | null;
  tenant_phone?: string | null;
  property_name?: string | null;
  owner_name?: string | null;
  unit_number?: string | null;
  contract_number?: string | null;
};

type Receipt = {
  id: number;
  amount?: number;
  received_date?: string | null;
  method?: string | null;
  reference_number?: string | null;
  notes?: string | null;
  payment?: {
    id?: number;
    contract?: {
      tenant?: {
        name?: string | null;
      } | null;
      unit?: {
        unit_number?: string | null;
        property?: {
          name?: string | null;
          owner?: {
            name?: string | null;
          } | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function statusLabel(value?: string | null) {
  if (value === "paid") return "مدفوعة";
  if (value === "partial") return "مدفوعة جزئيًا";
  if (value === "due") return "مستحقة";
  if (value === "overdue") return "متأخرة";
  return value || "-";
}

function methodLabel(value?: string | null) {
  if (value === "cash") return "نقدًا";
  if (value === "bank_transfer") return "تحويل بنكي";
  if (value === "mada") return "مدى";
  if (value === "stc_pay") return "STC Pay";
  if (value === "other") return "أخرى";
  return value || "-";
}

export default function PaymentReceiptsScreen() {
  const [payments, setPayments] = useState<ReceiptPayment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedPayment, setSelectedPayment] = useState<ReceiptPayment | null>(null);
  const [amount, setAmount] = useState("");
  const [receivedDate, setReceivedDate] = useState("2026-04-26");
  const [method, setMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    try {
      setLoading(true);

      const [paymentsResult, receiptsResult] = await Promise.all([
        apiGetScoped("/receipt-payments", "/my/receipt-payments"),
        apiGetScoped("/payment-receipts", "/my/payment-receipts"),
      ]);

      setPayments(Array.isArray(paymentsResult) ? paymentsResult : []);
      setReceipts(Array.isArray(receiptsResult) ? receiptsResult : []);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل سندات القبض");
    } finally {
      setLoading(false);
    }
  }

  function selectPayment(payment: ReceiptPayment) {
    setSelectedPayment(payment);
    setAmount(String(Math.round(Number(payment.remaining_amount || payment.amount || 0))));
  }

  async function saveReceipt() {
    if (!selectedPayment) {
      Alert.alert("تنبيه", "اختر دفعة لتسجيل القبض");
      return;
    }

    if (!amount.trim() || Number(amount || 0) <= 0) {
      Alert.alert("تنبيه", "اكتب مبلغ القبض");
      return;
    }

    try {
      setSaving(true);

      await apiPost(`/payments/${selectedPayment.id}/record-receipt`, {
        amount: Number(amount || 0),
        received_date: receivedDate.trim() || null,
        method,
        reference_number: referenceNumber.trim() || null,
        notes: notes.trim() || null,
      });

      setSelectedPayment(null);
      setAmount("");
      setReferenceNumber("");
      setNotes("");
      setMethod("cash");

      Alert.alert("تم", "تم تسجيل سند القبض");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تسجيل سند القبض");
    } finally {
      setSaving(false);
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

  const totalOpen = payments.reduce((sum, item) => sum + Number(item.remaining_amount || 0), 0);
  const totalReceipts = receipts.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const methodOptions = [
    { value: "cash", label: "نقدًا" },
    { value: "bank_transfer", label: "تحويل" },
    { value: "mada", label: "مدى" },
    { value: "stc_pay", label: "STC Pay" },
    { value: "other", label: "أخرى" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>سندات القبض</Text>
        <Text style={styles.subtitle}>
          تسجيل التحصيل الكامل أو الجزئي للدفعات
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>دفعات مفتوحة: {payments.length}</Text>
          <Text style={styles.summaryText}>المتبقي للتحصيل: {money(totalOpen)}</Text>
          <Text style={styles.summaryText}>إجمالي سندات القبض: {money(totalReceipts)}</Text>
        </View>
{selectedPayment ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>تسجيل سند قبض</Text>
            <Text style={styles.detail}>المستأجر: {selectedPayment.tenant_name || "-"}</Text>
            <Text style={styles.detail}>العقار: {selectedPayment.property_name || "-"}</Text>
            <Text style={styles.detail}>الوحدة: {selectedPayment.unit_number || "-"}</Text>
            <Text style={styles.detail}>العقد: {selectedPayment.contract_number || "-"}</Text>
            <Text style={styles.detail}>قيمة الدفعة: {money(selectedPayment.amount)}</Text>
            <Text style={styles.detail}>المقبوض سابقًا: {money(selectedPayment.received_amount)}</Text>
            <Text style={styles.remainingText}>المتبقي: {money(selectedPayment.remaining_amount)}</Text>

            <TextInput
              style={styles.input}
              placeholder="مبلغ القبض"
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="تاريخ القبض YYYY-MM-DD"
              value={receivedDate}
              onChangeText={setReceivedDate}
              textAlign="right"
            />

            <Text style={styles.label}>طريقة الدفع</Text>
            <View style={styles.chips}>
              {methodOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, method === option.value ? styles.chipActive : null]}
                  onPress={() => setMethod(option.value)}
                >
                  <Text style={[styles.chipText, method === option.value ? styles.chipTextActive : null]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="رقم المرجع / التحويل"
              value={referenceNumber}
              onChangeText={setReferenceNumber}
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

            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => setSelectedPayment(null)}>
                <Text style={styles.actionText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.saveButton]} onPress={saveReceipt} disabled={saving}>
                <Text style={styles.actionText}>{saving ? "جاري الحفظ..." : "حفظ السند"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل سندات القبض...</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>دفعات قابلة للتحصيل</Text>

        {!loading && payments.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد دفعات مفتوحة حاليًا</Text>
          </View>
        ) : null}

        {payments.map((payment) => (
          <View key={payment.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.badge}>{statusLabel(payment.status)}</Text>
              <Text style={styles.amount}>{money(payment.remaining_amount)}</Text>
            </View>

            <Text style={styles.detail}>المستأجر: {payment.tenant_name || "-"}</Text>
            <Text style={styles.detail}>العقار: {payment.property_name || "-"}</Text>
            <Text style={styles.detail}>الوحدة: {payment.unit_number || "-"}</Text>
            <Text style={styles.detail}>العقد: {payment.contract_number || "-"}</Text>
            <Text style={styles.detail}>الاستحقاق: {payment.due_date || "-"}</Text>
            <Text style={styles.detail}>أصل الدفعة: {money(payment.amount)}</Text>
            <Text style={styles.detail}>المقبوض: {money(payment.received_amount)}</Text>

            <TouchableOpacity style={styles.collectButton} onPress={() => selectPayment(payment)}>
              <Text style={styles.collectButtonText}>تسجيل قبض</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.sectionTitle}>آخر سندات القبض</Text>

        {receipts.slice(0, 20).map((receipt) => (
          <View key={receipt.id} style={styles.receiptCard}>
            <InlineEditDeleteActions resource="payment_receipts" id={receipt.id} onChanged={load} />
            <Text style={styles.receiptAmount}>{money(receipt.amount)}</Text>
            <Text style={styles.detail}>التاريخ: {receipt.received_date || "-"}</Text>
            <Text style={styles.detail}>الطريقة: {methodLabel(receipt.method)}</Text>
            <Text style={styles.detail}>المرجع: {receipt.reference_number || "-"}</Text>
            <Text style={styles.detail}>المستأجر: {receipt.payment?.contract?.tenant?.name || "-"}</Text>
            <Text style={styles.detail}>العقار: {receipt.payment?.contract?.unit?.property?.name || "-"}</Text>
            <Text style={styles.detail}>الوحدة: {receipt.payment?.contract?.unit?.unit_number || "-"}</Text>
            {receipt.notes ? <Text style={styles.notes}>ملاحظات: {receipt.notes}</Text> : null}
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
  primaryButton: { backgroundColor: "#111827", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 9 },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  formCard: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 9 },
  formTitle: { fontSize: 16, fontWeight: "800", color: "#111827", textAlign: "right", marginBottom: 10 },
  label: { color: "#374151", fontWeight: "800", textAlign: "right", marginBottom: 8 },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  multilineInput: { minHeight: 70, textAlignVertical: "top" },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 8 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  box: { backgroundColor: "#fff", padding: 12, borderRadius: 14, alignItems: "center", marginBottom: 8 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  sectionTitle: { marginTop: 10, marginBottom: 10, fontSize: 21, fontWeight: "800", color: "#111827", textAlign: "right" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8 },
  receiptCard: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8, borderRightWidth: 5, borderRightColor: "#16a34a" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  badge: { backgroundColor: "#fef3c7", color: "#92400e", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  amount: { color: "#111827", fontSize: 16, fontWeight: "800", textAlign: "right", flex: 1 },
  receiptAmount: { color: "#166534", fontSize: 16, fontWeight: "800", textAlign: "right" },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  remainingText: { marginTop: 8, color: "#b91c1c", fontWeight: "800", textAlign: "right" },
  notes: { marginTop: 10, color: "#92400e", fontWeight: "700", textAlign: "right" },
  collectButton: { backgroundColor: "#16a34a", padding: 12, borderRadius: 12, alignItems: "center", marginTop: 14 },
  collectButtonText: { color: "#fff", fontWeight: "800" },
  actionsRow: { flexDirection: "row-reverse", marginTop: 12 },
  actionButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  cancelButton: { backgroundColor: "#7A766F" },
  saveButton: { backgroundColor: "#16a34a" },
  actionText: { color: "#fff", fontWeight: "800" },
});
