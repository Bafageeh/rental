import { useEffect, useState } from "react";
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
import { apiGetScoped, apiPost } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type CheckItem = {
  id?: number;
  name?: string | null;
  unit_number?: string | null;
  property_name?: string | null;
  tenant_name?: string | null;
  owner_name?: string | null;
  amount?: number;
  due_date?: string | null;
  end_date?: string | null;
  message?: string | null;
  [key: string]: unknown;
};

type HealthCheck = {
  key: string;
  title: string;
  severity: "issue" | "warning" | string;
  count: number;
  items: CheckItem[];
};

type DataHealth = {
  summary?: {
    score?: number;
    issues_count?: number;
    warnings_count?: number;
    checks_count?: number;
    properties_count?: number;
    units_count?: number;
    contracts_count?: number;
    payments_count?: number;
  };
  checks?: HealthCheck[];
};

function severityLabel(value?: string) {
  if (value === "issue") return "مشكلة";
  if (value === "warning") return "تنبيه";
  return value || "-";
}

function severityStyle(value?: string) {
  if (value === "issue") return styles.issueBadge;
  if (value === "warning") return styles.warningBadge;
  return styles.neutralBadge;
}

export default function DataHealthScreen() {
  const [data, setData] = useState<DataHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/data-health",
        "/my/data-health"
      );

      setData(result as DataHealth);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل فحص البيانات");
    } finally {
      setLoading(false);
    }
  }

  async function fixOverduePayments() {
    try {
      setFixing(true);

      const result = await apiPost("/data-health/fix-overdue-payments");
      Alert.alert("تم", result.message || "تم تحديث الدفعات");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تنفيذ الإصلاح");
    } finally {
      setFixing(false);
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

  const summary = data?.summary || {};
  const checks = data?.checks || [];
  const score = Number(summary.score ?? 100);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>فحص سلامة البيانات</Text>
        <Text style={styles.subtitle}>
          اكتشاف السجلات الناقصة أو غير المتسقة قبل التقارير والمحاسبة
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.scoreText}>درجة السلامة: {score}%</Text>
          <Text style={styles.summaryText}>المشاكل: {summary.issues_count ?? 0}</Text>
          <Text style={styles.summaryText}>التنبيهات: {summary.warnings_count ?? 0}</Text>
          <Text style={styles.summaryText}>إجمالي الملاحظات: {summary.checks_count ?? 0}</Text>
        </View>

        <View style={styles.actionsRow}>
<TouchableOpacity style={styles.fixButton} onPress={fixOverduePayments} disabled={fixing}>
            <Text style={styles.actionText}>{fixing ? "..." : "تحديث المتأخر"}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري فحص البيانات...</Text>
          </View>
        ) : null}

        {!loading && checks.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لم تظهر نتائج فحص حاليًا</Text>
          </View>
        ) : null}

        {!loading && Number(summary.checks_count || 0) === 0 ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>البيانات سليمة ولا توجد ملاحظات مهمة حاليًا.</Text>
          </View>
        ) : null}

        {checks.map((check) => {
          const expanded = expandedKey === check.key;

          return (
            <View key={check.key} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={[styles.badge, severityStyle(check.severity)]}>
                  {severityLabel(check.severity)}
                </Text>
                <Text style={styles.cardTitle}>{check.title}</Text>
              </View>

              <Text style={styles.countText}>العدد: {check.count}</Text>

              {check.count > 0 ? (
                <TouchableOpacity
                  style={styles.detailsButton}
                  onPress={() => setExpandedKey(expanded ? null : check.key)}
                >
                  <Text style={styles.detailsButtonText}>
                    {expanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {expanded ? (
                <View style={styles.detailsBox}>
                  {(check.items || []).map((item, index) => (
                    <View key={`${check.key}-${item.id || index}`} style={styles.itemBox}>
                      <Text style={styles.itemTitle}>
                        {item.name || item.unit_number || item.tenant_name || item.property_name || `سجل #${item.id || index + 1}`}
                      </Text>
                      {item.message ? <Text style={styles.itemText}>{item.message}</Text> : null}
                      {item.property_name ? <Text style={styles.itemText}>العقار: {String(item.property_name)}</Text> : null}
                      {item.owner_name ? <Text style={styles.itemText}>المالك: {String(item.owner_name)}</Text> : null}
                      {item.tenant_name ? <Text style={styles.itemText}>المستأجر: {String(item.tenant_name)}</Text> : null}
                      {item.due_date ? <Text style={styles.itemText}>الاستحقاق: {String(item.due_date)}</Text> : null}
                      {item.end_date ? <Text style={styles.itemText}>نهاية العقد: {String(item.end_date)}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
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
  scoreText: { color: "#93c5fd", fontWeight: "800", textAlign: "right", marginBottom: 8, fontSize: 20 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  actionsRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 14 },
  refreshButton: { flex: 1, backgroundColor: "#0F9B6F", padding: 12, borderRadius: 12, alignItems: "center" },
  fixButton: { flex: 1, backgroundColor: "#16a34a", padding: 12, borderRadius: 12, alignItems: "center" },
  actionText: { color: "#fff", fontWeight: "800" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  successBox: { backgroundColor: "#dcfce7", padding: 16, borderRadius: 18, marginBottom: 12 },
  successText: { color: "#166534", fontWeight: "800", textAlign: "right" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  issueBadge: { backgroundColor: "#fee2e2", color: "#991b1b" },
  warningBadge: { backgroundColor: "#fef3c7", color: "#92400e" },
  neutralBadge: { backgroundColor: "#f3f4f6", color: "#374151" },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#111827", textAlign: "right", flex: 1 },
  countText: { marginTop: 10, color: "#5E5B55", fontWeight: "800", textAlign: "right" },
  detailsButton: { backgroundColor: "#111827", padding: 11, borderRadius: 12, alignItems: "center", marginTop: 12 },
  detailsButtonText: { color: "#fff", fontWeight: "800" },
  detailsBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 12 },
  itemBox: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 10 },
  itemTitle: { color: "#111827", fontWeight: "800", textAlign: "right" },
  itemText: { color: "#5E5B55", textAlign: "right", marginTop: 6, lineHeight: 21 },
});
