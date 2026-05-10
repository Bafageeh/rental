import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGetScoped } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type ExportSummary = {
  scope?: {
    is_admin?: boolean;
    owner_id?: number | null;
  };
  counts?: Record<string, number>;
  available_types?: string[];
};

type ExportResult = {
  status?: string;
  type?: string;
  format?: string;
  filename?: string;
  mime_type?: string;
  records_count?: number;
  content?: string;
  generated_at?: string;
};

function typeLabel(value: string) {
  if (value === "properties") return "العقارات";
  if (value === "units") return "الوحدات";
  if (value === "tenants") return "المستأجرون";
  if (value === "contracts") return "العقود";
  if (value === "payments") return "الدفعات";
  if (value === "receipts") return "سندات القبض";
  if (value === "expenses") return "المصاريف";
  if (value === "utility_bills") return "فواتير الخدمات";
  if (value === "followups") return "المتابعات";
  if (value === "backup") return "نسخة احتياطية شاملة";
  return value;
}

export default function ExportCenterScreen() {
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedType, setSelectedType] = useState("backup");
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [result, setResult] = useState<ExportResult | null>(null);

  async function load() {
    try {
      setLoading(true);

      const data = await apiGetScoped(
        "/export-center/summary",
        "/my/export-center/summary"
      );

      setSummary(data as ExportSummary);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل مركز التصدير");
    } finally {
      setLoading(false);
    }
  }

  async function runExport() {
    try {
      setExporting(true);

      const cleanFormat = selectedType === "backup" ? "json" : format;

      const data = await apiGetScoped(
        `/export-center/export?type=${selectedType}&format=${cleanFormat}`,
        `/my/export-center/export?type=${selectedType}&format=${cleanFormat}`
      );

      setResult(data as ExportResult);
      Alert.alert("تم", `تم تجهيز الملف: ${(data as ExportResult).filename || ""}`);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تجهيز التصدير");
    } finally {
      setExporting(false);
    }
  }

  async function shareResult() {
    if (!result?.content) {
      Alert.alert("تنبيه", "لا يوجد محتوى جاهز للمشاركة");
      return;
    }

    try {
      await Share.share({
        title: result.filename || "my-rentals-export",
        message: result.content,
      });
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر مشاركة التصدير");
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

  const types = useMemo(() => {
    return summary?.available_types || [
      "backup",
      "properties",
      "units",
      "tenants",
      "contracts",
      "payments",
      "receipts",
      "expenses",
      "utility_bills",
      "followups",
    ];
  }, [summary]);

  const counts = summary?.counts || {};
  const isAdmin = Boolean(summary?.scope?.is_admin);

  const preview = result?.content
    ? result.content.length > 3000
      ? `${result.content.slice(0, 3000)}\n\n... تم اختصار المعاينة فقط، المحتوى الكامل موجود عند المشاركة.`
      : result.content
    : "";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>مركز التصدير والنسخ</Text>
        <Text style={styles.subtitle}>
          تصدير بيانات النظام بصيغة JSON أو CSV للمراجعة والحفظ الخارجي
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>
            النطاق: {isAdmin ? "كل البيانات المتاحة للمدير" : "بيانات المالك الحالي فقط"}
          </Text>
          <Text style={styles.summaryText}>العقارات: {counts.properties ?? 0}</Text>
          <Text style={styles.summaryText}>الوحدات: {counts.units ?? 0}</Text>
          <Text style={styles.summaryText}>العقود: {counts.contracts ?? 0}</Text>
          <Text style={styles.summaryText}>الدفعات: {counts.payments ?? 0}</Text>
        </View>
{loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل مركز التصدير...</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>اختر نوع التصدير</Text>

          <View style={styles.chips}>
            {types.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.chip, selectedType === type ? styles.chipActive : null]}
                onPress={() => {
                  setSelectedType(type);

                  if (type === "backup") {
                    setFormat("json");
                  }
                }}
              >
                <Text style={[styles.chipText, selectedType === type ? styles.chipTextActive : null]}>
                  {typeLabel(type)} ({counts[type] ?? (type === "backup" ? "كل" : 0)})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>الصيغة</Text>

          <View style={styles.chips}>
            <TouchableOpacity
              style={[styles.chip, format === "json" ? styles.chipActive : null]}
              onPress={() => setFormat("json")}
            >
              <Text style={[styles.chipText, format === "json" ? styles.chipTextActive : null]}>
                JSON
              </Text>
            </TouchableOpacity>

            {selectedType !== "backup" ? (
              <TouchableOpacity
                style={[styles.chip, format === "csv" ? styles.chipActive : null]}
                onPress={() => setFormat("csv")}
              >
                <Text style={[styles.chipText, format === "csv" ? styles.chipTextActive : null]}>
                  CSV
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity style={styles.exportButton} onPress={runExport} disabled={exporting}>
            <Text style={styles.exportButtonText}>
              {exporting ? "جاري تجهيز التصدير..." : "تجهيز التصدير"}
            </Text>
          </TouchableOpacity>
        </View>

        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.sectionTitle}>نتيجة التصدير</Text>
            <Text style={styles.detail}>الملف: {result.filename || "-"}</Text>
            <Text style={styles.detail}>النوع: {typeLabel(result.type || "")}</Text>
            <Text style={styles.detail}>الصيغة: {result.format || "-"}</Text>
            <Text style={styles.detail}>العدد: {result.records_count ?? 0}</Text>
            <Text style={styles.detail}>وقت الإنشاء: {result.generated_at || "-"}</Text>

            <TouchableOpacity style={styles.shareButton} onPress={shareResult}>
              <Text style={styles.shareButtonText}>مشاركة / نسخ المحتوى</Text>
            </TouchableOpacity>

            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>معاينة المحتوى</Text>
              <Text style={styles.previewText}>{preview || "-"}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            ملاحظة: زر المشاركة يرسل محتوى التصدير كنص. للبيانات الكبيرة يفضل استخدام JSON للنسخة الشاملة، وCSV للجداول المفردة.
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
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14 },
  sectionTitle: { color: "#111827", fontSize: 19, fontWeight: "900", textAlign: "right", marginBottom: 10 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 12 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "800" },
  chipTextActive: { color: "#fff" },
  exportButton: { backgroundColor: "#16a34a", padding: 13, borderRadius: 12, alignItems: "center", marginTop: 4 },
  exportButtonText: { color: "#fff", fontWeight: "900" },
  resultCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14 },
  detail: { color: "#5E5B55", textAlign: "right", marginTop: 7, fontWeight: "700" },
  shareButton: { backgroundColor: "#111827", padding: 13, borderRadius: 12, alignItems: "center", marginTop: 14 },
  shareButtonText: { color: "#fff", fontWeight: "900" },
  previewBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 14 },
  previewTitle: { color: "#111827", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  previewText: { color: "#374151", textAlign: "left", lineHeight: 20 },
  noteBox: { backgroundColor: "#fffbeb", borderRadius: 18, padding: 14 },
  noteText: { color: "#92400e", fontWeight: "700", textAlign: "right", lineHeight: 22 },
});
