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

type StatementPayment = {
  id: number;
  amount?: number;
  due_date?: string | null;
  paid_date?: string | null;
  status?: string | null;
  notes?: string | null;
};

type StatementContract = {
  id: number;
  contract_number?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  rent_amount?: number;
  property_name?: string | null;
  owner_name?: string | null;
  unit_number?: string | null;
  payments?: StatementPayment[];
};

type TenantStatement = {
  tenant?: {
    id: number;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    national_id?: string | null;
    nationality?: string | null;
  };
  summary?: {
    contracts_count?: number;
    active_contracts_count?: number;
    payments_count?: number;
    total_amount?: number;
    paid_amount?: number;
    due_amount?: number;
    overdue_amount?: number;
    remaining_amount?: number;
  };
  latest_contract?: {
    id: number;
    contract_number?: string | null;
    status?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    property_name?: string | null;
    owner_name?: string | null;
    unit_number?: string | null;
  } | null;
  contracts?: StatementContract[];
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function statusLabel(value?: string | null) {
  if (value === "paid") return "مدفوعة";
  if (value === "due") return "مستحقة";
  if (value === "overdue") return "متأخرة";
  if (value === "active") return "نشط";
  if (value === "ended") return "منتهي";
  if (value === "cancelled") return "ملغى";
  return value || "-";
}

export default function TenantStatementsScreen() {
  const [items, setItems] = useState<TenantStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTenantId, setExpandedTenantId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/tenant-statements",
        "/my/tenant-statements"
      );

      setItems(Array.isArray(result) ? result : []);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل كشوف المستأجرين");
    } finally {
      setLoading(false);
    }
  }

  async function markPaid(paymentId: number) {
    try {
      setUpdatingId(paymentId);
      await apiPost(`/payments/${paymentId}/mark-paid`);
      Alert.alert("تم", "تم تسجيل الدفعة كمدفوعة");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحديث الدفعة");
    } finally {
      setUpdatingId(null);
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

  const totalPaid = items.reduce((sum, item) => sum + Number(item.summary?.paid_amount || 0), 0);
  const totalRemaining = items.reduce((sum, item) => sum + Number(item.summary?.remaining_amount || 0), 0);
  const totalOverdue = items.reduce((sum, item) => sum + Number(item.summary?.overdue_amount || 0), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>كشوف المستأجرين</Text>
        <Text style={styles.subtitle}>
          كشف حساب لكل مستأجر يشمل العقود والدفعات والمتبقي
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>عدد المستأجرين: {items.length}</Text>
          <Text style={styles.summaryText}>المدفوع: {money(totalPaid)}</Text>
          <Text style={styles.summaryText}>المتبقي: {money(totalRemaining)}</Text>
          <Text style={styles.summaryText}>المتأخر: {money(totalOverdue)}</Text>
        </View>
{loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل كشوف المستأجرين...</Text>
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد بيانات كشوف حاليًا</Text>
          </View>
        ) : null}

        {items.map((item) => {
          const tenantId = item.tenant?.id || 0;
          const expanded = expandedTenantId === tenantId;
          const summary = item.summary || {};

          return (
            <View key={tenantId} style={styles.card}>
              <Text style={styles.cardTitle}>{item.tenant?.name || "مستأجر"}</Text>
              <Text style={styles.detail}>الجوال: {item.tenant?.phone || "-"}</Text>
              <Text style={styles.detail}>الهوية: {item.tenant?.national_id || "-"}</Text>
              <Text style={styles.detail}>الجنسية: {item.tenant?.nationality || "-"}</Text>

              <View style={styles.statsRow}>
                <Text style={styles.stat}>العقود: {summary.contracts_count ?? 0}</Text>
                <Text style={styles.stat}>النشطة: {summary.active_contracts_count ?? 0}</Text>
                <Text style={styles.stat}>الدفعات: {summary.payments_count ?? 0}</Text>
              </View>

              <View style={styles.moneyBox}>
                <Text style={styles.moneyLine}>الإجمالي: {money(summary.total_amount)}</Text>
                <Text style={styles.moneyLine}>المدفوع: {money(summary.paid_amount)}</Text>
                <Text style={styles.moneyLine}>المستحق: {money(summary.due_amount)}</Text>
                <Text style={styles.moneyLine}>المتأخر: {money(summary.overdue_amount)}</Text>
                <Text style={styles.remainingLine}>المتبقي: {money(summary.remaining_amount)}</Text>
              </View>

              {item.latest_contract ? (
                <View style={styles.latestBox}>
                  <Text style={styles.latestTitle}>آخر عقد</Text>
                  <Text style={styles.detail}>العقد: {item.latest_contract.contract_number || item.latest_contract.id}</Text>
                  <Text style={styles.detail}>العقار: {item.latest_contract.property_name || "-"}</Text>
                  <Text style={styles.detail}>الوحدة: {item.latest_contract.unit_number || "-"}</Text>
                  <Text style={styles.detail}>الحالة: {statusLabel(item.latest_contract.status)}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.detailsButton}
                onPress={() => setExpandedTenantId(expanded ? null : tenantId)}
              >
                <Text style={styles.detailsButtonText}>
                  {expanded ? "إخفاء التفاصيل" : "عرض العقود والدفعات"}
                </Text>
              </TouchableOpacity>

              {expanded ? (
                <View style={styles.detailsBox}>
                  {(item.contracts || []).map((contract) => (
                    <View key={contract.id} style={styles.contractBox}>
                      <Text style={styles.contractTitle}>
                        عقد #{contract.contract_number || contract.id}
                      </Text>
                      <Text style={styles.detail}>العقار: {contract.property_name || "-"}</Text>
                      <Text style={styles.detail}>الوحدة: {contract.unit_number || "-"}</Text>
                      <Text style={styles.detail}>الحالة: {statusLabel(contract.status)}</Text>
                      <Text style={styles.detail}>الفترة: {contract.start_date || "-"} إلى {contract.end_date || "-"}</Text>

                      {(contract.payments || []).map((payment) => (
                        <View key={payment.id} style={styles.paymentBox}>
                          <Text style={styles.paymentAmount}>{money(payment.amount)}</Text>
                          <Text style={styles.paymentText}>الحالة: {statusLabel(payment.status)}</Text>
                          <Text style={styles.paymentText}>الاستحقاق: {payment.due_date || "-"}</Text>
                          <Text style={styles.paymentText}>السداد: {payment.paid_date || "-"}</Text>

                          {payment.status !== "paid" ? (
                            <TouchableOpacity
                              style={styles.paidButton}
                              onPress={() => markPaid(payment.id)}
                              disabled={updatingId === payment.id}
                            >
                              <Text style={styles.paidButtonText}>
                                {updatingId === payment.id ? "..." : "تسجيل كمدفوعة"}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ) : null}
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
  summaryBox: { backgroundColor: "#111827", borderRadius: 18, padding: 16, marginBottom: 14 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  primaryButton: { backgroundColor: "#111827", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 21, fontWeight: "800", color: "#111827", textAlign: "right" },
  detail: { marginTop: 7, color: "#5E5B55", textAlign: "right" },
  statsRow: { marginTop: 12, flexDirection: "row-reverse", flexWrap: "wrap" },
  stat: { backgroundColor: "#f3f4f6", color: "#374151", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: "hidden", fontWeight: "700", marginLeft: 8, marginBottom: 8 },
  moneyBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 10 },
  moneyLine: { color: "#374151", fontWeight: "700", textAlign: "right", marginBottom: 5 },
  remainingLine: { color: "#b91c1c", fontWeight: "800", textAlign: "right", marginTop: 4 },
  latestBox: { backgroundColor: "#eff6ff", borderRadius: 14, padding: 12, marginTop: 10 },
  latestTitle: { color: "#065F44", fontWeight: "800", textAlign: "right", marginBottom: 4 },
  detailsButton: { backgroundColor: "#0F9B6F", padding: 12, borderRadius: 12, alignItems: "center", marginTop: 14 },
  detailsButtonText: { color: "#fff", fontWeight: "800" },
  detailsBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 14 },
  contractBox: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 12 },
  contractTitle: { fontSize: 17, fontWeight: "800", color: "#111827", textAlign: "right" },
  paymentBox: { backgroundColor: "#f3f4f6", borderRadius: 12, padding: 12, marginTop: 10 },
  paymentAmount: { color: "#111827", fontSize: 17, fontWeight: "800", textAlign: "right" },
  paymentText: { marginTop: 5, color: "#5E5B55", textAlign: "right" },
  paidButton: { backgroundColor: "#16a34a", padding: 10, borderRadius: 10, alignItems: "center", marginTop: 10 },
  paidButtonText: { color: "#fff", fontWeight: "800" },
});
