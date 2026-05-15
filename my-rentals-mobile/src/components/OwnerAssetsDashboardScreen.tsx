import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGetScoped } from "../lib/api";

type Owner = { id: number; name?: string | null; phone?: string | null; email?: string | null; national_id?: string | null };
type Summary = { properties_count?: number; units_count?: number; active_contracts_count?: number; paid_income?: number; due_income?: number; net_income?: number };
type Unit = { id: number; property_id?: number | string | null; unit_scope?: string | null; unit_number?: string | null; name?: string | null; floor?: string | number | null; status?: string | null; rent_amount?: number | string | null };
type Property = { id: number; name?: string | null; city?: string | null; district?: string | null; property_type?: string | null; units_count?: number; rented_units_count?: number; active_contracts_count?: number; units?: Unit[] };
type Contract = { id: number; contract_number?: string | null; government_contract_number?: string | null; tenant_name?: string | null; property_name?: string | null; unit_number?: string | null; rent_amount?: number };
type DashboardData = { owner?: Owner; summary?: Summary; properties?: Property[]; units?: Unit[]; contracts?: Contract[] };
type TabKey = "summary" | "properties" | "contracts";

const tabs: Array<{ key: TabKey; label: string }> = [{ key: "summary", label: "الملخص" }, { key: "properties", label: "العقارات" }, { key: "contracts", label: "العقود" }];
const propertyTypeLabels: Record<string, string> = { building: "عمارة", apartment: "شقة", villa: "فيلا", land: "أرض", commercial: "تجاري", mixed: "مختلط" };
const statusLabels: Record<string, string> = { active: "نشط", ended: "منتهي", cancelled: "ملغى", available: "متاح", rented: "مؤجر", maintenance: "صيانة" };
function asNumber(value: unknown) { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; }
function count(value: unknown) { return Math.round(asNumber(value)).toLocaleString("ar-SA"); }
function money(value: unknown) { return `${Math.round(asNumber(value)).toLocaleString("ar-SA")} ريال`; }
function valueOrDash(value: unknown) { return value === null || value === undefined || String(value).trim() === "" ? "-" : String(value); }
function typeText(value?: string | null) { return value ? (propertyTypeLabels[value] || value) : "عقار"; }
function statusText(value?: string | null) { return value ? (statusLabels[value] || value) : "-"; }
function unitName(unit: Unit) { return unit.name || unit.unit_number || `وحدة #${unit.id}`; }
function EmptyBox({ text }: { text: string }) { return <View style={styles.emptyBox}><Text style={styles.emptyText}>{text}</Text></View>; }
function StatCard({ label, value }: { label: string; value: string }) { return <View style={styles.statCard}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }

export default function OwnerAssetsDashboardScreen({ id }: { id: string | number }) {
  const ownerId = String(id || "");
  const [activeTab, setActiveTab] = useState<TabKey>("properties");
  const [openPropertyId, setOpenPropertyId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(isRefresh = false) {
    if (!ownerId) return;
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError("");
      const response = await apiGetScoped(`/owners/${ownerId}/dashboard`, `/my/owners/${ownerId}/dashboard`);
      setData((response?.data ?? response) as DashboardData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل تفاصيل الأملاك");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }

  useEffect(() => { load(false); }, [ownerId]);
  useEffect(() => { if (activeTab !== "properties") setOpenPropertyId(null); }, [activeTab]);

  const owner = data?.owner;
  const ownerName = owner?.name || "مالك بدون اسم";
  const ownerNameForUrl = encodeURIComponent(ownerName);
  const summary = data?.summary || {};
  const properties = data?.properties || [];
  const units = data?.units || [];
  const contracts = data?.contracts || [];
  const ownerReturnTo = encodeURIComponent(`/owner/${ownerId}`);
  const directOwnerUnits = useMemo(() => units.filter((unit) => !unit.property_id || String(unit.unit_scope || "") === "owner"), [units]);
  const unitsByPropertyId = useMemo(() => {
    const map = new Map<string, Unit[]>();
    units.filter((unit) => unit.property_id && !directOwnerUnits.some((direct) => direct.id === unit.id)).forEach((unit) => {
      const key = String(unit.property_id);
      map.set(key, [...(map.get(key) || []), unit]);
    });
    return map;
  }, [units, directOwnerUnits]);

  function openManualProperty() { router.push(`/property-form?owner_id=${encodeURIComponent(ownerId)}&owner_name=${ownerNameForUrl}&management_type=owned&owner_private=1&return_to=${ownerReturnTo}` as never); }
  function openPdfProperty() { router.push(`/upload-property-deed?owner_id=${encodeURIComponent(ownerId)}&owner_name=${ownerNameForUrl}&management_type=owned&owner_private=1&return_to=${ownerReturnTo}` as never); }
  function openAddPrivateProperty() { Alert.alert("إضافة عقار", "اختر طريقة إضافة العقار لهذا المالك كأملاك خاصة:", [{ text: "رفع ملف PDF", onPress: openPdfProperty }, { text: "إدخال يدوي", onPress: openManualProperty }, { text: "إلغاء", style: "cancel" }]); }
  function toggleProperty(propertyId: number | string) { const key = String(propertyId); setOpenPropertyId((current) => current === key ? null : key); }

  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}><View style={styles.heroTopRow}><Text style={styles.typeBadge}>مالك</Text><View style={styles.heroTitleWrap}><Text numberOfLines={2} style={styles.ownerName}>{ownerName}</Text></View></View><View style={styles.contactGrid}><Text style={styles.contactText}>الجوال: {valueOrDash(owner?.phone)}</Text><Text style={styles.contactText}>البريد: {valueOrDash(owner?.email)}</Text><Text style={styles.contactText}>الهوية/السجل: {valueOrDash(owner?.national_id)}</Text></View></View>
      <View style={styles.tabsWrap}>{tabs.map((tab) => <TouchableOpacity key={tab.key} style={[styles.tabButton, activeTab === tab.key ? styles.tabButtonActive : null]} onPress={() => setActiveTab(tab.key)} activeOpacity={0.88}><Text style={[styles.tabText, activeTab === tab.key ? styles.tabTextActive : null]}>{tab.label}</Text></TouchableOpacity>)}</View>
      {loading ? <View style={styles.stateBox}><ActivityIndicator /><Text style={styles.stateText}>جاري تحميل تفاصيل الأملاك...</Text></View> : null}
      {error ? <View style={styles.errorBox}><Text style={styles.errorTitle}>تعذر تحميل تفاصيل الأملاك</Text><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => load(false)}><Text style={styles.retryText}>إعادة المحاولة</Text></TouchableOpacity></View> : null}

      {!loading && !error && activeTab === "summary" ? <View><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>ملخص المالك</Text><Text style={styles.sectionSubtitle}>إحصائيات خاصة بأملاك هذا المالك فقط</Text></View><View style={styles.statsGrid}><StatCard label="العقارات" value={count(summary.properties_count ?? properties.length)} /><StatCard label="الوحدات" value={count(summary.units_count ?? units.length)} /><StatCard label="العقود النشطة" value={count(summary.active_contracts_count)} /><StatCard label="المحصل" value={money(summary.paid_income)} /><StatCard label="المستحق" value={money(summary.due_income)} /><StatCard label="الصافي" value={money(summary.net_income)} /></View></View> : null}

      {!loading && !error && activeTab === "properties" ? <View>
        <View style={styles.assetsHeaderRow}><TouchableOpacity style={styles.addIconButton} onPress={openAddPrivateProperty} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel="إضافة عقار للمالك"><Ionicons name="add" size={28} color="#fff" /></TouchableOpacity><View style={styles.assetsHeaderText}><Text style={styles.sectionTitle}>العقارات والوحدات</Text><Text style={styles.sectionSubtitle}>القائمة مغلقة افتراضيًا، وافتح عقارًا واحدًا فقط في كل مرة.</Text></View></View>
        <View style={styles.assetSummaryStrip}><View style={styles.assetSummaryItem}><Text style={styles.assetSummaryValue}>{count(properties.length)}</Text><Text style={styles.assetSummaryLabel}>عقارات</Text></View><View style={styles.assetSummaryItem}><Text style={styles.assetSummaryValue}>{count(units.length)}</Text><Text style={styles.assetSummaryLabel}>وحدات</Text></View><View style={styles.assetSummaryItem}><Text style={styles.assetSummaryValue}>{count(directOwnerUnits.length)}</Text><Text style={styles.assetSummaryLabel}>مباشرة</Text></View></View>
        {properties.map((property) => {
          const propertyUnits = property.units?.length ? property.units : unitsByPropertyId.get(String(property.id)) || [];
          const isOpen = openPropertyId === String(property.id);
          return <View key={property.id} style={[styles.propertyCard, isOpen ? styles.propertyCardOpen : null]}>
            <TouchableOpacity style={styles.propertyHeader} activeOpacity={0.9} onPress={() => toggleProperty(property.id)}>
              <View style={[styles.accordionIconBox, isOpen ? styles.accordionIconBoxOpen : null]}><Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={19} color={isOpen ? "#fff" : "#0f766e"} /></View>
              <Text style={styles.propertyType}>{typeText(property.property_type)}</Text>
              <View style={styles.propertyTitleBox}><Text numberOfLines={1} style={styles.propertyTitle}>{property.name || "عقار بدون اسم"}</Text><Text style={styles.propertyMeta}>{[property.district, property.city].filter(Boolean).join("، ") || "لا يوجد موقع مسجل"}</Text></View>
            </TouchableOpacity>
            <View style={styles.miniStatsRow}><Text style={styles.miniPill}>وحدات: {count(propertyUnits.length || property.units_count)}</Text><Text style={styles.miniPill}>مؤجرة: {count(property.rented_units_count)}</Text><Text style={styles.miniPill}>عقود: {count(property.active_contracts_count)}</Text></View>
            {isOpen ? <View style={styles.unitsBox}><TouchableOpacity style={styles.propertyDetailsButton} activeOpacity={0.86} onPress={() => router.push(`/property/${property.id}` as never)}><Ionicons name="open-outline" size={18} color="#fff" /><Text style={styles.propertyDetailsText}>فتح تفاصيل العقار</Text></TouchableOpacity>{propertyUnits.length ? propertyUnits.map((unit) => <TouchableOpacity key={unit.id} style={styles.unitRow} activeOpacity={0.85} onPress={() => router.push(`/unit/${unit.id}` as never)}><Text style={styles.unitStatus}>{statusText(unit.status)}</Text><View style={styles.unitTextBox}><Text numberOfLines={1} style={styles.unitTitle}>{unitName(unit)}</Text><Text style={styles.unitMeta}>الدور: {valueOrDash(unit.floor)} | الإيجار: {money(unit.rent_amount)}</Text></View></TouchableOpacity>) : <EmptyBox text="لا توجد وحدات داخل هذا العقار." />}</View> : null}
          </View>;
        })}
        {directOwnerUnits.length ? <View><Text style={styles.directTitle}>وحدات مباشرة على المالك</Text>{directOwnerUnits.map((unit) => <TouchableOpacity key={unit.id} style={styles.directUnitCard} activeOpacity={0.9} onPress={() => router.push(`/unit/${unit.id}` as never)}><Text style={styles.unitTitle}>{unitName(unit)}</Text><Text style={styles.unitMeta}>الحالة: {statusText(unit.status)} | الإيجار: {money(unit.rent_amount)}</Text></TouchableOpacity>)}</View> : null}
        {!properties.length && !directOwnerUnits.length ? <EmptyBox text="لا توجد عقارات أو وحدات تابعة لهذا المالك." /> : null}
      </View> : null}

      {!loading && !error && activeTab === "contracts" ? <View><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>عقود المالك</Text><Text style={styles.sectionSubtitle}>العقود التابعة لعقارات ووحدات هذا المالك</Text></View>{contracts.length ? contracts.map((contract) => <TouchableOpacity key={contract.id} style={styles.contractCard} activeOpacity={0.9} onPress={() => router.push(`/contract/${contract.id}` as never)}><Text style={styles.contractTitle}>عقد {contract.government_contract_number || contract.contract_number || contract.id}</Text><Text style={styles.contractMeta}>المستأجر: {contract.tenant_name || "-"}</Text><Text style={styles.contractMeta}>{contract.property_name || "عقار"} / وحدة {valueOrDash(contract.unit_number)}</Text><Text style={styles.contractRent}>{money(contract.rent_amount)}</Text></TouchableOpacity>) : <EmptyBox text="لا توجد عقود لهذا المالك." />}</View> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" }, scroll: { flex: 1 }, container: { padding: 12, paddingBottom: 40 }, heroCard: { backgroundColor: "#111827", borderRadius: 22, padding: 14, marginBottom: 12 }, heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, heroTitleWrap: { flex: 1 }, ownerName: { color: "#fff", fontSize: 23, fontWeight: "900", textAlign: "right" }, typeBadge: { color: "#064e3b", backgroundColor: "#d1fae5", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, overflow: "hidden", fontWeight: "900" }, contactGrid: { marginTop: 12, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, gap: 5 }, contactText: { color: "#F7F6F4", textAlign: "right", fontWeight: "800", fontSize: 13 }, tabsWrap: { flexDirection: "row-reverse", backgroundColor: "#deddd8", borderRadius: 18, padding: 4, marginBottom: 12, gap: 3 }, tabButton: { flex: 1, borderRadius: 16, minHeight: 50, alignItems: "center", justifyContent: "center" }, tabButtonActive: { backgroundColor: "#fff" }, tabText: { color: "#6b7280", fontWeight: "900", fontSize: 13 }, tabTextActive: { color: "#111827" }, stateBox: { backgroundColor: "#fff", borderRadius: 18, padding: 18, alignItems: "center", marginBottom: 10 }, stateText: { color: "#6b7280", marginTop: 8, fontWeight: "800" }, errorBox: { backgroundColor: "#fee2e2", borderRadius: 18, padding: 14, marginBottom: 10 }, errorTitle: { color: "#991b1b", fontWeight: "900", textAlign: "right", marginBottom: 5 }, errorText: { color: "#991b1b", textAlign: "right", fontWeight: "700", lineHeight: 22 }, retryButton: { backgroundColor: "#991b1b", borderRadius: 12, padding: 11, alignItems: "center", marginTop: 10 }, retryText: { color: "#fff", fontWeight: "900" }, sectionHeader: { alignItems: "flex-end", marginBottom: 10 }, sectionTitle: { color: "#111827", fontSize: 21, fontWeight: "900", textAlign: "right" }, sectionSubtitle: { color: "#7A766F", fontWeight: "800", textAlign: "right", marginTop: 4, lineHeight: 20 }, assetsHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }, assetsHeaderText: { flex: 1, alignItems: "flex-end" }, addIconButton: { width: 54, height: 54, borderRadius: 22, backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 }, assetSummaryStrip: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 }, assetSummaryItem: { flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#EDECE9" }, assetSummaryValue: { color: "#111827", fontSize: 18, fontWeight: "900" }, assetSummaryLabel: { color: "#7A766F", fontWeight: "800", marginTop: 5 }, statsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }, statCard: { width: "31.8%", backgroundColor: "#fff", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#EDECE9", minHeight: 78, alignItems: "center", justifyContent: "center" }, statValue: { color: "#111827", fontWeight: "900", fontSize: 16, textAlign: "center" }, statLabel: { color: "#7A766F", fontWeight: "800", fontSize: 12, marginTop: 6, textAlign: "center" }, propertyCard: { backgroundColor: "#fff", borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#EDECE9", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 1 }, propertyCardOpen: { borderColor: "#99F6E4" }, propertyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, accordionIconBox: { width: 34, height: 34, borderRadius: 14, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#A7F3D0" }, accordionIconBoxOpen: { backgroundColor: "#0f766e", borderColor: "#0f766e" }, propertyTitleBox: { flex: 1, alignItems: "flex-end" }, propertyTitle: { color: "#111827", fontWeight: "900", fontSize: 17, textAlign: "right" }, propertyMeta: { color: "#6b7280", fontWeight: "800", marginTop: 4, textAlign: "right" }, propertyType: { color: "#0f766e", backgroundColor: "#ecfdf5", borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5, fontWeight: "900" }, miniStatsRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginTop: 12 }, miniPill: { color: "#374151", backgroundColor: "#F3F4F6", borderRadius: 999, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5, fontWeight: "800", fontSize: 12 }, unitsBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 8 }, propertyDetailsButton: { minHeight: 42, borderRadius: 14, backgroundColor: "#111827", alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 7, marginBottom: 8 }, propertyDetailsText: { color: "#fff", fontWeight: "900", fontSize: 12 }, unitRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F8FAFC", borderRadius: 14, padding: 10, marginTop: 7 }, unitTextBox: { flex: 1, alignItems: "flex-end" }, unitTitle: { color: "#111827", fontWeight: "900", textAlign: "right" }, unitMeta: { color: "#6b7280", fontWeight: "800", fontSize: 12, marginTop: 4, textAlign: "right" }, unitStatus: { color: "#0369A1", backgroundColor: "#E0F2FE", borderRadius: 999, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5, fontWeight: "900", fontSize: 11 }, directTitle: { color: "#111827", fontWeight: "900", fontSize: 17, textAlign: "right", marginVertical: 10 }, directUnitCard: { backgroundColor: "#fff", borderRadius: 18, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: "#EDECE9" }, emptyBox: { backgroundColor: "#fff", borderRadius: 18, padding: 18, alignItems: "center", borderWidth: 1, borderColor: "#EDECE9" }, emptyText: { color: "#7A766F", fontWeight: "900", textAlign: "center" }, contractCard: { backgroundColor: "#fff", borderRadius: 18, padding: 14, marginBottom: 9, borderWidth: 1, borderColor: "#EDECE9" }, contractTitle: { color: "#111827", fontWeight: "900", textAlign: "right", fontSize: 16 }, contractMeta: { color: "#6b7280", fontWeight: "800", marginTop: 5, textAlign: "right" }, contractRent: { color: "#0f766e", fontWeight: "900", marginTop: 8, textAlign: "right" },
});