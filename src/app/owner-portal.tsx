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
import { apiGet } from "../lib/api";
import { clearAuthSession, getAuthUser } from "../lib/auth";
import { SafeAreaView } from "react-native-safe-area-context";

type Summary = {
  properties_count?: number;
  units_count?: number;
  contracts_count?: number;
  active_contracts_count?: number;
  payments_count?: number;
  paid_income?: number;
  due_income?: number;
  overdue_income?: number;
  expenses?: number;
  net_income?: number;
};

type ScopedData = {
  status?: string;
  user?: any;
  role?: string;
  owner_id?: number | null;
  is_admin?: boolean;
  summary?: Summary;
  properties?: any[];
  contracts?: any[];
  payments?: any[];
  expenses?: any[];
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

export default function OwnerPortalScreen() {
  const [data, setData] = useState<ScopedData | null>(null);
  const [localUser, setLocalUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const user = await getAuthUser();
      setLocalUser(user);

      const result = await apiGet("/my/scope");
      setData(result as ScopedData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير معروف");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await clearAuthSession();
    Alert.alert("تم", "تم تسجيل الخروج");
    setData(null);
    setLocalUser(null);
    setError("تم تسجيل الخروج. الرجاء تسجيل الدخول مرة أخرى.");
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
  const user = data?.user || localUser;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>بوابة الحساب</Text>
        <Text style={styles.subtitle}>
          عرض البيانات حسب صلاحية المستخدم الحالي
        </Text>

        <View style={styles.userBox}>
          <Text style={styles.userName}>{user?.name || "مستخدم غير محدد"}</Text>
          <Text style={styles.userMeta}>البريد: {user?.email || "-"}</Text>
          <Text style={styles.userMeta}>
            الصلاحية: {data?.is_admin ? "مدير" : "مالك"}
          </Text>
          <Text style={styles.userMeta}>Owner ID: {data?.owner_id || "-"}</Text>
        </View>

        <View style={styles.actionsRow}>
<TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.actionText}>خروج</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل بيانات الحساب...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>تنبيه</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {data ? (
          <>
            <View style={styles.grid}>
              <Card title="العقارات" value={summary.properties_count ?? 0} />
              <Card title="الوحدات" value={summary.units_count ?? 0} />
              <Card title="العقود" value={summary.contracts_count ?? 0} />
              <Card title="العقود النشطة" value={summary.active_contracts_count ?? 0} />
              <Card title="المدفوع" value={money(summary.paid_income)} />
              <Card title="المستحق" value={money(summary.due_income)} />
              <Card title="المتأخر" value={money(summary.overdue_income)} />
              <Card title="المصاريف" value={money(summary.expenses)} />
              <Card title="صافي الدخل" value={money(summary.net_income)} />
            </View>

            <Text style={styles.sectionTitle}>العقارات المرتبطة</Text>
            {(data.properties || []).length === 0 ? (
              <View style={styles.box}>
                <Text style={styles.emptyText}>لا توجد عقارات ضمن هذا الحساب</Text>
              </View>
            ) : (
              (data.properties || []).map((property) => (
                <View key={property.id} style={styles.item}>
                  <Text style={styles.itemTitle}>{property.name || "عقار"}</Text>
                  <Text style={styles.itemText}>المالك: {property.owner?.name || "-"}</Text>
                  <Text style={styles.itemText}>المدينة: {property.city || "-"}</Text>
                  <Text style={styles.itemText}>الحي: {property.district || "-"}</Text>
                  <Text style={styles.itemText}>الوحدات: {property.units_count ?? 0}</Text>
                </View>
              ))
            )}

            <Text style={styles.sectionTitle}>آخر العقود</Text>
            {(data.contracts || []).slice(0, 10).map((contract) => (
              <View key={contract.id} style={styles.item}>
                <Text style={styles.itemTitle}>
                  عقد #{contract.government_contract_number || contract.contract_number || contract.id}
                </Text>
                <Text style={styles.itemText}>المستأجر: {contract.tenant?.name || "-"}</Text>
                <Text style={styles.itemText}>العقار: {contract.unit?.property?.name || "-"}</Text>
                <Text style={styles.itemText}>الوحدة: {contract.unit?.unit_number || "-"}</Text>
                <Text style={styles.itemText}>الحالة: {contract.status || "-"}</Text>
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
  container: { padding: 18, paddingBottom: 50 },
  title: { fontSize: 30, fontWeight: "800", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", fontSize: 15, textAlign: "right" },
  userBox: { backgroundColor: "#111827", borderRadius: 18, padding: 16, marginBottom: 12 },
  userName: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "right" },
  userMeta: { color: "#C4C1BB", marginTop: 6, textAlign: "right" },
  actionsRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 14 },
  refreshButton: { flex: 1, backgroundColor: "#0F9B6F", padding: 12, borderRadius: 12, alignItems: "center" },
  logoutButton: { flex: 1, backgroundColor: "#dc2626", padding: 12, borderRadius: 12, alignItems: "center" },
  actionText: { color: "#fff", fontWeight: "800" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  errorBox: { backgroundColor: "#fee2e2", padding: 16, borderRadius: 18, marginBottom: 14 },
  errorTitle: { color: "#991b1b", fontSize: 18, fontWeight: "800", textAlign: "right" },
  errorText: { color: "#7f1d1d", marginTop: 8, textAlign: "right" },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between" },
  card: { width: "48%", backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12, minHeight: 96, alignItems: "flex-end" },
  cardTitle: { color: "#7A766F", fontSize: 14, textAlign: "right" },
  cardValue: { marginTop: 10, color: "#111827", fontSize: 20, fontWeight: "800", textAlign: "right" },
  sectionTitle: { marginTop: 10, marginBottom: 10, fontSize: 22, fontWeight: "800", color: "#111827", textAlign: "right" },
  item: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  itemTitle: { fontSize: 18, fontWeight: "800", color: "#111827", textAlign: "right" },
  itemText: { marginTop: 7, color: "#5E5B55", textAlign: "right" },
});
