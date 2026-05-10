import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { apiGet } from "../lib/api";
import InlineEditDeleteActions from "./InlineEditDeleteActions";
import ContractPaymentCard from "./ContractPaymentCard";

type PaymentItem = {
  id: number;
  entity: string;
  title: string;
  subtitle?: string;
  badge?: string | null;
  amount?: number | string | null;
  due_date?: string | null;
  paid_date?: string | null;
  deadline_date?: string | null;
  notes?: string | null;
  status?: string | null;
};

type ContractPayload = {
  title?: string;
  sections?: Array<{ key: string; title: string; count: number; items: PaymentItem[] }>;
};

function isPayment(item: PaymentItem) {
  return String(item.entity || "").toLowerCase() === "payment";
}

export default function ContractDetailsScreen({ id }: { id: string | number }) {
  const [data, setData] = useState<ContractPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function load(refresh = false) {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      const result = await apiGet(`/relation-manager/related/contract/${id}`);
      setData(result as ContractPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل العقد");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(false);
  }, [id]);

  const payments = (data?.sections || []).flatMap((section) => section.items || []).filter(isPayment);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>العقد</Text>
          <Text style={styles.heroTitle}>{data?.title || "تفاصيل العقد"}</Text>
          <View style={styles.heroPills}>
            <Text style={styles.heroPill}>الدفعات: {payments.length}</Text>
          </View>
        </View>

        <View style={styles.actionsBox}>
          <InlineEditDeleteActions resource="contracts" id={id} hideDetails onChanged={() => load(true)} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.count}>{payments.length}</Text>
            <Text style={styles.sectionTitle}>جدول الدفعات</Text>
          </View>

          {loading ? <View style={styles.state}><ActivityIndicator /><Text style={styles.stateText}>جاري التحميل...</Text></View> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && !error && payments.length === 0 ? <Text style={styles.empty}>لا توجد دفعات مرتبطة بهذا العقد.</Text> : null}

          {payments.map((payment, index) => (
            <ContractPaymentCard
              key={payment.id}
              item={payment}
              index={index}
              expanded={expandedId === payment.id}
              onToggle={() => setExpandedId((current) => current === payment.id ? null : payment.id)}
              onChanged={() => load(true)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f7fb" },
  container: { padding: 14, paddingBottom: 30 },
  hero: { backgroundColor: "#111827", borderRadius: 24, padding: 16, marginBottom: 12 },
  heroLabel: { color: "#c7d2fe", fontSize: 13, fontWeight: "900", textAlign: "right", marginBottom: 6 },
  heroTitle: { color: "#fff", fontSize: 24, lineHeight: 32, fontWeight: "900", textAlign: "right" },
  heroPills: { flexDirection: "row-reverse", gap: 8, marginTop: 13, flexWrap: "wrap" },
  heroPill: { overflow: "hidden", backgroundColor: "rgba(255,255,255,0.12)", color: "#fff", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, fontWeight: "800", fontSize: 12 },
  actionsBox: { backgroundColor: "#fff", borderRadius: 18, padding: 8, marginBottom: 12, borderWidth: 1, borderColor: "#EDECE9" },
  section: { backgroundColor: "#fff", borderRadius: 24, padding: 12, borderWidth: 1, borderColor: "#EDECE9" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionTitle: { color: "#111827", fontSize: 20, fontWeight: "900", textAlign: "right" },
  count: { overflow: "hidden", backgroundColor: "#eff6ff", color: "#065F44", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontWeight: "900" },
  state: { alignItems: "center", padding: 20, gap: 8 },
  stateText: { color: "#6b7280", fontWeight: "800" },
  error: { color: "#be123c", backgroundColor: "#fff1f2", padding: 12, borderRadius: 14, textAlign: "right", fontWeight: "800" },
  empty: { color: "#6b7280", textAlign: "center", padding: 18, fontWeight: "800" },
});
