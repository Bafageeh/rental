import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiGet, apiPost } from "../lib/api";
import { clearAuthSession, getAuthUser } from "../lib/auth";
import { SafeAreaView } from "react-native-safe-area-context";

type Dashboard = {
  status: string;
  role?: string;
  owner_id?: number | null;
  is_admin?: boolean;
  summary: {
    owners_count?: number;
    properties_count: number;
    units_count: number;
    contracts_count: number;
    active_contracts_count: number;
    payments_count?: number;
    paid_income?: number;
    due_income?: number;
    overdue_income?: number;
    overdue_count?: number;
    expenses?: number;
    net_income: number;
  };
  owners?: Array<any>;
  properties: Array<any>;
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function roleLabel(role?: string | null) {
  const normalized = String(role ?? "").trim().toLowerCase();
  if (normalized === "manager") return "مدير عقارات";
  if (normalized === "admin" || normalized === "super_admin") return "أدمن عام";
  if (normalized === "owner") return "مالك";
  if (normalized === "tenant") return "مستأجر";
  return "مستخدم";
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function MyAccountScreen() {
  const [user, setUser] = useState<any>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const storedUser = await getAuthUser();
      if (!storedUser) {
        setUser(null);
        setDashboard(null);
        return;
      }
      const me = await apiGet("/auth/me");
      const scoped = await apiGet("/my/scope");
      setUser(me?.data ?? me?.user ?? me);
      setDashboard((scoped?.data ?? scoped) as Dashboard);
    } catch (e) {
      Alert.alert("تنبيه", e instanceof Error ? e.message : "يرجى تسجيل الدخول");
      setUser(null);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try { await apiPost("/auth/logout"); } catch {}
    await clearAuthSession();
    Alert.alert("تم", "تم تسجيل الخروج");
    router.replace("/login" as any);
  }

  async function refreshScreen() {
    try { setRefreshing(true); await load(); } finally { setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);

  const summary = dashboard?.summary;
  const dashboardRole = dashboard?.role ?? user?.role;
  const ownersCount = summary?.owners_count ?? dashboard?.owners?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}>
        <Text style={styles.title}>حسابي</Text>
        <Text style={styles.subtitle}>لوحة بيانات حسب صلاحية المستخدم</Text>

        {loading ? <View style={styles.box}><ActivityIndicator /><Text style={styles.boxText}>جاري تحميل الحساب...</Text></View> : null}

        {!loading && !user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>غير مسجل الدخول</Text>
            <Text style={styles.detail}>سجل الدخول لعرض بياناتك حسب الصلاحية.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/login" as any)}><Text style={styles.primaryButtonText}>تسجيل الدخول</Text></TouchableOpacity>
          </View>
        ) : null}

        {user && summary ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{user.name}</Text>
              <Text style={styles.detail}>البريد: {user.email}</Text>
              <Text style={styles.detail}>الصلاحية: {roleLabel(dashboardRole)}</Text>
              <Text style={styles.detail}>رقم المالك المرتبط: {user.owner_id || "-"}</Text>
              <TouchableOpacity style={styles.logoutButton} onPress={logout}><Text style={styles.primaryButtonText}>تسجيل الخروج</Text></TouchableOpacity>
            </View>

            <View style={styles.grid}>
              <Card title="الملاك" value={ownersCount} />
              <Card title="العقارات" value={summary.properties_count} />
              <Card title="الوحدات" value={summary.units_count} />
              <Card title="العقود" value={summary.contracts_count} />
              <Card title="النشطة" value={summary.active_contracts_count} />
              <Card title="المدفوع" value={money(summary.paid_income)} />
              <Card title="المستحق" value={money(summary.due_income)} />
              <Card title="المصاريف" value={money(summary.expenses)} />
              <Card title="الصافي" value={money(summary.net_income)} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>العقارات ضمن الصلاحية</Text>
              {dashboard?.properties?.length ? dashboard.properties.map((property: any) => (
                <View key={property.id} style={styles.propertyItem}>
                  <Text style={styles.propertyName}>{property.name || "عقار"}</Text>
                  <Text style={styles.detail}>المدينة: {property.city || "-"}</Text>
                  <Text style={styles.detail}>الحي: {property.district || "-"}</Text>
                </View>
              )) : <Text style={styles.detail}>لا توجد عقارات ضمن هذا الحساب.</Text>}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 18, paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: "800", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", textAlign: "right" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 20, fontWeight: "800", color: "#111827", textAlign: "right", marginBottom: 8 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  primaryButton: { marginTop: 14, backgroundColor: "#111827", padding: 13, borderRadius: 12, alignItems: "center" },
  logoutButton: { marginTop: 14, backgroundColor: "#dc2626", padding: 13, borderRadius: 12, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between" },
  statCard: { width: "48%", backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12, alignItems: "flex-end" },
  statTitle: { color: "#7A766F", fontSize: 14, textAlign: "right" },
  statValue: { marginTop: 8, color: "#111827", fontSize: 19, fontWeight: "800", textAlign: "right" },
  propertyItem: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 10 },
  propertyName: { color: "#111827", fontWeight: "800", textAlign: "right" },
});
