import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiGetScoped } from "../lib/api";

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
  fallback?: boolean;
  calculated_locally?: boolean;
};

const EMPTY_DASHBOARD: DashboardPayload = {
  summary: {
    properties_count: 0,
    units_count: 0,
    rented_units_count: 0,
    vacant_units_count: 0,
    available_units_count: 0,
    occupancy_rate: 0,
    active_contracts_count: 0,
    tenants_count: 0,
    paid_income: 0,
    due_income: 0,
    overdue_income: 0,
    expenses: 0,
    net_income: 0,
    open_followups_count: 0,
    critical_alerts_count: 0,
  },
  recent_due_payments: [],
};

function numberValue(value: unknown) {
  const n = Number(String(value ?? 0).replace(/,/g, ""));
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

function unwrapArray(payload: any, key?: string): any[] {
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (key && Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function isRealUnit(unit: any) {
  const number = String(unit?.unit_number ?? unit?.number ?? "").trim();
  const type = String(unit?.type ?? "").trim();
  return number !== "العقار كامل" && type !== "whole_property";
}

function isPaidStatus(status: unknown) {
  return ["paid", "مدفوع", "مسدد"].includes(String(status ?? "").trim());
}

function isCancelledStatus(status: unknown) {
  return ["cancelled", "canceled", "ملغي", "ملغى"].includes(String(status ?? "").trim());
}

function isActiveContract(contract: any) {
  const status = String(contract?.status ?? "").trim();
  if (["active", "نشط", "ساري", "مفتوح", "open"].includes(status)) return true;
  if (["ended", "expired", "closed", "منتهي", "مغلق", "ملغي", "ملغى"].includes(status)) return false;

  const today = new Date().toISOString().slice(0, 10);
  const start = String(contract?.start_date ?? "").slice(0, 10);
  const end = String(contract?.end_date ?? "").slice(0, 10);
  const startOk = !/^\d{4}-\d{2}-\d{2}$/.test(start) || start <= today;
  const endOk = !/^\d{4}-\d{2}-\d{2}$/.test(end) || end >= today;
  return startOk && endOk;
}

function summaryIsEmpty(payload: DashboardPayload | null | undefined) {
  const s = payload?.summary || {};
  return [s.properties_count, s.units_count, s.active_contracts_count, s.rented_units_count, s.paid_income, s.due_income, s.overdue_income]
    .every((item) => numberValue(item) === 0);
}

async function safeGet(path: string) {
  try {
    return await apiGet(path);
  } catch {
    return null;
  }
}

async function buildLocalDashboard(isAdmin: boolean): Promise<DashboardPayload | null> {
  const [propertiesRes, unitsRes, contractsRes, paymentsRes, expensesRes, threadsRes] = await Promise.all([
    safeGet(isAdmin ? "/properties" : "/profile/properties"),
    safeGet(isAdmin ? "/units" : "/my/units"),
    safeGet("/contracts"),
    safeGet("/payments"),
    safeGet("/expenses"),
    safeGet("/chat/threads"),
  ]);

  const properties = unwrapArray(propertiesRes);
  const allUnits = unwrapArray(unitsRes).filter(isRealUnit);
  const contracts = unwrapArray(contractsRes);
  const payments = unwrapArray(paymentsRes);
  const expenses = unwrapArray(expensesRes);
  const threads = unwrapArray(threadsRes, "threads");

  if (properties.length === 0 && allUnits.length === 0 && contracts.length === 0) {
    return null;
  }

  const unitIds = new Set(allUnits.map((unit: any) => Number(unit?.id)).filter(Boolean));
  const activeContracts = contracts.filter((contract: any) => {
    const unitId = Number(contract?.unit_id ?? contract?.unit?.id);
    return (!unitId || unitIds.has(unitId)) && isActiveContract(contract);
  });

  const activeUnitIds = new Set<number>();
  activeContracts.forEach((contract: any) => {
    const unitId = Number(contract?.unit_id ?? contract?.unit?.id);
    if (unitId) activeUnitIds.add(unitId);
  });
  allUnits.forEach((unit: any) => {
    if (["rented", "مؤجرة", "مؤجر", "occupied"].includes(String(unit?.status ?? "").trim())) {
      const unitId = Number(unit?.id);
      if (unitId) activeUnitIds.add(unitId);
    }
  });

  const today = new Date().toISOString().slice(0, 10);
  let paidIncome = 0;
  let dueIncome = 0;
  let overdueIncome = 0;
  let criticalCount = 0;

  payments.forEach((payment: any) => {
    const status = payment?.status;
    if (isCancelledStatus(status)) return;
    const amount = numberValue(payment?.amount);
    const paidAmount = numberValue(payment?.paid_amount ?? payment?.actual_paid_amount);
    const dueDate = String(payment?.due_date ?? "").slice(0, 10);
    const remaining = Math.max(0, amount - paidAmount);

    if (isPaidStatus(status) || paidAmount >= amount) {
      paidIncome += paidAmount > 0 ? paidAmount : amount;
      return;
    }

    dueIncome += remaining > 0 ? remaining : amount;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate) && dueDate < today) {
      overdueIncome += remaining > 0 ? remaining : amount;
      criticalCount += 1;
    }
  });

  const tenants = new Set<string>();
  contracts.forEach((contract: any) => {
    const tenantId = contract?.tenant_id ?? contract?.tenant?.id;
    if (tenantId) tenants.add(String(tenantId));
  });

  const expensesSum = expenses.reduce((sum: number, expense: any) => sum + numberValue(expense?.amount), 0);
  const unitsCount = allUnits.length;
  const rentedUnits = activeUnitIds.size;
  const vacantUnits = Math.max(0, unitsCount - rentedUnits);

  return {
    calculated_locally: true,
    summary: {
      properties_count: properties.length,
      units_count: unitsCount,
      rented_units_count: rentedUnits,
      vacant_units_count: vacantUnits,
      available_units_count: vacantUnits,
      occupancy_rate: unitsCount > 0 ? Math.round((rentedUnits / unitsCount) * 100) : 0,
      active_contracts_count: activeContracts.length,
      tenants_count: tenants.size,
      paid_income: paidIncome,
      due_income: dueIncome,
      overdue_income: overdueIncome,
      expenses: expensesSum,
      net_income: paidIncome - expensesSum,
      critical_alerts_count: criticalCount,
      open_followups_count: threads.filter((thread: any) => String(thread?.status ?? "") !== "closed").length,
    },
  };
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
  const [warning, setWarning] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setWarning("");

      const result = await apiGetScoped("/dashboard", "/my/dashboard");
      let payload = (result?.data ?? result) as DashboardPayload;

      if (payload?.fallback || summaryIsEmpty(payload)) {
        const localPayload = await buildLocalDashboard(isAdmin);
        if (localPayload && !summaryIsEmpty(localPayload)) {
          payload = localPayload;
          setWarning("تم حساب الإحصائيات مباشرة من بيانات العقارات والعقود.");
        }
      }

      setData(payload);
      if (payload?.fallback && !payload?.calculated_locally) {
        setWarning("تعذر حساب الإحصائيات الحية من الخادم.");
      }
    } catch (e) {
      const localPayload = await buildLocalDashboard(isAdmin);
      if (localPayload) {
        setData(localPayload);
        setWarning("تم حساب الإحصائيات مباشرة من بيانات العقارات والعقود.");
      } else {
        setData(EMPTY_DASHBOARD);
        setWarning(e instanceof Error ? e.message : "تعذر تحميل الإحصائيات من الخادم، تم عرض قيم مؤقتة.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

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
          <Text style={styles.heroSubtitle}>{isAdmin ? "نظرة عامة على كل النظام حسب صلاحيات المدير." : `أهلًا ${firstName}، هذه نظرة عامة على عقاراتك.`}</Text>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator />
            <Text style={styles.stateText}>جاري تحميل الإحصائيات...</Text>
          </View>
        ) : null}

        {warning && !loading ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningTitle}>تنبيه</Text>
            <Text style={styles.warningText}>{warning}</Text>
            <TouchableOpacity style={styles.warningButton} onPress={() => load(false)}><Text style={styles.warningButtonText}>إعادة التحميل</Text></TouchableOpacity>
          </View>
        ) : null}

        {!loading ? (
          <>
            <View style={styles.grid}>
              <StatCard title="العقارات" value={count(s.properties_count)} subtitle={isAdmin ? "إجمالي العقارات" : "عقاراتك الخاصة"} tone="dark" />
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
  warningBanner: { backgroundColor: "#FFFBEB", borderRadius: 20, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#FED7AA" },
  warningTitle: { color: "#92400E", fontWeight: "900", textAlign: "right", fontSize: 16 },
  warningText: { color: "#92400E", marginTop: 6, textAlign: "right", lineHeight: 20 },
  warningButton: { backgroundColor: "#92400E", borderRadius: 14, padding: 12, alignItems: "center", marginTop: 10 },
  warningButtonText: { color: "#fff", fontWeight: "900" },
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
