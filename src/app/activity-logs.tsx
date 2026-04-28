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
import { apiGetScoped, apiPost } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type ActivityLog = {
  id: number;
  action?: string | null;
  resource?: string | null;
  resource_label?: string | null;
  record_id?: number | null;
  record_title?: string | null;
  owner_id?: number | null;
  user_id?: number | null;
  user_name?: string | null;
  user_email?: string | null;
  old_payload?: Record<string, unknown> | null;
  new_payload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at?: string | null;
};

function actionLabel(value?: string | null) {
  if (value === "update") return "تعديل";
  if (value === "delete") return "حذف";
  if (value === "archive") return "أرشفة/تعطيل";
  if (value === "restore") return "استعادة";
  if (value === "rollback") return "تراجع";
  if (value === "create") return "إضافة";
  return value || "-";
}

function actionStyle(value?: string | null) {
  if (value === "delete") return styles.actionDelete;
  if (value === "archive") return styles.actionArchive;
  if (value === "restore" || value === "rollback") return styles.actionRestore;
  return styles.actionUpdate;
}

function changedFields(oldPayload?: Record<string, unknown> | null, newPayload?: Record<string, unknown> | null) {
  if (!oldPayload || !newPayload) return [];

  return Object.keys(newPayload).filter((key) => {
    const oldValue = oldPayload[key] === null || oldPayload[key] === undefined ? "" : String(oldPayload[key]);
    const newValue = newPayload[key] === null || newPayload[key] === undefined ? "" : String(newPayload[key]);

    return oldValue !== newValue;
  });
}

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  return String(value);
}

function canRollback(item: ActivityLog) {
  return (item.action === "update" || item.action === "archive")
    && Boolean(item.old_payload)
    && Boolean(item.record_id)
    && Boolean(item.resource);
}

export default function ActivityLogsScreen() {
  const [items, setItems] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionFilter, setActionFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);

  async function load() {
    try {
      setLoading(true);

      const query = actionFilter === "all" ? "" : `?action=${encodeURIComponent(actionFilter)}`;

      const result = await apiGetScoped(
        `/activity-logs${query}`,
        `/my/activity-logs${query}`
      );

      setItems(Array.isArray(result) ? result : []);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل سجل العمليات");
    } finally {
      setLoading(false);
    }
  }

  async function rollback(item: ActivityLog) {
    if (!canRollback(item)) {
      Alert.alert("تنبيه", "التراجع متاح فقط للتعديل أو الأرشفة");
      return;
    }

    const fields = changedFields(item.old_payload, item.new_payload);

    Alert.alert(
      "تأكيد التراجع",
      `هل تريد استعادة القيم السابقة لهذا السجل؟\n\n${item.record_title || "#" + item.record_id}\n\nالحقول: ${fields.length ? fields.join(", ") : "-"}`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تراجع",
          onPress: async () => {
            try {
              setWorkingId(item.id);

              await apiPost(`/activity-logs/${item.id}/rollback`, {});

              Alert.alert("تم", "تم التراجع عن العملية واستعادة القيم السابقة");
              await load();
            } catch (e) {
              Alert.alert("تعذر التراجع", e instanceof Error ? e.message : "حدث خطأ أثناء التراجع");
            } finally {
              setWorkingId(null);
            }
          },
        },
      ]
    );
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
  }, [actionFilter]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      updates: items.filter((item) => item.action === "update").length,
      deletes: items.filter((item) => item.action === "delete").length,
      archives: items.filter((item) => item.action === "archive").length,
      restores: items.filter((item) => item.action === "restore").length,
      rollbacks: items.filter((item) => item.action === "rollback").length,
    };
  }, [items]);

  const filters = [
    { id: "all", label: "الكل" },
    { id: "update", label: "التعديلات" },
    { id: "delete", label: "الحذف" },
    { id: "archive", label: "الأرشفة" },
    { id: "rollback", label: "التراجع" },
    { id: "restore", label: "الاستعادة" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>سجل العمليات</Text>
        <Text style={styles.subtitle}>
          تتبع التعديلات والحذف والأرشفة مع إمكانية التراجع عن التعديلات الناجحة
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>الإجمالي المعروض: {summary.total}</Text>
          <Text style={styles.summaryText}>تعديلات: {summary.updates}</Text>
          <Text style={styles.summaryText}>حذف: {summary.deletes}</Text>
          <Text style={styles.summaryText}>أرشفة/تعطيل: {summary.archives}</Text>
          <Text style={styles.summaryText}>تراجع: {summary.rollbacks}</Text>
          <Text style={styles.summaryText}>استعادة: {summary.restores}</Text>
        </View>
<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {filters.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.filterChip, actionFilter === item.id ? styles.filterChipActive : null]}
              onPress={() => setActionFilter(item.id)}
            >
              <Text style={[styles.filterText, actionFilter === item.id ? styles.filterTextActive : null]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل سجل العمليات...</Text>
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد عمليات مسجلة حاليًا</Text>
          </View>
        ) : null}

        {items.map((item) => {
          const expanded = expandedId === item.id;
          const fields = changedFields(item.old_payload, item.new_payload);
          const rollbackAvailable = canRollback(item);

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={[styles.actionBadge, actionStyle(item.action)]}>
                  {actionLabel(item.action)}
                </Text>
                <Text style={styles.cardTitle}>{item.record_title || `#${item.record_id}`}</Text>
              </View>

              <Text style={styles.detail}>القسم: {item.resource_label || item.resource || "-"}</Text>
              <Text style={styles.detail}>رقم السجل: {item.record_id || "-"}</Text>
              <Text style={styles.detail}>المستخدم: {item.user_name || item.user_email || "-"}</Text>
              <Text style={styles.detail}>التاريخ: {item.created_at || "-"}</Text>
              <Text style={styles.detail}>الحقول المتغيرة: {fields.length > 0 ? fields.join(", ") : "-"}</Text>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.smallButton, styles.previewButton]}
                  onPress={() => setExpandedId(expanded ? null : item.id)}
                >
                  <Text style={styles.smallButtonText}>
                    {expanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                  </Text>
                </TouchableOpacity>

                {rollbackAvailable ? (
                  <TouchableOpacity
                    style={[styles.smallButton, styles.rollbackButton]}
                    onPress={() => rollback(item)}
                    disabled={workingId === item.id}
                  >
                    <Text style={styles.smallButtonText}>
                      {workingId === item.id ? "جاري..." : "تراجع عن العملية"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {item.action === "delete" ? (
                <Text style={styles.hintText}>للتراجع عن الحذف استخدم شاشة: المزيد &gt; سلة المحذوفات.</Text>
              ) : null}

              {expanded ? (
                <View style={styles.detailsBox}>
                  {fields.length === 0 ? (
                    <Text style={styles.detailsText}>لا توجد تفاصيل تغيير قابلة للعرض</Text>
                  ) : null}

                  {fields.slice(0, 40).map((field) => (
                    <View key={field} style={styles.changeRow}>
                      <Text style={styles.fieldName}>{field}</Text>
                      <Text style={styles.oldValue}>قبل: {valueText(item.old_payload?.[field])}</Text>
                      <Text style={styles.newValue}>بعد: {valueText(item.new_payload?.[field])}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            زر التراجع يعيد القيم السابقة للتعديل أو الأرشفة. أما الحذف فتتم استعادته من سلة المحذوفات.
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
  primaryButton: { backgroundColor: "#0F9B6F", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  primaryButtonText: { color: "#fff", fontWeight: "900" },
  filtersRow: { flexDirection: "row-reverse", paddingBottom: 12 },
  filterChip: { backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginLeft: 8, borderWidth: 1, borderColor: "#DDDBD6" },
  filterChipActive: { backgroundColor: "#111827" },
  filterText: { color: "#374151", fontWeight: "900" },
  filterTextActive: { color: "#fff" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  actionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  actionUpdate: { backgroundColor: "#dbeafe", color: "#065F44" },
  actionDelete: { backgroundColor: "#fee2e2", color: "#991b1b" },
  actionArchive: { backgroundColor: "#fef3c7", color: "#92400e" },
  actionRestore: { backgroundColor: "#dcfce7", color: "#166534" },
  cardTitle: { color: "#111827", fontSize: 19, fontWeight: "900", textAlign: "right", flex: 1 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  actionsRow: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  smallButton: { flex: 1, padding: 11, borderRadius: 12, alignItems: "center" },
  previewButton: { backgroundColor: "#111827" },
  rollbackButton: { backgroundColor: "#16a34a" },
  smallButtonText: { color: "#fff", fontWeight: "900", textAlign: "center" },
  hintText: { color: "#92400e", backgroundColor: "#fffbeb", padding: 10, borderRadius: 12, textAlign: "right", marginTop: 10, fontWeight: "800" },
  detailsBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 12 },
  detailsText: { color: "#7A766F", textAlign: "right" },
  changeRow: { borderBottomWidth: 1, borderBottomColor: "#DDDBD6", paddingVertical: 8 },
  fieldName: { color: "#111827", fontWeight: "900", textAlign: "right", marginBottom: 4 },
  oldValue: { color: "#991b1b", textAlign: "right", marginBottom: 3 },
  newValue: { color: "#166534", textAlign: "right" },
  noteBox: { backgroundColor: "#fffbeb", borderRadius: 18, padding: 14, marginTop: 4 },
  noteText: { color: "#92400e", fontWeight: "700", textAlign: "right", lineHeight: 22 },
});
