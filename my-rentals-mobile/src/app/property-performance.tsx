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

type PropertyPerformanceItem = {
  id: number;
  name?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
  city?: string | null;
  district?: string | null;
  property_type?: string | null;
  management_type?: string | null;
  units_count?: number;
  rented_units_count?: number;
  vacant_units_count?: number;
  occupancy_rate?: number;
  active_contracts_count?: number;
  monthly_rent?: number;
  annualized_rent?: number;
  paid_income?: number;
  due_income?: number;
  overdue_income?: number;
  expenses?: number;
  expenses_count?: number;
  utility_due?: number;
  utility_overdue?: number;
  utility_bills_count?: number;
  net_income?: number;
  maintenance_open?: number;
  maintenance_urgent?: number;
  documents_expiring?: number;
  risk_score?: number;
};

type PropertyPerformancePayload = {
  summary?: {
    properties_count?: number;
    units_count?: number;
    rented_units_count?: number;
    vacant_units_count?: number;
    occupancy_rate?: number;
    monthly_rent?: number;
    annualized_rent?: number;
    paid_income?: number;
    due_income?: number;
    overdue_income?: number;
    expenses?: number;
    utility_overdue?: number;
    net_income?: number;
    maintenance_open?: number;
    documents_expiring?: number;
  };
  items?: PropertyPerformanceItem[];
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function riskLabel(value?: number) {
  const score = Number(value || 0);
  if (score >= 70) return "مرتفع";
  if (score >= 35) return "متوسط";
  return "منخفض";
}

function riskStyle(value?: number) {
  const score = Number(value || 0);
  if (score >= 70) return styles.riskHigh;
  if (score >= 35) return styles.riskMedium;
  return styles.riskLow;
}

function propertyTypeLabel(value?: string | null) {
  if (value === "building") return "عمارة";
  if (value === "apartment") return "شقة مستقلة";
  if (value === "villa") return "فيلا";
  return value || "-";
}

export default function PropertyPerformanceScreen() {
  const [data, setData] = useState<PropertyPerformancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [sortMode, setSortMode] = useState("net");

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/property-performance",
        "/my/property-performance"
      );

      setData(result as PropertyPerformancePayload);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل تحليل أداء العقارات");
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

  const items = data?.items || [];
  const summary = data?.summary || {};

  const owners = useMemo(() => {
    const map = new Map<string, string>();

    items.forEach((item) => {
      const id = String(item.owner_id || "none");
      const name = item.owner_name || "مالك غير محدد";
      map.set(id, name);
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const visibleItems = useMemo(() => {
    const filtered = ownerFilter === "all"
      ? items
      : items.filter((item) => String(item.owner_id || "none") === ownerFilter);

    return [...filtered].sort((a, b) => {
      if (sortMode === "occupancy") {
        return Number(b.occupancy_rate || 0) - Number(a.occupancy_rate || 0);
      }

      if (sortMode === "risk") {
        return Number(b.risk_score || 0) - Number(a.risk_score || 0);
      }

      if (sortMode === "overdue") {
        return Number(b.overdue_income || 0) - Number(a.overdue_income || 0);
      }

      return Number(b.net_income || 0) - Number(a.net_income || 0);
    });
  }, [items, ownerFilter, sortMode]);

  const sortOptions = [
    { id: "net", label: "الصافي" },
    { id: "occupancy", label: "الإشغال" },
    { id: "overdue", label: "المتأخر" },
    { id: "risk", label: "المخاطر" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>تحليل أداء العقارات</Text>
        <Text style={styles.subtitle}>
          مقارنة ربحية العقارات ونسبة الإشغال والمتأخرات والمخاطر التشغيلية
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>العقارات: {summary.properties_count ?? 0}</Text>
          <Text style={styles.summaryText}>الوحدات: {summary.units_count ?? 0}</Text>
          <Text style={styles.summaryText}>نسبة الإشغال: {summary.occupancy_rate ?? 0}%</Text>
          <Text style={styles.summaryText}>الإيجار الشهري المتوقع: {money(summary.monthly_rent)}</Text>
          <Text style={styles.summaryText}>المقبوض: {money(summary.paid_income)}</Text>
          <Text style={styles.summaryText}>المتأخر: {money(summary.overdue_income)}</Text>
          <Text style={styles.netText}>الصافي: {money(summary.net_income)}</Text>
        </View>
<Text style={styles.filterTitle}>فلترة حسب المالك</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterChip, ownerFilter === "all" ? styles.filterChipActive : null]}
            onPress={() => setOwnerFilter("all")}
          >
            <Text style={[styles.filterText, ownerFilter === "all" ? styles.filterTextActive : null]}>
              كل الملاك
            </Text>
          </TouchableOpacity>

          {owners.map((owner) => (
            <TouchableOpacity
              key={owner.id}
              style={[styles.filterChip, ownerFilter === owner.id ? styles.filterChipActive : null]}
              onPress={() => setOwnerFilter(owner.id)}
            >
              <Text style={[styles.filterText, ownerFilter === owner.id ? styles.filterTextActive : null]}>
                {owner.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.filterTitle}>ترتيب حسب</Text>
        <View style={styles.sortRow}>
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[styles.sortChip, sortMode === option.id ? styles.sortChipActive : null]}
              onPress={() => setSortMode(option.id)}
            >
              <Text style={[styles.sortText, sortMode === option.id ? styles.sortTextActive : null]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل تحليل الأداء...</Text>
          </View>
        ) : null}

        {!loading && visibleItems.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد عقارات لتحليلها حاليًا</Text>
          </View>
        ) : null}

        {visibleItems.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[styles.riskBadge, riskStyle(item.risk_score)]}>
                مخاطر {riskLabel(item.risk_score)}
              </Text>
              <Text style={styles.cardTitle}>{item.name || "عقار"}</Text>
            </View>

            <Text style={styles.detail}>المالك: {item.owner_name || "-"}</Text>
            <Text style={styles.detail}>المدينة/الحي: {item.city || "-"} / {item.district || "-"}</Text>
            <Text style={styles.detail}>نوع العقار: {propertyTypeLabel(item.property_type)}</Text>

            <View style={styles.metricsGrid}>
              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>{item.occupancy_rate ?? 0}%</Text>
                <Text style={styles.metricLabel}>الإشغال</Text>
              </View>

              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>{item.vacant_units_count ?? 0}</Text>
                <Text style={styles.metricLabel}>شاغرة</Text>
              </View>

              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>{item.active_contracts_count ?? 0}</Text>
                <Text style={styles.metricLabel}>عقود</Text>
              </View>
            </View>

            <View style={styles.financeBox}>
              <Text style={styles.financeLine}>الإيجار الشهري المتوقع: {money(item.monthly_rent)}</Text>
              <Text style={styles.financeLine}>المقبوض: {money(item.paid_income)}</Text>
              <Text style={styles.financeLine}>المستحق: {money(item.due_income)}</Text>
              <Text style={styles.overdueLine}>المتأخر: {money(item.overdue_income)}</Text>
              <Text style={styles.financeLine}>المصاريف: {money(item.expenses)}</Text>
              <Text style={styles.financeLine}>فواتير خدمات متأخرة: {money(item.utility_overdue)}</Text>
              <Text style={styles.netLine}>الصافي: {money(item.net_income)}</Text>
            </View>

            <View style={styles.operationsBox}>
              <Text style={styles.operationLine}>صيانة مفتوحة: {item.maintenance_open ?? 0}</Text>
              <Text style={styles.operationLine}>صيانة عاجلة: {item.maintenance_urgent ?? 0}</Text>
              <Text style={styles.operationLine}>مستندات قريبة الانتهاء: {item.documents_expiring ?? 0}</Text>
              <Text style={styles.operationLine}>درجة المخاطر: {item.risk_score ?? 0}/100</Text>
            </View>
          </View>
        ))}

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            درجة المخاطر ترتفع عند وجود متأخرات، صيانة عاجلة، مستندات قريبة الانتهاء، أو انخفاض الإشغال.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 18, paddingBottom: 50 },
  title: { fontSize: 30, fontWeight: "900", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", fontSize: 15, textAlign: "right", lineHeight: 22 },
  summaryBox: { backgroundColor: "#111827", borderRadius: 18, padding: 16, marginBottom: 14 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  netText: { color: "#bbf7d0", fontWeight: "900", textAlign: "right", marginTop: 6, fontSize: 18 },
  primaryButton: { backgroundColor: "#0F9B6F", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  primaryButtonText: { color: "#fff", fontWeight: "900" },
  filterTitle: { color: "#374151", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  filtersRow: { flexDirection: "row-reverse", paddingBottom: 12 },
  filterChip: { backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginLeft: 8, borderWidth: 1, borderColor: "#DDDBD6" },
  filterChipActive: { backgroundColor: "#111827" },
  filterText: { color: "#374151", fontWeight: "900" },
  filterTextActive: { color: "#fff" },
  sortRow: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 14 },
  sortChip: { backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8, borderWidth: 1, borderColor: "#DDDBD6" },
  sortChipActive: { backgroundColor: "#0F9B6F" },
  sortText: { color: "#374151", fontWeight: "900" },
  sortTextActive: { color: "#fff" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  riskLow: { backgroundColor: "#dcfce7", color: "#166534" },
  riskMedium: { backgroundColor: "#fef3c7", color: "#92400e" },
  riskHigh: { backgroundColor: "#fee2e2", color: "#991b1b" },
  cardTitle: { color: "#111827", fontSize: 20, fontWeight: "900", textAlign: "right", flex: 1 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  metricsGrid: { flexDirection: "row-reverse", gap: 8, marginTop: 14 },
  metricBox: { flex: 1, backgroundColor: "#eff6ff", borderRadius: 14, padding: 12, alignItems: "center" },
  metricValue: { color: "#065F44", fontSize: 22, fontWeight: "900" },
  metricLabel: { color: "#065F44", fontWeight: "800", marginTop: 4 },
  financeBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 12 },
  financeLine: { color: "#374151", fontWeight: "800", textAlign: "right", marginBottom: 5 },
  overdueLine: { color: "#b91c1c", fontWeight: "900", textAlign: "right", marginBottom: 5 },
  netLine: { color: "#166534", fontWeight: "900", textAlign: "right", marginTop: 4 },
  operationsBox: { backgroundColor: "#fff7ed", borderRadius: 14, padding: 12, marginTop: 12 },
  operationLine: { color: "#92400e", fontWeight: "800", textAlign: "right", marginBottom: 5 },
  noteBox: { backgroundColor: "#fffbeb", borderRadius: 18, padding: 14, marginTop: 4 },
  noteText: { color: "#92400e", fontWeight: "700", textAlign: "right", lineHeight: 22 },
});
