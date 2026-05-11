import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { apiGetScoped } from "../lib/api";

type Summary = {
  properties_count?: number;
  units_count?: number;
  rented_units_count?: number;
  vacant_units_count?: number;
  available_units_count?: number;
  occupancy_rate?: number;
  active_contracts_count?: number;
  tenants_count?: number;
  paid_income?: number;
  due_income?: number;
  overdue_income?: number;
  expenses?: number;
  net_income?: number;
  open_followups_count?: number;
  critical_alerts_count?: number;
};

type DashboardPayload = {
  summary?: Summary;
  recent_due_payments?: Array<any>;
};

function numberValue(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function count(value: unknown) {
  return Math.round(numberValue(value)).toLocaleString("ar-SA");
}

function money(value: unknown) {
  return `${Math.round(numberValue(value)).toLocaleString("ar-SA")} ريال`;
}

function pct(value: unknown) {
  return `${Math.round(numberValue(value)).toLocaleString("ar-SA")}%`;
}

function StatCard({ title, value, subtitle, tone = "default" }: { title: string; value: string; subtitle?: string; tone?: "default" | "success" | "warning" | "danger" | "dark" }) {
  return (
    <View style={[styles.statCard, tone === "success" ? styles.successCard : null, tone === "warning" ? styles.warningCard : null, tone === "danger" ? styles.dangerCard : null, tone === "dark" ? styles.darkCard : null]}>
      <Text style={[styles.statValue, tone === "dark" ? styles.darkText : null]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.statTitle, tone === "dark" ? styles.darkSubText : null]}>{title}</Text>
      {subtitle ? <Text style={[styles.statSubtitle, tone === "dark" ? styles.darkSubText : null]}>{subtitle}</Text> : null}
    </View>
  );
}

export default function StatisticsScreen() {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      const result = await apiGetScoped("/dashboard", "/my/dashboard");
      setData((result?.data ?? result) as DashboardPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل الإحصائيات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(false);
  }, []);

  const s = data?.summary || {};
  const vacant = s.vacant_units_count ?? s.available_units_count ?? 0;
  const firstName = user?.name?.split(" ")?.[0] || (isAdmin ? "المدير" : "المالك");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0f766e" />}
      >
        <View style={styles.hero}>
          <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{isAdmin ? "لوحة مدير" : "لوحة مالك"}</Text></View>
          <Text style={styles.heroTitle}>الإحصائيات</Text>
          <Text style={styles.heroSubtitle}>أهلًا {firstName}، هذه نظرة عامة بحسب صلاحيات الحساب الحالي.</Text>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator />
            <Text style={styles.stateText}>جاري تحميل الإحصائيات...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>تعذر التحميل</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => load(false)}><Text style={styles.retryText}>إعادة المحاولة</Text></TouchableOpacity>
          </View>
        ) : null}

        {!loading && !error ? (
          <>
            <View style={styles.grid}>
              <StatCard title="العقارات" value={count(s.properties_count)} subtitle={isAdmin ? "عقارات حساب المدير فقط في عقاراتي" : "عقاراتك الخاصة"} tone="dark" />
              <StatCard title="الوحدات" value={count(s.units_count)} subtitle="إجمالي الوحدات" />
              <StatCard title="نسبة الإشغال" value={pct(s.occupancy_rate)} subtitle="مؤجر / إجمالي" tone="success" />
              <StatCard title="وحدات مؤجرة" value={count(s.rented_units_count)} subtitle="نشطة حاليًا" tone="success" />
              <StatCard title="وحدات شاغرة" value={count(vacant)} subtitle="متاحة للتأجير" tone="warning" />
              <StatCard title="عقود نشطة" value={count(s.active_contracts_count)} subtitle="العقود الحالية" />
            </View>

            <Text style={styles.sectionTitle}>الملخص المالي</Text>
            <View style={styles.grid}>
              <StatCard title="المحصل" value={money(s.paid_income)} tone="success" />
              <StatCard title="المستحق" value={money(s.due_income)} tone="warning" />
              <StatCard title="المتأخر" value={money(s.overdue_income)} tone="danger" />
              <StatCard title="المصروفات" value={money(s.expenses)} />
              <StatCard title="صافي الدخل" value={money(s.net_income)} tone="dark" />
              <StatCard title="المستأجرون" value={count(s.tenants_count)} />
            </View>

            <Text style={styles.sectionTitle}>تنبيهات ومتابعات</Text>
            <View style={styles.grid}>
              <StatCard title="تنبيهات حرجة" value={count(s.critical_alerts_count)} tone="danger" />
              <StatCard title="متابعات مفتوحة" value={count(s.open_followups_count)} tone="warning" />
            </View>

            <TouchableOpacity style={styles.mainAction} onPress={() => router.push("/properties" as never)}>
              <Text style={styles.mainActionText}>فتح عقاراتي</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  content: { padding: 14, paddingBottom: 42 },
  hero: { backgroundColor: "#111827", borderRadius: 28, padding: 18, marginBottom: 14, alignItems: "flex-end" },
  heroBadge: { backgroundColor: "#D1FAE5", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  heroBadgeText: { color: "#064E3B", fontWeight: "900" },
  heroTitle: { color: "#fff", fontSize: 30, fontWeight: "900", textAlign: "right" },
  heroSubtitle: { color: "#CBD5E1", marginTop: 8, fontWeight: "800", textAlign: "right", lineHeight: 22 },
  stateCard: { backgroundColor: "#fff", borderRadius: 22, padding: 18, alignItems: "center" },
  stateText: { color: "#64748B", fontWeight: "800", marginTop: 8 },
  errorCard: { backgroundColor: "#FEE2E2", borderRadius: 20, padding: 14 },
  errorTitle: { color: "#991B1B", fontWeight: "900", textAlign: "right", fontSize: 16 },
  errorText: { color: "#991B1B", marginTop: 6, textAlign: "right" },
  retryButton: { backgroundColor: "#991B1B", borderRadius: 14, padding: 12, alignItems: "center", marginTop: 10 },
  retryText: { color: "#fff", fontWeight: "900" },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  statCard: { width: "48.5%", backgroundColor: "#fff", borderRadius: 22, padding: 14, minHeight: 118, borderWidth: 1, borderColor: "#ECEFF3", justifyContent: "center" },
  successCard: { backgroundColor: "#ECFDF5", borderColor: "#BBF7D0" },
  warningCard: { backgroundColor: "#FFFBEB", borderColor: "#FED7AA" },
  dangerCard: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  darkCard: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  statValue: { color: "#111827", fontSize: 22, fontWeight: "900", textAlign: "right" },
  statTitle: { color: "#334155", fontSize: 14, fontWeight: "900", textAlign: "right", marginTop: 8 },
  statSubtitle: { color: "#64748B", fontSize: 11, fontWeight: "800", textAlign: "right", marginTop: 5, lineHeight: 17 },
  darkText: { color: "#fff" },
  darkSubText: { color: "#CBD5E1" },
  sectionTitle: { color: "#111827", fontSize: 20, fontWeight: "900", textAlign: "right", marginTop: 20, marginBottom: 10 },
  mainAction: { backgroundColor: "#0F766E", borderRadius: 20, padding: 16, alignItems: "center", marginTop: 18 },
  mainActionText: { color: "#fff", fontSize: 16, fontWeight: "900" },
});
