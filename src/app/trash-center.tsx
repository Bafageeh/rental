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

type DeletedRecord = {
  id: number;
  resource?: string | null;
  resource_label?: string | null;
  table_name?: string | null;
  record_id?: number | null;
  record_title?: string | null;
  owner_id?: number | null;
  deleted_by_name?: string | null;
  payload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  status?: string | null;
  deleted_at?: string | null;
  restored_at?: string | null;
  restore_error?: string | null;
};

function valueToText(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "حدث خطأ غير متوقع";
}

export default function TrashCenterScreen() {
  const [items, setItems] = useState<DeletedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/trash-center/deleted-records",
        "/my/trash-center/deleted-records"
      );

      setItems(Array.isArray(result) ? result : []);
    } catch (e) {
      Alert.alert("خطأ", errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function restore(item: DeletedRecord) {
    Alert.alert(
      "تأكيد الاستعادة",
      `هل تريد استعادة هذا السجل؟\n${item.record_title || "#" + item.record_id}`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "استعادة",
          onPress: async () => {
            try {
              setWorkingId(item.id);
              await apiPost(`/trash-center/deleted-records/${item.id}/restore`, {});
              Alert.alert("تم", "تمت استعادة السجل");
              await load();
            } catch (e) {
              Alert.alert("تعذر الاستعادة", errorMessage(e));
            } finally {
              setWorkingId(null);
            }
          },
        },
      ]
    );
  }

  async function purge(item: DeletedRecord) {
    Alert.alert(
      "حذف نسخة السلة نهائيًا",
      "هذا يحذف نسخة الاستعادة فقط، ولن تستطيع استرجاع السجل من هذه الشاشة بعد ذلك.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف نهائي",
          style: "destructive",
          onPress: async () => {
            try {
              setWorkingId(item.id);
              await apiPost(`/trash-center/deleted-records/${item.id}/purge`, {});
              Alert.alert("تم", "تم حذف نسخة السلة");
              await load();
            } catch (e) {
              Alert.alert("خطأ", errorMessage(e));
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
  }, []);

  const grouped = items.reduce<Record<string, number>>((acc, item) => {
    const key = item.resource_label || item.resource || "غير محدد";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>سلة المحذوفات</Text>
        <Text style={styles.subtitle}>
          السجلات التي تم حذفها من مركز التعديل والحذف تحفظ هنا ويمكن استعادتها
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>إجمالي المحذوفات: {items.length}</Text>
          {Object.entries(grouped).slice(0, 6).map(([key, count]) => (
            <Text key={key} style={styles.summaryText}>{key}: {count}</Text>
          ))}
        </View>
{loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل سلة المحذوفات...</Text>
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>السلة فارغة حاليًا</Text>
          </View>
        ) : null}

        {items.map((item) => {
          const expanded = expandedId === item.id;
          const payloadEntries = Object.entries(item.payload || {}).slice(0, 40);

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.badge}>{item.resource_label || item.resource || "-"}</Text>
                <Text style={styles.cardTitle}>{item.record_title || `#${item.record_id}`}</Text>
              </View>

              <Text style={styles.detail}>رقم السجل الأصلي: {item.record_id || "-"}</Text>
              <Text style={styles.detail}>الجدول: {item.table_name || "-"}</Text>
              <Text style={styles.detail}>حذفه: {item.deleted_by_name || "-"}</Text>
              <Text style={styles.detail}>تاريخ الحذف: {item.deleted_at || "-"}</Text>
              {item.restore_error ? (
                <Text style={styles.errorText}>آخر خطأ استعادة: {item.restore_error}</Text>
              ) : null}

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.previewButton]}
                  onPress={() => setExpandedId(expanded ? null : item.id)}
                >
                  <Text style={styles.actionText}>{expanded ? "إخفاء" : "عرض البيانات"}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.restoreButton]}
                  onPress={() => restore(item)}
                  disabled={workingId === item.id}
                >
                  <Text style={styles.actionText}>{workingId === item.id ? "جاري..." : "استعادة"}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.purgeButton}
                onPress={() => purge(item)}
                disabled={workingId === item.id}
              >
                <Text style={styles.purgeText}>حذف نسخة السلة نهائيًا</Text>
              </TouchableOpacity>

              {expanded ? (
                <View style={styles.payloadBox}>
                  {payloadEntries.map(([key, value]) => (
                    <View key={key} style={styles.payloadRow}>
                      <Text style={styles.payloadKey}>{key}</Text>
                      <Text style={styles.payloadValue}>{valueToText(value)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            الاستعادة تعيد السجل بنفس رقمه الأصلي إذا لم يكن الرقم مستخدمًا. إذا فشلت الاستعادة بسبب علاقة ناقصة، أعد السجلات المرتبطة أولًا أو أعد إدخال السجل يدويًا.
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
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  badge: { backgroundColor: "#dbeafe", color: "#065F44", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  cardTitle: { color: "#111827", fontSize: 19, fontWeight: "900", textAlign: "right", flex: 1 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  errorText: { marginTop: 10, color: "#991b1b", fontWeight: "800", textAlign: "right", lineHeight: 22 },
  actionsRow: { flexDirection: "row-reverse", gap: 10, marginTop: 14 },
  actionButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: "center" },
  previewButton: { backgroundColor: "#111827" },
  restoreButton: { backgroundColor: "#16a34a" },
  actionText: { color: "#fff", fontWeight: "900" },
  purgeButton: { backgroundColor: "#dc2626", padding: 12, borderRadius: 12, alignItems: "center", marginTop: 10 },
  purgeText: { color: "#fff", fontWeight: "900" },
  payloadBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 12 },
  payloadRow: { borderBottomWidth: 1, borderBottomColor: "#DDDBD6", paddingVertical: 8 },
  payloadKey: { color: "#7A766F", fontSize: 12, textAlign: "left" },
  payloadValue: { color: "#111827", fontWeight: "700", textAlign: "right", marginTop: 3 },
  noteBox: { backgroundColor: "#fffbeb", borderRadius: 18, padding: 14, marginTop: 4 },
  noteText: { color: "#92400e", fontWeight: "700", textAlign: "right", lineHeight: 22 },
});
