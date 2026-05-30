import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { apiGet, apiPost } from "../lib/api";

type Summary = { initial_balance?: number; collected_rents?: number; expenses?: number; transfers?: number; balance?: number };
type LedgerItem = { id: number; type: string; label?: string; amount?: number; signed_amount?: number; date?: string | null; property_name?: string | null; unit_number?: string | null; tenant_name?: string | null; method?: string | null; bank?: string | null; reference?: string | null; notes?: string | null; contract_number?: string | null };
type Statement = { owner?: { id: number; name?: string | null }; settings?: { initial_balance?: number; initial_balance_date?: string | null; notes?: string | null }; summary?: Summary; ledger?: LedgerItem[]; transfers?: LedgerItem[] };

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
function num(value: unknown) { const n = Number(String(value ?? 0).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; }
function money(value: unknown) { return `${Math.round(num(value)).toLocaleString("ar-SA")} ريال`; }
function dateOnly(value?: string | null) { return String(value || "").slice(0, 10) || "-"; }
function today() { return new Date().toISOString().slice(0, 10); }
function typeTone(type: string) { if (type === "rent" || type === "initial") return "credit"; if (type === "expense") return "expense"; return "transfer"; }
function typeLabel(type: string) { if (type === "rent") return "إيجار"; if (type === "expense") return "مصروف"; if (type === "transfer") return "حوالة"; if (type === "initial") return "رصيد مبدئي"; return type; }

export default function OwnerAccountStatementScreen() {
  const params = useLocalSearchParams<{ owner_id?: string; owner_name?: string }>();
  const ownerId = first(params.owner_id);
  const ownerNameParam = first(params.owner_name);
  const [data, setData] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [initialBalance, setInitialBalance] = useState("0");
  const [initialDate, setInitialDate] = useState(today());
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDate, setTransferDate] = useState(today());
  const [transferMethod, setTransferMethod] = useState("");
  const [transferBank, setTransferBank] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [transferNotes, setTransferNotes] = useState("");

  const ownerName = data?.owner?.name || ownerNameParam || "المالك";
  const summary = data?.summary || {};
  const ledger = data?.ledger || [];

  const load = useCallback(async (refresh = false) => {
    if (!ownerId) return;
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError("");
      const response = await apiGet(`/owners/${ownerId}/account-statement?_=${Date.now()}`);
      setData(response as Statement);
      setInitialBalance(String(response?.settings?.initial_balance ?? 0));
      setInitialDate(response?.settings?.initial_balance_date || today());
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل حساب المالك");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ownerId]);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const totals = useMemo(() => [
    { label: "الرصيد المبدئي", value: summary.initial_balance, icon: "wallet-outline" as const },
    { label: "الإيجارات المحصلة", value: summary.collected_rents, icon: "cash-check" as const },
    { label: "المصروفات", value: summary.expenses, icon: "cash-minus" as const, danger: true },
    { label: "المحول للمالك", value: summary.transfers, icon: "bank-transfer-out" as const, danger: true },
  ], [summary]);

  async function saveInitial() {
    try {
      setSaving(true);
      const response = await apiPost(`/owners/${ownerId}/account-settings`, { initial_balance: num(initialBalance), initial_balance_date: initialDate || null });
      setData((response?.data || response) as Statement);
      Alert.alert("تم", "تم حفظ الرصيد المبدئي.");
    } catch (e) {
      Alert.alert("تعذر الحفظ", e instanceof Error ? e.message : "فشل حفظ الرصيد المبدئي");
    } finally { setSaving(false); }
  }

  async function saveTransfer() {
    if (num(transferAmount) <= 0) return Alert.alert("تنبيه", "اكتب مبلغ الحوالة.");
    try {
      setSaving(true);
      const response = await apiPost(`/owners/${ownerId}/account-transfers`, { amount: num(transferAmount), transfer_date: transferDate || today(), method: transferMethod || null, bank: transferBank || null, reference: transferRef || null, notes: transferNotes || null });
      setData((response?.data || response) as Statement);
      setTransferAmount(""); setTransferMethod(""); setTransferBank(""); setTransferRef(""); setTransferNotes(""); setTransferDate(today());
      Alert.alert("تم", "تم تسجيل الحوالة للمالك.");
    } catch (e) {
      Alert.alert("تعذر الحفظ", e instanceof Error ? e.message : "فشل تسجيل الحوالة");
    } finally { setSaving(false); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0F766E" />}>
        <View style={styles.hero}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Ionicons name="chevron-forward" size={22} color="#fff" /></TouchableOpacity>
          <View style={styles.heroText}>
            <Text style={styles.kicker}>حسابات المالك</Text>
            <Text style={styles.heroTitle}>{ownerName}</Text>
            <Text style={styles.heroSub}>علاقة مالية بين المالك ومدير إدارة العقار</Text>
          </View>
          <View style={styles.heroIcon}><MaterialCommunityIcons name="bank-outline" size={30} color="#0F766E" /></View>
        </View>

        {loading ? <View style={styles.state}><ActivityIndicator /><Text style={styles.stateText}>جاري تحميل الحساب...</Text></View> : null}
        {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}

        {!loading && !error ? <>
          <View style={styles.balanceCard}><Text style={styles.balanceLabel}>الرصيد الحالي المستحق للمالك</Text><Text style={styles.balanceValue}>{money(summary.balance)}</Text></View>
          <View style={styles.grid}>{totals.map((item) => <View key={item.label} style={[styles.totalCard, item.danger ? styles.totalDanger : null]}><MaterialCommunityIcons name={item.icon} size={24} color={item.danger ? "#DC2626" : "#0F766E"} /><Text style={[styles.totalValue, item.danger ? styles.dangerText : null]}>{money(item.value)}</Text><Text style={styles.totalLabel}>{item.label}</Text></View>)}</View>

          <View style={styles.formCard}><Text style={styles.sectionTitle}>الرصيد المبدئي</Text><Field label="الرصيد" value={initialBalance} onChange={setInitialBalance} keyboardType="decimal-pad" /><Field label="تاريخ الرصيد" value={initialDate} onChange={setInitialDate} /><TouchableOpacity disabled={saving} style={styles.saveButton} onPress={saveInitial}><Text style={styles.saveText}>حفظ الرصيد المبدئي</Text></TouchableOpacity></View>

          <View style={styles.formCard}><Text style={styles.sectionTitle}>تسجيل حوالة للمالك</Text><Field label="المبلغ" value={transferAmount} onChange={setTransferAmount} keyboardType="decimal-pad" /><Field label="تاريخ التحويل" value={transferDate} onChange={setTransferDate} /><Field label="طريقة التحويل" value={transferMethod} onChange={setTransferMethod} placeholder="تحويل بنكي / نقدي / شيك" /><Field label="البنك" value={transferBank} onChange={setTransferBank} /><Field label="رقم المرجع" value={transferRef} onChange={setTransferRef} /><Field label="ملاحظة" value={transferNotes} onChange={setTransferNotes} multiline /><TouchableOpacity disabled={saving} style={[styles.saveButton, styles.transferButton]} onPress={saveTransfer}><Text style={styles.saveText}>تسجيل الحوالة وخصمها</Text></TouchableOpacity></View>

          <View style={styles.ledgerCard}><Text style={styles.sectionTitle}>حركة الحساب</Text>{ledger.map((item, index) => <View key={`${item.type}-${item.id}-${index}`} style={styles.ledgerItem}><View style={[styles.typeBadge, styles[`badge_${typeTone(item.type)}` as keyof typeof styles] as any]}><Text style={styles.typeBadgeText}>{typeLabel(item.type)}</Text></View><View style={styles.ledgerBody}><Text style={styles.ledgerTitle}>{item.label || typeLabel(item.type)}</Text><Text style={styles.ledgerSub}>{dateOnly(item.date)}{item.property_name ? ` • ${item.property_name}` : ""}{item.unit_number ? ` • وحدة ${item.unit_number}` : ""}</Text>{item.tenant_name ? <Text style={styles.ledgerSub}>المستأجر: {item.tenant_name}</Text> : null}{item.method || item.bank ? <Text style={styles.ledgerSub}>طريقة التحويل: {item.method || "-"} • البنك: {item.bank || "-"}</Text> : null}{item.reference ? <Text style={styles.ledgerSub}>المرجع: {item.reference}</Text> : null}</View><Text style={[styles.ledgerAmount, num(item.signed_amount) < 0 ? styles.dangerText : styles.creditText]}>{money(item.signed_amount ?? item.amount)}</Text></View>)}{ledger.length === 0 ? <Text style={styles.empty}>لا توجد حركة حساب.</Text> : null}</View>
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType = "default", multiline = false }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboardType?: any; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChange} placeholder={placeholder || label} keyboardType={keyboardType} multiline={multiline} textAlign="right" style={[styles.input, multiline ? styles.textArea : null]} placeholderTextColor="#94A3B8" /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8F6" }, container: { padding: 14, paddingBottom: 44 },
  hero: { backgroundColor: "#111827", borderRadius: 28, padding: 15, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  backButton: { width: 42, height: 42, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  heroText: { flex: 1, alignItems: "flex-end" }, kicker: { color: "#A7F3D0", fontWeight: "900" }, heroTitle: { color: "#fff", fontSize: 25, fontWeight: "900", textAlign: "right", marginTop: 3 }, heroSub: { color: "#CBD5E1", fontWeight: "800", textAlign: "right", marginTop: 4 },
  heroIcon: { width: 58, height: 58, borderRadius: 22, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  state: { backgroundColor: "#fff", borderRadius: 20, padding: 18, alignItems: "center" }, stateText: { color: "#64748B", fontWeight: "800", marginTop: 8 }, error: { backgroundColor: "#FEE2E2", borderRadius: 16, padding: 14 }, errorText: { color: "#991B1B", fontWeight: "900", textAlign: "right" },
  balanceCard: { backgroundColor: "#0F766E", borderRadius: 24, padding: 16, alignItems: "flex-end", marginBottom: 10 }, balanceLabel: { color: "#D1FAE5", fontWeight: "900" }, balanceValue: { color: "#fff", fontSize: 30, fontWeight: "900", marginTop: 6 },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 10 }, totalCard: { width: "48.5%", backgroundColor: "#fff", borderRadius: 20, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#E7E9EA" }, totalDanger: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }, totalValue: { color: "#111827", fontWeight: "900", fontSize: 16, marginTop: 6 }, totalLabel: { color: "#64748B", fontWeight: "800", fontSize: 12, marginTop: 4, textAlign: "center" }, dangerText: { color: "#DC2626" }, creditText: { color: "#0F766E" },
  formCard: { backgroundColor: "#fff", borderRadius: 22, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: "#E7E9EA" }, sectionTitle: { color: "#111827", fontWeight: "900", fontSize: 19, textAlign: "right", marginBottom: 10 }, field: { marginBottom: 9 }, fieldLabel: { color: "#334155", fontWeight: "900", textAlign: "right", marginBottom: 6 }, input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 15, minHeight: 46, paddingHorizontal: 12, color: "#111827", fontWeight: "900" }, textArea: { minHeight: 80, textAlignVertical: "top", paddingTop: 10 }, saveButton: { backgroundColor: "#111827", borderRadius: 16, minHeight: 48, alignItems: "center", justifyContent: "center" }, transferButton: { backgroundColor: "#0F766E" }, saveText: { color: "#fff", fontWeight: "900" },
  ledgerCard: { backgroundColor: "#fff", borderRadius: 22, padding: 13, borderWidth: 1, borderColor: "#E7E9EA" }, ledgerItem: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }, ledgerBody: { flex: 1, alignItems: "flex-end" }, ledgerTitle: { color: "#111827", fontWeight: "900", textAlign: "right" }, ledgerSub: { color: "#64748B", fontWeight: "800", fontSize: 11, textAlign: "right", marginTop: 3 }, ledgerAmount: { minWidth: 82, fontWeight: "900", fontSize: 13, textAlign: "left" }, typeBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }, typeBadgeText: { fontWeight: "900", fontSize: 10, color: "#111827" }, badge_credit: { backgroundColor: "#DCFCE7" }, badge_expense: { backgroundColor: "#FEE2E2" }, badge_transfer: { backgroundColor: "#FEF3C7" }, empty: { color: "#64748B", fontWeight: "800", textAlign: "center", padding: 14 },
});
