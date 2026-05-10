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

type ActivityItem = {
  type?: string;
  title?: string;
  subtitle?: string | null;
  happened_at?: string;
  date_label?: string;
  meta?: Record<string, unknown>;
};

function typeLabel(type?: string) {
  if (type === "property") return "عقار";
  if (type === "unit") return "وحدة";
  if (type === "contract") return "عقد";
  if (type === "payment") return "دفعة";
  if (type === "tenant") return "مستأجر";
  if (type === "expense") return "مصروف";
  if (type === "maintenance") return "صيانة";
  if (type === "parking") return "موقف";
  return "نشاط";
}

function typeStyle(type?: string) {
  if (type === "payment") return styles.typePayment;
  if (type === "expense") return styles.typeExpense;
  if (type === "maintenance") return styles.typeMaintenance;
  if (type === "contract") return styles.typeContract;
  return styles.typeDefault;
}

export default function ActivityFeedScreen() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/activity-feed",
        "/my/activity-feed"
      );

      setItems(Array.isArray(result) ? result : []);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل سجل النشاط");
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
        <Text style={styles.title}>سجل النشاط</Text>
        <Text style={styles.subtitle}>
          آخر العمليات والتحديثات في العقارات والعقود والدفعات والصيانة
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>إجمالي الأنشطة: {items.length}</Text>
          <Text style={styles.summaryText}>المعروض الآن: {visibleItems.length}</Text>
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
            <Text style={styles.boxText}>جاري تحميل سجل النشاط...</Text>
          </View>
        ) : null}

        {!loading && visibleItems.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد أنشطة حاليًا</Text>
          </View>
        ) : null}

        {visibleItems.map((item, index) => (
          <View key={`${item.type}-${item.happened_at}-${index}`} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[styles.typeBadge, typeStyle(item.type)]}>
                {typeLabel(item.type)}
              </Text>
              <Text style={styles.dateText}>{item.date_label || item.happened_at || "-"}</Text>
            </View>

            <Text style={styles.cardTitle}>{item.title || "نشاط"}</Text>
            <Text style={styles.subtitleText}>{item.subtitle || "-"}</Text>

            {item.meta ? (
              <View style={styles.metaBox}>
                {Object.entries(item.meta).slice(0, 5).map(([key, value]) => (
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
  primaryButton: { backgroundColor: "#111827", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  filtersRow: { flexDirection: "row-reverse", paddingBottom: 12 },
  filterChip: { backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginLeft: 8, borderWidth: 1, borderColor: "#DDDBD6" },
  filterChipActive: { backgroundColor: "#111827" },
  filterText: { color: "#374151", fontWeight: "800" },
  filterTextActive: { color: "#fff" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  typeDefault: { backgroundColor: "#f3f4f6", color: "#374151" },
  typePayment: { backgroundColor: "#dcfce7", color: "#166534" },
  typeExpense: { backgroundColor: "#fee2e2", color: "#991b1b" },
  typeMaintenance: { backgroundColor: "#fef3c7", color: "#92400e" },
  typeContract: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  dateText: { color: "#7A766F", fontWeight: "700", textAlign: "right", flex: 1 },
  cardTitle: { marginTop: 12, fontSize: 19, fontWeight: "800", color: "#111827", textAlign: "right" },
  subtitleText: { marginTop: 8, color: "#5E5B55", textAlign: "right", lineHeight: 22 },
  metaBox: { backgroundColor: "#F7F6F4", borderRadius: 12, padding: 10, marginTop: 12 },
  metaText: { color: "#7A766F", textAlign: "right", marginTop: 4 },
});
