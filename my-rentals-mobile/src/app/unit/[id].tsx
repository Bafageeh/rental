import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGet, apiPost } from "../../lib/api";

type UnitTabKey = "stats" | "details" | "contracts";
type FieldItem = { key: string; label: string; value: string | number | null };
type RelatedItem = { id: number; entity: string; title: string; subtitle?: string; badge?: string | null; route?: string | null };
type RelatedSection = { key: string; title: string; count: number; items: RelatedItem[] };
type DetailsResponse = { id: number; title: string; fields: FieldItem[]; sections: RelatedSection[] };
type PaymentItem = { status?: string | null; amount?: number | string | null };
type ContractFileItem = { id: number; contract_id?: number | string | null; file_name?: string | null; file_url?: string | null; download_url?: string | null; mime_type?: string | null; file_type?: string | null };
type ContractItem = {
  id: number;
  contract_number?: string | null;
  government_contract_number?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  rent_amount?: number | string | null;
  status?: string | null;
  tenant_name?: string | null;
  property_name?: string | null;
  unit_number?: string | null;
  tenant?: { name?: string | null } | null;
  unit?: { unit_number?: string | null; property?: { name?: string | null } | null } | null;
  payments?: PaymentItem[];
};

const unitTabs: Array<{ key: UnitTabKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "stats", label: "إحصائيات", icon: "stats-chart-outline" },
  { key: "details", label: "التفاصيل", icon: "list-outline" },
  { key: "contracts", label: "العقود", icon: "documents-outline" },
];

const statusLabels: Record<string, string> = { active: "نشط", ended: "منتهي", cancelled: "ملغي", draft: "مسودة", pending: "معلق" };

function valueOrDash(value: unknown) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
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
function normalizeId(value: unknown) {
  const text = String(value ?? "").trim();
  const match = text.match(/\d+/);
  return match ? match[0] : "";
}
function statusText(status?: string | null) {
  return status ? statusLabels[status] || status : "-";
}
function firstLetter(value?: string | null) {
  const text = String(value || "؟").trim();
  return text ? text[0] : "؟";
}
function normalizeContractsResponse(result: any): ContractItem[] {
  return Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : Array.isArray(result?.items) ? result.items : [];
}
function normalizeContractFilesResponse(result: any): ContractFileItem[] {
  return Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : Array.isArray(result?.items) ? result.items : [];
}
function isContractSection(section: RelatedSection) {
  const key = `${section.key || ""} ${section.title || ""}`.toLowerCase();
  return /contract|عقد|عقود/.test(key) || section.items.some((item) => /contract|contracts|عقد|عقود/i.test(`${item.entity} ${item.title}`));
}
function relationRoute(item: RelatedItem) {
  if (item.route) return item.route;
  if (/contracts?/.test(item.entity)) return `/contract/${item.id}`;
  if (/tenants?/.test(item.entity)) return `/tenant/${item.id}`;
  if (/properties?/.test(item.entity)) return `/property/${item.id}`;
  return `/record-details?resource=${encodeURIComponent(item.entity)}&id=${encodeURIComponent(String(item.id))}`;
}
function paymentProgress(payments?: PaymentItem[]) {
  const list = payments || [];
  const paid = list.filter((payment) => payment.status === "paid").length;
  const overdue = list.filter((payment) => payment.status === "overdue").length;
  return { paid, total: list.length, overdue, pct: list.length ? Math.round((paid / list.length) * 100) : 0 };
}
function contractFileUrl(file?: ContractFileItem) {
  return String(file?.download_url || file?.file_url || "").trim();
}
function safeDecode(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return "";
  try { return decodeURIComponent(raw); } catch { return raw; }
}
function routeFromReturnTo(returnTo: string) {
  const match = String(returnTo || "").match(/\/property\/(\d+)/);
  return match ? `/property/${match[1]}` : "";
}

function StatTile({ icon, label, value, danger = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number; danger?: boolean }) {
  return (
    <View style={[styles.statTile, danger ? styles.statTileDanger : null]}>
      <View style={[styles.statIconBox, danger ? styles.statIconBoxDanger : null]}>
        <Ionicons name={icon} size={22} color={danger ? "#DC2626" : "#0F766E"} />
      </View>
      <Text style={[styles.statTileValue, danger ? styles.statTileValueDanger : null]}>{valueOrDash(value)}</Text>
      <Text style={[styles.statTileLabel, danger ? styles.statTileLabelDanger : null]}>{label}</Text>
    </View>
  );
}

function ContractListCard({ contract, fallback, contractFile, onDownload, sourceUnitId }: { contract?: ContractItem; fallback?: RelatedItem; contractFile?: ContractFileItem; onDownload?: (file: ContractFileItem) => void; sourceUnitId?: string }) {
  const id = contract?.id || fallback?.id || 0;
  const tenantName = contract?.tenant?.name || contract?.tenant_name || fallback?.title || "مستأجر";
  const propertyName = contract?.unit?.property?.name || contract?.property_name || "عقار";
  const unitNumber = contract?.unit?.unit_number || contract?.unit_number || "-";
  const status = contract?.status || fallback?.badge || null;
  const progress = paymentProgress(contract?.payments);
  const contractNo = contract?.government_contract_number || contract?.contract_number || String(id);
  const fileReady = !!contractFileUrl(contractFile);
  const contractRoute = `/contract/${id}${sourceUnitId ? `?from_unit_id=${encodeURIComponent(sourceUnitId)}` : ""}`;
  return (
    <TouchableOpacity style={styles.contractCardBig} activeOpacity={0.88} onPress={() => router.push(contractRoute as never)}>
      <TouchableOpacity
        style={[styles.contractDownloadButton, !fileReady ? styles.contractDownloadButtonDisabled : null]}
        activeOpacity={0.86}
        disabled={!fileReady || !contractFile}
        onPress={() => contractFile ? onDownload?.(contractFile) : undefined}
      >
        <Ionicons name="download-outline" size={18} color={fileReady ? "#0F766E" : "#94A3B8"} />
      </TouchableOpacity>
      <View style={styles.contractCardTop}>
        <View style={styles.contractTopMain}>
          <View style={styles.avatarCircle}><Text style={styles.avatarText}>{firstLetter(tenantName)}</Text></View>
          <View style={styles.contractTenantWrap}>
            <Text numberOfLines={1} style={styles.contractTenantName}>{tenantName}</Text>
            <Text numberOfLines={1} style={styles.contractPropertyInfo}>{propertyName} — {unitNumber}</Text>
          </View>
        </View>
        <Text style={[styles.contractStatusBadge, status === "active" || status === "نشط" ? styles.contractStatusActive : null]}>{statusText(status)}</Text>
      </View>
      <View style={styles.contractNumberRow}><Text style={styles.contractNumberLabel}>رقم العقد</Text><Text numberOfLines={1} style={styles.contractNumberValue}>{contractNo}</Text></View>
      <View style={styles.contractDetailsRow}>
        <View style={styles.contractDetailItem}><Text style={styles.contractDetailLabel}>الإيجار</Text><Text style={styles.contractDetailValue}>{money(contract?.rent_amount)}</Text></View>
        <View style={styles.contractDetailDivider} />
        <View style={styles.contractDetailItem}><Text style={styles.contractDetailLabel}>البداية</Text><Text style={styles.contractDetailValue}>{dateOnly(contract?.start_date)}</Text></View>
        <View style={styles.contractDetailDivider} />
        <View style={styles.contractDetailItem}><Text style={styles.contractDetailLabel}>النهاية</Text><Text style={styles.contractDetailValue}>{dateOnly(contract?.end_date)}</Text></View>
      </View>
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}><Text style={styles.progressLabel}>الدفعات: {progress.paid}/{progress.total}</Text>{progress.overdue > 0 ? <Text style={styles.overdueLabel}>{progress.overdue} متأخرة</Text> : null}</View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress.pct}%` }]} /></View>
      </View>
    </TouchableOpacity>
  );
}

export default function UnitDetailsRoute() {
  const params = useLocalSearchParams<{ id: string; return_to?: string }>();
  const navigation = useNavigation();
  const id = String(params.id || "");
  const [data, setData] = useState<DetailsResponse | null>(null);
  const [unitContracts, setUnitContracts] = useState<ContractItem[]>([]);
  const [contractFiles, setContractFiles] = useState<Record<string, ContractFileItem>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<UnitTabKey>("stats");
  const forcingBackRef = useRef(false);
  const backTargetRef = useRef("/properties");

  useEffect(() => {
    (navigation as any).setOptions?.({ gestureEnabled: false });
  }, [navigation]);

  useEffect(() => {
    (globalThis as any).__RENTAL_EDIT_CONTEXT__ = { resource: "units", id };
    return () => {
      if ((globalThis as any).__RENTAL_EDIT_CONTEXT__?.resource === "units" && String((globalThis as any).__RENTAL_EDIT_CONTEXT__?.id || "") === id) {
        (globalThis as any).__RENTAL_EDIT_CONTEXT__ = undefined;
      }
    };
  }, [id]);

  async function load(isRefresh = false) {
    if (!id) return;
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError("");
      const [detailsResponse, contractsResponse, contractFilesResponse] = await Promise.all([
        apiGet(`/relation-manager/related/unit/${id}`),
        apiGet(`/contracts?unit_id=${encodeURIComponent(id)}`).catch(() => null),
        apiGet(`/contract-files?unit_id=${encodeURIComponent(id)}`).catch(() => []),
      ]);
      setData(detailsResponse as DetailsResponse);
      setUnitContracts(normalizeContractsResponse(contractsResponse));
      const filesMap: Record<string, ContractFileItem> = {};
      normalizeContractFilesResponse(contractFilesResponse).forEach((file) => {
        const contractId = String(file.contract_id || "");
        if (contractId && !filesMap[contractId]) filesMap[contractId] = file;
      });
      setContractFiles(filesMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل تفاصيل الوحدة");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(false); }, [id]);

  const title = data?.title || "جاري التحميل...";
  const propertyId = normalizeId(fieldValue(data?.fields, "property_id"));
  const unitStatus = valueOrDash(fieldValue(data?.fields, "status"));
  const unitRent = money(fieldValue(data?.fields, "rent_amount"));
  const unitFloor = valueOrDash(fieldValue(data?.fields, "floor"));
  const sourceReturnTo = safeDecode(params.return_to);
  const propertyReturnFromParam = routeFromReturnTo(sourceReturnTo);
  const unitBackTarget = propertyId ? `/property/${propertyId}` : (propertyReturnFromParam || "/properties");
  const detailsReturnTo = `/unit/${id}?return_to=${encodeURIComponent(unitBackTarget)}`;
  const deleteReturnTo = unitBackTarget;

  useEffect(() => { backTargetRef.current = unitBackTarget; }, [unitBackTarget]);

  function forceBackToProperty() {
    if (forcingBackRef.current) return true;
    forcingBackRef.current = true;
    const target = backTargetRef.current || "/properties";
    router.replace(target as never);
    setTimeout(() => { forcingBackRef.current = false; }, 900);
    return true;
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove" as never, (event: any) => {
      if (forcingBackRef.current) return;
      const actionType = String(event?.data?.action?.type || "").toUpperCase();
      const isBackAction = !actionType || ["GO_BACK", "POP", "POP_TO_TOP", "REPLACE", "NAVIGATE"].includes(actionType);
      if (!isBackAction) return;
      event.preventDefault?.();
      forceBackToProperty();
    });
    return typeof unsubscribe === "function" ? unsubscribe : undefined;
  }, [navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => forceBackToProperty());
    return () => sub.remove();
  }, []);

  const primaryFields = useMemo(() => {
    const preferred = ["property_id", "owner_id", "unit_number", "floor", "type", "status", "rent_amount"];
    const fields = data?.fields || [];
    return [...fields.filter((field) => preferred.includes(field.key)), ...fields.filter((field) => !preferred.includes(field.key))];
  }, [data?.fields]);
  const contractSections = useMemo(() => (data?.sections || []).filter(isContractSection), [data?.sections]);
  const contractFallbackItems = useMemo(() => contractSections.flatMap((section) => section.items), [contractSections]);
  const otherSections = useMemo(() => (data?.sections || []).filter((section) => !isContractSection(section)), [data?.sections]);
  const relatedCount = useMemo(() => (data?.sections || []).reduce((sum, section) => sum + (section.count || section.items.length || 0), 0), [data?.sections]);
  const contractsCount = unitContracts.length || contractFallbackItems.length;
  const activeTenantName = useMemo(() => {
    const activeContract = unitContracts.find((contract) => contract.status === "active" || contract.status === "نشط") || null;
    return activeContract?.tenant?.name || activeContract?.tenant_name || "";
  }, [unitContracts]);
  const paymentStats = useMemo(() => {
    const payments = unitContracts.flatMap((contract) => contract.payments || []);
    return { total: payments.length, overdue: payments.filter((payment) => payment.status === "overdue").length };
  }, [unitContracts]);

  function closeMenu() { setMenuOpen(false); }
  function unitQuery(extraQuery = "") {
    const unitName = encodeURIComponent(title || `وحدة ${id}`);
    return `unit_id=${id}&unit_name=${unitName}${extraQuery ? `&${extraQuery}` : ""}`;
  }
  function openEditScreen() { closeMenu(); router.push({ pathname: "/unit-edit/[id]", params: { id, return_to: detailsReturnTo, delete_return_to: deleteReturnTo } } as never); }
  function openUnitService(path: string, extraQuery = "") { closeMenu(); router.push(`${path}?${unitQuery(extraQuery)}` as never); }
  async function downloadContractFile(file: ContractFileItem) {
    const url = contractFileUrl(file);
    if (!url) return Alert.alert("لا يوجد ملف", "لم يتم العثور على ملف PDF لهذا العقد.");
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) return Alert.alert("تعذر التنزيل", "لا يمكن فتح رابط ملف العقد على هذا الجهاز.");
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert("تعذر التنزيل", e instanceof Error ? e.message : "حدث خطأ أثناء فتح ملف العقد.");
    }
  }
  function openCreateContractOptions() {
    closeMenu();
    Alert.alert("إنشاء عقد", "اختر طريقة إنشاء العقد لهذه الوحدة:", [
      { text: "إنشاء عقد يدوي", onPress: () => router.push(`/create-contract?${unitQuery()}` as never) },
      { text: "رفع PDF", onPress: () => router.push(`/upload-contract?${unitQuery()}` as never) },
      { text: "إلغاء", style: "cancel" },
    ]);
  }
  async function performUnitRemove() {
    try { await apiPost(`/edit-delete-center/units/${id}/delete`, {}); router.replace(deleteReturnTo as never); }
    catch (e) { Alert.alert("تعذر التنفيذ", e instanceof Error ? e.message : "تعذر تنفيذ العملية"); }
  }
  function removeUnit() {
    closeMenu();
    Alert.alert("حذف الوحدة", "هل تريد حذف هذه الوحدة؟", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: performUnitRemove }]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
        <View style={styles.headerCard}>
          <Text style={styles.entityLabel}>وحدة</Text>
          <Text numberOfLines={2} style={styles.title}>{title}</Text>
          {activeTenantName ? <Text numberOfLines={1} style={styles.activeTenantLine}>المستأجر النشط: {activeTenantName}</Text> : null}
          <View style={styles.headerStatsRow}><Text style={styles.statPill}>العقود: {contractsCount}</Text><Text style={styles.statPill}>رقم السجل: {valueOrDash(id)}</Text></View>
        </View>
        <View style={styles.tabsWrap}>{unitTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return <TouchableOpacity key={tab.key} style={[styles.tabButton, isActive ? styles.tabButtonActive : null]} activeOpacity={0.88} onPress={() => setActiveTab(tab.key)}><Ionicons name={tab.icon} size={17} color={isActive ? "#0F172A" : "#6B7280"} /><Text style={[styles.tabText, isActive ? styles.tabTextActive : null]}>{tab.label}</Text></TouchableOpacity>;
        })}</View>
        {loading ? <View style={styles.loadingBox}><ActivityIndicator /><Text style={styles.loadingText}>جاري تحميل التفاصيل...</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorTitle}>تعذر تحميل تفاصيل الوحدة</Text><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => load(false)}><Text style={styles.retryText}>إعادة المحاولة</Text></TouchableOpacity></View> : null}
        {!loading && !error && activeTab === "stats" ? <View style={styles.sectionCard}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>إحصائيات الوحدة</Text><Text style={styles.sectionSubtitle}>ملخص سريع عن الوحدة وارتباطاتها</Text></View><View style={styles.statsGrid}><StatTile icon="alert-circle-outline" label="دفعات متأخرة" value={paymentStats.overdue} danger={paymentStats.overdue > 0} /><StatTile icon="receipt-outline" label="عدد الدفعات" value={paymentStats.total} /><StatTile icon="documents-outline" label="العقود" value={contractsCount} /><StatTile icon="cash-outline" label="الإيجار" value={unitRent} /><StatTile icon="checkmark-circle-outline" label="الحالة" value={unitStatus} /><StatTile icon="layers-outline" label="الدور" value={unitFloor} /><StatTile icon="link-outline" label="الارتباطات" value={relatedCount} /><StatTile icon="list-outline" label="حقول البيانات" value={primaryFields.length} /></View></View> : null}
        {!loading && !error && activeTab === "details" ? <><View style={styles.sectionCard}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>البيانات الأساسية</Text><Text style={styles.sectionSubtitle}>{primaryFields.length} حقل</Text></View>{primaryFields.map((field) => <View key={field.key} style={styles.fieldRow}><Text style={styles.fieldValue}>{valueOrDash(field.value)}</Text><Text style={styles.fieldLabel}>{field.label}</Text></View>)}</View>{otherSections.map((section) => <View key={section.key} style={styles.sectionCard}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{section.title}</Text><Text style={styles.sectionSubtitle}>{section.count} عنصر</Text></View>{section.items.length ? section.items.map((item) => <TouchableOpacity key={`${item.entity}-${item.id}`} style={styles.relatedCard} activeOpacity={0.86} onPress={() => router.push(relationRoute(item) as never)}><View style={styles.relatedTopRow}>{item.badge ? <Text style={styles.badge}>{item.badge}</Text> : <View />}<View style={styles.relatedTitleWrap}><Text numberOfLines={1} style={styles.relatedTitle}>{item.title}</Text>{item.subtitle ? <Text numberOfLines={2} style={styles.relatedSubtitle}>{item.subtitle}</Text> : null}</View></View></TouchableOpacity>) : <Text style={styles.emptyText}>لا توجد عناصر مرتبطة.</Text>}</View>)}</> : null}
        {!loading && !error && activeTab === "contracts" ? <View style={styles.contractsSection}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>العقود</Text><Text style={styles.sectionSubtitle}>{contractsCount} عقد مرتبط بهذه الوحدة</Text></View>{unitContracts.length ? unitContracts.map((contract) => <ContractListCard key={contract.id} contract={contract} sourceUnitId={id} contractFile={contractFiles[String(contract.id)]} onDownload={downloadContractFile} />) : contractFallbackItems.length ? contractFallbackItems.map((item) => <ContractListCard key={`${item.entity}-${item.id}`} fallback={item} sourceUnitId={id} contractFile={contractFiles[String(item.id)]} onDownload={downloadContractFile} />) : <Text style={styles.emptyText}>لا توجد عقود مرتبطة بهذه الوحدة.</Text>}</View> : null}
      </ScrollView>
      {menuOpen ? <TouchableOpacity style={styles.floatingBackdrop} activeOpacity={1} onPress={closeMenu} /> : null}
      {menuOpen ? <View style={styles.floatingMenu}><FloatingMenuAction icon="create-outline" label="تعديل" color="#0F766E" onPress={openEditScreen} /><FloatingMenuAction icon="trash-outline" label="حذف" color="#DC2626" onPress={removeUnit} /><FloatingMenuAction icon="create-outline" label="إنشاء عقد" onPress={openCreateContractOptions} /><FloatingMenuAction icon="cash-outline" label="المصروفات" onPress={() => openUnitService("/expenses")} /><FloatingMenuAction icon="images-outline" label="الوسائط" onPress={() => openUnitService("/files", "mode=media")} /></View> : null}
      <TouchableOpacity style={styles.floatingButton} activeOpacity={0.88} onPress={() => setMenuOpen((value) => !value)}><Ionicons name={menuOpen ? "close" : "ellipsis-vertical"} size={24} color="#fff" /></TouchableOpacity>
    </SafeAreaView>
  );
}

function FloatingMenuAction({ icon, label, color = "#0F172A", onPress }: { icon: string; label: string; color?: string; onPress: () => void }) {
  return <TouchableOpacity style={styles.floatingMenuAction} activeOpacity={0.86} onPress={onPress}><Ionicons name={icon as any} size={20} color={color} /><Text style={[styles.floatingMenuText, { color }]}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f7fb" },
  scroll: { flex: 1 },
  container: { padding: 14, paddingBottom: 28 },
  headerCard: { backgroundColor: "#111827", borderRadius: 24, padding: 16, marginBottom: 10 },
  entityLabel: { alignSelf: "flex-end", color: "#c7d2fe", fontSize: 13, fontWeight: "900", marginBottom: 6 },
  title: { color: "#fff", fontSize: 24, lineHeight: 32, fontWeight: "900", textAlign: "right" },
  activeTenantLine: { color: "#A7F3D0", fontSize: 14, fontWeight: "900", textAlign: "right", marginTop: 6 },
  headerStatsRow: { flexDirection: "row-reverse", gap: 8, marginTop: 12, flexWrap: "wrap" },
  statPill: { overflow: "hidden", backgroundColor: "rgba(255,255,255,0.12)", color: "#fff", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontWeight: "800", fontSize: 12 },
  tabsWrap: { flexDirection: "row-reverse", backgroundColor: "#E7E5E0", borderRadius: 19, padding: 5, marginBottom: 12, gap: 4 },
  tabButton: { flex: 1, minHeight: 47, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 3 },
  tabButtonActive: { backgroundColor: "#fff", shadowColor: "#0F172A", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  tabText: { color: "#6B7280", fontWeight: "900", fontSize: 12 },
  tabTextActive: { color: "#111827" },
  loadingBox: { backgroundColor: "#fff", borderRadius: 20, padding: 18, alignItems: "center", gap: 10 },
  loadingText: { color: "#6b7280", fontWeight: "800" },
  errorBox: { backgroundColor: "#fff1f2", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#fecdd3" },
  errorTitle: { color: "#9f1239", fontSize: 16, fontWeight: "900", textAlign: "right" },
  errorText: { color: "#be123c", marginTop: 8, textAlign: "right", lineHeight: 22 },
  retryButton: { marginTop: 12, backgroundColor: "#111827", borderRadius: 14, paddingVertical: 11, alignItems: "center" },
  retryText: { color: "#fff", fontWeight: "900" },
  sectionCard: { backgroundColor: "#fff", borderRadius: 22, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#EDECE9" },
  contractsSection: { backgroundColor: "#fff", borderRadius: 22, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#EDECE9" },
  sectionHeader: { alignItems: "flex-end", marginBottom: 10 },
  sectionTitle: { color: "#111827", fontSize: 18, fontWeight: "900", textAlign: "right" },
  sectionSubtitle: { color: "#9CA3AF", fontSize: 12, fontWeight: "800", textAlign: "right", marginTop: 4 },
  statsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  statTile: { width: "48%", minHeight: 96, borderRadius: 18, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center", padding: 8 },
  statTileDanger: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  statIconBox: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  statIconBoxDanger: { backgroundColor: "#FEE2E2" },
  statTileValue: { color: "#111827", fontWeight: "900", fontSize: 17, textAlign: "center" },
  statTileValueDanger: { color: "#DC2626" },
  statTileLabel: { color: "#6B7280", fontWeight: "800", fontSize: 12, marginTop: 3, textAlign: "center" },
  statTileLabelDanger: { color: "#991B1B" },
  fieldRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  fieldValue: { flex: 1, color: "#111827", fontWeight: "900", textAlign: "left" },
  fieldLabel: { minWidth: 110, color: "#6B7280", fontWeight: "900", textAlign: "right" },
  relatedCard: { backgroundColor: "#F8FAFC", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", padding: 12, marginBottom: 8 },
  relatedTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  relatedTitleWrap: { flex: 1, alignItems: "flex-end" },
  relatedTitle: { color: "#111827", fontWeight: "900", textAlign: "right" },
  relatedSubtitle: { color: "#64748B", fontWeight: "800", textAlign: "right", marginTop: 3 },
  badge: { backgroundColor: "#ECFDF5", color: "#0F766E", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, overflow: "hidden", fontWeight: "900", fontSize: 11 },
  emptyText: { color: "#6B7280", textAlign: "center", fontWeight: "800", padding: 16 },
  contractCardBig: { backgroundColor: "#F8FAFC", borderRadius: 20, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  contractDownloadButton: { position: "absolute", left: 10, top: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: "#D1FAE5", alignItems: "center", justifyContent: "center", zIndex: 2 },
  contractDownloadButtonDisabled: { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" },
  contractCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  contractTopMain: { flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#0F766E", fontWeight: "900", fontSize: 18 },
  contractTenantWrap: { flex: 1, alignItems: "flex-end" },
  contractTenantName: { color: "#111827", fontWeight: "900", fontSize: 15, textAlign: "right" },
  contractPropertyInfo: { color: "#64748B", fontWeight: "800", fontSize: 12, marginTop: 2, textAlign: "right" },
  contractStatusBadge: { borderRadius: 999, backgroundColor: "#F1F5F9", color: "#475569", paddingHorizontal: 10, paddingVertical: 5, overflow: "hidden", fontWeight: "900", fontSize: 11 },
  contractStatusActive: { backgroundColor: "#DCFCE7", color: "#166534" },
  contractNumberRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  contractNumberLabel: { color: "#64748B", fontWeight: "900", fontSize: 12 },
  contractNumberValue: { flex: 1, color: "#111827", fontWeight: "900", textAlign: "right", fontSize: 12 },
  contractDetailsRow: { flexDirection: "row-reverse", alignItems: "center", marginTop: 10, backgroundColor: "#fff", borderRadius: 16, paddingVertical: 9 },
  contractDetailItem: { flex: 1, alignItems: "center" },
  contractDetailDivider: { width: 1, height: 34, backgroundColor: "#E5E7EB" },
  contractDetailLabel: { color: "#94A3B8", fontWeight: "800", fontSize: 11 },
  contractDetailValue: { color: "#111827", fontWeight: "900", fontSize: 12, marginTop: 3 },
  progressSection: { marginTop: 10 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  progressLabel: { color: "#64748B", fontWeight: "900", fontSize: 12 },
  overdueLabel: { color: "#DC2626", fontWeight: "900", fontSize: 12 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: "#E5E7EB", overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: "#0F766E" },
  floatingButton: { position: "absolute", left: 18, top: 18, width: 56, height: 56, borderRadius: 28, backgroundColor: "#0F766E", alignItems: "center", justifyContent: "center", shadowColor: "#0F172A", shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 10, zIndex: 60 },
  floatingBackdrop: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "transparent", zIndex: 40 },
  floatingMenu: { position: "absolute", left: 18, top: 82, width: 210, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", paddingVertical: 6, shadowColor: "#0F172A", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 12, zIndex: 70 },
  floatingMenuAction: { minHeight: 42, flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 10, paddingHorizontal: 14 },
  floatingMenuText: { fontWeight: "900", fontSize: 13, textAlign: "right" },
});
