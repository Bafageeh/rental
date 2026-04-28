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
import { apiGetScoped } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type PropertySettlement = {
  id: number;
  name?: string | null;
  city?: string | null;
  district?: string | null;
  property_type?: string | null;
  units_count?: number;
  contracts_count?: number;
  paid_income?: number;
  due_income?: number;
  overdue_income?: number;
  expenses?: number;
  net_income?: number;
};

type OwnerSettlement = {
  owner?: {
    id: number;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    type?: string | null;
  };
  summary?: {
    properties_count?: number;
    units_count?: number;
    contracts_count?: number;
    active_contracts_count?: number;
    payments_count?: number;
    expected_income?: number;
    paid_income?: number;
    due_income?: number;
    overdue_income?: number;
    remaining_income?: number;
    expenses?: number;
    net_income?: number;
  };
  properties?: PropertySettlement[];
  recent_payments?: Array<{
    id: number;
    amount?: number;
    due_date?: string | null;
    paid_date?: string | null;
    status?: string | null;
    tenant_name?: string | null;
    property_name?: string | null;
    unit_number?: string | null;
  }>;
  recent_expenses?: Array<{
    id: number;
    amount?: number;
    expense_date?: string | null;
    title?: string | null;
    category_name?: string | null;
    property_name?: string | null;
  }>;
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function statusLabel(value?: string | null) {
  if (value === "paid") return "مدفوعة";
  if (value === "due") return "مستحقة";
  if (value === "overdue") return "متأخرة";
  return value || "-";
}

export default function OwnerSettlementsScreen() {
  const [items, setItems] = useState<OwnerSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedOwnerId, setExpandedOwnerId] = useState<number | null>(null);

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/owner-settlements",
        "/my/owner-settlements"
      );

      setItems(Array.isArray(result) ? result : []);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل تسويات الملاك");
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

  const totalPaid = items.reduce((sum, item) => sum + Number(item.summary?.paid_income || 0), 0);
  const totalExpenses = items.reduce((sum, item) => sum + Number(item.summary?.expenses || 0), 0);
  const totalNet = items.reduce((sum, item) => sum + Number(item.summary?.net_income || 0), 0);
  const totalRemaining = items.reduce((sum, item) => sum + Number(item.summary?.remaining_income || 0), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>تسويات الملاك</Text>
        <Text style={styles.subtitle}>
          صافي الدخل لكل مالك بناءً على المدفوعات والمصاريف
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>عدد الملاك: {items.length}</Text>
          <Text style={styles.summaryText}>المدفوع: {money(totalPaid)}</Text>
          <Text style={styles.summaryText}>المصاريف: {money(totalExpenses)}</Text>
          <Text style={styles.summaryText}>صافي الدخل: {money(totalNet)}</Text>
          <Text style={styles.summaryText}>المتبقي غير المحصل: {money(totalRemaining)}</Text>
        </View>
{loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل تسويات الملاك...</Text>
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد بيانات تسويات حاليًا</Text>
          </View>
        ) : null}

        {items.map((item) => {
          const ownerId = item.owner?.id || 0;
          const summary = item.summary || {};
          const expanded = expandedOwnerId === ownerId;

          return (
            <View key={ownerId} style={styles.card}>
              <Text style={styles.cardTitle}>{item.owner?.name || "مالك"}</Text>
              <Text style={styles.detail}>الجوال: {item.owner?.phone || "-"}</Text>
              <Text style={styles.detail}>البريد: {item.owner?.email || "-"}</Text>

              <View style={styles.statsRow}>
                <Text style={styles.stat}>العقارات: {summary.properties_count ?? 0}</Text>
                <Text style={styles.stat}>الوحدات: {summary.units_count ?? 0}</Text>
                <Text style={styles.stat}>العقود: {summary.contracts_count ?? 0}</Text>
              </View>

              <View style={styles.moneyBox}>
                <Text style={styles.moneyLine}>الإيراد المتوقع: {money(summary.expected_income)}</Text>
                <Text style={styles.moneyLine}>المدفوع: {money(summary.paid_income)}</Text>
                <Text style={styles.moneyLine}>المستحق: {money(summary.due_income)}</Text>
                <Text style={styles.moneyLine}>المتأخر: {money(summary.overdue_income)}</Text>
                <Text style={styles.moneyLine}>المصاريف: {money(summary.expenses)}</Text>
                <Text style={styles.netLine}>صافي الدخل: {money(summary.net_income)}</Text>
              </View>

              <TouchableOpacity
                style={styles.detailsButton}
                onPress={() => setExpandedOwnerId(expanded ? null : ownerId)}
              >
                <Text style={styles.detailsButtonText}>
                  {expanded ? "إخفاء التفاصيل" : "عرض تفاصيل العقارات"}
                </Text>
              </TouchableOpacity>

              {expanded ? (
                <View style={styles.detailsBox}>
                  <Text style={styles.sectionTitle}>العقارات</Text>

                  {(item.properties || []).map((property) => (
                    <View key={property.id} style={styles.propertyBox}>
                      <Text style={styles.propertyTitle}>{property.name || "عقار"}</Text>
                      <Text style={styles.detail}>المدينة: {property.city || "-"}</Text>
                      <Text style={styles.detail}>الحي: {property.district || "-"}</Text>
                      <Text style={styles.detail}>الوحدات: {property.units_count ?? 0}</Text>
                      <Text style={styles.detail}>العقود: {property.contracts_count ?? 0}</Text>
                      <Text style={styles.detail}>المدفوع: {money(property.paid_income)}</Text>
                      <Text style={styles.detail}>المصاريف: {money(property.expenses)}</Text>
                      <Text style={styles.propertyNet}>الصافي: {money(property.net_income)}</Text>
                    </View>
                  ))}

                  <Text style={styles.sectionTitle}>آخر الدفعات</Text>
                  {(item.recent_payments || []).slice(0, 10).map((payment) => (
                    <View key={payment.id} style={styles.rowItem}>
                      <Text style={styles.rowTitle}>{money(payment.amount)}</Text>
                      <Text style={styles.detail}>الحالة: {statusLabel(payment.status)}</Text>
                      <Text style={styles.detail}>المستأجر: {payment.tenant_name || "-"}</Text>
                      <Text style={styles.detail}>العقار: {payment.property_name || "-"}</Text>
                      <Text style={styles.detail}>الاستحقاق: {payment.due_date || "-"}</Text>
                    </View>
                  ))}

                  <Text style={styles.sectionTitle}>آخر المصاريف</Text>
                  {(item.recent_expenses || []).slice(0, 10).map((expense) => (
                    <View key={expense.id} style={styles.rowItem}>
                      <Text style={styles.expenseTitle}>{money(expense.amount)}</Text>
                      <Text style={styles.detail}>العقار: {expense.property_name || "-"}</Text>
                      <Text style={styles.detail}>النوع: {expense.category_name || "-"}</Text>
                      <Text style={styles.detail}>العنوان: {expense.title || "-"}</Text>
                      <Text style={styles.detail}>التاريخ: {expense.expense_date || "-"}</Text>
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
  netLine: { color: "#166534", fontWeight: "800", textAlign: "right", marginTop: 4 },
  detailsButton: { backgroundColor: "#0F9B6F", padding: 12, borderRadius: 12, alignItems: "center", marginTop: 14 },
  detailsButtonText: { color: "#fff", fontWeight: "800" },
  detailsBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 14 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#111827", textAlign: "right", marginBottom: 10, marginTop: 6 },
  propertyBox: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 12 },
  propertyTitle: { fontSize: 17, fontWeight: "800", color: "#111827", textAlign: "right" },
  propertyNet: { marginTop: 7, color: "#166534", fontWeight: "800", textAlign: "right" },
  rowItem: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 10 },
  rowTitle: { color: "#111827", fontSize: 17, fontWeight: "800", textAlign: "right" },
  expenseTitle: { color: "#b91c1c", fontSize: 17, fontWeight: "800", textAlign: "right" },
});
