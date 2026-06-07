import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGetScoped } from "../lib/api";

type Owner = { id: number; name?: string | null; phone?: string | null; email?: string | null; national_id?: string | null };
type Summary = { properties_count?: number; units_count?: number; active_contracts_count?: number; paid_income?: number; due_income?: number; overdue_income?: number; net_income?: number };
type Unit = { id: number; property_id?: number | string | null; unit_scope?: string | null; unit_number?: string | null; name?: string | null; floor?: string | number | null; status?: string | null; rent_amount?: number | string | null };
type Property = { id: number; name?: string | null; city?: string | null; district?: string | null; property_type?: string | null; units_count?: number; rented_units_count?: number; active_contracts_count?: number; units?: Unit[] };
type Contract = { id: number; contract_number?: string | null; government_contract_number?: string | null; tenant_name?: string | null; property_name?: string | null; unit_number?: string | null; rent_amount?: number };
type Payment = { id: number; amount?: number | string | null; status?: string | null; due_date?: string | null; tenant_name?: string | null; property_name?: string | null; unit_number?: string | null };
type DashboardData = { owner?: Owner; summary?: Summary; properties?: Property[]; units?: Unit[]; contracts?: Contract[]; overdue_payments?: Payment[] };
type TabKey = "summary" | "properties" | "contracts";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "summary", label: "الملخص" },
  { key: "properties", label: "العقارات" },
  { key: "contracts", label: "العقود" },
];
const propertyTypeLabels: Record<string, string> = { building: "عمارة", apartment: "شقة", villa: "فيلا", land: "أرض", commercial: "تجاري", mixed: "مختلط" };

function asNumber(value: unknown) { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; }
function count(value: unknown) { return Math.round(asNumber(value)).toLocaleString("ar-SA"); }
function money(value: unknown) { return `${Math.round(asNumber(value)).toLocaleString("ar-SA")} ريال`; }
function valueOrDash(value: unknown) { return value === null || value === undefined || String(value).trim() === "" ? "-" : String(value); }
function typeText(value?: string | null) { return value ? propertyTypeLabels[value] || value : "عقار"; }

function EmptyBox({ text }: { text: string }) {
  return <View style={styles.emptyBox}><MaterialCommunityIcons name="inbox-outline" size={26} color="#94A3B8" /><Text style={styles.emptyText}>{text}</Text></View>;
}

function InfoItem({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: unknown }) {
  return <View style={styles.infoItem}><View style={styles.infoIconBox}><Ionicons name={icon} size={17} color="#D9FBEF" /></View><View style={styles.infoTextBox}><Text style={styles.infoLabel}>{label}</Text><Text numberOfLines={1} style={styles.infoValue}>{valueOrDash(value)}</Text></View></View>;
}

function SummaryCard({ icon, label, value, danger = false, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; danger?: boolean; onPress?: () => void }) {
  const Card: any = onPress ? TouchableOpacity : View;
  return <Card style={[styles.summaryCard, danger ? styles.summaryCardDanger : null]} activeOpacity={0.88} onPress={onPress}><View style={[styles.summaryIconBox, danger ? styles.summaryIconDanger : null]}><MaterialCommunityIcons name={icon} size={23} color={danger ? "#DC2626" : "#0F766E"} /></View><View style={styles.summaryTextBox}><Text style={[styles.summaryLabel, danger ? styles.summaryLabelDanger : null]}>{label}</Text><Text style={[styles.summaryValue, danger ? styles.summaryValueDanger : null]}>{value}</Text>{onPress ? <Text style={styles.summaryHint}>اضغط للعرض</Text> : null}</View></Card>;
}

function StatCard({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  return <View style={styles.statCard}><View style={styles.statIconBox}><MaterialCommunityIcons name={icon} size={24} color="#0F766E" /></View><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function PropertyMetric({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  return <View style={styles.propertyMetric}><MaterialCommunityIcons name={icon} size={19} color="#64748B" /><Text style={styles.propertyMetricText}>{label}: {value}</Text></View>;
}

export default function OwnerAssetsDashboardScreen({ id }: { id: string | number }) {
  const ownerId = String(id || "");
  const [activeTab, setActiveTab] = useState<TabKey>("properties");
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
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(false); }, [ownerId]);

  const owner = data?.owner;
  const ownerName = owner?.name || "مالك بدون اسم";
  const ownerNameForUrl = encodeURIComponent(ownerName);
  const summary = data?.summary || {};
  const properties = data?.properties || [];
  const units = data?.units || [];
  const contracts = data?.contracts || [];
  const ownerReturnTo = encodeURIComponent(`/owner/${ownerId}`);

  function openManualProperty() {
    router.push(`/property-form?owner_id=${encodeURIComponent(ownerId)}&owner_name=${ownerNameForUrl}&management_type=owned&owner_private=1&return_to=${ownerReturnTo}` as never);
  }
  function openPdfProperty() {
    router.push(`/upload-property-deed?owner_id=${encodeURIComponent(ownerId)}&owner_name=${ownerNameForUrl}&management_type=owned&owner_private=1&return_to=${ownerReturnTo}` as never);
  }
  function openAddPrivateProperty() {
    Alert.alert("إضافة عقار", "اختر طريقة إضافة العقار لهذا المالك كأملاك خاصة:", [
      { text: "رفع ملف PDF", onPress: openPdfProperty },
      { text: "إدخال يدوي", onPress: openManualProperty },
      { text: "إلغاء", style: "cancel" },
    ]);
  }
  function openOverdueUnits() {
    router.push(`/owner-overdue-units?owner_id=${encodeURIComponent(ownerId)}&owner_name=${ownerNameForUrl}` as never);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0F766E" />} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroDecor} />
          <View style={styles.heroTopRow}>
            <View style={styles.ownerAvatar}><Ionicons name="person-outline" size={30} color="#0F766E" /></View>
            <View style={styles.heroTitleWrap}><Text numberOfLines={2} style={styles.ownerName}>{ownerName}</Text><Text style={styles.ownerCaption}>حساب مالك</Text></View>
            <Text style={styles.typeBadge}>مالك</Text>
          </View>
          <View style={styles.infoGrid}>
            <InfoItem icon="call-outline" label="الجوال" value={owner?.phone} />
            <InfoItem icon="mail-outline" label="البريد الإلكتروني" value={owner?.email} />
            <InfoItem icon="id-card-outline" label="الهوية / السجل" value={owner?.national_id} />
          </View>
        </View>

        <View style={styles.tabsWrap}>{tabs.map((tab) => <TouchableOpacity key={tab.key} style={[styles.tabButton, activeTab === tab.key ? styles.tabButtonActive : null]} onPress={() => setActiveTab(tab.key)} activeOpacity={0.88}><Text style={[styles.tabText, activeTab === tab.key ? styles.tabTextActive : null]}>{tab.label}</Text></TouchableOpacity>)}</View>

        {loading ? <View style={styles.stateBox}><ActivityIndicator /><Text style={styles.stateText}>جاري تحميل تفاصيل الأملاك...</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorTitle}>تعذر تحميل تفاصيل الأملاك</Text><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => load(false)}><Text style={styles.retryText}>إعادة المحاولة</Text></TouchableOpacity></View> : null}

        {!loading && !error && activeTab === "summary" ? <View><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>ملخص المالك</Text><Text style={styles.sectionSubtitle}>إحصائيات خاصة بأملاك هذا المالك فقط</Text></View><View style={styles.statsGrid}><StatCard icon="office-building" label="العقارات" value={count(summary.properties_count ?? properties.length)} /><StatCard icon="home-city-outline" label="الوحدات" value={count(summary.units_count ?? units.length)} /><StatCard icon="file-document-check-outline" label="العقود النشطة" value={count(summary.active_contracts_count)} /><SummaryCard icon="cash-check" label="المحصل" value={money(summary.paid_income)} /><SummaryCard icon="cash-clock" label="المستحق" value={money(summary.due_income)} /><SummaryCard icon="cash-alert" label="الدفعات المتأخرة" value={money(summary.overdue_income)} danger={asNumber(summary.overdue_income) > 0} onPress={openOverdueUnits} /><SummaryCard icon="chart-line" label="الصافي" value={money(summary.net_income)} /></View></View> : null}

        {!loading && !error && activeTab === "properties" ? <View>
          <TouchableOpacity style={styles.addPropertyButton} onPress={openAddPrivateProperty} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel="إضافة عقار للمالك">
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.addPropertyButtonText}>إضافة عقار</Text>
          </TouchableOpacity>

          {properties.map((property) => {
            const unitCount = Number(property.units_count ?? property.units?.length ?? 0);
            return <TouchableOpacity key={property.id} style={styles.propertyCard} activeOpacity={0.9} onPress={() => router.push(`/property/${property.id}` as never)}>
              <View style={styles.propertyHeader}>
                <View style={styles.openHintIcon}><Ionicons name="chevron-back" size={20} color="#0F766E" /></View>
                <View style={styles.propertyTypeIcon}><MaterialCommunityIcons name="office-building-outline" size={22} color="#0F766E" /></View>
                <View style={styles.propertyTitleBox}><Text numberOfLines={1} style={styles.propertyTitle}>{property.name || "عقار بدون اسم"}</Text><View style={styles.locationLine}><Ionicons name="location-outline" size={13} color="#6B7280" /><Text style={styles.propertyMeta}>{[property.district, property.city].filter(Boolean).join("، ") || "لا يوجد موقع مسجل"}</Text></View><Text style={styles.tapHint}>اضغط على البطاقة لفتح التفاصيل</Text></View>
                <Text style={styles.propertyType}>{typeText(property.property_type)}</Text>
              </View>
              <View style={styles.propertyMetricsRow}>
                <PropertyMetric icon="home-outline" label="وحدات" value={count(unitCount)} />
                <PropertyMetric icon="account-key-outline" label="مؤجرة" value={count(property.rented_units_count)} />
                <PropertyMetric icon="file-document-outline" label="عقود" value={count(property.active_contracts_count)} />
              </View>
            </TouchableOpacity>;
          })}

          {!properties.length ? <EmptyBox text="لا توجد عقارات تابعة لهذا المالك." /> : null}
        </View> : null}

        {!loading && !error && activeTab === "contracts" ? <View><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>عقود المالك</Text><Text style={styles.sectionSubtitle}>العقود التابعة لعقارات ووحدات هذا المالك</Text></View>{contracts.length ? contracts.map((contract) => <TouchableOpacity key={contract.id} style={styles.contractCard} activeOpacity={0.9} onPress={() => router.push(`/contract/${contract.id}` as never)}><Text style={styles.contractTitle}>عقد {contract.government_contract_number || contract.contract_number || contract.id}</Text><Text style={styles.contractMeta}>المستأجر: {contract.tenant_name || "-"}</Text><Text style={styles.contractMeta}>{contract.property_name || "عقار"} / وحدة {valueOrDash(contract.unit_number)}</Text><Text style={styles.contractRent}>{money(contract.rent_amount)}</Text></TouchableOpacity>) : <EmptyBox text="لا توجد عقود لهذا المالك." />}</View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8F6" },
  scroll: { flex: 1 },
  container: { padding: 14, paddingBottom: 44 },
  heroCard: { backgroundColor: "#0B1220", borderRadius: 25, padding: 14, marginBottom: 12, overflow: "hidden", borderWidth: 1, borderColor: "#172033" },
  heroDecor: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(15,118,110,0.16)", left: -80, bottom: -90 },
  heroTopRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  ownerAvatar: { width: 58, height: 58, borderRadius: 20, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  heroTitleWrap: { flex: 1, alignItems: "flex-end" },
  ownerName: { color: "#fff", fontSize: 25, fontWeight: "900", textAlign: "right", lineHeight: 34 },
  ownerCaption: { color: "#5EEAD4", fontWeight: "900", textAlign: "right", marginTop: 3 },
  typeBadge: { color: "#064E3B", backgroundColor: "#D1FAE5", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  infoGrid: { flexDirection: "row-reverse", gap: 7, marginTop: 16 },
  infoItem: { flex: 1, minHeight: 62, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", padding: 8, alignItems: "flex-end", justifyContent: "space-between" },
  infoIconBox: { width: 30, height: 30, borderRadius: 11, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  infoTextBox: { alignItems: "flex-end", width: "100%" },
  infoLabel: { color: "#CBD5E1", fontWeight: "800", fontSize: 10, textAlign: "right" },
  infoValue: { color: "#fff", fontWeight: "900", fontSize: 11.5, textAlign: "right", marginTop: 2, maxWidth: "100%" },
  tabsWrap: { flexDirection: "row-reverse", backgroundColor: "#E7E5E0", borderRadius: 20, padding: 5, marginBottom: 14, gap: 4 },
  tabButton: { flex: 1, borderRadius: 17, minHeight: 50, alignItems: "center", justifyContent: "center" },
  tabButtonActive: { backgroundColor: "#fff", shadowColor: "#0F172A", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  tabText: { color: "#6B7280", fontWeight: "900", fontSize: 13 },
  tabTextActive: { color: "#111827" },
  stateBox: { backgroundColor: "#fff", borderRadius: 18, padding: 18, alignItems: "center", marginBottom: 10 },
  stateText: { color: "#6B7280", marginTop: 8, fontWeight: "800" },
  errorBox: { backgroundColor: "#FEE2E2", borderRadius: 18, padding: 14, marginBottom: 10 },
  errorTitle: { color: "#991B1B", fontWeight: "900", textAlign: "right", marginBottom: 5 },
  errorText: { color: "#991B1B", textAlign: "right", fontWeight: "700", lineHeight: 22 },
  retryButton: { backgroundColor: "#991B1B", borderRadius: 12, padding: 11, alignItems: "center", marginTop: 10 },
  retryText: { color: "#fff", fontWeight: "900" },
  sectionHeader: { alignItems: "flex-end", marginBottom: 10 },
  sectionTitle: { color: "#111827", fontSize: 23, fontWeight: "900", textAlign: "right" },
  sectionSubtitle: { color: "#7A766F", fontWeight: "800", textAlign: "right", marginTop: 4, lineHeight: 20 },
  addPropertyButton: { minHeight: 56, width: "100%", borderRadius: 18, backgroundColor: "#0F766E", alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 8, marginBottom: 12, shadowColor: "#0F172A", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  addPropertyButtonText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  statsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  statCard: { flex: 1, minWidth: "30%", backgroundColor: "#fff", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "#E7E9EA", minHeight: 94, alignItems: "center", justifyContent: "center", shadowColor: "#0F172A", shadowOpacity: 0.035, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  statIconBox: { width: 43, height: 43, borderRadius: 16, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: 7 },
  statValue: { color: "#111827", fontWeight: "900", fontSize: 21, textAlign: "center" },
  statLabel: { color: "#7A766F", fontWeight: "800", fontSize: 12, marginTop: 5, textAlign: "center" },
  summaryCard: { width: "48.6%", backgroundColor: "#fff", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "#E7E9EA", minHeight: 78, flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  summaryCardDanger: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  summaryIconBox: { width: 43, height: 43, borderRadius: 16, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  summaryIconDanger: { backgroundColor: "#FEE2E2" },
  summaryTextBox: { flex: 1, alignItems: "flex-end" },
  summaryLabel: { color: "#7A766F", fontWeight: "800", fontSize: 12 },
  summaryLabelDanger: { color: "#991B1B" },
  summaryValue: { color: "#111827", fontWeight: "900", fontSize: 15, marginTop: 4, textAlign: "right" },
  summaryValueDanger: { color: "#DC2626" },
  summaryHint: { color: "#DC2626", fontWeight: "900", fontSize: 10, marginTop: 4, textAlign: "right" },
  propertyCard: { backgroundColor: "#fff", borderRadius: 24, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#E7E9EA", shadowColor: "#0F172A", shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  propertyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  openHintIcon: { width: 43, height: 43, borderRadius: 17, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#A7F3D0" },
  propertyTypeIcon: { width: 43, height: 43, borderRadius: 17, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  propertyTitleBox: { flex: 1, alignItems: "flex-end", minWidth: 0 },
  propertyTitle: { color: "#111827", fontWeight: "900", fontSize: 19, textAlign: "right" },
  locationLine: { flexDirection: "row-reverse", alignItems: "center", gap: 3, marginTop: 5 },
  propertyMeta: { color: "#6B7280", fontWeight: "800", textAlign: "right", fontSize: 12 },
  tapHint: { color: "#0F766E", fontWeight: "900", textAlign: "right", fontSize: 11, marginTop: 6 },
  propertyType: { color: "#0F766E", backgroundColor: "#ECFDF5", borderRadius: 999, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 7, fontWeight: "900", fontSize: 12 },
  propertyMetricsRow: { flexDirection: "row-reverse", gap: 7, marginTop: 14 },
  propertyMetric: { flex: 1, minHeight: 45, borderRadius: 15, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#FBFCFC", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 6 },
  propertyMetricText: { color: "#475569", fontWeight: "900", fontSize: 11.5, textAlign: "center" },
  emptyBox: { backgroundColor: "#fff", borderRadius: 18, padding: 18, alignItems: "center", borderWidth: 1, borderColor: "#E7E9EA" },
  emptyText: { color: "#7A766F", fontWeight: "900", textAlign: "center", marginTop: 7 },
  contractCard: { backgroundColor: "#fff", borderRadius: 18, padding: 14, marginBottom: 9, borderWidth: 1, borderColor: "#E7E9EA" },
  contractTitle: { color: "#111827", fontWeight: "900", textAlign: "right", fontSize: 16 },
  contractMeta: { color: "#6B7280", fontWeight: "800", marginTop: 5, textAlign: "right" },
  contractRent: { color: "#0F766E", fontWeight: "900", marginTop: 8, textAlign: "right" },
});
