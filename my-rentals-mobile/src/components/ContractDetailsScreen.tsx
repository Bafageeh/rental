import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, BackHandler, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiGet, apiPost } from "../lib/api";
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

type FieldItem = {
  key?: string;
  label?: string;
  value?: unknown;
  raw_value?: unknown;
  is_relation?: boolean;
};

type ContractPayload = {
  entity?: string;
  id?: number;
  title?: string;
  fields?: FieldItem[];
  sections?: Array<{ key: string; title: string; count: number; items: PaymentItem[] }>;
};

type ContractRecord = {
  id: number;
  contract_number?: string | null;
  government_contract_number?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  rent_amount?: number | string | null;
  total_contract_value?: number | string | null;
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

function hasText(value: unknown) {
  return String(value ?? "").trim() !== "";
}

function statusLabel(status?: string | null) {
  const text = String(status || "").toLowerCase();
  if (["active", "نشط"].includes(text)) return "نشط";
  if (["ended", "expired", "inactive", "closed", "منتهي"].includes(text)) return "منتهي";
  if (["cancelled", "canceled", "ملغي", "ملغاة"].includes(text)) return "ملغي";
  return status ? String(status) : "غير محدد";
}

function paymentStatusLabel(status?: string | null, badge?: string | null) {
  const text = String(status || badge || "").toLowerCase();
  if (["paid", "مدفوعة", "مدفوع"].includes(text)) return "paid";
  if (["overdue", "متأخرة", "متأخر"].includes(text)) return "overdue";
  if (["due", "مستحقة", "مستحق"].includes(text)) return "due";
  return text;
}

function isActiveStatus(status?: string | null) {
  return statusLabel(status) === "نشط";
}

function cleanTitleTitle(title?: string) {
  return String(title || "").replace(/^عقد\s*/u, "").trim();
}

function numberValue(value: unknown) {
  const parsed = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return `${numberValue(value).toLocaleString("ar-SA")} ر.س`;
}

function prettyDate(value?: string | null, fallback = "-") {
  const text = String(value || "").slice(0, 10);
  return text || fallback;
}

function firstFilled<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined && hasText(value)) return value;
  }
  return null;
}

function normalizeContractPayload(payload: any): ContractRecord | null {
  const candidate = payload?.contract || payload?.data || payload;
  if (!candidate || Array.isArray(candidate) || typeof candidate !== "object") return null;
  if (!hasText(candidate.id)) return null;
  return candidate as ContractRecord;
}

function fieldByKey(payload: any, key: string): FieldItem | undefined {
  const fields = Array.isArray(payload?.fields) ? payload.fields : [];
  return fields.find((field: FieldItem) => field?.key === key);
}

function fieldRaw(payload: any, key: string) {
  const field = fieldByKey(payload, key);
  return field?.raw_value ?? field?.value ?? null;
}

function fieldDisplay(payload: any, key: string) {
  const field = fieldByKey(payload, key);
  return field?.value ?? field?.raw_value ?? null;
}

function numberOrUndefined(value: unknown) {
  if (!hasText(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function contractFromRelatedPayload(payload: any, id: string | number): ContractRecord | null {
  if (!payload || payload.entity !== "contract") return null;

  const tenantId = numberOrUndefined(fieldRaw(payload, "tenant_id"));
  const unitId = numberOrUndefined(fieldRaw(payload, "unit_id"));

  return {
    id: Number(payload.id || id),
    contract_number: firstFilled(fieldRaw(payload, "contract_number"), cleanTitleTitle(payload.title)) as string | null,
    government_contract_number: firstFilled(fieldRaw(payload, "government_contract_number")) as string | null,
    status: firstFilled(fieldRaw(payload, "status"), fieldDisplay(payload, "status")) as string | null,
    start_date: firstFilled(fieldRaw(payload, "start_date"), fieldDisplay(payload, "start_date")) as string | null,
    end_date: firstFilled(fieldRaw(payload, "end_date"), fieldDisplay(payload, "end_date")) as string | null,
    rent_amount: fieldRaw(payload, "rent_amount") as number | string | null,
    total_contract_value: fieldRaw(payload, "total_contract_value") as number | string | null,
    tenant: {
      id: tenantId,
      name: firstFilled(fieldDisplay(payload, "tenant_id")) as string | null,
    },
    unit: {
      id: unitId,
      unit_number: firstFilled(fieldDisplay(payload, "unit_id")) as string | null,
    },
  };
}

function mergeContractRecords(primary: ContractRecord | null, fallback: ContractRecord | null): ContractRecord | null {
  if (!primary && !fallback) return null;
  if (!primary) return fallback;
  if (!fallback) return primary;

  return {
    id: Number(firstFilled(primary.id, fallback.id) || primary.id || fallback.id),
    contract_number: firstFilled(primary.contract_number, fallback.contract_number) as string | null,
    government_contract_number: firstFilled(primary.government_contract_number, fallback.government_contract_number) as string | null,
    status: firstFilled(primary.status, fallback.status) as string | null,
    start_date: firstFilled(primary.start_date, fallback.start_date) as string | null,
    end_date: firstFilled(primary.end_date, fallback.end_date) as string | null,
    rent_amount: firstFilled(primary.rent_amount, fallback.rent_amount),
    total_contract_value: firstFilled(primary.total_contract_value, fallback.total_contract_value),
    tenant: {
      id: primary.tenant?.id || fallback.tenant?.id,
      name: firstFilled(primary.tenant?.name, fallback.tenant?.name) as string | null,
    },
    unit: {
      id: primary.unit?.id || fallback.unit?.id,
      unit_number: firstFilled(primary.unit?.unit_number, fallback.unit?.unit_number) as string | null,
      property: {
        id: primary.unit?.property?.id || fallback.unit?.property?.id,
        name: firstFilled(primary.unit?.property?.name, fallback.unit?.property?.name) as string | null,
      },
    },
  };
}

export default function ContractDetailsScreen({ id }: { id: string | number }) {
  const navigation = useNavigation();
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
      const [relatedResult, contractResult, contractsResult] = await Promise.all([
        apiGet(`/relation-manager/related/contract/${id}`),
        apiGet(`/contracts/${id}`).catch(() => null),
        apiGet(`/contracts`).catch(() => []),
      ]);
      const relatedPayload = relatedResult as ContractPayload;
      setData(relatedPayload);

      const list = responseList(contractsResult) as ContractRecord[];
      const listContract = list.find((item) => String(item.id) === String(id)) || null;
      const directContract = normalizeContractPayload(contractResult);
      const relatedContract = contractFromRelatedPayload(relatedPayload, id);
      setContract(mergeContractRecords(mergeContractRecords(directContract, listContract), relatedContract));
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

  const forcedUnitRoute = contract?.unit?.id ? `/unit/${contract.unit.id}` : "";

  useEffect(() => {
    const unitId = contract?.unit?.id;
    if (!unitId) return undefined;
    const source = `contract-${id}`;
    (globalThis as any).__RENTAL_FORCED_BACK_ROUTE__ = {
      source,
      route: `/unit/${unitId}`,
    };
    return () => {
      const override = (globalThis as any).__RENTAL_FORCED_BACK_ROUTE__;
      if (override?.source === source) {
        (globalThis as any).__RENTAL_FORCED_BACK_ROUTE__ = undefined;
      }
    };
  }, [contract?.unit?.id, id]);

  useEffect(() => {
    if (!forcedUnitRoute) return undefined;

    const goToUnit = () => {
      router.replace(forcedUnitRoute as never);
      return true;
    };

    const hardwareSubscription = BackHandler.addEventListener("hardwareBackPress", goToUnit);
    const unsubscribeBeforeRemove = navigation.addListener("beforeRemove" as never, (event: any) => {
      const actionType = String(event?.data?.action?.type || "").toUpperCase();
      const isBackAction = ["GO_BACK", "POP", "POP_TO_TOP"].includes(actionType);
      if (!isBackAction) return;
      event.preventDefault?.();
      goToUnit();
    });

    return () => {
      hardwareSubscription.remove();
      if (typeof unsubscribeBeforeRemove === "function") unsubscribeBeforeRemove();
    };
  }, [forcedUnitRoute, navigation]);

  function openEdit() {
    const unitId = contract?.unit?.id;
    router.push({ pathname: "/contract-edit/[id]", params: { id: String(id), return_to: unitId ? `/unit/${unitId}` : `/contract/${id}` } } as never);
  }

  function deleteContract() {
    const unitId = contract?.unit?.id;
    router.push(`/edit-delete-center?resource=contracts&id=${id}${unitId ? `&return_to=${encodeURIComponent(`/unit/${unitId}`)}` : ""}` as never);
  }

  const payments = (data?.sections || []).flatMap((section) => section.items || []).filter(isPayment);
  const tenantName = display(contract?.tenant?.name, "المستأجر غير محدد");
  const contractNumber = display(contract?.government_contract_number || contract?.contract_number || cleanTitleTitle(data?.title) || id);
  const startDate = prettyDate(contract?.start_date, "بلا بداية");
  const endDate = prettyDate(contract?.end_date, "بلا نهاية");
  const badgeText = statusLabel(contract?.status);
  const propertyName = contract?.unit?.property?.name || "-";
  const unitName = contract?.unit?.unit_number || "-";

  const paymentSummary = useMemo(() => {
    const paid = payments.filter((payment) => paymentStatusLabel(payment.status, payment.badge) === "paid").length;
    const overdue = payments.filter((payment) => paymentStatusLabel(payment.status, payment.badge) === "overdue").length;
    const due = payments.filter((payment) => paymentStatusLabel(payment.status, payment.badge) === "due").length;
    const totalAmount = payments.reduce((sum, payment) => sum + numberValue(payment.amount), 0);
    const paidAmount = payments
      .filter((payment) => paymentStatusLabel(payment.status, payment.badge) === "paid")
      .reduce((sum, payment) => sum + numberValue(payment.amount), 0);
    const nextPayment = payments
      .filter((payment) => paymentStatusLabel(payment.status, payment.badge) !== "paid")
      .sort((a, b) => String(a.due_date || "9999-99-99").localeCompare(String(b.due_date || "9999-99-99")))[0];
    return { paid, overdue, due, totalAmount, paidAmount, nextPayment };
  }, [payments]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0F766E" />} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroActionsBox}>
              <TouchableOpacity style={[styles.actionCircle, styles.deleteCircle]} onPress={deleteContract} activeOpacity={0.86}>
                <Text style={styles.actionIconText}>🗑️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionCircle, styles.editCircle]} onPress={openEdit} activeOpacity={0.86}>
                <Text style={styles.actionIconText}>✏️</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.heroTextBox}>
              <View style={styles.tenantRow}>
                <Text style={styles.tenantName}>{tenantName}</Text>
              </View>
              <View style={styles.contractMetaRow}>
                <Text style={styles.contractNumber}>رقم العقد: {contractNumber}</Text>
              </View>
            </View>
            <View style={styles.heroIconColumn}>
              <View style={styles.heroIconBox}>
                <Ionicons name="document-text-outline" size={29} color="#0F766E" />
              </View>
              <Text style={[styles.statusBadge, isActiveStatus(contract?.status) ? styles.statusActive : styles.statusEnded]}>{badgeText}</Text>
            </View>
          </View>

          <View style={styles.timelineBox}>
            <View style={styles.timelineDateBlock}>
              <Text style={styles.timelineLabel}>إلى</Text>
              <Text style={styles.timelineDate}>{endDate}</Text>
            </View>
            <View style={styles.timelineLineWrap}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineLine} />
              <View style={styles.timelineDot} />
            </View>
            <View style={styles.timelineDateBlock}>
              <Text style={styles.timelineLabel}>من</Text>
              <Text style={styles.timelineDate}>{startDate}</Text>
            </View>
          </View>

          <View style={styles.heroInfoGrid}>
            <View style={styles.heroInfoCard}>
              <MaterialCommunityIcons name="home-city-outline" size={18} color="#A7F3D0" />
              <Text style={styles.heroInfoLabel}>العقار</Text>
              <Text style={styles.heroInfoValue} numberOfLines={1}>{propertyName}</Text>
            </View>
            <View style={styles.heroInfoCard}>
              <MaterialCommunityIcons name="door-closed" size={18} color="#A7F3D0" />
              <Text style={styles.heroInfoLabel}>الوحدة</Text>
              <Text style={styles.heroInfoValue} numberOfLines={1}>{unitName}</Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{payments.length.toLocaleString("ar-SA")}</Text>
            <Text style={styles.summaryLabel}>الدفعات</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{paymentSummary.paid.toLocaleString("ar-SA")}</Text>
            <Text style={styles.summaryLabel}>مدفوعة</Text>
          </View>
          <View style={[styles.summaryCard, paymentSummary.overdue > 0 ? styles.summaryDangerCard : null]}>
            <Text style={[styles.summaryValue, paymentSummary.overdue > 0 ? styles.summaryDangerValue : null]}>{paymentSummary.overdue.toLocaleString("ar-SA")}</Text>
            <Text style={styles.summaryLabel}>متأخرة</Text>
          </View>
        </View>

        <View style={styles.moneyPanel}>
          <View style={styles.moneyItem}>
            <Text style={styles.moneyLabel}>إجمالي الدفعات</Text>
            <Text style={styles.moneyValue}>{money(paymentSummary.totalAmount || contract?.total_contract_value || contract?.rent_amount)}</Text>
          </View>
          <View style={styles.moneyDivider} />
          <View style={styles.moneyItem}>
            <Text style={styles.moneyLabel}>المسدّد</Text>
            <Text style={styles.moneyValue}>{money(paymentSummary.paidAmount)}</Text>
          </View>
        </View>

        {paymentSummary.nextPayment ? (
          <View style={styles.nextPaymentCard}>
            <View style={styles.nextPaymentIcon}><Ionicons name="calendar-outline" size={21} color="#0F766E" /></View>
            <View style={styles.nextPaymentTextBox}>
              <Text style={styles.nextPaymentTitle}>الدفعة القادمة</Text>
              <Text style={styles.nextPaymentMeta}>{paymentSummary.nextPayment.title} • {prettyDate(paymentSummary.nextPayment.due_date)}</Text>
            </View>
            <Text style={styles.nextPaymentAmount}>{money(paymentSummary.nextPayment.amount)}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionCountBox}><Text style={styles.count}>{payments.length}</Text></View>
            <View style={styles.sectionTitleBox}>
              <Text style={styles.sectionTitle}>جدول الدفعات</Text>
              <Text style={styles.sectionSubtitle}>اضغط على أي قسط لعرض السداد والملاحظات</Text>
            </View>
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
  safe: { flex: 1, backgroundColor: "#F6F7FB" },
  container: { padding: 14, paddingBottom: 34 },
  hero: { backgroundColor: "#111827", borderRadius: 30, padding: 15, marginBottom: 12, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, elevation: 3 },
  heroGlow: { position: "absolute", left: -34, top: -40, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(15,118,110,0.32)" },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroActionsBox: { minWidth: 96, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "flex-start" },
  actionCircle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  editCircle: { backgroundColor: "#0F9B6F" },
  deleteCircle: { backgroundColor: "#dc2626" },
  actionIconText: { fontSize: 19 },
  heroTextBox: { flex: 1, alignItems: "flex-end" },
  heroIconColumn: { width: 66, alignItems: "center", gap: 7 },
  heroIconBox: { width: 55, height: 55, borderRadius: 21, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#A7F3D0" },
  tenantRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", alignSelf: "stretch" },
  tenantName: { color: "#fff", fontSize: 23, lineHeight: 31, fontWeight: "900", textAlign: "right", flexShrink: 1 },
  contractMetaRow: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  statusBadge: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontWeight: "900", fontSize: 12, textAlign: "center" },
  statusActive: { backgroundColor: "#DCFCE7", color: "#166534" },
  statusEnded: { backgroundColor: "#FEE2E2", color: "#991B1B" },
  contractNumber: { color: "#CBD5E1", fontSize: 12, fontWeight: "900", textAlign: "right" },
  timelineBox: { marginTop: 14, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 20, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timelineDateBlock: { flex: 1, alignItems: "center" },
  timelineLabel: { color: "#A7F3D0", fontWeight: "900", fontSize: 11 },
  timelineDate: { color: "#fff", fontWeight: "900", marginTop: 4, fontSize: 13 },
  timelineLineWrap: { width: 86, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  timelineDot: { width: 9, height: 9, borderRadius: 999, backgroundColor: "#5EEAD4" },
  timelineLine: { flex: 1, height: 2, backgroundColor: "rgba(94,234,212,0.55)" },
  heroInfoGrid: { flexDirection: "row-reverse", gap: 8, marginTop: 10 },
  heroInfoCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 18, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  heroInfoLabel: { color: "#CBD5E1", fontWeight: "800", fontSize: 11, marginTop: 4 },
  heroInfoValue: { color: "#fff", fontWeight: "900", fontSize: 12, marginTop: 3, textAlign: "center" },
  summaryGrid: { flexDirection: "row-reverse", gap: 8, marginBottom: 10 },
  summaryCard: { flex: 1, backgroundColor: "#fff", borderRadius: 20, padding: 13, alignItems: "center", borderWidth: 1, borderColor: "#EDECE9" },
  summaryDangerCard: { backgroundColor: "#FFF1F2", borderColor: "#FECDD3" },
  summaryValue: { color: "#111827", fontSize: 20, fontWeight: "900" },
  summaryDangerValue: { color: "#BE123C" },
  summaryLabel: { color: "#64748B", fontWeight: "900", marginTop: 4, fontSize: 12 },
  moneyPanel: { backgroundColor: "#fff", borderRadius: 22, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#EDECE9", flexDirection: "row-reverse", alignItems: "center" },
  moneyItem: { flex: 1, alignItems: "center" },
  moneyDivider: { width: 1, height: 42, backgroundColor: "#E5E7EB" },
  moneyLabel: { color: "#64748B", fontWeight: "900", fontSize: 12 },
  moneyValue: { color: "#0F766E", fontWeight: "900", marginTop: 5, fontSize: 16 },
  nextPaymentCard: { backgroundColor: "#F0FDFA", borderRadius: 22, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#CCFBF1", flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  nextPaymentIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#A7F3D0" },
  nextPaymentTextBox: { flex: 1, alignItems: "flex-end" },
  nextPaymentTitle: { color: "#0F172A", fontWeight: "900", textAlign: "right" },
  nextPaymentMeta: { color: "#0F766E", fontWeight: "800", fontSize: 12, marginTop: 3, textAlign: "right" },
  nextPaymentAmount: { color: "#111827", fontWeight: "900", fontSize: 13 },
  section: { backgroundColor: "#fff", borderRadius: 26, padding: 12, borderWidth: 1, borderColor: "#EDECE9" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitleBox: { flex: 1, alignItems: "flex-end" },
  sectionTitle: { color: "#111827", fontSize: 20, fontWeight: "900", textAlign: "right" },
  sectionSubtitle: { color: "#64748B", fontSize: 12, fontWeight: "800", textAlign: "right", marginTop: 3 },
  sectionCountBox: { backgroundColor: "#ECFDF5", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#A7F3D0" },
  count: { color: "#065F46", fontWeight: "900" },
  state: { alignItems: "center", padding: 20, gap: 8 },
  stateText: { color: "#6b7280", fontWeight: "800" },
  error: { color: "#be123c", backgroundColor: "#fff1f2", padding: 12, borderRadius: 14, textAlign: "right", fontWeight: "800" },
  empty: { color: "#6b7280", textAlign: "center", padding: 18, fontWeight: "800" },
});