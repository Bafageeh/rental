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
import { apiGetScoped } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type MonthItem = {
  month: number;
  label?: string;
  month_name?: string;
  expected_income?: number;
  paid_income?: number;
  due_income?: number;
  overdue_income?: number;
  expenses?: number;
  net_income?: number;
  payments_count?: number;
  receipts_count?: number;
  expenses_count?: number;
  utility_due?: number;
  utility_paid?: number;
  utility_overdue?: number;
};

type MonthlyReport = {
  year?: number;
  summary?: {
    paid_income?: number;
    expected_income?: number;
    due_income?: number;
    overdue_income?: number;
    expenses?: number;
    net_income?: number;
    receipts_count?: number;
    payments_count?: number;
    expenses_count?: number;
    utility_due?: number;
    utility_paid?: number;
    utility_overdue?: number;
  };
  months?: MonthItem[];
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function monthArabic(month: number) {
  const names = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];

  return names[month - 1] || String(month);
}

export default function MonthlyFinancialScreen() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(customYear = year) {
    const cleanYear = Number(customYear || currentYear);

    if (!cleanYear || cleanYear < 2000 || cleanYear > 2100) {
      Alert.alert("تنبيه", "أدخل سنة صحيحة");
      return;
    }

    try {
      setLoading(true);

      const result = await apiGetScoped(
        `/monthly-financial-summary?year=${cleanYear}`,
        `/my/monthly-financial-summary?year=${cleanYear}`
      );

      setReport(result as MonthlyReport);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل التقرير الشهري");
    } finally {
      setLoading(false);
    }
  }

  function changeYear(delta: number) {
    const next = String(Number(year || currentYear) + delta);
    setYear(next);
    load(next);
  }
  async function refreshScreen() {
    try {
      setRefreshing(true);
      await load(year);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(String(currentYear));
  }, []);

  const summary = report?.summary || {};
  const months = report?.months || [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>التقرير المالي الشهري</Text>
        <Text style={styles.subtitle}>
          ملخص شهري للدخل والمصاريف والصافي حسب السنة
        </Text>

        <View style={styles.yearBox}>
          <TouchableOpacity style={styles.yearButton} onPress={() => changeYear(-1)}>
            <Text style={styles.yearButtonText}>السنة السابقة</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.yearInput}
            value={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            textAlign="center"
          />

          <TouchableOpacity style={styles.yearButton} onPress={() => changeYear(1)}>
            <Text style={styles.yearButtonText}>السنة التالية</Text>
          </TouchableOpacity>
        </View>
<View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>ملخص سنة {report?.year || year}</Text>
          <Text style={styles.summaryText}>الإيراد المتوقع: {money(summary.expected_income)}</Text>
          <Text style={styles.summaryText}>المقبوض: {money(summary.paid_income)}</Text>
          <Text style={styles.summaryText}>المستحق: {money(summary.due_income)}</Text>
          <Text style={styles.summaryText}>المتأخر: {money(summary.overdue_income)}</Text>
          <Text style={styles.summaryText}>المصاريف: {money(summary.expenses)}</Text>
          <Text style={styles.netText}>الصافي: {money(summary.net_income)}</Text>
        </View>

        <View style={styles.utilityBox}>
          <Text style={styles.utilityTitle}>فواتير الخدمات</Text>
          <Text style={styles.utilityText}>مدفوعة: {money(summary.utility_paid)}</Text>
          <Text style={styles.utilityText}>مستحقة: {money(summary.utility_due)}</Text>
          <Text style={styles.utilityText}>متأخرة: {money(summary.utility_overdue)}</Text>
        </View>

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل التقرير...</Text>
          </View>
        ) : null}

        {!loading && months.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد بيانات شهرية حاليًا</Text>
          </View>
        ) : null}

        {months.map((month) => {
          const net = Number(month.net_income || 0);

          return (
            <View key={month.month} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={[styles.netBadge, net >= 0 ? styles.netPositive : styles.netNegative]}>
                  {net >= 0 ? "ربح" : "خسارة"}
                </Text>
                <Text style={styles.cardTitle}>{monthArabic(month.month)} {report?.year || year}</Text>
              </View>

              <Text style={styles.detail}>الإيراد المتوقع: {money(month.expected_income)}</Text>
              <Text style={styles.detail}>المقبوض: {money(month.paid_income)}</Text>
              <Text style={styles.detail}>المستحق: {money(month.due_income)}</Text>
              <Text style={styles.detail}>المتأخر: {money(month.overdue_income)}</Text>
              <Text style={styles.detail}>المصاريف: {money(month.expenses)}</Text>
              <Text style={styles.netLine}>الصافي: {money(month.net_income)}</Text>

              <View style={styles.statsRow}>
                <Text style={styles.stat}>دفعات: {month.payments_count ?? 0}</Text>
                <Text style={styles.stat}>سندات: {month.receipts_count ?? 0}</Text>
                <Text style={styles.stat}>مصروفات: {month.expenses_count ?? 0}</Text>
              </View>

              <View style={styles.monthUtilityBox}>
                <Text style={styles.monthUtilityText}>خدمات مدفوعة: {money(month.utility_paid)}</Text>
                <Text style={styles.monthUtilityText}>خدمات مستحقة: {money(month.utility_due)}</Text>
                <Text style={styles.monthUtilityText}>خدمات متأخرة: {money(month.utility_overdue)}</Text>
              </View>
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
  yearBox: { flexDirection: "row-reverse", gap: 10, marginBottom: 12 },
  yearButton: { flex: 1, backgroundColor: "#111827", padding: 12, borderRadius: 12, alignItems: "center" },
  yearButtonText: { color: "#fff", fontWeight: "800" },
  yearInput: { width: 90, backgroundColor: "#fff", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, color: "#111827", fontWeight: "800" },
  primaryButton: { backgroundColor: "#0F9B6F", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  summaryBox: { backgroundColor: "#111827", borderRadius: 18, padding: 16, marginBottom: 14 },
  summaryTitle: { color: "#93c5fd", fontWeight: "800", textAlign: "right", marginBottom: 8, fontSize: 18 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  netText: { color: "#bbf7d0", fontWeight: "800", textAlign: "right", marginTop: 6, fontSize: 18 },
  utilityBox: { backgroundColor: "#eff6ff", borderRadius: 18, padding: 14, marginBottom: 14 },
  utilityTitle: { color: "#065F44", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  utilityText: { color: "#065F44", fontWeight: "700", textAlign: "right", marginBottom: 4 },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  cardTitle: { fontSize: 20, fontWeight: "800", color: "#111827", textAlign: "right", flex: 1 },
  netBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  netPositive: { backgroundColor: "#dcfce7", color: "#166534" },
  netNegative: { backgroundColor: "#fee2e2", color: "#991b1b" },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  netLine: { marginTop: 8, color: "#166534", fontWeight: "800", textAlign: "right" },
  statsRow: { marginTop: 12, flexDirection: "row-reverse", flexWrap: "wrap" },
  stat: { backgroundColor: "#f3f4f6", color: "#374151", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: "hidden", fontWeight: "700", marginLeft: 8, marginBottom: 8 },
  monthUtilityBox: { backgroundColor: "#F7F6F4", borderRadius: 12, padding: 10, marginTop: 10 },
  monthUtilityText: { color: "#5E5B55", textAlign: "right", marginBottom: 4 },
});
