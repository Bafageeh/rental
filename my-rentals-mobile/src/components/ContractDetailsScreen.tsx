import { Ionicons } from "@expo/vector-icons";
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

type ContractRecord = {
  id: number;
  contract_number?: string | null;
  government_contract_number?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  tenant?: { id?: number; name?: string | null } | null;
  unit?: { id?: number; unit_number?: string | null; property?: { id?: number; name?: string | null } | null } | null;
};

function isPayment(item: PaymentItem) {
  return String(item.entity || "").toLowerCase() === "payment";
}

function responseList(payload: any) {
  return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
}

function display(value: unknown, fallback = "-") {
  const text = String(value ?? "").trim();
  return text ? text : fallback;
}

function statusLabel(status?: string | null) {
  const text = String(status || "").toLowerCase();
  if (["active", "نشط"].includes(text)) return "نشط";
  if (["ended", "expired", "inactive", "closed", "منتهي"].includes(text)) return "منتهي";
  if (["cancelled", "canceled", "ملغي", "ملغاة"].includes(text)) return "ملغي";
  return status ? String(status) : "غير محدد";
}

function isActiveStatus(status?: string | null) {
  return statusLabel(status) === "نشط";
}

function cleanTitleTitle(title?: string) {
  return String(title || "").replace(/^عقد\s*/u, "").trim();
}

export default function ContractDetailsScreen({ id }: { id: string | number }) {
  const [data, setData] = useState<ContractPayload | null>(null);
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function load(refresh = false) {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      const [relatedResult, contractsResult] = await Promise.all([
        apiGet(`/relation-manager/related/contract/${id}`),
        apiGet(`/contracts`).catch(() => []),
      ]);
      setData(relatedResult as ContractPayload);
      const list = responseList(contractsResult) as ContractRecord[];
      setContract(list.find((item) => String(item.id) === String(id)) || null);
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
  const tenantName = display(contract?.tenant?.name, cleanTitleTitle(data?.title) || "المستأجر غير محدد");
  const contractNumber = display(contract?.government_contract_number || contract?.contract_number || id);
  const dateRange = `${display(contract?.start_date, "بلا بداية")}  ←  ${display(contract?.end_date, "بلا نهاية")}`;
  const badgeText = statusLabel(contract?.status);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroActionsBox}>
              <InlineEditDeleteActions resource="contracts" id={id} hideDetails compact iconOnly onChanged={() => load(true)} />
            </View>
            <View style={styles.heroTextBox}>
              <View style={styles.tenantRow}>
                <Text style={[styles.statusBadge, isActiveStatus(contract?.status) ? styles.statusActive : styles.statusEnded]}>{badgeText}</Text>
                <Text style={styles.tenantName}>{tenantName}</Text>
              </View>
              <Text style={styles.contractNumber}>رقم العقد: {contractNumber}</Text>
            </View>
            <View style={styles.heroIconBox}>
              <Ionicons name="document-text-outline" size={28} color="#0F766E" />
            </View>
          </View>

          <View style={styles.contractDateBox}>
            <Text style={styles.contractDateLabel}>تاريخ العقد</Text>
            <Text style={styles.contractDateValue}>{dateRange}</Text>
          </View>

          <View style={styles.heroPills}>
            <Text style={styles.heroPill}>الدفعات: {payments.length}</Text>
            {contract?.unit?.property?.name ? <Text style={styles.heroPill}>العقار: {contract.unit.property.name}</Text> : null}
          </View>
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
  hero: { backgroundColor: "#111827", borderRadius: 26, padding: 14, marginBottom: 12 },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroActionsBox: { minWidth: 98, alignItems: "flex-start" },
  heroTextBox: { flex: 1, alignItems: "flex-end" },
  heroIconBox: { width: 52, height: 52, borderRadius: 19, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  tenantRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" },
  tenantName: { color: "#fff", fontSize: 22, lineHeight: 30, fontWeight: "900", textAlign: "right" },
  statusBadge: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontWeight: "900", fontSize: 12 },
  statusActive: { backgroundColor: "#DCFCE7", color: "#166534" },
  statusEnded: { backgroundColor: "#FEE2E2", color: "#991B1B" },
  contractNumber: { color: "#CBD5E1", fontSize: 12, fontWeight: "900", textAlign: "right", marginTop: 4 },
  contractDateBox: { marginTop: 13, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 18, padding: 12, alignItems: "flex-end" },
  contractDateLabel: { color: "#A7F3D0", fontWeight: "900", fontSize: 12, textAlign: "right" },
  contractDateValue: { color: "#fff", fontWeight: "900", fontSize: 15, marginTop: 4, textAlign: "right" },
  heroPills: { flexDirection: "row-reverse", gap: 8, marginTop: 11, flexWrap: "wrap" },
  heroPill: { overflow: "hidden", backgroundColor: "rgba(255,255,255,0.12)", color: "#fff", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, fontWeight: "800", fontSize: 12 },
  section: { backgroundColor: "#fff", borderRadius: 24, padding: 12, borderWidth: 1, borderColor: "#EDECE9" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionTitle: { color: "#111827", fontSize: 20, fontWeight: "900", textAlign: "right" },
  count: { overflow: "hidden", backgroundColor: "#eff6ff", color: "#065F44", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontWeight: "900" },
  state: { alignItems: "center", padding: 20, gap: 8 },
  stateText: { color: "#6b7280", fontWeight: "800" },
  error: { color: "#be123c", backgroundColor: "#fff1f2", padding: 12, borderRadius: 14, textAlign: "right", fontWeight: "800" },
  empty: { color: "#6b7280", textAlign: "center", padding: 18, fontWeight: "800" },
});
