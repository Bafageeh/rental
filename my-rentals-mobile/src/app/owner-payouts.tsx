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

type BankAccount = {
  id: number;
  bank_name?: string | null;
  account_name?: string | null;
  iban?: string | null;
  account_number?: string | null;
  is_default?: boolean;
  is_active?: boolean;
};

type OwnerBalance = {
  owner_id: number;
  owner_name?: string | null;
  properties_count?: number;
  paid_income?: number;
  expenses?: number;
  net_income?: number;
  paid_payouts?: number;
  pending_payouts?: number;
  remaining_balance?: number;
  bank_accounts_count?: number;
  default_bank_account_id?: number | null;
  default_bank_name?: string | null;
  default_iban?: string | null;
  bank_accounts?: BankAccount[];
};

type OwnerPayout = {
  id: number;
  owner_id?: number;
  owner_name?: string | null;
  owner_bank_account_id?: number | null;
  bank_name?: string | null;
  account_name?: string | null;
  iban?: string | null;
  account_number?: string | null;
  amount?: number;
  payout_date?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  method?: string | null;
  reference_number?: string | null;
  status?: string | null;
  notes?: string | null;
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function methodLabel(value?: string | null) {
  if (value === "bank_transfer") return "تحويل بنكي";
  if (value === "cash") return "نقدًا";
  if (value === "cheque") return "شيك";
  if (value === "other") return "أخرى";
  return value || "-";
}

function statusLabel(value?: string | null) {
  if (value === "paid") return "مدفوعة";
  if (value === "pending") return "معلقة";
  if (value === "cancelled") return "ملغاة";
  return value || "-";
}

function statusStyle(value?: string | null) {
  if (value === "paid") return styles.statusPaid;
  if (value === "pending") return styles.statusPending;
  if (value === "cancelled") return styles.statusCancelled;
  return styles.statusNeutral;
}

function maskIban(value?: string | null) {
  if (!value) return "-";
  const clean = value.replace(/\s+/g, "");
  if (clean.length <= 8) return clean;
  return `${clean.slice(0, 4)} **** **** ${clean.slice(-4)}`;
}

export default function OwnerPayoutsScreen() {
  const [balances, setBalances] = useState<OwnerBalance[]>([]);
  const [payouts, setPayouts] = useState<OwnerPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [bankAccountId, setBankAccountId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [payoutDate, setPayoutDate] = useState("2026-04-26");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    try {
      setLoading(true);

      const [summaryResult, payoutsResult] = await Promise.all([
        apiGetScoped("/owner-payouts-bank/summary", "/my/owner-payouts-bank/summary"),
        apiGetScoped("/owner-payouts-bank", "/my/owner-payouts-bank"),
      ]);

      const nextBalances = Array.isArray(summaryResult) ? summaryResult : [];
      setBalances(nextBalances);
      setPayouts(Array.isArray(payoutsResult) ? payoutsResult : []);

      if (!ownerId && nextBalances.length > 0) {
        selectOwner(nextBalances[0], false);
      }
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل حوالات الملاك");
    } finally {
      setLoading(false);
    }
  }

  function selectOwner(balance: OwnerBalance, updateAmount = true) {
    setOwnerId(balance.owner_id);
    setBankAccountId(balance.default_bank_account_id || balance.bank_accounts?.find((item) => item.is_active)?.id || null);

    if (updateAmount) {
      setAmount(String(Math.max(0, Math.round(Number(balance.remaining_balance || 0)))));
    }
  }

  async function savePayout() {
    if (!ownerId) {
      Alert.alert("تنبيه", "اختر المالك");
      return;
    }

    if (!amount.trim() || Number(amount || 0) <= 0) {
      Alert.alert("تنبيه", "اكتب مبلغ الحوالة");
      return;
    }

    try {
      setSaving(true);

      await apiPost("/owner-payouts-bank", {
        owner_id: ownerId,
        owner_bank_account_id: bankAccountId,
        amount: Number(amount || 0),
        payout_date: payoutDate.trim() || null,
        period_start: periodStart.trim() || null,
        period_end: periodEnd.trim() || null,
        method,
        reference_number: referenceNumber.trim() || null,
        status: "paid",
        notes: notes.trim() || null,
      });

      setReferenceNumber("");
      setNotes("");
      setPeriodStart("");
      setPeriodEnd("");
      setShowForm(false);

      Alert.alert("تم", "تم تسجيل حوالة المالك وربطها بالحساب البنكي");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ الحوالة");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: number, status: string) {
    try {
      await apiPost(`/owner-payouts-bank/${id}/status`, { status });
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحديث حالة الحوالة");
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

  const totals = balances.reduce(
    (acc, item) => {
      acc.paidIncome += Number(item.paid_income || 0);
      acc.expenses += Number(item.expenses || 0);
      acc.netIncome += Number(item.net_income || 0);
      acc.paidPayouts += Number(item.paid_payouts || 0);
      acc.remaining += Number(item.remaining_balance || 0);
      return acc;
    },
    { paidIncome: 0, expenses: 0, netIncome: 0, paidPayouts: 0, remaining: 0 }
  );

  const methodOptions = [
    { value: "bank_transfer", label: "تحويل بنكي" },
    { value: "cash", label: "نقدًا" },
    { value: "cheque", label: "شيك" },
    { value: "other", label: "أخرى" },
  ];

  const selectedOwner = balances.find((item) => item.owner_id === ownerId);
  const selectedBank = selectedOwner?.bank_accounts?.find((item) => item.id === bankAccountId);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>حوالات الملاك</Text>
        <Text style={styles.subtitle}>
          تسجيل المبالغ المحولة للملاك وربط كل حوالة بالحساب البنكي المستخدم
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>المقبوض: {money(totals.paidIncome)}</Text>
          <Text style={styles.summaryText}>المصاريف: {money(totals.expenses)}</Text>
          <Text style={styles.summaryText}>الصافي: {money(totals.netIncome)}</Text>
          <Text style={styles.summaryText}>المحول للملاك: {money(totals.paidPayouts)}</Text>
          <Text style={styles.remainingSummary}>المتبقي للتحويل: {money(totals.remaining)}</Text>
        </View>

        <View style={styles.actionsRow}>
<TouchableOpacity style={styles.addButton} onPress={() => setShowForm(!showForm)}>
            <Text style={styles.primaryButtonText}>
              {showForm ? "إغلاق النموذج" : "تسجيل حوالة"}
            </Text>
          </TouchableOpacity>
        </View>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>تسجيل حوالة مالك</Text>

            <Text style={styles.label}>اختيار المالك</Text>
            <View style={styles.chips}>
              {balances.map((balance) => (
                <TouchableOpacity
                  key={balance.owner_id}
                  style={[styles.chip, ownerId === balance.owner_id ? styles.chipActive : null]}
                  onPress={() => selectOwner(balance)}
                >
                  <Text style={[styles.chipText, ownerId === balance.owner_id ? styles.chipTextActive : null]}>
                    {balance.owner_name || "مالك"} — {money(balance.remaining_balance)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedOwner ? (
              <View style={styles.ownerHint}>
                <Text style={styles.ownerHintText}>الصافي: {money(selectedOwner.net_income)}</Text>
                <Text style={styles.ownerHintText}>المحول سابقًا: {money(selectedOwner.paid_payouts)}</Text>
                <Text style={styles.ownerHintText}>المتبقي: {money(selectedOwner.remaining_balance)}</Text>
                <Text style={styles.ownerHintText}>الحسابات البنكية: {selectedOwner.bank_accounts_count ?? 0}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>الحساب البنكي</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, bankAccountId === null ? styles.chipActive : null]}
                onPress={() => setBankAccountId(null)}
              >
                <Text style={[styles.chipText, bankAccountId === null ? styles.chipTextActive : null]}>
                  بدون ربط
                </Text>
              </TouchableOpacity>

              {(selectedOwner?.bank_accounts || []).map((account) => (
                <TouchableOpacity
                  key={account.id}
                  style={[styles.chip, bankAccountId === account.id ? styles.chipActive : null]}
                  onPress={() => setBankAccountId(account.id)}
                >
                  <Text style={[styles.chipText, bankAccountId === account.id ? styles.chipTextActive : null]}>
                    {account.bank_name || "بنك"} {account.is_default ? "★" : ""} — {maskIban(account.iban)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedBank ? (
              <View style={styles.bankHint}>
                <Text style={styles.bankHintText}>البنك: {selectedBank.bank_name || "-"}</Text>
                <Text style={styles.bankHintText}>اسم الحساب: {selectedBank.account_name || "-"}</Text>
                <Text style={styles.bankHintText}>الآيبان: {maskIban(selectedBank.iban)}</Text>
              </View>
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="مبلغ الحوالة"
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="تاريخ الحوالة YYYY-MM-DD"
              value={payoutDate}
              onChangeText={setPayoutDate}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="بداية الفترة YYYY-MM-DD اختياري"
              value={periodStart}
              onChangeText={setPeriodStart}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="نهاية الفترة YYYY-MM-DD اختياري"
              value={periodEnd}
              onChangeText={setPeriodEnd}
              textAlign="right"
            />

            <Text style={styles.label}>طريقة التحويل</Text>
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

            <TouchableOpacity style={styles.saveButton} onPress={savePayout} disabled={saving}>
              <Text style={styles.saveButtonText}>
                {saving ? "جاري الحفظ..." : "حفظ الحوالة"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل حوالات الملاك...</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>أرصدة الملاك</Text>

        {!loading && balances.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد أرصدة ملاك حاليًا</Text>
          </View>
        ) : null}

        {balances.map((item) => (
          <View key={item.owner_id} style={styles.balanceCard}>
            <Text style={styles.cardTitle}>{item.owner_name || "مالك"}</Text>
            <Text style={styles.detail}>عدد العقارات: {item.properties_count ?? 0}</Text>
            <Text style={styles.detail}>المقبوض: {money(item.paid_income)}</Text>
            <Text style={styles.detail}>المصاريف: {money(item.expenses)}</Text>
            <Text style={styles.detail}>الصافي: {money(item.net_income)}</Text>
            <Text style={styles.detail}>محول سابقًا: {money(item.paid_payouts)}</Text>
            <Text style={styles.remainingLine}>المتبقي: {money(item.remaining_balance)}</Text>
            <Text style={styles.detail}>الحساب الافتراضي: {item.default_bank_name || "-"} — {maskIban(item.default_iban)}</Text>

            <TouchableOpacity style={styles.smallButton} onPress={() => {
              selectOwner(item);
              setShowForm(true);
            }}>
              <Text style={styles.smallButtonText}>تسجيل حوالة لهذا المالك</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.sectionTitle}>سجل الحوالات</Text>

        {!loading && payouts.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد حوالات مسجلة حاليًا</Text>
          </View>
        ) : null}

        {payouts.map((item) => (
          <View key={item.id} style={styles.card}>
            <InlineEditDeleteActions resource="owner_payouts" id={item.id} onChanged={load} />
            <View style={styles.rowBetween}>
              <Text style={[styles.statusBadge, statusStyle(item.status)]}>
                {statusLabel(item.status)}
              </Text>
              <Text style={styles.amount}>{money(item.amount)}</Text>
            </View>

            <Text style={styles.detail}>المالك: {item.owner_name || "-"}</Text>
            <Text style={styles.detail}>تاريخ الحوالة: {item.payout_date || "-"}</Text>
            <Text style={styles.detail}>الفترة: {item.period_start || "-"} إلى {item.period_end || "-"}</Text>
            <Text style={styles.detail}>الطريقة: {methodLabel(item.method)}</Text>
            <Text style={styles.detail}>المرجع: {item.reference_number || "-"}</Text>
            <Text style={styles.bankLine}>الحساب البنكي: {item.bank_name || "-"} — {maskIban(item.iban)}</Text>
            {item.notes ? <Text style={styles.notes}>ملاحظات: {item.notes}</Text> : null}

            <View style={styles.itemActionsRow}>
              <TouchableOpacity style={[styles.itemActionButton, styles.paidButton]} onPress={() => updateStatus(item.id, "paid")}>
                <Text style={styles.itemActionText}>مدفوعة</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.itemActionButton, styles.pendingButton]} onPress={() => updateStatus(item.id, "pending")}>
                <Text style={styles.itemActionText}>معلقة</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.itemActionButton, styles.cancelButton]} onPress={() => updateStatus(item.id, "cancelled")}>
                <Text style={styles.itemActionText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.helpBox}>
          <Text style={styles.helpTitle}>تنبيه</Text>
          <Text style={styles.helpText}>
            قبل تسجيل الحوالة يفضّل إضافة حساب بنكي للمالك من شاشة: المزيد ثم حسابات الملاك البنكية.
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
  remainingSummary: { color: "#bbf7d0", fontWeight: "900", textAlign: "right", marginTop: 6, fontSize: 16 },
  actionsRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 9 },
  primaryButton: { flex: 1, backgroundColor: "#0F9B6F", padding: 13, borderRadius: 14, alignItems: "center" },
  addButton: { flex: 1, backgroundColor: "#16a34a", padding: 13, borderRadius: 14, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "900" },
  formCard: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 9 },
  formTitle: { fontSize: 16, fontWeight: "900", color: "#111827", textAlign: "right", marginBottom: 8 },
  label: { color: "#374151", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 8 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "800" },
  chipTextActive: { color: "#fff" },
  ownerHint: { backgroundColor: "#eff6ff", borderRadius: 14, padding: 12, marginBottom: 8 },
  ownerHintText: { color: "#065F44", fontWeight: "800", textAlign: "right", marginBottom: 4 },
  bankHint: { backgroundColor: "#f0fdf4", borderRadius: 14, padding: 12, marginBottom: 8 },
  bankHintText: { color: "#166534", fontWeight: "800", textAlign: "right", marginBottom: 4 },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  multilineInput: { minHeight: 70, textAlignVertical: "top" },
  saveButton: { backgroundColor: "#16a34a", padding: 13, borderRadius: 12, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "900" },
  box: { backgroundColor: "#fff", padding: 12, borderRadius: 14, alignItems: "center", marginBottom: 8 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  sectionTitle: { color: "#111827", fontSize: 21, fontWeight: "900", textAlign: "right", marginBottom: 10, marginTop: 6 },
  balanceCard: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8, borderRightWidth: 5, borderRightColor: "#0F9B6F" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: "900", color: "#111827", textAlign: "right" },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  bankLine: { marginTop: 8, color: "#065F44", fontWeight: "900", textAlign: "right" },
  remainingLine: { marginTop: 8, color: "#166534", fontWeight: "900", textAlign: "right" },
  smallButton: { backgroundColor: "#0F9B6F", padding: 12, borderRadius: 12, alignItems: "center", marginTop: 14 },
  smallButtonText: { color: "#fff", fontWeight: "900" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  amount: { color: "#111827", fontSize: 16, fontWeight: "900", textAlign: "right", flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  statusPaid: { backgroundColor: "#dcfce7", color: "#166534" },
  statusPending: { backgroundColor: "#fef3c7", color: "#92400e" },
  statusCancelled: { backgroundColor: "#fee2e2", color: "#991b1b" },
  statusNeutral: { backgroundColor: "#f3f4f6", color: "#374151" },
  notes: { marginTop: 10, color: "#92400e", fontWeight: "700", textAlign: "right" },
  itemActionsRow: { flexDirection: "row-reverse", marginTop: 14 },
  itemActionButton: { flex: 1, padding: 11, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  paidButton: { backgroundColor: "#16a34a" },
  pendingButton: { backgroundColor: "#d97706" },
  cancelButton: { backgroundColor: "#dc2626" },
  itemActionText: { color: "#fff", fontWeight: "900" },
  helpBox: { backgroundColor: "#fffbeb", borderRadius: 14, padding: 10, marginTop: 4 },
  helpTitle: { color: "#92400e", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  helpText: { color: "#92400e", fontWeight: "700", textAlign: "right", lineHeight: 22 },
});
