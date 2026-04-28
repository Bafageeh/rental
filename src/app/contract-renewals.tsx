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

type RenewalItem = {
  id: number;
  contract_number?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  days_to_end?: number | null;
  rent_amount?: number;
  parking_fee?: number;
  services_fee?: number;
  payment_cycle?: string | null;
  tenant?: {
    name?: string | null;
    phone?: string | null;
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
  summary?: {
    payments_count?: number;
    paid_amount?: number;
    due_amount?: number;
    overdue_amount?: number;
  };
};

type PaymentCycle = "monthly" | "quarterly" | "semi_annual" | "annual";

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function statusLabel(value?: string | null) {
  if (value === "active") return "نشط";
  if (value === "ended") return "منتهي";
  if (value === "cancelled") return "ملغى";
  return value || "-";
}

function cycleLabel(value: PaymentCycle) {
  if (value === "monthly") return "شهري";
  if (value === "quarterly") return "ربع سنوي";
  if (value === "semi_annual") return "نصف سنوي";
  if (value === "annual") return "سنوي";
  return value;
}

function nextDay(date?: string | null) {
  if (!date) return "2026-05-01";

  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + 1);

  return value.toISOString().slice(0, 10);
}

export default function ContractRenewalsScreen() {
  const [items, setItems] = useState<RenewalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<RenewalItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [startDate, setStartDate] = useState("2026-05-01");
  const [endDate, setEndDate] = useState("2027-04-30");
  const [rentAmount, setRentAmount] = useState("");
  const [parkingFee, setParkingFee] = useState("");
  const [servicesFee, setServicesFee] = useState("");
  const [paymentsCount, setPaymentsCount] = useState("12");
  const [paymentCycle, setPaymentCycle] = useState<PaymentCycle>("monthly");

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/contract-renewals",
        "/my/contract-renewals"
      );

      setItems(Array.isArray(result) ? result : []);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل عقود التجديد");
    } finally {
      setLoading(false);
    }
  }

  function selectContract(item: RenewalItem) {
    setSelected(item);
    setStartDate(nextDay(item.end_date));
    setRentAmount(String(Math.round(Number(item.rent_amount || 0))));
    setParkingFee(String(Math.round(Number(item.parking_fee || 0))));
    setServicesFee(String(Math.round(Number(item.services_fee || 0))));
    setPaymentCycle((item.payment_cycle as PaymentCycle) || "monthly");
    setPaymentsCount("12");
  }

  async function renewContract() {
    if (!selected) {
      Alert.alert("تنبيه", "اختر عقدًا للتجديد");
      return;
    }

    if (!endDate.trim()) {
      Alert.alert("تنبيه", "اكتب تاريخ نهاية التجديد");
      return;
    }

    try {
      setSaving(true);

      const result = await apiPost(`/contracts/${selected.id}/renew`, {
        start_date: startDate.trim(),
        end_date: endDate.trim(),
        rent_amount: Number(rentAmount || selected.rent_amount || 0),
        parking_fee: Number(parkingFee || 0),
        services_fee: Number(servicesFee || 0),
        payment_cycle: paymentCycle,
        payments_count: Number(paymentsCount || 1),
        close_old_contract: true,
      });

      Alert.alert("تم", result.message || "تم تجديد العقد");
      setSelected(null);
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تجديد العقد");
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

  const urgent = items.filter((item) => Number(item.days_to_end ?? 9999) <= 30);
  const ended = items.filter((item) => item.status === "ended" || Number(item.days_to_end ?? 1) < 0);
  const cycleOptions: PaymentCycle[] = ["monthly", "quarterly", "semi_annual", "annual"];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>تجديد العقود</Text>
        <Text style={styles.subtitle}>
          عقود منتهية أو قريبة من الانتهاء خلال 90 يوم
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>العقود المعروضة: {items.length}</Text>
          <Text style={styles.summaryText}>خلال 30 يوم: {urgent.length}</Text>
          <Text style={styles.summaryText}>منتهية: {ended.length}</Text>
        </View>
{selected ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>تجديد العقد</Text>
            <Text style={styles.detail}>العقد: #{selected.contract_number || selected.id}</Text>
            <Text style={styles.detail}>المستأجر: {selected.tenant?.name || "-"}</Text>
            <Text style={styles.detail}>العقار: {selected.unit?.property?.name || "-"}</Text>
            <Text style={styles.detail}>الوحدة: {selected.unit?.unit_number || "-"}</Text>

            <TextInput
              style={styles.input}
              placeholder="تاريخ بداية التجديد YYYY-MM-DD"
              value={startDate}
              onChangeText={setStartDate}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="تاريخ نهاية التجديد YYYY-MM-DD"
              value={endDate}
              onChangeText={setEndDate}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="قيمة الإيجار الجديدة"
              value={rentAmount}
              onChangeText={setRentAmount}
              keyboardType="number-pad"
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="رسوم الموقف"
              value={parkingFee}
              onChangeText={setParkingFee}
              keyboardType="number-pad"
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="رسوم الخدمات"
              value={servicesFee}
              onChangeText={setServicesFee}
              keyboardType="number-pad"
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="عدد الدفعات"
              value={paymentsCount}
              onChangeText={setPaymentsCount}
              keyboardType="number-pad"
              textAlign="right"
            />

            <Text style={styles.label}>دورة السداد</Text>
            <View style={styles.chips}>
              {cycleOptions.map((cycle) => (
                <TouchableOpacity
                  key={cycle}
                  style={[styles.chip, paymentCycle === cycle ? styles.chipActive : null]}
                  onPress={() => setPaymentCycle(cycle)}
                >
                  <Text style={[styles.chipText, paymentCycle === cycle ? styles.chipTextActive : null]}>
                    {cycleLabel(cycle)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => setSelected(null)}
              >
                <Text style={styles.actionText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={renewContract}
                disabled={saving}
              >
                <Text style={styles.actionText}>
                  {saving ? "جاري التجديد..." : "تجديد"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل عقود التجديد...</Text>
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد عقود قريبة من الانتهاء حاليًا</Text>
          </View>
        ) : null}

        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.badge}>
                {Number(item.days_to_end ?? 9999) < 0
                  ? "منتهي"
                  : `باقي ${item.days_to_end ?? "-"} يوم`}
              </Text>

              <Text style={styles.cardTitle}>عقد #{item.contract_number || item.id}</Text>
            </View>

            <Text style={styles.detail}>الحالة: {statusLabel(item.status)}</Text>
            <Text style={styles.detail}>المستأجر: {item.tenant?.name || "-"}</Text>
            <Text style={styles.detail}>جوال المستأجر: {item.tenant?.phone || "-"}</Text>
            <Text style={styles.detail}>المالك: {item.unit?.property?.owner?.name || "-"}</Text>
            <Text style={styles.detail}>العقار: {item.unit?.property?.name || "-"}</Text>
            <Text style={styles.detail}>الوحدة: {item.unit?.unit_number || "-"}</Text>
            <Text style={styles.detail}>تاريخ النهاية: {item.end_date || "-"}</Text>
            <Text style={styles.amount}>الإيجار الحالي: {money(item.rent_amount)}</Text>

            <View style={styles.statsRow}>
              <Text style={styles.stat}>مدفوع: {money(item.summary?.paid_amount)}</Text>
              <Text style={styles.stat}>مستحق: {money(item.summary?.due_amount)}</Text>
              <Text style={styles.stat}>متأخر: {money(item.summary?.overdue_amount)}</Text>
            </View>

            <TouchableOpacity style={styles.renewButton} onPress={() => selectContract(item)}>
              <Text style={styles.renewButtonText}>تجديد هذا العقد</Text>
            </TouchableOpacity>
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
  primaryButton: { backgroundColor: "#111827", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  formCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14 },
  formTitle: { fontSize: 20, fontWeight: "800", color: "#111827", textAlign: "right", marginBottom: 10 },
  label: { color: "#374151", fontWeight: "800", textAlign: "right", marginBottom: 8 },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 12 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  badge: { backgroundColor: "#fef3c7", color: "#92400e", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  cardTitle: { fontSize: 19, fontWeight: "800", color: "#111827", textAlign: "right", flex: 1 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  amount: { marginTop: 8, color: "#166534", fontWeight: "800", textAlign: "right" },
  statsRow: { marginTop: 12, flexDirection: "row-reverse", flexWrap: "wrap" },
  stat: { backgroundColor: "#f3f4f6", color: "#374151", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: "hidden", fontWeight: "700", marginLeft: 8, marginBottom: 8 },
  renewButton: { backgroundColor: "#16a34a", padding: 12, borderRadius: 12, alignItems: "center", marginTop: 14 },
  renewButtonText: { color: "#fff", fontWeight: "800" },
  actionsRow: { flexDirection: "row-reverse", marginTop: 12 },
  actionButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  cancelButton: { backgroundColor: "#7A766F" },
  saveButton: { backgroundColor: "#16a34a" },
  actionText: { color: "#fff", fontWeight: "800" },
});
