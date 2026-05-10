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

type SmartAlert = {
  type?: string;
  severity?: string;
  title?: string;
  subtitle?: string | null;
  alert_date?: string | null;
  date_label?: string | null;
  meta?: Record<string, unknown>;
};

type SmartAlertsPayload = {
  summary?: {
    total?: number;
    critical?: number;
    warning?: number;
    info?: number;
  };
  items?: SmartAlert[];
};

function typeLabel(value?: string) {
  if (value === "payment") return "دفعات";
  if (value === "contract") return "عقود";
  if (value === "utility") return "خدمات";
  if (value === "document") return "مستندات";
  if (value === "maintenance") return "صيانة";
  if (value === "followup") return "متابعات";
  return "أخرى";
}

function severityLabel(value?: string) {
  if (value === "critical") return "عاجل";
  if (value === "warning") return "تنبيه";
  if (value === "info") return "معلومة";
  return value || "-";
}

function severityStyle(value?: string) {
  if (value === "critical") return styles.criticalBadge;
  if (value === "warning") return styles.warningBadge;
  if (value === "info") return styles.infoBadge;
  return styles.neutralBadge;
}

export default function SmartAlertsScreen() {
  const [payload, setPayload] = useState<SmartAlertsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/smart-alerts",
        "/my/smart-alerts"
      );

      setPayload(result as SmartAlertsPayload);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل مركز التنبيهات");
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

  const items = payload?.items || [];
  const summary = payload?.summary || {};

  const filters = useMemo(() => {
    const types = Array.from(new Set(items.map((item) => item.type || "other")));
    return ["all", ...types];
  }, [items]);

  const visibleItems = filter === "all"
    ? items
    : items.filter((item) => (item.type || "other") === filter);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>مركز التنبيهات الذكي</Text>
        <Text style={styles.subtitle}>
          شاشة موحدة للتنبيهات المهمة من الدفعات والعقود والخدمات والمستندات والمتابعات
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>إجمالي التنبيهات: {summary.total ?? 0}</Text>
          <Text style={styles.summaryText}>عاجلة: {summary.critical ?? 0}</Text>
          <Text style={styles.summaryText}>تنبيهات: {summary.warning ?? 0}</Text>
          <Text style={styles.summaryText}>معلومات: {summary.info ?? 0}</Text>
        </View>
<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {filters.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.filterChip, filter === type ? styles.filterChipActive : null]}
              onPress={() => setFilter(type)}
            >
              <Text style={[styles.filterText, filter === type ? styles.filterTextActive : null]}>
                {type === "all" ? "الكل" : typeLabel(type)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل التنبيهات...</Text>
          </View>
        ) : null}

        {!loading && visibleItems.length === 0 ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>لا توجد تنبيهات في هذا التصنيف حاليًا.</Text>
          </View>
        ) : null}

        {visibleItems.map((item, index) => (
          <View key={`${item.type}-${item.severity}-${item.alert_date}-${index}`} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[styles.badge, severityStyle(item.severity)]}>
                {severityLabel(item.severity)}
              </Text>
              <Text style={styles.dateText}>{item.date_label || item.alert_date || "-"}</Text>
            </View>

            <Text style={styles.cardTitle}>{item.title || "تنبيه"}</Text>
            <Text style={styles.typeText}>{typeLabel(item.type)}</Text>
            <Text style={styles.subtitleText}>{item.subtitle || "-"}</Text>

            {item.meta ? (
              <View style={styles.metaBox}>
                {Object.entries(item.meta).slice(0, 6).map(([key, value]) => (
                  <Text key={key} style={styles.metaText}>
                    {key}: {String(value ?? "-")}
                  </Text>
                ))}
              </View>
            ) : null}
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
  filtersRow: { flexDirection: "row-reverse", paddingBottom: 12 },
  filterChip: { backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginLeft: 8, borderWidth: 1, borderColor: "#DDDBD6" },
  filterChipActive: { backgroundColor: "#111827" },
  filterText: { color: "#374151", fontWeight: "800" },
  filterTextActive: { color: "#fff" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  successBox: { backgroundColor: "#dcfce7", padding: 16, borderRadius: 18, marginBottom: 12 },
  successText: { color: "#166534", fontWeight: "800", textAlign: "right" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  criticalBadge: { backgroundColor: "#fee2e2", color: "#991b1b" },
  warningBadge: { backgroundColor: "#fef3c7", color: "#92400e" },
  infoBadge: { backgroundColor: "#dbeafe", color: "#065F44" },
  neutralBadge: { backgroundColor: "#f3f4f6", color: "#374151" },
  dateText: { color: "#7A766F", fontWeight: "700", textAlign: "right", flex: 1 },
  cardTitle: { marginTop: 12, fontSize: 20, fontWeight: "800", color: "#111827", textAlign: "right" },
  typeText: { marginTop: 5, color: "#0F9B6F", fontWeight: "800", textAlign: "right" },
  subtitleText: { marginTop: 8, color: "#5E5B55", textAlign: "right", lineHeight: 22 },
  metaBox: { backgroundColor: "#F7F6F4", borderRadius: 12, padding: 10, marginTop: 12 },
  metaText: { color: "#7A766F", textAlign: "right", marginTop: 4 },
});
