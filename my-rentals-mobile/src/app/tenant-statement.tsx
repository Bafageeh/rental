import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGetScoped } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type TenantOption = {
  id: number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  national_id?: string | null;
};

type ContractItem = {
  id: number;
  contract_number?: string | number | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  rent_amount?: number | null;
  property_name?: string | null;
  unit_number?: string | null;
};

type StatementTransaction = {
  date?: string | null;
  kind?: string | null;
  kind_label?: string | null;
  description?: string | null;
  property_name?: string | null;
  unit_number?: string | null;
  contract_number?: string | number | null;
  reference?: string | null;
  method?: string | null;
  debit?: number;
  credit?: number;
  amount?: number;
  balance_after?: number;
  payment_status?: string | null;
};

type TenantStatement = {
  tenants?: TenantOption[];
  selected_tenant?: TenantOption | null;
  contracts?: ContractItem[];
  period?: {
    from?: string | null;
    to?: string | null;
  };
  summary?: {
    charges?: number;
    receipts?: number;
    balance?: number;
    overdue?: number;
    transactions_count?: number;
  };
  transactions?: StatementTransaction[];
  statement_text?: string;
};

function pad(number: number) {
  return String(number).padStart(2, "0");
}

function todayString() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function yearStartString() {
  const date = new Date();
  return `${date.getFullYear()}-01-01`;
}

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function kindStyle(value?: string | null) {
  if (value === "charge") return styles.kindCharge;
  if (value === "receipt") return styles.kindReceipt;
  return styles.kindNeutral;
}

function statusLabel(value?: string | null) {
  if (value === "paid") return "مدفوعة";
  if (value === "partial") return "جزئية";
  if (value === "due") return "مستحقة";
  if (value === "overdue") return "متأخرة";
  return value || "-";
}

export default function TenantStatementScreen() {
  const [data, setData] = useState<TenantStatement | null>(null);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState(yearStartString());
  const [toDate, setToDate] = useState(todayString());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(nextTenantId = tenantId, nextFrom = fromDate, nextTo = toDate) {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (nextTenantId) {
        params.append("tenant_id", String(nextTenantId));
      }

      if (nextFrom) {
        params.append("from", nextFrom);
      }

      if (nextTo) {
        params.append("to", nextTo);
      }

      const query = params.toString();

      const result = await apiGetScoped(
        `/tenant-statement?${query}`,
        `/my/tenant-statement?${query}`
      );

      const payload = result as TenantStatement;
      setData(payload);

      if (!nextTenantId && payload.selected_tenant?.id) {
        setTenantId(payload.selected_tenant.id);
      }
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل كشف حساب المستأجر");
    } finally {
      setLoading(false);
    }
  }

  async function shareStatement() {
    if (!data?.statement_text) {
      Alert.alert("تنبيه", "لا يوجد كشف جاهز للمشاركة");
      return;
    }

    try {
      await Share.share({
        title: "كشف حساب مستأجر",
        message: data.statement_text,
      });
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر مشاركة كشف الحساب");
    }
  }
  async function refreshScreen() {
    try {
      setRefreshing(true);
      await load(tenantId, fromDate, toDate);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const tenants = data?.tenants || [];
  const contracts = data?.contracts || [];
  const summary = data?.summary || {};
  const transactions = data?.transactions || [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>كشف حساب المستأجر</Text>
        <Text style={styles.subtitle}>
          كشف تفصيلي للاستحقاقات والسداد والرصيد المستحق لكل مستأجر
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>المستأجر: {data?.selected_tenant?.name || "-"}</Text>
          <Text style={styles.summaryText}>الجوال: {data?.selected_tenant?.phone || "-"}</Text>
          <Text style={styles.summaryText}>الاستحقاقات: {money(summary.charges)}</Text>
          <Text style={styles.summaryText}>السداد: {money(summary.receipts)}</Text>
          <Text style={styles.balanceText}>الرصيد المستحق: {money(summary.balance)}</Text>
          <Text style={styles.overdueText}>المتأخر الحالي: {money(summary.overdue)}</Text>
        </View>

        <View style={styles.filterCard}>
          <Text style={styles.sectionTitle}>الفترة والمستأجر</Text>

          <Text style={styles.label}>المستأجر</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {tenants.map((tenant) => (
              <TouchableOpacity
                key={tenant.id}
                style={[styles.chip, tenantId === tenant.id ? styles.chipActive : null]}
                onPress={() => {
                  setTenantId(tenant.id);
                  load(tenant.id, fromDate, toDate);
                }}
              >
                <Text style={[styles.chipText, tenantId === tenant.id ? styles.chipTextActive : null]}>
                  {tenant.name || `مستأجر #${tenant.id}`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={styles.input}
            placeholder="من تاريخ YYYY-MM-DD"
            value={fromDate}
            onChangeText={setFromDate}
            textAlign="right"
          />

          <TextInput
            style={styles.input}
            placeholder="إلى تاريخ YYYY-MM-DD"
            value={toDate}
            onChangeText={setToDate}
            textAlign="right"
          />

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.refreshButton} onPress={() => load(tenantId, fromDate, toDate)}>
              <Text style={styles.actionText}>عرض الكشف</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareButton} onPress={shareStatement}>
              <Text style={styles.actionText}>مشاركة</Text>
            </TouchableOpacity>
          </View>
        </View>

        {contracts.length > 0 ? (
          <View style={styles.contractsCard}>
            <Text style={styles.sectionTitle}>عقود المستأجر</Text>

            {contracts.map((contract) => (
              <View key={contract.id} style={styles.contractItem}>
                <Text style={styles.contractTitle}>عقد #{contract.contract_number || contract.id}</Text>
                <Text style={styles.detail}>الحالة: {contract.status || "-"}</Text>
                <Text style={styles.detail}>العقار: {contract.property_name || "-"}</Text>
                <Text style={styles.detail}>الوحدة: {contract.unit_number || "-"}</Text>
                <Text style={styles.detail}>الفترة: {contract.start_date || "-"} إلى {contract.end_date || "-"}</Text>
                <Text style={styles.detail}>الإيجار: {money(contract.rent_amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل كشف الحساب...</Text>
          </View>
        ) : null}

        {!loading && transactions.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد حركات في هذه الفترة</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>الحركات</Text>

        {transactions.map((item, index) => (
          <View key={`${item.date}-${item.kind}-${index}`} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[styles.kindBadge, kindStyle(item.kind)]}>
                {item.kind_label || "-"}
              </Text>
              <Text style={styles.dateText}>{item.date || "-"}</Text>
            </View>

            <Text style={styles.description}>{item.description || "-"}</Text>
            <Text style={styles.detail}>العقد: {item.contract_number || "-"}</Text>
            <Text style={styles.detail}>العقار: {item.property_name || "-"}</Text>
            <Text style={styles.detail}>الوحدة: {item.unit_number || "-"}</Text>
            <Text style={styles.detail}>المرجع: {item.reference || "-"}</Text>
            <Text style={styles.detail}>حالة الدفعة: {statusLabel(item.payment_status)}</Text>

            <View style={styles.amountBox}>
              <Text style={styles.debitText}>مدين: {money(item.debit)}</Text>
              <Text style={styles.creditText}>دائن: {money(item.credit)}</Text>
              <Text style={styles.afterBalance}>الرصيد بعد الحركة: {money(item.balance_after)}</Text>
            </View>
          </View>
        ))}

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            المدين يمثل الاستحقاقات على المستأجر، والدائن يمثل السداد المقبوض. الرصيد النهائي = الاستحقاقات - السداد.
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
  balanceText: { color: "#bbf7d0", fontWeight: "900", textAlign: "right", marginTop: 6, fontSize: 18 },
  overdueText: { color: "#fecaca", fontWeight: "900", textAlign: "right", marginTop: 6 },
  filterCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14 },
  contractsCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14 },
  contractItem: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginBottom: 10 },
  contractTitle: { color: "#111827", fontWeight: "900", textAlign: "right", marginBottom: 5 },
  sectionTitle: { color: "#111827", fontSize: 21, fontWeight: "900", textAlign: "right", marginBottom: 10 },
  label: { color: "#374151", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  chips: { flexDirection: "row-reverse", paddingBottom: 10 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "800" },
  chipTextActive: { color: "#fff" },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  actionsRow: { flexDirection: "row-reverse", gap: 10, marginTop: 4 },
  refreshButton: { flex: 1, backgroundColor: "#0F9B6F", padding: 13, borderRadius: 12, alignItems: "center" },
  shareButton: { flex: 1, backgroundColor: "#16a34a", padding: 13, borderRadius: 12, alignItems: "center" },
  actionText: { color: "#fff", fontWeight: "900" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  kindBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  kindCharge: { backgroundColor: "#fee2e2", color: "#991b1b" },
  kindReceipt: { backgroundColor: "#dcfce7", color: "#166534" },
  kindNeutral: { backgroundColor: "#f3f4f6", color: "#374151" },
  dateText: { color: "#7A766F", fontWeight: "800", textAlign: "right", flex: 1 },
  description: { marginTop: 12, color: "#111827", fontSize: 17, fontWeight: "900", textAlign: "right" },
  detail: { marginTop: 7, color: "#5E5B55", textAlign: "right" },
  amountBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 12 },
  debitText: { color: "#991b1b", fontWeight: "900", textAlign: "right", marginBottom: 5 },
  creditText: { color: "#166534", fontWeight: "900", textAlign: "right", marginBottom: 5 },
  afterBalance: { color: "#065F44", fontWeight: "900", textAlign: "right" },
  noteBox: { backgroundColor: "#fffbeb", borderRadius: 18, padding: 14, marginTop: 4 },
  noteText: { color: "#92400e", fontWeight: "700", textAlign: "right", lineHeight: 22 },
});
