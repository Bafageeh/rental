import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGet, apiPost } from "../../lib/api";

type PaymentRow = {
  id: number;
  title?: string;
  amount?: number | string | null;
  display_amount?: number | string | null;
  remaining_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_date?: string | null;
  paid_date?: string | null;
  deadline_date?: string | null;
  status?: string | null;
  badge?: string | null;
  notes?: string | null;
  entity?: string;
};

type ContractRecord = {
  id: number;
  contract_number?: string | null;
  government_contract_number?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  rent_amount?: number | string | null;
  total_contract_value?: number | string | null;
  regular_payment_amount?: number | string | null;
  last_payment_amount?: number | string | null;
  tenant?: { name?: string | null } | null;
  unit?: { unit_number?: string | null; property?: { name?: string | null } | null } | null;
  payments?: PaymentRow[];
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function responseList(payload: any) {
  return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
}

function contractPayload(payload: any, expectedId: string): ContractRecord | null {
  const candidate = payload?.contract || payload?.data || payload;
  if (!candidate || Array.isArray(candidate) || typeof candidate !== "object") return null;
  if (String(candidate.id || "") !== String(expectedId)) return null;
  return candidate as ContractRecord;
}

function onlyDate(value: unknown) {
  return String(value || "").slice(0, 10);
}

function numericOnly(value: string) {
  return value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
}

function statusValue(value?: string | null, badge?: string | null) {
  const text = String(value || badge || "due").toLowerCase();
  if (["paid", "مدفوع", "مدفوعة"].includes(text)) return "paid";
  if (["overdue", "متأخر", "متأخرة"].includes(text)) return "overdue";
  if (["due", "مستحق", "مستحقة"].includes(text)) return "due";
  if (["cancelled", "canceled", "ملغي"].includes(text)) return "cancelled";
  return text || "due";
}

function statusLabel(value: string) {
  if (value === "paid") return "مدفوع";
  if (value === "overdue") return "متأخر";
  if (value === "cancelled") return "ملغي";
  return "مستحق";
}

function money(value: unknown) {
  const n = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(n) ? n.toLocaleString("ar-SA") : "0";
}

function paymentTitle(payment: PaymentRow, index: number) {
  return payment.title || `الدفعة ${index + 1}`;
}

function normalizePayment(payment: PaymentRow, index: number): PaymentRow {
  return {
    ...payment,
    entity: payment.entity || "payment",
    title: payment.title || `الدفعة ${index + 1}`,
  };
}

export default function ContractEditScreen() {
  const params = useLocalSearchParams<{ id: string; return_to?: string }>();
  const id = String(params.id || "");
  const returnTo = firstParam(params.return_to) || `/contract/${id}`;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [form, setForm] = useState({
    rent_amount: "",
    total_contract_value: "",
    regular_payment_amount: "",
    last_payment_amount: "",
  });
  const [paymentForms, setPaymentForms] = useState<Record<string, { amount: string; due_date: string; paid_date: string; status: string; notes: string }>>({});

  async function load() {
    try {
      setLoading(true);
      const [contractResult, relatedResult] = await Promise.all([
        apiGet(`/contracts/${id}`).catch(() => null),
        apiGet(`/relation-manager/related/contract/${id}`).catch(() => null),
      ]);

      const current = contractPayload(contractResult, id);
      const directPayments = Array.isArray(current?.payments)
        ? current.payments.map((payment, index) => normalizePayment(payment, index))
        : [];
      const relatedPayments = ((relatedResult as any)?.sections || [])
        .flatMap((section: any) => section.items || [])
        .filter((item: PaymentRow) => String(item.entity || "").toLowerCase() === "payment")
        .map((payment: PaymentRow, index: number) => normalizePayment(payment, index)) as PaymentRow[];
      const loadedPayments = directPayments.length > 0 ? directPayments : relatedPayments;

      setContract(current);
      setPayments(loadedPayments);
      setForm({
        rent_amount: String(current?.rent_amount ?? ""),
        total_contract_value: String(current?.total_contract_value ?? current?.rent_amount ?? ""),
        regular_payment_amount: String(current?.regular_payment_amount ?? ""),
        last_payment_amount: String(current?.last_payment_amount ?? ""),
      });

      const nextPaymentForms: Record<string, { amount: string; due_date: string; paid_date: string; status: string; notes: string }> = {};
      loadedPayments.forEach((payment) => {
        nextPaymentForms[String(payment.id)] = {
          amount: String(payment.amount ?? ""),
          due_date: onlyDate(payment.due_date),
          paid_date: onlyDate(payment.paid_date),
          status: statusValue(payment.status, payment.badge),
          notes: String(payment.notes || ""),
        };
      });
      setPaymentForms(nextPaymentForms);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل بيانات العقد");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const totalPaymentsAmount = useMemo(() => {
    return Object.values(paymentForms).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [paymentForms]);

  function setContractField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: numericOnly(value) }));
  }

  function setPaymentField(paymentId: number, field: "amount" | "due_date" | "paid_date" | "status" | "notes", value: string) {
    setPaymentForms((prev) => ({
      ...prev,
      [String(paymentId)]: {
        ...(prev[String(paymentId)] || { amount: "", due_date: "", paid_date: "", status: "due", notes: "" }),
        [field]: field === "amount" ? numericOnly(value) : value,
      },
    }));
  }

  async function save() {
    try {
      setSaving(true);
      await apiPost(`/edit-delete-center/contracts/${id}/update`, {
        fields: {
          rent_amount: form.rent_amount,
          total_contract_value: form.total_contract_value || form.rent_amount,
          regular_payment_amount: form.regular_payment_amount,
          last_payment_amount: form.last_payment_amount,
        },
      });

      for (const payment of payments) {
        const row = paymentForms[String(payment.id)];
        if (!row) continue;
        await apiPost(`/edit-delete-center/payments/${payment.id}/update`, {
          _schedule_edit: true,
          fields: {
            _schedule_edit: true,
            amount: row.amount,
            due_date: row.due_date,
            paid_date: row.paid_date,
            status: row.status,
            notes: row.notes,
          },
        });
      }

      router.replace(returnTo as never);
    } catch (e) {
      Alert.alert("تعذر الحفظ", e instanceof Error ? e.message : "فشل حفظ تعديل العقد");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}><Ionicons name="document-text-outline" size={28} color="#fff" /></View>
            <View style={styles.heroText}>
              <Text style={styles.heroKicker}>تعديل العقد</Text>
              <Text style={styles.heroTitle}>{contract?.tenant?.name || "عقد إيجار"}</Text>
              <Text style={styles.heroSub} numberOfLines={1}>{contract?.unit?.property?.name || "-"} • {contract?.unit?.unit_number || "-"}</Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>جاري تحميل العقد وجدول الدفعات...</Text>
            </View>
          ) : null}

          {!loading ? (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>قيمة العقد</Text>
                <MoneyField label="قيمة الإيجار" value={form.rent_amount} onChange={(value) => setContractField("rent_amount", value)} />
                <MoneyField label="قيمة العقد الإجمالية" value={form.total_contract_value} onChange={(value) => setContractField("total_contract_value", value)} />
                <MoneyField label="دفعة الإيجار الدورية" value={form.regular_payment_amount} onChange={(value) => setContractField("regular_payment_amount", value)} />
                <MoneyField label="دفعة الإيجار الأخيرة" value={form.last_payment_amount} onChange={(value) => setContractField("last_payment_amount", value)} />
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{payments.length}</Text>
                  <Text style={styles.summaryLabel}>دفعة</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{money(totalPaymentsAmount)}</Text>
                  <Text style={styles.summaryLabel}>مجموع الدفعات</Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>جدول الدفعات</Text>
                {payments.length === 0 ? <Text style={styles.emptyText}>لا توجد دفعات مرتبطة بهذا العقد.</Text> : null}
                {payments.map((payment, index) => {
                  const row = paymentForms[String(payment.id)] || { amount: "", due_date: "", paid_date: "", status: "due", notes: "" };
                  return (
                    <View key={payment.id} style={styles.paymentCard}>
                      <View style={styles.paymentHeader}>
                        <Text style={styles.paymentTitle}>{paymentTitle(payment, index)}</Text>
                        <Text style={styles.paymentBadge}>{statusLabel(row.status)}</Text>
                      </View>

                      <MoneyField label="المبلغ" value={row.amount} onChange={(value) => setPaymentField(payment.id, "amount", value)} compact />
                      <TextField label="تاريخ الاستحقاق" value={row.due_date} onChange={(value) => setPaymentField(payment.id, "due_date", value)} placeholder="YYYY-MM-DD" />
                      <TextField label="تاريخ السداد" value={row.paid_date} onChange={(value) => setPaymentField(payment.id, "paid_date", value)} placeholder="YYYY-MM-DD" />

                      <View style={styles.choiceRow}>
                        {[
                          ["due", "مستحق"],
                          ["overdue", "متأخر"],
                          ["paid", "مدفوع"],
                          ["cancelled", "ملغي"],
                        ].map(([value, label]) => {
                          const active = row.status === value;
                          return (
                            <TouchableOpacity key={value} style={[styles.choice, active ? styles.choiceActive : null]} onPress={() => setPaymentField(payment.id, "status", value)}>
                              <Text style={[styles.choiceText, active ? styles.choiceTextActive : null]}>{label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <TextField label="ملاحظات" value={row.notes} onChange={(value) => setPaymentField(payment.id, "notes", value)} placeholder="ملاحظات الدفعة" multiline />
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving} activeOpacity={0.9}>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveText}>{saving ? "جاري الحفظ..." : "حفظ العقد والدفعات"}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MoneyField({ label, value, onChange, compact = false }: { label: string; value: string; onChange: (value: string) => void; compact?: boolean }) {
  return <TextField label={label} value={value} onChange={onChange} placeholder="0.00" keyboardType="decimal-pad" suffix="ريال" compact={compact} />;
}

function TextField({ label, value, onChange, placeholder, keyboardType = "default", suffix, compact = false, multiline = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; keyboardType?: any; suffix?: string; compact?: boolean; multiline?: boolean }) {
  return (
    <View style={[styles.fieldBox, compact ? styles.fieldCompact : null]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder || label}
          placeholderTextColor="#94A3B8"
          style={[styles.input, multiline ? styles.multilineInput : null]}
          textAlign="right"
          keyboardType={keyboardType}
          multiline={multiline}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 14, paddingBottom: 34 },
  hero: { backgroundColor: "#111827", borderRadius: 28, padding: 16, flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 12 },
  heroIcon: { width: 58, height: 58, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  heroText: { flex: 1, alignItems: "flex-end" },
  heroKicker: { color: "#A7F3D0", fontSize: 12, fontWeight: "900" },
  heroTitle: { color: "#fff", fontSize: 23, fontWeight: "900", textAlign: "right", marginTop: 2 },
  heroSub: { color: "#CBD5E1", fontSize: 12, fontWeight: "800", textAlign: "right", marginTop: 4 },
  loadingBox: { backgroundColor: "#fff", borderRadius: 18, padding: 18, alignItems: "center", gap: 10 },
  loadingText: { color: "#64748B", fontWeight: "800" },
  card: { backgroundColor: "#fff", borderRadius: 22, padding: 13, borderWidth: 1, borderColor: "#EDECE9", marginBottom: 12 },
  sectionTitle: { color: "#111827", fontSize: 18, fontWeight: "900", textAlign: "right", marginBottom: 10 },
  fieldBox: { marginBottom: 10 },
  fieldCompact: { marginBottom: 8 },
  fieldLabel: { color: "#111827", fontSize: 13, fontWeight: "900", textAlign: "right", marginBottom: 7 },
  inputWrap: { minHeight: 46, borderRadius: 15, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
  input: { flex: 1, color: "#111827", fontWeight: "900", minHeight: 44 },
  multilineInput: { minHeight: 78, textAlignVertical: "top", paddingTop: 11 },
  suffix: { color: "#64748B", fontWeight: "900", marginRight: 8 },
  summaryRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: "#ECFDF5", borderRadius: 18, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#A7F3D0" },
  summaryValue: { color: "#065F46", fontSize: 18, fontWeight: "900" },
  summaryLabel: { color: "#0F766E", fontSize: 12, fontWeight: "900", marginTop: 3 },
  paymentCard: { backgroundColor: "#F7F6F4", borderRadius: 18, padding: 11, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  paymentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  paymentTitle: { color: "#111827", fontSize: 15, fontWeight: "900", textAlign: "right", flex: 1 },
  paymentBadge: { overflow: "hidden", backgroundColor: "#DCFCE7", color: "#166534", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: "900" },
  choiceRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 9 },
  choice: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  choiceActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" },
  choiceText: { color: "#475569", fontWeight: "900", fontSize: 12 },
  choiceTextActive: { color: "#fff" },
  emptyText: { color: "#64748B", fontWeight: "800", textAlign: "center", padding: 14 },
  saveButton: { minHeight: 56, borderRadius: 18, backgroundColor: "#0F766E", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  saveText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
