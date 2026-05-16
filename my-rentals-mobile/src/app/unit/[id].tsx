import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
type RelatedItem = { id: number; entity: string; title: string; subtitle?: string; badge?: string | null; route?: string | null; meta?: string[] };
type RelatedSection = { key: string; title: string; count: number; items: RelatedItem[] };
type DetailsResponse = { id: number; title: string; entity_title?: string; fields: FieldItem[]; sections: RelatedSection[] };
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
  tenant?: { name?: string | null; phone?: string | null } | null;
  unit?: { id?: number; unit_number?: string | null; property_id?: number; property?: { id?: number; name?: string | null } | null } | null;
  payments?: Array<{ status?: string | null; amount?: number | string | null }>;
};

const unitTabs: Array<{ key: UnitTabKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "stats", label: "إحصائيات", icon: "stats-chart-outline" },
  { key: "details", label: "التفاصيل", icon: "list-outline" },
  { key: "contracts", label: "العقود", icon: "documents-outline" },
];

const statusLabels: Record<string, string> = {
  active: "نشط",
  ended: "منتهي",
  cancelled: "ملغي",
  draft: "مسودة",
  pending: "معلق",
};

function valueOrDash(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function asNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown) {
  return `${Math.round(asNumber(value)).toLocaleString("ar-SA")} ريال`;
}

function dateOnly(value?: string | null) {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : String(value);
}

function paymentProgress(payments?: ContractItem["payments"]) {
  if (!payments || payments.length === 0) return { paid: 0, total: 0, pct: 0, overdue: 0 };
  const paid = payments.filter((p) => p.status === "paid").length;
  const overdue = payments.filter((p) => p.status === "overdue").length;
  return { paid, total: payments.length, pct: Math.round((paid / payments.length) * 100), overdue };
}

function statusText(status?: string | null) {
  if (!status) return "-";
  return statusLabels[status] || status;
}

function relationRoute(item: RelatedItem) {
  if (item.route) return item.route;
  if (item.entity === "contract" || item.entity === "contracts") return `/contract/${item.id}`;
  if (item.entity === "tenant" || item.entity === "tenants") return `/tenant/${item.id}`;
  if (item.entity === "property" || item.entity === "properties") return `/property/${item.id}`;
  return `/record-details?resource=${encodeURIComponent(item.entity)}&id=${encodeURIComponent(String(item.id))}`;
}

function fieldValue(fields: FieldItem[] | undefined, key: string) {
  return fields?.find((field) => field.key === key)?.value ?? "";
}

function shouldOfferCascadeDelete(message: string) {
  return /ارتباط|الارتباطات|راجع التفاصيل|أكد الحذف|تأكيد|cascade|requires_confirmation/i.test(message);
}

function isContractSection(section: RelatedSection) {
  const key = `${section.key || ""} ${section.title || ""}`.toLowerCase();
  if (/contract|عقد|عقود/.test(key)) return true;
  return section.items.some((item) => /contract|contracts|عقد|عقود/i.test(`${item.entity} ${item.title}`));
}

function firstLetter(value?: string | null) {
  const text = String(value || "?").trim();
  return text ? text[0] : "؟";
}

function normalizeContractsResponse(result: any): ContractItem[] {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.items)) return result.items;
  return [];
}

function StatTile({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statIconBox}><Ionicons name={icon} size={22} color="#0F766E" /></View>
      <Text style={styles.statTileValue}>{valueOrDash(value)}</Text>
      <Text style={styles.statTileLabel}>{label}</Text>
    </View>
  );
}

function ContractListCard({ contract, fallback }: { contract?: ContractItem; fallback?: RelatedItem }) {
  const id = contract?.id || fallback?.id || 0;
  const tenantName = contract?.tenant?.name || contract?.tenant_name || fallback?.title || "مستأجر";
  const propertyName = contract?.unit?.property?.name || contract?.property_name || "عقار";
  const unitNumber = contract?.unit?.unit_number || contract?.unit_number || "-";
  const status = contract?.status || fallback?.badge || null;
  const progress = paymentProgress(contract?.payments);
  const contractNo = contract?.government_contract_number || contract?.contract_number || String(id);

  return (
    <TouchableOpacity style={styles.contractCardBig} activeOpacity={0.88} onPress={() => router.push(`/contract/${id}` as never)}>
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

      <View style={styles.contractNumberRow}>
        <Text style={styles.contractNumberLabel}>رقم العقد</Text>
        <Text numberOfLines={1} style={styles.contractNumberValue}>{contractNo}</Text>
      </View>

      <View style={styles.contractDetailsRow}>
        <View style={styles.contractDetailItem}><Text style={styles.contractDetailLabel}>الإيجار</Text><Text style={styles.contractDetailValue}>{money(contract?.rent_amount)}</Text></View>
        <View style={styles.contractDetailDivider} />
        <View style={styles.contractDetailItem}><Text style={styles.contractDetailLabel}>البداية</Text><Text style={styles.contractDetailValue}>{dateOnly(contract?.start_date)}</Text></View>
        <View style={styles.contractDetailDivider} />
        <View style={styles.contractDetailItem}><Text style={styles.contractDetailLabel}>النهاية</Text><Text style={styles.contractDetailValue}>{dateOnly(contract?.end_date)}</Text></View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>الدفعات: {progress.paid}/{progress.total}</Text>
          {progress.overdue > 0 ? <Text style={styles.overdueLabel}>{progress.overdue} متأخرة</Text> : null}
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress.pct}%`, backgroundColor: progress.pct === 100 ? "#16A34A" : "#0F766E" }]} /></View>
      </View>
    </TouchableOpacity>
  );
}

export default function UnitDetailsRoute() {
  const params = useLocalSearchParams<{ id: string; source?: string; return_to?: string }>();
  const id = String(params.id || "");
  const [data, setData] = useState<DetailsResponse | null>(null);
  const [unitContracts, setUnitContracts] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<UnitTabKey>("stats");

  useEffect(() => {
    globalThis.__RENTAL_EDIT_CONTEXT__ = { resource: "units", id };
    return () => {
      if (globalThis.__RENTAL_EDIT_CONTEXT__?.resource === "units" && String(globalThis.__RENTAL_EDIT_CONTEXT__?.id || "") === id) {
        globalThis.__RENTAL_EDIT_CONTEXT__ = undefined;
      }
    };
  }, [id]);

  async function load(isRefresh = false) {
    if (!id) return;
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError("");
      const [detailsResponse, contractsResponse] = await Promise.all([
        apiGet(`/relation-manager/related/unit/${id}`),
        apiGet(`/contracts?unit_id=${encodeURIComponent(id)}`).catch(() => null),
      ]);
      setData(detailsResponse as DetailsResponse);
      setUnitContracts(normalizeContractsResponse(contractsResponse));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل تفاصيل الوحدة");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(false); }, [id]);

  const title = data?.title || "جاري التحميل...";
  const propertyId = valueOrDash(fieldValue(data?.fields, "property_id"));
  const unitStatus = valueOrDash(fieldValue(data?.fields, "status"));
  const unitRent = valueOrDash(fieldValue(data?.fields, "rent_amount"));
  const unitFloor = valueOrDash(fieldValue(data?.fields, "floor"));
  const sourceReturnTo = typeof params.return_to === "string" && params.return_to ? params.return_to : "";
  const detailsReturnTo = `/unit/${id}${sourceReturnTo ? `?return_to=${encodeURIComponent(sourceReturnTo)}` : ""}`;
  const deleteReturnTo = sourceReturnTo || (propertyId !== "-" ? `/property/${propertyId}` : "/properties");

  const primaryFields = useMemo(() => {
    const preferred = ["property_id", "owner_id", "unit_number", "floor", "type", "status", "rent_amount"];
    const fields = data?.fields || [];
    return [...fields.filter((field) => preferred.includes(field.key)), ...fields.filter((field) => !preferred.includes(field.key))];
  }, [data?.fields]);

  const contractSections = useMemo(() => (data?.sections || []).filter(isContractSection), [data?.sections]);
  const contractFallbackItems = useMemo(() => contractSections.flatMap((section) => section.items), [contractSections]);
  const otherSections = useMemo(() => (data?.sections || []).filter((section) => !isContractSection(section)), [data?.sections]);
  const contractCards = unitContracts.length ? unitContracts : [];
  const relatedCount = useMemo(() => (data?.sections || []).reduce((sum, section) => sum + (section.count || section.items.length || 0), 0), [data?.sections]);
  const contractsCount = unitContracts.length || contractFallbackItems.length;

  function closeMenu() { setMenuOpen(false); }

  function openEditScreen() {
    closeMenu();
    router.push({ pathname: "/unit-edit/[id]", params: { id, return_to: detailsReturnTo, delete_return_to: deleteReturnTo } } as never);
  }

  function unitQuery(extraQuery = "") {
    const unitName = encodeURIComponent(title || `وحدة ${id}`);
    const suffix = extraQuery ? `&${extraQuery}` : "";
    return `unit_id=${id}&unit_name=${unitName}${suffix}`;
  }

  function openUnitService(path: string, extraQuery = "") {
    closeMenu();
    router.push(`${path}?${unitQuery(extraQuery)}` as never);
  }

  function openCreateContractOptions() {
    closeMenu();
    Alert.alert("إنشاء عقد", "اختر طريقة إنشاء العقد لهذه الوحدة:", [
      { text: "إنشاء عقد يدوي", onPress: () => router.push(`/create-contract?${unitQuery()}` as never) },
      { text: "رفع PDF", onPress: () => router.push(`/upload-contract?${unitQuery()}` as never) },
      { text: "إلغاء", style: "cancel" },
    ]);
  }

  async function performUnitDelete(force = false) {
    try {
      await apiPost(`/edit-delete-center/units/${id}/delete`, force ? { force: true } : {});
      router.replace(deleteReturnTo as never);
    } catch (e) {
      const message = e instanceof Error ? e.message : "فشل حذف الوحدة";
      if (!force && shouldOfferCascadeDelete(message)) {
        Alert.alert("تأكيد حذف الارتباطات", `${message}\n\nهل تؤكد حذف الوحدة مع جميع الارتباطات التابعة لها؟ سيتم حذف العقود والدفعات والملفات المرتبطة بهذه الوحدة.`, [
          { text: "إلغاء", style: "cancel" },
          { text: "تأكيد الحذف", style: "destructive", onPress: () => performUnitDelete(true) },
        ]);
        return;
      }
      Alert.alert("تعذر الحذف", message);
    }
  }

  function deleteUnit() {
    closeMenu();
    Alert.alert("حذف الوحدة", "سيتم حذف الوحدة. إذا كانت عليها عقود أو دفعات أو ملفات مرتبطة سيظهر لك تأكيد إضافي لحذفها معها.", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => performUnitDelete(false) },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
        <View style={styles.topBar}><Text style={styles.topTitle}>الوحدة</Text><Text style={styles.topSubtitle}>تفاصيل الوحدة والخدمات المرتبطة بها</Text></View>
        <View style={styles.headerCard}>
          <Text style={styles.entityLabel}>وحدة</Text>
          <Text numberOfLines={2} style={styles.title}>{title}</Text>
          <View style={styles.headerStatsRow}><Text style={styles.statPill}>العقود: {contractsCount}</Text><Text style={styles.statPill}>رقم السجل: {valueOrDash(id)}</Text></View>
        </View>

        <View style={styles.tabsWrap}>{unitTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return <TouchableOpacity key={tab.key} style={[styles.tabButton, isActive ? styles.tabButtonActive : null]} activeOpacity={0.88} onPress={() => setActiveTab(tab.key)}><Ionicons name={tab.icon} size={17} color={isActive ? "#0F172A" : "#6B7280"} /><Text style={[styles.tabText, isActive ? styles.tabTextActive : null]}>{tab.label}</Text></TouchableOpacity>;
        })}</View>

        {loading ? <View style={styles.loadingBox}><ActivityIndicator /><Text style={styles.loadingText}>جاري تحميل التفاصيل...</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorTitle}>تعذر تحميل تفاصيل الوحدة</Text><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => load(false)}><Text style={styles.retryText}>إعادة المحاولة</Text></TouchableOpacity></View> : null}

        {!loading && !error && activeTab === "stats" ? <View style={styles.sectionCard}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>إحصائيات الوحدة</Text><Text style={styles.sectionSubtitle}>ملخص سريع عن الوحدة وارتباطاتها</Text></View><View style={styles.statsGrid}><StatTile icon="documents-outline" label="العقود" value={contractsCount} /><StatTile icon="cash-outline" label="الإيجار" value={unitRent} /><StatTile icon="layers-outline" label="الدور" value={unitFloor} /><StatTile icon="checkmark-circle-outline" label="الحالة" value={unitStatus} /><StatTile icon="link-outline" label="الارتباطات" value={relatedCount} /><StatTile icon="list-outline" label="حقول البيانات" value={primaryFields.length} /></View></View> : null}

        {!loading && !error && activeTab === "details" ? <>{<View style={styles.sectionCard}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>البيانات الأساسية</Text><Text style={styles.sectionSubtitle}>{primaryFields.length} حقل</Text></View>{primaryFields.map((field) => <View key={field.key} style={styles.fieldRow}><Text style={styles.fieldValue}>{valueOrDash(field.value)}</Text><Text style={styles.fieldLabel}>{field.label}</Text></View>)}</View>}{otherSections.map((section) => <View key={section.key} style={styles.sectionCard}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{section.title}</Text><Text style={styles.sectionSubtitle}>{section.count} عنصر</Text></View>{section.items.length ? section.items.map((item) => <TouchableOpacity key={`${item.entity}-${item.id}`} style={styles.relatedCard} activeOpacity={0.86} onPress={() => router.push(relationRoute(item) as never)}><View style={styles.relatedTopRow}>{item.badge ? <Text style={styles.badge}>{item.badge}</Text> : <View />}<View style={styles.relatedTitleWrap}><Text numberOfLines={1} style={styles.relatedTitle}>{item.title}</Text>{item.subtitle ? <Text numberOfLines={2} style={styles.relatedSubtitle}>{item.subtitle}</Text> : null}</View></View></TouchableOpacity>) : <Text style={styles.emptyText}>لا توجد عناصر مرتبطة.</Text>}</View>)}</> : null}

        {!loading && !error && activeTab === "contracts" ? <View style={styles.contractsSection}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>العقود</Text><Text style={styles.sectionSubtitle}>{contractsCount} عقد مرتبط بهذه الوحدة</Text></View>{contractCards.length ? contractCards.map((contract) => <ContractListCard key={contract.id} contract={contract} />) : contractFallbackItems.length ? contractFallbackItems.map((item) => <ContractListCard key={`${item.entity}-${item.id}`} fallback={item} />) : <Text style={styles.emptyText}>لا توجد عقود مرتبطة بهذه الوحدة.</Text>}</View> : null}
      </ScrollView>

      {menuOpen ? <TouchableOpacity style={styles.floatingBackdrop} activeOpacity={1} onPress={closeMenu} /> : null}
      {menuOpen ? <View style={styles.floatingMenu}><FloatingMenuAction icon="create-outline" label="تعديل" color="#0F766E" onPress={openEditScreen} /><FloatingMenuAction icon="trash-outline" label="حذف" color="#DC2626" onPress={deleteUnit} /><FloatingMenuAction icon="documents-outline" label="العقود" onPress={() => openUnitService("/contracts")} /><FloatingMenuAction icon="create-outline" label="إنشاء عقد" onPress={openCreateContractOptions} /><FloatingMenuAction icon="cash-outline" label="المصروفات" onPress={() => openUnitService("/expenses")} /><FloatingMenuAction icon="images-outline" label="الوسائط" onPress={() => openUnitService("/files", "mode=media")} /></View> : null}
      <TouchableOpacity style={styles.floatingButton} activeOpacity={0.88} onPress={() => setMenuOpen((value) => !value)}><Ionicons name={menuOpen ? "close" : "ellipsis-vertical"} size={24} color="#fff" /></TouchableOpacity>
    </SafeAreaView>
  );
}

function FloatingMenuAction({ icon, label, color = "#0F172A", onPress }: { icon: string; label: string; color?: string; onPress: () => void }) {
  return <TouchableOpacity style={styles.floatingMenuAction} activeOpacity={0.86} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}><Ionicons name={icon as any} size={20} color={color} /><Text style={[styles.floatingMenuText, { color }]}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f7fb" },
  scroll: { flex: 1 },
  container: { padding: 14, paddingBottom: 28 },
  topBar: { alignItems: "flex-end", marginBottom: 10 },
  topTitle: { color: "#111827", fontSize: 20, fontWeight: "900", textAlign: "right" },
  topSubtitle: { color: "#6b7280", fontSize: 12, fontWeight: "800", textAlign: "right", marginTop: 3 },
  headerCard: { backgroundColor: "#111827", borderRadius: 24, padding: 16, marginBottom: 10 },
  entityLabel: { alignSelf: "flex-end", color: "#c7d2fe", fontSize: 13, fontWeight: "900", marginBottom: 6 },
  title: { color: "#fff", fontSize: 24, lineHeight: 32, fontWeight: "900", textAlign: "right" },
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
  sectionHeader: { alignItems: "flex-end", marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827", textAlign: "right" },
  sectionSubtitle: { color: "#9ca3af", fontSize: 11, fontWeight: "800", textAlign: "right", marginTop: 2 },
  statsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  statTile: { width: "31.8%", minHeight: 96, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#EEF2F7", borderRadius: 18, alignItems: "center", justifyContent: "center", padding: 8 },
  statIconBox: { width: 40, height: 40, borderRadius: 15, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  statTileValue: { color: "#111827", fontWeight: "900", fontSize: 15, textAlign: "center" },
  statTileLabel: { color: "#64748B", fontWeight: "800", fontSize: 11, textAlign: "center", marginTop: 3 },
  fieldRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  fieldLabel: { color: "#6b7280", fontSize: 13, fontWeight: "800", textAlign: "right", width: 116 },
  fieldValue: { flex: 1, color: "#111827", fontSize: 14, fontWeight: "800", textAlign: "right" },
  relatedCard: { backgroundColor: "#F7F6F4", borderRadius: 18, padding: 11, marginTop: 8, borderWidth: 1, borderColor: "#edf2f7" },
  relatedTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  relatedTitleWrap: { flex: 1, alignItems: "flex-end" },
  relatedTitle: { color: "#111827", fontSize: 15, fontWeight: "900", textAlign: "right" },
  relatedSubtitle: { marginTop: 5, color: "#4b5563", fontSize: 12, fontWeight: "700", textAlign: "right" },
  badge: { overflow: "hidden", backgroundColor: "#dcfce7", color: "#166534", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: "900" },
  contractCardBig: { backgroundColor: "#fff", borderRadius: 22, marginTop: 10, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB", shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  contractCardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 14, gap: 10 },
  contractTopMain: { flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#0F766E", fontWeight: "900", fontSize: 16 },
  contractTenantWrap: { flex: 1, alignItems: "flex-end", minWidth: 0 },
  contractTenantName: { color: "#111827", fontSize: 17, fontWeight: "900", textAlign: "right" },
  contractPropertyInfo: { color: "#6B7280", fontSize: 12, fontWeight: "800", textAlign: "right", marginTop: 3 },
  contractStatusBadge: { overflow: "hidden", backgroundColor: "#F1F5F9", color: "#64748B", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, fontWeight: "900", fontSize: 11 },
  contractStatusActive: { backgroundColor: "#ECFDF5", color: "#0F766E" },
  contractNumberRow: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  contractNumberLabel: { color: "#94A3B8", fontWeight: "800", fontSize: 11 },
  contractNumberValue: { flex: 1, color: "#111827", fontWeight: "900", textAlign: "right" },
  contractDetailsRow: { flexDirection: "row-reverse", alignItems: "center", borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingVertical: 12, paddingHorizontal: 14 },
  contractDetailItem: { flex: 1, alignItems: "center" },
  contractDetailLabel: { color: "#94A3B8", fontWeight: "800", fontSize: 11, marginBottom: 2 },
  contractDetailValue: { color: "#111827", fontWeight: "900", fontSize: 12, textAlign: "center" },
  contractDetailDivider: { width: 1, height: 26, backgroundColor: "#E5E7EB" },
  progressSection: { backgroundColor: "#F7F6F4", padding: 12, paddingHorizontal: 14 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7 },
  progressLabel: { color: "#6B7280", fontWeight: "800", fontSize: 11 },
  overdueLabel: { color: "#DC2626", fontWeight: "900", fontSize: 11 },
  progressTrack: { height: 4, backgroundColor: "#E5E7EB", borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  emptyText: { color: "#6b7280", fontWeight: "800", textAlign: "center", padding: 14 },
  floatingButton: { position: "absolute", left: 18, top: 14, width: 56, height: 56, borderRadius: 28, backgroundColor: "#0F766E", alignItems: "center", justifyContent: "center", shadowColor: "#0F172A", shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 10, zIndex: 60 },
  floatingBackdrop: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "transparent", zIndex: 40 },
  floatingMenu: { position: "absolute", left: 18, top: 78, width: 210, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", paddingVertical: 6, shadowColor: "#0F172A", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 12, zIndex: 70 },
  floatingMenuAction: { minHeight: 42, flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 10, paddingHorizontal: 14 },
  floatingMenuText: { fontWeight: "900", fontSize: 13, textAlign: "right" },
});