import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGet } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type OwnerReport = {
  owner_id: number;
  owner_name?: string | null;
  owner_type?: string | null;
  properties_count?: number;
  units_count?: number;
  active_contracts_count?: number;
  paid_income?: number;
  due_income?: number;
  overdue_income?: number;
  expenses?: number;
  net_income?: number;
};

type ReportsResponse = {
  status: string;
  summary: {
    owners_count?: number;
    properties_count?: number;
    units_count?: number;
    active_contracts_count?: number;
    paid_income?: number;
    due_income?: number;
    overdue_income?: number;
    expenses?: number;
    net_income?: number;
  };
  owners: OwnerReport[];
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function numberText(value: unknown) {
  return Number(value || 0).toLocaleString();
}

function ownerTypeLabel(type?: string | null) {
  return "مالك";
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryCardTitle}>{title}</Text>
      <Text style={styles.summaryCardValue}>{value}</Text>
    </View>
  );
}

export default function ReportsScreen() {
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const result = await apiGet("/reports/owners-summary");
      setData(result as ReportsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير معروف");
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

  const summary = data?.summary || {};

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>التقارير</Text>
        <Text style={styles.subtitle}>ملخص الدخل والمصاريف وصافي الربح حسب كل مالك</Text>
{loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل التقرير...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>تعذر تحميل التقرير</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {data ? (
          <>
            <View style={styles.summaryGrid}>
              <SummaryCard title="الملاك" value={numberText(summary.owners_count)} />
              <SummaryCard title="العقارات" value={numberText(summary.properties_count)} />
              <SummaryCard title="الوحدات" value={numberText(summary.units_count)} />
              <SummaryCard title="العقود النشطة" value={numberText(summary.active_contracts_count)} />
              <SummaryCard title="المدفوع" value={money(summary.paid_income)} />
              <SummaryCard title="المستحق" value={money(summary.due_income)} />
              <SummaryCard title="المتأخر" value={money(summary.overdue_income)} />
              <SummaryCard title="المصاريف" value={money(summary.expenses)} />
              <SummaryCard title="صافي الدخل" value={money(summary.net_income)} />
            </View>

            <Text style={styles.sectionTitle}>تفصيل الملاك</Text>

            {data.owners.length === 0 ? (
              <View style={styles.box}>
                <Text style={styles.emptyText}>لا توجد بيانات ملاك حاليًا</Text>
              </View>
            ) : null}

            {data.owners.map((owner) => (
              <View key={owner.owner_id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.badge}>{ownerTypeLabel(owner.owner_type)}</Text>
                  <Text style={styles.cardTitle}>{owner.owner_name || "مالك بدون اسم"}</Text>
                </View>

                <View style={styles.statsRow}>
                  <Text style={styles.stat}>العقارات: {numberText(owner.properties_count)}</Text>
                  <Text style={styles.stat}>الوحدات: {numberText(owner.units_count)}</Text>
                  <Text style={styles.stat}>العقود: {numberText(owner.active_contracts_count)}</Text>
                </View>

                <Text style={styles.detail}>المدفوع: {money(owner.paid_income)}</Text>
                <Text style={styles.detail}>المستحق: {money(owner.due_income)}</Text>
                <Text style={styles.overdue}>المتأخر: {money(owner.overdue_income)}</Text>
                <Text style={styles.expense}>المصاريف: {money(owner.expenses)}</Text>
                <Text style={styles.net}>صافي الدخل: {money(owner.net_income)}</Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 18, paddingBottom: 40 },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
    textAlign: "right",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 15,
    color: "#7A766F",
    textAlign: "right",
    lineHeight: 23,
  },
  refreshButton: {
    backgroundColor: "#111827",
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 14,
  },
  refreshButtonText: { color: "#fff", fontWeight: "800" },
  box: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    marginBottom: 12,
  },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  errorBox: {
    backgroundColor: "#fee2e2",
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
  },
  errorTitle: {
    color: "#991b1b",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
  },
  errorText: { color: "#7f1d1d", marginTop: 8, textAlign: "right" },
  summaryGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  summaryCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    minHeight: 96,
    alignItems: "flex-end",
  },
  summaryCardTitle: {
    color: "#7A766F",
    fontSize: 13,
    textAlign: "right",
  },
  summaryCardValue: {
    marginTop: 10,
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "right",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  badge: {
    backgroundColor: "#e0f2fe",
    color: "#075985",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "800",
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
    textAlign: "right",
    flex: 1,
  },
  statsRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    marginTop: 12,
  },
  stat: {
    backgroundColor: "#f3f4f6",
    color: "#374151",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "700",
    marginLeft: 8,
    marginBottom: 8,
  },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  overdue: { marginTop: 8, color: "#b91c1c", fontWeight: "800", textAlign: "right" },
  expense: { marginTop: 8, color: "#92400e", fontWeight: "800", textAlign: "right" },
  net: { marginTop: 10, color: "#166534", fontSize: 17, fontWeight: "800", textAlign: "right" },
});
