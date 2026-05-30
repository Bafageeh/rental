import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiGetScoped } from "../lib/api";

type PaymentItem = {
  id: number;
  amount?: number | string | null;
  status?: string | null;
  due_date?: string | null;
  paid_date?: string | null;
  tenant_name?: string | null;
  property_name?: string | null;
  unit_number?: string | null;
};

type DashboardData = {
  owner?: { id: number; name?: string | null };
  overdue_payments?: PaymentItem[];
};

type UnitGroup = {
  key: string;
  propertyName: string;
  unitNumber: string;
  total: number;
  count: number;
  oldestDueDate: string;
  tenantName: string;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function asNumber(value: unknown) {
  const n = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown) {
  return `${Math.round(asNumber(value)).toLocaleString("ar-SA")} ريال`;
}

function dateOnly(value?: string | null) {
  return String(value || "").slice(0, 10) || "-";
}

function clean(value: unknown, fallback = "-") {
  const text = String(value ?? "").trim();
  return text ? text : fallback;
}

export default function OwnerOverdueUnitsScreen() {
  const params = useLocalSearchParams<{ owner_id?: string; owner_name?: string }>();
  const ownerId = firstParam(params.owner_id);
  const ownerNameParam = firstParam(params.owner_name);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    if (!ownerId) return;
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError("");
      const response = await apiGetScoped(`/owners/${ownerId}/dashboard`, `/my/owners/${ownerId}/dashboard`);
      setData((response?.data ?? response) as DashboardData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل الوحدات المتأخرة");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(false); }, [ownerId]);

  const ownerName = data?.owner?.name || ownerNameParam || "المالك";
  const overduePayments = data?.overdue_payments || [];
  const groups = useMemo<UnitGroup[]>(() => {
    const map = new Map<string, UnitGroup>();
    overduePayments.forEach((payment) => {
      const propertyName = clean(payment.property_name, "عقار غير محدد");
      const unitNumber = clean(payment.unit_number, "وحدة غير محددة");
      const key = `${propertyName}::${unitNumber}`;
      const dueDate = dateOnly(payment.due_date);
      const previous = map.get(key);
      if (!previous) {
        map.set(key, {
          key,
          propertyName,
          unitNumber,
          total: asNumber(payment.amount),
          count: 1,
          oldestDueDate: dueDate,
          tenantName: clean(payment.tenant_name, "-"),
        });
        return;
      }
      previous.total += asNumber(payment.amount);
      previous.count += 1;
      if (dueDate !== "-" && (previous.oldestDueDate === "-" || dueDate < previous.oldestDueDate)) previous.oldestDueDate = dueDate;
      if (previous.tenantName === "-" && payment.tenant_name) previous.tenantName = String(payment.tenant_name);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [overduePayments]);

  function openUnitPayments(group: UnitGroup) {
    router.push(`/unit-overdue-payments?owner_id=${encodeURIComponent(ownerId)}&owner_name=${encodeURIComponent(ownerName)}&property_name=${encodeURIComponent(group.propertyName)}&unit_number=${encodeURIComponent(group.unitNumber)}` as never);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#DC2626" />}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><MaterialCommunityIcons name="cash-alert" size={30} color="#DC2626" /></View>
          <View style={styles.heroText}>
            <Text style={styles.heroKicker}>الدفعات المتأخرة</Text>
            <Text style={styles.heroTitle}>الوحدات المتأخرة</Text>
            <Text style={styles.heroSub}>المالك: {ownerName}</Text>
          </View>
        </View>

        {loading ? <View style={styles.stateBox}><ActivityIndicator /><Text style={styles.stateText}>جاري التحميل...</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => load(false)}><Text style={styles.retryText}>إعادة المحاولة</Text></TouchableOpacity></View> : null}

        {!loading && !error ? (
          <>
            <View style={styles.summaryPanel}>
              <Text style={styles.summaryValue}>{money(groups.reduce((sum, group) => sum + group.total, 0))}</Text>
              <Text style={styles.summaryLabel}>إجمالي المتأخر على {groups.length.toLocaleString("ar-SA")} وحدة</Text>
            </View>

            {groups.map((group) => (
              <TouchableOpacity key={group.key} style={styles.unitCard} activeOpacity={0.88} onPress={() => openUnitPayments(group)}>
                <View style={styles.chevronBox}><Ionicons name="chevron-back" size={22} color="#DC2626" /></View>
                <View style={styles.unitIcon}><MaterialCommunityIcons name="door-closed" size={24} color="#DC2626" /></View>
                <View style={styles.unitInfo}>
                  <Text style={styles.unitTitle}>وحدة {group.unitNumber}</Text>
                  <Text style={styles.unitMeta}>{group.propertyName}</Text>
                  <Text style={styles.unitMeta}>المستأجر: {group.tenantName}</Text>
                  <Text style={styles.unitHint}>اضغط لعرض الدفعات التابعة لهذه الوحدة</Text>
                </View>
                <View style={styles.amountBox}>
                  <Text style={styles.amount}>{money(group.total)}</Text>
                  <Text style={styles.countText}>{group.count.toLocaleString("ar-SA")} دفعة</Text>
                  <Text style={styles.dueText}>أقدم: {group.oldestDueDate}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {!groups.length ? <View style={styles.emptyBox}><MaterialCommunityIcons name="check-circle-outline" size={34} color="#0F766E" /><Text style={styles.emptyText}>لا توجد وحدات عليها دفعات متأخرة.</Text></View> : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8F6" },
  container: { padding: 14, paddingBottom: 40 },
  hero: { backgroundColor: "#111827", borderRadius: 26, padding: 15, marginBottom: 12, flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  heroIcon: { width: 58, height: 58, borderRadius: 22, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  heroText: { flex: 1, alignItems: "flex-end" },
  heroKicker: { color: "#FCA5A5", fontWeight: "900", textAlign: "right" },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "900", textAlign: "right", marginTop: 3 },
  heroSub: { color: "#CBD5E1", fontWeight: "800", textAlign: "right", marginTop: 4 },
  stateBox: { backgroundColor: "#fff", borderRadius: 18, padding: 18, alignItems: "center", marginBottom: 10 },
  stateText: { color: "#6B7280", fontWeight: "800", marginTop: 8 },
  errorBox: { backgroundColor: "#FEE2E2", borderRadius: 18, padding: 14, marginBottom: 10 },
  errorText: { color: "#991B1B", fontWeight: "900", textAlign: "right" },
  retryButton: { backgroundColor: "#991B1B", borderRadius: 12, padding: 11, alignItems: "center", marginTop: 10 },
  retryText: { color: "#fff", fontWeight: "900" },
  summaryPanel: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 20, padding: 14, marginBottom: 12, alignItems: "flex-end" },
  summaryValue: { color: "#DC2626", fontSize: 24, fontWeight: "900", textAlign: "right" },
  summaryLabel: { color: "#991B1B", fontWeight: "900", textAlign: "right", marginTop: 4 },
  unitCard: { backgroundColor: "#fff", borderRadius: 22, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#FECACA", flexDirection: "row", alignItems: "center", gap: 9, shadowColor: "#0F172A", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  chevronBox: { width: 34, height: 34, borderRadius: 14, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  unitIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  unitInfo: { flex: 1, alignItems: "flex-end", minWidth: 0 },
  unitTitle: { color: "#111827", fontWeight: "900", fontSize: 18, textAlign: "right" },
  unitMeta: { color: "#64748B", fontWeight: "800", textAlign: "right", marginTop: 3, fontSize: 12 },
  unitHint: { color: "#DC2626", fontWeight: "900", textAlign: "right", marginTop: 5, fontSize: 11 },
  amountBox: { alignItems: "flex-start", minWidth: 86 },
  amount: { color: "#DC2626", fontWeight: "900", fontSize: 14 },
  countText: { color: "#991B1B", fontWeight: "900", fontSize: 11, marginTop: 4 },
  dueText: { color: "#6B7280", fontWeight: "800", fontSize: 10, marginTop: 3 },
  emptyBox: { backgroundColor: "#fff", borderRadius: 18, padding: 20, alignItems: "center", borderWidth: 1, borderColor: "#E7E9EA" },
  emptyText: { color: "#0F766E", fontWeight: "900", textAlign: "center", marginTop: 8 },
});
