import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { apiGetScoped } from "../lib/api";
import { labelForResource, resourceLabel, translateValue } from "../lib/arabicDisplay";

type RecordItem = {
  id: number;
  resource: string;
  resource_label: string;
  title: string;
  fields: Record<string, unknown>;
};

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function cleanDate(value: unknown) {
  const text = valueText(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : text;
}

function cleanMoney(value: unknown) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return valueText(value);
  return `${Math.round(number).toLocaleString("ar-SA")} ريال`;
}

function displayValue(resource: string | undefined, field: string, value: unknown) {
  if (field.includes("date") || field.endsWith("_at")) return cleanDate(value);
  if (field === "amount" || field === "rent_amount" || field.includes("balance")) return cleanMoney(value);
  return translateValue(resource || "", field, value);
}

export default function RecordDetailsScreen() {
  const params = useLocalSearchParams<{ resource?: string; id?: string }>();
  const resource = Array.isArray(params.resource) ? params.resource[0] : params.resource;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [record, setRecord] = useState<RecordItem | null>(null);
  const [loading, setLoading] = useState(true);

  const fields = useMemo(() => {
    if (!record) return [];

    const hidden = new Set([
      "id",
      "password",
      "remember_token",
      "created_at",
      "updated_at",
      "deleted_at",
    ]);

    const preferred = [
      "title",
      "name",
      "amount",
      "expense_date",
      "property_id",
      "unit_id",
      "owner_id",
      "category_id",
      "description",
      "notes",
      "status",
    ];

    const keys = Object.keys(record.fields || {}).filter((key) => !hidden.has(key));
    const ordered = [...preferred.filter((key) => keys.includes(key)), ...keys.filter((key) => !preferred.includes(key))];

    return ordered.slice(0, 12);
  }, [record]);

  async function loadRecord() {
    if (!resource || !id) {
      Alert.alert("تنبيه", "بيانات التفاصيل غير مكتملة");
      return;
    }

    try {
      setLoading(true);
      const data = await apiGetScoped(
        `/edit-delete-center/${resource}?id=${encodeURIComponent(id)}`,
        `/my/edit-delete-center/${resource}?id=${encodeURIComponent(id)}`
      );
      const item = Array.isArray(data?.items) ? data.items[0] : null;
      setRecord(item || null);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل التفاصيل");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecord();
  }, [resource, id]);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "التفاصيل", presentation: "modal" }} />
      <Modal visible transparent animationType="fade" onRequestClose={() => router.back()}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => router.back()} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
              <View style={styles.titleBox}>
                <Text style={styles.sheetTitle}>{record?.title || "تفاصيل"}</Text>
                <Text style={styles.sheetSubtitle}>{record?.resource_label || resourceLabel(resource)}</Text>
              </View>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>جاري تحميل التفاصيل...</Text>
              </View>
            ) : null}

            {!loading && !record ? (
              <View style={styles.loadingBox}>
                <Text style={styles.emptyText}>لم يتم العثور على البيانات</Text>
              </View>
            ) : null}

            {!loading && record ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                {fields.map((field) => (
                  <View key={field} style={styles.row}>
                    <Text style={styles.label}>{labelForResource(resource || "", field)}</Text>
                    <Text style={styles.value}>{displayValue(resource, field, record.fields?.[field])}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  overlay: { flex: 1, justifyContent: "center", padding: 16 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.35)" },
  sheet: {
    maxHeight: "82%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#111827", fontSize: 26, fontWeight: "900", lineHeight: 30 },
  titleBox: { flex: 1, alignItems: "flex-end", marginLeft: 12 },
  sheetTitle: { color: "#111827", fontSize: 22, fontWeight: "900", textAlign: "right" },
  sheetSubtitle: { color: "#0F766E", fontSize: 13, fontWeight: "800", textAlign: "right", marginTop: 4 },
  loadingBox: { padding: 24, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: "#6B7280", fontWeight: "700" },
  emptyText: { color: "#6B7280", fontWeight: "800" },
  content: { paddingBottom: 6 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#EEF2F4", alignItems: "flex-end" },
  label: { color: "#6B7280", fontSize: 13, fontWeight: "800", textAlign: "right" },
  value: { color: "#111827", fontSize: 16, fontWeight: "900", textAlign: "right", marginTop: 5 },
});
