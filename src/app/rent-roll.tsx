import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGetScoped } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type RentRollItem = {
  id: number;
  contract_number?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  rent_amount?: number;
  parking_fee?: number;
  services_fee?: number;
  monthly_total?: number;
  payment_cycle?: string | null;
  payments_total?: number;
  received_total?: number;
  remaining_total?: number;
  overdue_total?: number;
  next_due_date?: string | null;
  next_due_amount?: number | null;
  tenant?: {
    id?: number;
    name?: string | null;
    phone?: string | null;
    national_id?: string | null;
  };
  unit?: {
    id?: number;
    unit_number?: string | null;
    floor?: string | null;
    type?: string | null;
  };
  property?: {
    id?: number;
    name?: string | null;
    city?: string | null;
    district?: string | null;
    property_type?: string | null;
  };
  owner?: {
    id?: number;
    name?: string | null;
    phone?: string | null;
  };
};

type RentRollReport = {
  summary?: {
    contracts_count?: number;
    monthly_rent?: number;
    monthly_parking?: number;
    monthly_services?: number;
    monthly_total?: number;
    payments_total?: number;
    received_total?: number;
    remaining_total?: number;
    overdue_total?: number;
  };
  items?: RentRollItem[];
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function cycleLabel(value?: string | null) {
  if (value === "monthly") return "شهري";
  if (value === "quarterly") return "ربع سنوي";
  if (value === "semi_annual") return "نصف سنوي";
  if (value === "annual") return "سنوي";
  return value || "-";
}

export default function RentRollScreen() {
  const [report, setReport] = useState<RentRollReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/rent-roll",
        "/my/rent-roll"
      );

      setReport(result as RentRollReport);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل كشف الإيجارات");
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
    load();
  }, []);

  const items = report?.items || [];
  const summary = report?.summary || {};

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      const id = String(item.owner?.id || "none");
      const name = item.owner?.name || "مالك غير محدد";
      map.set(id, name);
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const visibleItems = filter === "all"
    ? items
    : items.filter((item) => String(item.owner?.id || "none") === filter);

  const visibleMonthlyTotal = visibleItems.reduce((sum, item) => sum + Number(item.monthly_total || 0), 0);
  const visibleRemaining = visibleItems.reduce((sum, item) => sum + Number(item.remaining_total || 0), 0);
  const visibleOverdue = visibleItems.reduce((sum, item) => sum + Number(item.overdue_total || 0), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>كشف الإيجارات</Text>
        <Text style={styles.subtitle}>
          قائمة العقود النشطة وقيمة الإيجار الشهري والمتبقي والتحصيل
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>العقود النشطة: {summary.contracts_count ?? 0}</Text>
          <Text style={styles.summaryText}>الإيجار الشهري: {money(summary.monthly_rent)}</Text>
          <Text style={styles.summaryText}>المواقف: {money(summary.monthly_parking)}</Text>
          <Text style={styles.summaryText}>الخدمات: {money(summary.monthly_services)}</Text>
          <Text style={styles.netText}>الإجمالي الشهري: {money(summary.monthly_total)}</Text>
        </View>

        <View style={styles.collectionBox}>
          <Text style={styles.collectionText}>إجمالي الدفعات: {money(summary.payments_total)}</Text>
          <Text style={styles.collectionText}>المقبوض: {money(summary.received_total)}</Text>
          <Text style={styles.collectionText}>المتبقي: {money(summary.remaining_total)}</Text>
          <Text style={styles.collectionText}>المتأخر: {money(summary.overdue_total)}</Text>
        </View>
<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterChip, filter === "all" ? styles.filterChipActive : null]}
            onPress={() => setFilter("all")}
          >
            <Text style={[styles.filterText, filter === "all" ? styles.filterTextActive : null]}>
              كل الملاك
            </Text>
          </TouchableOpacity>

          {owners.map((owner) => (
            <TouchableOpacity
              key={owner.id}
              style={[styles.filterChip, filter === owner.id ? styles.filterChipActive : null]}
              onPress={() => setFilter(owner.id)}
            >
              <Text style={[styles.filterText, filter === owner.id ? styles.filterTextActive : null]}>
                {owner.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.visibleBox}>
          <Text style={styles.visibleText}>المعروض: {visibleItems.length}</Text>
          <Text style={styles.visibleText}>شهريًا: {money(visibleMonthlyTotal)}</Text>
          <Text style={styles.visibleText}>متبقي: {money(visibleRemaining)}</Text>
          <Text style={styles.visibleText}>متأخر: {money(visibleOverdue)}</Text>
        </View>

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل كشف الإيجارات...</Text>
          </View>
        ) : null}

        {!loading && visibleItems.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد عقود نشطة حاليًا</Text>
          </View>
        ) : null}

        {visibleItems.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.badge}>نشط</Text>
              <Text style={styles.cardTitle}>عقد #{item.contract_number || item.id}</Text>
            </View>

            <Text style={styles.detail}>المالك: {item.owner?.name || "-"}</Text>
            <Text style={styles.detail}>العقار: {item.property?.name || "-"}</Text>
            <Text style={styles.detail}>المدينة/الحي: {item.property?.city || "-"} / {item.property?.district || "-"}</Text>
            <Text style={styles.detail}>الوحدة: {item.unit?.unit_number || "-"} | الدور: {item.unit?.floor || "-"}</Text>
            <Text style={styles.detail}>المستأجر: {item.tenant?.name || "-"}</Text>
            <Text style={styles.detail}>جوال المستأجر: {item.tenant?.phone || "-"}</Text>
            <Text style={styles.detail}>الفترة: {item.start_date || "-"} إلى {item.end_date || "-"}</Text>
            <Text style={styles.detail}>دورة السداد: {cycleLabel(item.payment_cycle)}</Text>

            <View style={styles.moneyBox}>
              <Text style={styles.moneyLine}>الإيجار: {money(item.rent_amount)}</Text>
              <Text style={styles.moneyLine}>الموقف: {money(item.parking_fee)}</Text>
              <Text style={styles.moneyLine}>الخدمات: {money(item.services_fee)}</Text>
              <Text style={styles.totalLine}>الإجمالي الشهري: {money(item.monthly_total)}</Text>
            </View>

            <View style={styles.paymentBox}>
              <Text style={styles.paymentLine}>إجمالي الدفعات: {money(item.payments_total)}</Text>
              <Text style={styles.paymentLine}>المقبوض: {money(item.received_total)}</Text>
              <Text style={styles.remainingLine}>المتبقي: {money(item.remaining_total)}</Text>
              <Text style={styles.overdueLine}>المتأخر: {money(item.overdue_total)}</Text>
              <Text style={styles.paymentLine}>أقرب استحقاق: {item.next_due_date || "-"} — {money(item.next_due_amount)}</Text>
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
  summaryBox: { backgroundColor: "#111827", borderRadius: 18, padding: 16, marginBottom: 12 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  netText: { color: "#bbf7d0", fontWeight: "800", textAlign: "right", marginTop: 6, fontSize: 18 },
  collectionBox: { backgroundColor: "#eff6ff", borderRadius: 18, padding: 14, marginBottom: 14 },
  collectionText: { color: "#065F44", fontWeight: "800", textAlign: "right", marginBottom: 5 },
  primaryButton: { backgroundColor: "#0F9B6F", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  filtersRow: { flexDirection: "row-reverse", paddingBottom: 12 },
  filterChip: { backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginLeft: 8, borderWidth: 1, borderColor: "#DDDBD6" },
  filterChipActive: { backgroundColor: "#111827" },
  filterText: { color: "#374151", fontWeight: "800" },
  filterTextActive: { color: "#fff" },
  visibleBox: { backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 14 },
  visibleText: { color: "#374151", fontWeight: "800", textAlign: "right", marginBottom: 5 },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  badge: { backgroundColor: "#dcfce7", color: "#166534", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  cardTitle: { fontSize: 19, fontWeight: "800", color: "#111827", textAlign: "right", flex: 1 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  moneyBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 12 },
  moneyLine: { color: "#374151", fontWeight: "700", textAlign: "right", marginBottom: 5 },
  totalLine: { color: "#166534", fontWeight: "800", textAlign: "right", marginTop: 4 },
  paymentBox: { backgroundColor: "#fff7ed", borderRadius: 14, padding: 12, marginTop: 12 },
  paymentLine: { color: "#92400e", fontWeight: "700", textAlign: "right", marginBottom: 5 },
  remainingLine: { color: "#b45309", fontWeight: "800", textAlign: "right", marginBottom: 5 },
  overdueLine: { color: "#b91c1c", fontWeight: "800", textAlign: "right", marginBottom: 5 },
});
