import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiGet, apiPost } from "../../lib/api";

type UnitTabKey = "stats" | "details" | "tenant" | "contracts";
type FieldItem = { key: string; label: string; value: string | number | null };
type PaymentItem = { status?: string | null; amount?: number | string | null };
type ContractItem = {
  id: number;
  contract_number?: string | null;
  government_contract_number?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  rent_amount?: number | string | null;
  status?: string | null;
  tenant_name?: string | null;
  tenant_phone?: string | null;
  tenant_national_id?: string | null;
  property_name?: string | null;
  unit_number?: string | null;
  tenant?: { id?: number | string | null; name?: string | null; phone?: string | null; mobile?: string | null; national_id?: string | null; identity_number?: string | null; email?: string | null; notes?: string | null } | null;
  unit?: { unit_number?: string | null; property?: { name?: string | null; owner?: { name?: string | null } | null } | null } | null;
  owner_name?: string | null;
  payments?: PaymentItem[];
};
type DetailsResponse = { id: number; title: string; fields: FieldItem[]; sections?: Array<{ key: string; title: string; count: number; items: any[] }> };

const allTabs: Array<{ key: UnitTabKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "stats", label: "إحصائيات", icon: "stats-chart-outline" },
  { key: "details", label: "التفاصيل", icon: "list-outline" },
  { key: "tenant", label: "المستأجر", icon: "person-outline" },
  { key: "contracts", label: "العقود", icon: "documents-outline" },
];

const statusLabels: Record<string, string> = { active: "نشط", ended: "منتهي", cancelled: "ملغي", draft: "مسودة", pending: "معلق", rented: "مؤجرة", available: "متاحة" };

function valueOrDash(value: unknown) {
  const text = String(value ?? "").trim();
  return text === "" || text === "غير محدد" ? "-" : text;
}
function hasValue(value: unknown) {
  const text = String(value ?? "").trim();
  return text !== "" && text !== "-" && text !== "غير محدد";
}
function asNumber(value: unknown) {
  const n = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function money(value: unknown) {
  return `${Math.round(asNumber(value)).toLocaleString("ar-SA")} ريال`;
}
function dateOnly(value?: string | null) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : valueOrDash(value);
}
function fieldValue(fields: FieldItem[] | undefined, key: string) {
  return fields?.find((field) => field.key === key)?.value ?? "";
}
function fieldAny(fields: FieldItem[] | undefined, keys: string[]) {
  for (const key of keys) {
    const value = fieldValue(fields, key);
    if (hasValue(value)) return String(value).trim();
  }
  return "";
}
function safeDecode(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return "";
  try { return decodeURIComponent(raw); } catch { return raw; }
}
function normalizeContracts(result: any): ContractItem[] {
  return Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : Array.isArray(result?.items) ? result.items : [];
}
function statusText(value?: string | null) {
  const key = String(value || "").trim();
  return statusLabels[key] || key || "-";
}
function isActiveContract(contract?: ContractItem | null) {
  const status = String(contract?.status || "").trim().toLowerCase();
  return ["active", "نشط", "open", "current", "ساري", "مفتوح"].includes(status);
}
function paymentProgress(payments?: PaymentItem[]) {
  const list = payments || [];
  const paid = list.filter((payment) => payment.status === "paid" || payment.status === "مدفوع").length;
  const overdue = list.filter((payment) => payment.status === "overdue" || payment.status === "متأخر").length;
  return { paid, total: list.length, overdue, pct: list.length ? Math.round((paid / list.length) * 100) : 0 };
}
function firstLetter(value?: string | null) {
  const text = String(value || "؟").trim();
  return text ? text[0] : "؟";
}
function isTechnicalKey(key: string) {
  return ["manager_id", "deleted_at", "created_at", "updated_at"].includes(key);
}

function StatTile({ icon, label, value, danger = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: unknown; danger?: boolean }) {
  return (
    <View style={[styles.statTile, danger ? styles.statTileDanger : null]}>
      <View style={[styles.statIconBox, danger ? styles.statIconBoxDanger : null]}>
        <Ionicons name={icon} size={21} color={danger ? "#DC2626" : "#0F766E"} />
      </View>
      <Text numberOfLines={1} style={[styles.statValue, danger ? styles.statValueDanger : null]}>{valueOrDash(value)}</Text>
      <Text style={[styles.statLabel, danger ? styles.statLabelDanger : null]}>{label}</Text>
    </View>
  );
}

function FieldRow({ label, value }: { label: string; value: unknown }) {
  if (!hasValue(value)) return null;
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldValue}>{valueOrDash(value)}</Text>
      <Text style={styles.fieldLabel}>{label}</Text>
    </View>
  );
}

function ContractCard({ contract, unitId }: { contract: ContractItem; unitId: string }) {
  const tenantName = contract.tenant?.name || contract.tenant_name || "مستأجر";
  const progress = paymentProgress(contract.payments);
  const contractNo = contract.government_contract_number || contract.contract_number || String(contract.id);
  return (
    <TouchableOpacity style={styles.contractCard} activeOpacity={0.88} onPress={() => router.push(`/contract/${contract.id}?from_unit_id=${encodeURIComponent(unitId)}` as never)}>
      <View style={styles.contractTopRow}>
        <View style={styles.tenantAvatar}><Text style={styles.tenantAvatarText}>{firstLetter(tenantName)}</Text></View>
        <View style={styles.contractMainText}>
          <Text numberOfLines={1} style={styles.contractTenant}>{tenantName}</Text>
          <Text numberOfLines={1} style={styles.contractSub}>{contract.property_name || contract.unit?.property?.name || "عقار"} - {contract.unit_number || contract.unit?.unit_number || "وحدة"}</Text>
        </View>
        <Text style={[styles.statusBadge, isActiveContract(contract) ? styles.statusBadgeActive : null]}>{statusText(contract.status)}</Text>
      </View>
      <View style={styles.contractNumberRow}>
        <Text style={styles.contractNumberLabel}>رقم العقد</Text>
        <Text numberOfLines={1} style={styles.contractNumberValue}>{contractNo}</Text>
      </View>
      <View style={styles.contractDetailsRow}>
        <View style={styles.contractDetail}><Text style={styles.contractDetailLabel}>الإيجار</Text><Text style={styles.contractDetailValue}>{money(contract.rent_amount)}</Text></View>
        <View style={styles.divider} />
        <View style={styles.contractDetail}><Text style={styles.contractDetailLabel}>البداية</Text><Text style={styles.contractDetailValue}>{dateOnly(contract.start_date)}</Text></View>
        <View style={styles.divider} />
        <View style={styles.contractDetail}><Text style={styles.contractDetailLabel}>النهاية</Text><Text style={styles.contractDetailValue}>{dateOnly(contract.end_date)}</Text></View>
      </View>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>الدفعات: {progress.paid}/{progress.total}</Text>
        {progress.overdue > 0 ? <Text style={styles.overdueLabel}>{progress.overdue} متأخرة</Text> : null}
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress.pct}%` }]} /></View>
    </TouchableOpacity>
  );
}

export default function UnitDetailsRoute() {
  const params = useLocalSearchParams<{ id: string; return_to?: string }>();
  const navigation = useNavigation();
  const id = String(params.id || "");
  const [data, setData] = useState<DetailsResponse | null>(null);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<UnitTabKey>("stats");
  const [menuOpen, setMenuOpen] = useState(false);
  const forcingBackRef = useRef(false);
  const backTargetRef = useRef("/properties");

  const load = useCallback(async (isRefresh = false) => {
    if (!id) return;
    const nonce = Date.now();
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError("");
      setMenuOpen(false);
      const [detailsResponse, contractsResponse] = await Promise.all([
        apiGet(`/relation-manager/related/unit/${id}?_=${nonce}`).catch(() => apiGet(`/my/relation-manager/related/unit/${id}?_=${nonce}`)),
        apiGet(`/contracts?unit_id=${encodeURIComponent(id)}&_=${nonce}`).catch(() => []),
      ]);
      setData(detailsResponse as DetailsResponse);
      setContracts(normalizeContracts(contractsResponse));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل تفاصيل الوحدة");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  useEffect(() => {
    (navigation as any).setOptions?.({ gestureEnabled: false });
  }, [navigation]);

  const sourceReturnTo = safeDecode(params.return_to);
  const safeReturnTo = sourceReturnTo && sourceReturnTo.startsWith("/") && !sourceReturnTo.startsWith("/property/") ? sourceReturnTo : "/properties";
  useEffect(() => { backTargetRef.current = safeReturnTo; }, [safeReturnTo]);

  function forceBack() {
    if (forcingBackRef.current) return true;
    forcingBackRef.current = true;
    router.replace((backTargetRef.current || "/properties") as never);
    setTimeout(() => { forcingBackRef.current = false; }, 700);
    return true;
  }

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => forceBack());
    return () => sub.remove();
  }, []);

  const fields = data?.fields || [];
  const title = data?.title || "جاري التحميل...";
  const unitStatus = valueOrDash(fieldValue(fields, "status"));
  const unitRent = money(fieldValue(fields, "rent_amount"));
  const unitFloor = valueOrDash(fieldValue(fields, "floor"));
  const propertyName = fieldAny(fields, ["property_name", "property", "property_id", "parent_property_name"]) || contracts.find((contract) => hasValue(contract.property_name || contract.unit?.property?.name))?.property_name || "";
  const ownerName = fieldAny(fields, ["owner_name", "owner", "owner_id", "property_owner_name"]) || contracts.find((contract) => hasValue(contract.owner_name || contract.unit?.property?.owner?.name))?.owner_name || "";
  const activeContract = useMemo(() => contracts.find(isActiveContract) || null, [contracts]);
  const activeTenantName = activeContract?.tenant?.name || activeContract?.tenant_name || "";
  const paymentStats = useMemo(() => {
    const payments = contracts.flatMap((contract) => contract.payments || []);
    return { total: payments.length, overdue: payments.filter((payment) => payment.status === "overdue" || payment.status === "متأخر").length };
  }, [contracts]);

  const visibleTabs = useMemo(() => allTabs.filter((tab) => {
    if (tab.key === "tenant") return !!activeContract;
    if (tab.key === "contracts") return contracts.length > 0;
    return true;
  }), [activeContract, contracts.length]);

  useEffect(() => {
    if (activeTab === "tenant" && !activeContract) setActiveTab("details");
    if (activeTab === "contracts" && contracts.length === 0) setActiveTab("details");
  }, [activeTab, activeContract, contracts.length]);

  const primaryFields = useMemo(() => {
    const preferred = ["property_name", "property_city", "property_district", "property_address", "property_id", "owner_id", "unit_number", "floor", "type", "status", "rent_amount"];
    const clean = fields.filter((field) => !isTechnicalKey(field.key));
    return [...clean.filter((field) => preferred.includes(field.key)), ...clean.filter((field) => !preferred.includes(field.key))];
  }, [fields]);

  const tenantFields = useMemo(() => {
    if (!activeContract) return [] as Array<{ label: string; value: unknown }>;
    const tenant = activeContract.tenant || {};
    return [
      { label: "اسم المستأجر", value: tenant.name || activeContract.tenant_name },
      { label: "رقم الهوية", value: tenant.national_id || tenant.identity_number || activeContract.tenant_national_id },
      { label: "رقم الجوال", value: tenant.phone || tenant.mobile || activeContract.tenant_phone },
      { label: "البريد الإلكتروني", value: tenant.email },
      { label: "رقم العقد", value: activeContract.government_contract_number || activeContract.contract_number || activeContract.id },
      { label: "حالة العقد", value: statusText(activeContract.status) },
      { label: "بداية العقد", value: dateOnly(activeContract.start_date) },
      { label: "نهاية العقد", value: dateOnly(activeContract.end_date) },
      { label: "قيمة الإيجار", value: money(activeContract.rent_amount) },
      { label: "ملاحظات المستأجر", value: tenant.notes },
    ];
  }, [activeContract]);

  function openEditScreen() {
    setMenuOpen(false);
    router.push({ pathname: "/unit-edit/[id]", params: { id, return_to: `/unit/${id}?return_to=${encodeURIComponent(safeReturnTo)}`, delete_return_to: safeReturnTo } } as never);
  }
  function openCreateContractOptions() {
    setMenuOpen(false);
    const unitName = encodeURIComponent(title || `وحدة ${id}`);
    const query = `unit_id=${encodeURIComponent(id)}&unit_name=${unitName}`;
    Alert.alert("إنشاء عقد", "اختر طريقة إنشاء العقد لهذه الوحدة:", [
      { text: "إنشاء عقد يدوي", onPress: () => router.push(`/create-contract?${query}` as never) },
      { text: "رفع PDF", onPress: () => router.push(`/upload-contract?${query}` as never) },
      { text: "إلغاء", style: "cancel" },
    ]);
  }
  async function performUnitRemove() {
    try { await apiPost(`/edit-delete-center/units/${id}/delete`, {}); router.replace(safeReturnTo as never); }
    catch (e) { Alert.alert("تعذر التنفيذ", e instanceof Error ? e.message : "تعذر تنفيذ العملية"); }
  }
  function removeUnit() {
    setMenuOpen(false);
    Alert.alert("حذف الوحدة", "هل تريد حذف هذه الوحدة؟", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: performUnitRemove }]);
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.loadingBox}><ActivityIndicator /><Text style={styles.loadingText}>جاري تحميل تفاصيل الوحدة...</Text></View></SafeAreaView>;
  }

  if (error || !data) {
    return <SafeAreaView style={styles.safe}><View style={styles.errorBox}><Text style={styles.errorTitle}>تعذر تحميل تفاصيل الوحدة</Text><Text style={styles.errorText}>{error || "غير موجود"}</Text><TouchableOpacity style={styles.retryButton} onPress={() => load(false)}><Text style={styles.retryText}>إعادة المحاولة</Text></TouchableOpacity></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0F766E" />} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.entityLabel}>وحدة</Text>
          <Text numberOfLines={2} style={styles.title}>{title}</Text>
          <View style={styles.contextBox}>
            <Text numberOfLines={1} style={styles.contextLine}>المالك: {valueOrDash(ownerName)}</Text>
            <Text numberOfLines={1} style={styles.contextLine}>العقار: {valueOrDash(propertyName)}</Text>
            {activeTenantName ? <Text numberOfLines={1} style={styles.tenantLine}>المستأجر النشط: {activeTenantName}</Text> : null}
          </View>
          <View style={styles.headerStatsRow}><Text style={styles.statPill}>العقود: {contracts.length}</Text><Text style={styles.statPill}>رقم السجل: {valueOrDash(id)}</Text></View>
        </View>

        <View style={styles.tabsWrap}>{visibleTabs.map((tab) => {
          const active = activeTab === tab.key;
          return <TouchableOpacity key={tab.key} style={[styles.tabButton, active ? styles.tabButtonActive : null]} activeOpacity={0.88} onPress={() => setActiveTab(tab.key)}><Ionicons name={tab.icon} size={17} color={active ? "#0F172A" : "#6B7280"} /><Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{tab.label}</Text></TouchableOpacity>;
        })}</View>

        {activeTab === "stats" ? <View style={styles.sectionCard}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>إحصائيات الوحدة</Text><Text style={styles.sectionSubtitle}>ملخص سريع عن الوحدة وارتباطاتها</Text></View><View style={styles.statsGrid}><StatTile icon="alert-circle-outline" label="دفعات متأخرة" value={paymentStats.overdue} danger={paymentStats.overdue > 0} /><StatTile icon="receipt-outline" label="عدد الدفعات" value={paymentStats.total} /><StatTile icon="documents-outline" label="العقود" value={contracts.length} /><StatTile icon="cash-outline" label="الإيجار" value={unitRent} /><StatTile icon="checkmark-circle-outline" label="الحالة" value={statusText(unitStatus)} /><StatTile icon="layers-outline" label="الدور" value={unitFloor} /><StatTile icon="list-outline" label="حقول البيانات" value={primaryFields.length} /></View></View> : null}

        {activeTab === "details" ? <View style={styles.sectionCard}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>البيانات الأساسية</Text><Text style={styles.sectionSubtitle}>{primaryFields.length} حقل</Text></View>{primaryFields.map((field) => <FieldRow key={field.key} label={field.label} value={field.value} />)}</View> : null}

        {activeTab === "tenant" ? <View style={styles.sectionCard}>{activeContract ? <><View style={styles.tenantHero}><View style={styles.tenantAvatarBig}><Text style={styles.tenantAvatarBigText}>{firstLetter(activeTenantName || "م")}</Text></View><View style={styles.tenantHeroText}><Text numberOfLines={1} style={styles.tenantName}>{valueOrDash(activeTenantName || "مستأجر")}</Text><Text style={styles.tenantStatus}>العقد النشط للوحدة</Text></View></View>{tenantFields.map((field) => <FieldRow key={field.label} label={field.label} value={field.value} />)}{activeContract.tenant?.id ? <TouchableOpacity style={styles.tenantOpenButton} activeOpacity={0.86} onPress={() => router.push(`/tenant/${activeContract.tenant?.id}` as never)}><Ionicons name="open-outline" size={18} color="#0F766E" /><Text style={styles.tenantOpenButtonText}>فتح تفاصيل المستأجر</Text></TouchableOpacity> : null}</> : <Text style={styles.emptyText}>لا يوجد مستأجر نشط مرتبط بهذه الوحدة.</Text>}</View> : null}

        {activeTab === "contracts" ? <View style={styles.sectionCard}><View style={styles.sectionHeaderRow}><TouchableOpacity style={styles.smallAddButton} activeOpacity={0.88} onPress={openCreateContractOptions}><Ionicons name="add" size={22} color="#fff" /></TouchableOpacity><View style={styles.sectionHeaderText}><Text style={styles.sectionTitle}>العقود</Text><Text style={styles.sectionSubtitle}>{contracts.length} عقد مرتبط بهذه الوحدة</Text></View></View>{contracts.map((contract) => <ContractCard key={contract.id} contract={contract} unitId={id} />)}</View> : null}

        <View style={{ height: 80 }} />
      </ScrollView>

      {menuOpen ? <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setMenuOpen(false)} /> : null}
      {menuOpen ? <View style={styles.menu}><MenuAction icon="create-outline" label="تعديل" onPress={openEditScreen} /><MenuAction icon="documents-outline" label="إنشاء / رفع عقد" onPress={openCreateContractOptions} /><MenuAction icon="trash-outline" label="حذف" danger onPress={removeUnit} /></View> : null}
      <TouchableOpacity style={styles.floatingButton} activeOpacity={0.88} onPress={() => setMenuOpen((v) => !v)}><Ionicons name={menuOpen ? "close" : "ellipsis-vertical"} size={24} color="#fff" /></TouchableOpacity>
    </SafeAreaView>
  );
}

function MenuAction({ icon, label, danger = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; danger?: boolean; onPress: () => void }) {
  const color = danger ? "#DC2626" : "#0F766E";
  return <TouchableOpacity style={styles.menuAction} activeOpacity={0.86} onPress={onPress}><Ionicons name={icon} size={21} color={color} /><Text style={[styles.menuText, { color }]}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  scroll: { flex: 1 },
  container: { padding: 10, paddingBottom: 36 },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  loadingText: { color: "#64748B", fontWeight: "800" },
  errorBox: { margin: 14, backgroundColor: "#FEE2E2", borderRadius: 18, padding: 15, alignItems: "center" },
  errorTitle: { color: "#991B1B", fontSize: 16, fontWeight: "900" },
  errorText: { color: "#7F1D1D", marginTop: 8, textAlign: "center", fontSize: 12 },
  retryButton: { marginTop: 10, backgroundColor: "#991B1B", borderRadius: 13, paddingHorizontal: 14, paddingVertical: 9 },
  retryText: { color: "#fff", fontWeight: "900" },
  headerCard: { backgroundColor: "#0B1220", borderRadius: 28, padding: 18, marginBottom: 9, alignItems: "flex-end" },
  entityLabel: { color: "#C7D2FE", fontWeight: "900", marginBottom: 6 },
  title: { color: "#fff", fontSize: 25, fontWeight: "900", textAlign: "right", lineHeight: 34 },
  contextBox: { alignItems: "flex-end", marginTop: 10, gap: 5 },
  contextLine: { color: "#BFF7D3", fontWeight: "900", textAlign: "right" },
  tenantLine: { color: "#BFF7D3", fontWeight: "900", textAlign: "right", marginTop: 2 },
  headerStatsRow: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  statPill: { backgroundColor: "#263244", color: "#fff", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, fontWeight: "900", overflow: "hidden" },
  tabsWrap: { flexDirection: "row-reverse", backgroundColor: "#E7E5E0", borderRadius: 19, padding: 5, marginBottom: 10, gap: 4 },
  tabButton: { flex: 1, minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 3 },
  tabButtonActive: { backgroundColor: "#fff", shadowColor: "#0F172A", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  tabText: { color: "#64748B", fontWeight: "900", fontSize: 12 },
  tabTextActive: { color: "#111827" },
  sectionCard: { backgroundColor: "#fff", borderRadius: 22, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E8EEF0" },
  sectionHeader: { alignItems: "flex-end", marginBottom: 10 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10 },
  sectionHeaderText: { flex: 1, alignItems: "flex-end" },
  sectionTitle: { color: "#111827", fontSize: 19, fontWeight: "900", textAlign: "right" },
  sectionSubtitle: { color: "#64748B", fontWeight: "800", fontSize: 12, marginTop: 4, textAlign: "right" },
  statsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  statTile: { width: "48.5%", backgroundColor: "#F8FAFC", borderRadius: 18, padding: 11, borderWidth: 1, borderColor: "#E7ECEF", minHeight: 106, alignItems: "center", justifyContent: "center" },
  statTileDanger: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" },
  statIconBox: { width: 42, height: 42, borderRadius: 18, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: 7 },
  statIconBoxDanger: { backgroundColor: "#FEE2E2" },
  statValue: { color: "#111827", fontWeight: "900", fontSize: 18, textAlign: "center" },
  statValueDanger: { color: "#DC2626" },
  statLabel: { color: "#64748B", fontWeight: "900", fontSize: 12, textAlign: "center", marginTop: 4 },
  statLabelDanger: { color: "#991B1B" },
  fieldRow: { borderBottomWidth: 1, borderBottomColor: "#EEF2F4", paddingVertical: 11, alignItems: "flex-end" },
  fieldLabel: { color: "#64748B", fontWeight: "900", fontSize: 12, marginTop: 4 },
  fieldValue: { color: "#111827", fontWeight: "900", fontSize: 15, textAlign: "right" },
  tenantHero: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 12, backgroundColor: "#F8FAFC", borderRadius: 18, padding: 10 },
  tenantAvatarBig: { width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#ECFDF5" },
  tenantAvatarBigText: { color: "#0F766E", fontWeight: "900", fontSize: 22 },
  tenantHeroText: { flex: 1, alignItems: "flex-end" },
  tenantName: { color: "#111827", fontSize: 18, fontWeight: "900", textAlign: "right" },
  tenantStatus: { color: "#0F766E", fontWeight: "900", marginTop: 4, fontSize: 12 },
  tenantOpenButton: { marginTop: 12, backgroundColor: "#ECFDF5", borderRadius: 16, paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 7, borderWidth: 1, borderColor: "#A7F3D0" },
  tenantOpenButtonText: { color: "#0F766E", fontWeight: "900" },
  smallAddButton: { width: 42, height: 42, borderRadius: 17, backgroundColor: "#0F9B6F", alignItems: "center", justifyContent: "center" },
  contractCard: { borderRadius: 18, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E7ECEF", padding: 12, marginBottom: 9 },
  contractTopRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  tenantAvatar: { width: 40, height: 40, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#ECFDF5" },
  tenantAvatarText: { color: "#0F766E", fontWeight: "900", fontSize: 18 },
  contractMainText: { flex: 1, alignItems: "flex-end" },
  contractTenant: { color: "#111827", fontSize: 17, fontWeight: "900", textAlign: "right" },
  contractSub: { color: "#64748B", fontWeight: "800", fontSize: 12, marginTop: 3, textAlign: "right" },
  statusBadge: { color: "#64748B", backgroundColor: "#F1F5F9", borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5, fontWeight: "900", fontSize: 11 },
  statusBadgeActive: { color: "#0F766E", backgroundColor: "#DCFCE7" },
  contractNumberRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  contractNumberLabel: { color: "#64748B", fontWeight: "900" },
  contractNumberValue: { color: "#111827", fontWeight: "900", flex: 1, textAlign: "left" },
  contractDetailsRow: { flexDirection: "row-reverse", backgroundColor: "#fff", borderRadius: 16, marginTop: 10, paddingVertical: 10 },
  contractDetail: { flex: 1, alignItems: "center" },
  contractDetailLabel: { color: "#94A3B8", fontWeight: "900", fontSize: 11 },
  contractDetailValue: { color: "#111827", fontWeight: "900", marginTop: 5, fontSize: 12 },
  divider: { width: 1, backgroundColor: "#E5E7EB" },
  progressHeader: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 11 },
  progressLabel: { color: "#64748B", fontWeight: "900" },
  overdueLabel: { color: "#DC2626", fontWeight: "900" },
  progressTrack: { height: 9, borderRadius: 999, backgroundColor: "#E5E7EB", overflow: "hidden", marginTop: 7 },
  progressFill: { height: "100%", backgroundColor: "#0F766E" },
  emptyText: { color: "#64748B", fontWeight: "900", textAlign: "center", paddingVertical: 14, lineHeight: 24 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.05)", zIndex: 15 },
  floatingButton: { position: "absolute", top: 26, left: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: "#0F766E", alignItems: "center", justifyContent: "center", zIndex: 20, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
  menu: { position: "absolute", top: 88, left: 20, width: 220, backgroundColor: "#fff", borderRadius: 22, padding: 8, zIndex: 22, borderWidth: 1, borderColor: "#E5E7EB", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  menuAction: { minHeight: 48, borderRadius: 15, paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  menuText: { fontWeight: "900", fontSize: 15 },
});
