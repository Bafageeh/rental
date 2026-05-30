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
function sameText(a: unknown, b: unknown) {
  return String(a ?? "").trim() === String(b ?? "").trim();
}

export default function UnitOverduePaymentsScreen() {
  const params = useLocalSearchParams<{ owner_id?: string; owner_name?: string; property_name?: string; unit_number?: string }>();
  const ownerId = firstParam(params.owner_id);
  const ownerNameParam = firstParam(params.owner_name);
  const propertyName = firstParam(params.property_name);
  const unitNumber = firstParam(params.unit_number);
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
      setError(e instanceof Error ? e.message : "تعذر تحميل دفعات الوحدة");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(false); }, [ownerId]);

  const ownerName = data?.owner?.name || ownerNameParam || "المالك";
  const payments = useMemo(() => {
    return (data?.overdue_payments || [])
      .filter((payment) => sameText(payment.property_name, propertyName) && sameText(payment.unit_number, unitNumber))
      .sort((a, b) => dateOnly(a.due_date).localeCompare(dateOnly(b.due_date)));
  }, [data?.overdue_payments, propertyName, unitNumber]);
  const total = payments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#DC2626" />}>
        <View style={styles.hero}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.85} onPress={() => router.back()}>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.heroIcon}><MaterialCommunityIcons name="door-closed" size={30} color="#DC2626" /></View>
          <View style={styles.heroText}>
            <Text style={styles.heroKicker}>دفعات الوحدة المتأخرة</Text>
            <Text style={styles.heroTitle}>وحدة {clean(unitNumber)}</Text>
            <Text style={styles.heroSub}>{clean(propertyName)} • {ownerName}</Text>
          </View>
        </View>

        {loading ? <View style={styles.stateBox}><ActivityIndicator /><Text style={styles.stateText}>جاري التحميل...</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => load(false)}><Text style={styles.retryText}>إعادة المحاولة</Text></TouchableOpacity></View> : null}

        {!loading && !error ? (
          <>
            <View style={styles.summaryPanel}>
              <Text style={styles.summaryValue}>{money(total)}</Text>
              <Text style={styles.summaryLabel}>{payments.length.toLocaleString("ar-SA")} دفعة متأخرة تابعة لهذه الوحدة</Text>
            </View>

            {payments.map((payment, index) => (
              <View key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentTop}>
                  <View style={styles.numberBadge}><Text style={styles.numberText}>{(index + 1).toLocaleString("ar-SA")}</Text></View>
                  <View style={styles.paymentTitleBox}>
                    <Text style={styles.paymentTitle}>دفعة متأخرة</Text>
                    <Text style={styles.paymentMeta}>المستأجر: {clean(payment.tenant_name)}</Text>
                  </View>
                  <Text style={styles.amount}>{money(payment.amount)}</Text>
                </View>
                <View style={styles.dateRow}>
                  <View style={styles.dateChip}><Text style={styles.dateLabel}>الاستحقاق</Text><Text style={styles.dateValue}>{dateOnly(payment.due_date)}</Text></View>
                  <View style={styles.dateChip}><Text style={styles.dateLabel}>الحالة</Text><Text style={styles.statusText}>متأخرة</Text></View>
                </View>
              </View>
            ))}

            {!payments.length ? <View style={styles.emptyBox}><MaterialCommunityIcons name="check-circle-outline" size={34} color="#0F766E" /><Text style={styles.emptyText}>لا توجد دفعات متأخرة لهذه الوحدة.</Text></View> : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8F6" },
  container: { padding: 14, paddingBottom: 40 },
  hero: { backgroundColor: "#111827", borderRadius: 26, padding: 15, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  backButton: { width: 42, height: 42, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" },
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
  paymentCard: { backgroundColor: "#fff", borderRadius: 20, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#FECACA" },
  paymentTop: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  numberBadge: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  numberText: { color: "#DC2626", fontWeight: "900", fontSize: 17 },
  paymentTitleBox: { flex: 1, alignItems: "flex-end" },
  paymentTitle: { color: "#111827", fontWeight: "900", fontSize: 17, textAlign: "right" },
  paymentMeta: { color: "#64748B", fontWeight: "800", fontSize: 12, textAlign: "right", marginTop: 4 },
  amount: { color: "#DC2626", fontWeight: "900", fontSize: 15 },
  dateRow: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  dateChip: { flex: 1, backgroundColor: "#F8FAFC", borderRadius: 14, padding: 10, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" },
  dateLabel: { color: "#64748B", fontWeight: "800", fontSize: 11 },
  dateValue: { color: "#111827", fontWeight: "900", marginTop: 3 },
  statusText: { color: "#DC2626", fontWeight: "900", marginTop: 3 },
  emptyBox: { backgroundColor: "#fff", borderRadius: 18, padding: 20, alignItems: "center", borderWidth: 1, borderColor: "#E7E9EA" },
  emptyText: { color: "#0F766E", fontWeight: "900", textAlign: "center", marginTop: 8 },
});
