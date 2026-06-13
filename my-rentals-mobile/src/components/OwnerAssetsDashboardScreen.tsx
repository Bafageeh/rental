import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGetScoped } from "../lib/api";

type Owner = { id: number; name?: string | null; phone?: string | null; email?: string | null; national_id?: string | null };
type Summary = { properties_count?: number; units_count?: number; active_contracts_count?: number; paid_income?: number; due_income?: number; overdue_income?: number; net_income?: number };
type Unit = { id: number; property_id?: number | string | null; unit_scope?: string | null; unit_number?: string | null; name?: string | null; floor?: string | number | null; status?: string | null; rent_amount?: number | string | null };
type Property = { id: number; name?: string | null; city?: string | null; district?: string | null; property_type?: string | null; units_count?: number; rented_units_count?: number; active_contracts_count?: number; units?: Unit[] };
type Contract = { id: number; contract_number?: string | null; government_contract_number?: string | null; tenant_name?: string | null; property_name?: string | null; unit_number?: string | null; rent_amount?: number };
type Payment = { id: number; amount?: number | string | null; status?: string | null; due_date?: string | null; tenant_name?: string | null; property_name?: string | null; unit_number?: string | null };
type DashboardData = { owner?: Owner; summary?: Summary; properties?: Property[]; units?: Unit[]; contracts?: Contract[]; overdue_payments?: Payment[] };
type TabKey = "summary" | "properties";

const tabs: Array<{ key: TabKey; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: "properties", label: "العقارات", icon: "office-building-outline" },
  { key: "summary", label: "الملخص", icon: "chart-box-outline" },
];

const propertyTypeLabels: Record<string, string> = { building: "عمارة", apartment: "شقة", villa: "فيلا", land: "أرض", commercial: "تجاري", mixed: "مختلط" };

function goToOwners() {
  router.replace("/owners" as never);
}

function asNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function count(value: unknown) {
  return Math.round(asNumber(value)).toLocaleString("ar-SA");
}

function money(value: unknown) {
  return `${Math.round(asNumber(value)).toLocaleString("ar-SA")} ريال`;
}

function valueOrDash(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "" ? "-" : String(value);
}

function typeText(value?: string | null) {
  return value ? propertyTypeLabels[value] || value : "عقار";
}

function EmptyBox({ text }: { text: string }) {
  return (
    <View style={styles.emptyBox}>
      <MaterialCommunityIcons name="inbox-outline" size={28} color="#94A3B8" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function ContactChip({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: unknown }) {
  return (
    <View style={styles.contactChip}>
      <View style={styles.contactIconBox}><Ionicons name={icon} size={17} color="#0F766E" /></View>
      <View style={styles.contactTextBox}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.contactValue}>{valueOrDash(value)}</Text>
      </View>
    </View>
  );
}

function QuickMetric({ icon, label, value, accent = false, danger = false, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; accent?: boolean; danger?: boolean; onPress?: () => void }) {
  const Box: any = onPress ? TouchableOpacity : View;
  return (
    <Box style={[styles.quickMetric, accent ? styles.quickMetricAccent : null, danger ? styles.quickMetricDanger : null]} activeOpacity={0.88} onPress={onPress}>
      <View style={[styles.metricIconBox, accent ? styles.metricIconAccent : null, danger ? styles.metricIconDanger : null]}>
        <MaterialCommunityIcons name={icon} size={22} color={danger ? "#DC2626" : "#0F766E"} />
      </View>
      <Text style={[styles.metricValue, danger ? styles.metricValueDanger : null]}>{value}</Text>
      <Text style={[styles.metricLabel, danger ? styles.metricLabelDanger : null]}>{label}</Text>
    </Box>
  );
}

function PropertyMetric({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.propertyMetric}>
      <MaterialCommunityIcons name={icon} size={17} color="#0F766E" />
      <Text style={styles.propertyMetricText}>{label}: {value}</Text>
    </View>
  );
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
      setError(e instanceof Error ? e.message : "تعذر تحميل تفاصيل المالك");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(false); }, [ownerId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      goToOwners();
      return true;
    });
    return () => sub.remove();
  }, []);

  const owner = data?.owner;
  const ownerName = owner?.name || "مالك بدون اسم";
  const ownerNameForUrl = encodeURIComponent(ownerName);
  const summary = data?.summary || {};
  const properties = data?.properties || [];
  const units = data?.units || [];
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
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.ownerAvatar}><Ionicons name="person-outline" size={26} color="#0F766E" /></View>
            <View style={styles.profileTitleWrap}>
              <Text numberOfLines={2} style={styles.ownerName}>{ownerName}</Text>
              <Text style={styles.ownerCaption}>حساب مالك</Text>
            </View>
            <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>مالك</Text></View>
          </View>

          <View style={styles.contactGrid}>
            <ContactChip icon="call-outline" label="الجوال" value={owner?.phone} />
            <ContactChip icon="mail-outline" label="البريد" value={owner?.email} />
            <ContactChip icon="id-card-outline" label="الهوية" value={owner?.national_id} />
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickMetric icon="office-building-outline" label="العقارات" value={count(summary.properties_count ?? properties.length)} accent />
          <QuickMetric icon="home-city-outline" label="الوحدات" value={count(summary.units_count ?? units.length)} />
          <QuickMetric icon="file-document-check-outline" label="العقود النشطة" value={count(summary.active_contracts_count)} />
          <QuickMetric icon="cash-alert" label="المتأخر" value={money(summary.overdue_income)} danger={asNumber(summary.overdue_income) > 0} onPress={openOverdueUnits} />
        </View>

        <View style={styles.tabsWrap}>
          {tabs.map((tab) => (
            <TouchableOpacity key={tab.key} style={[styles.tabButton, activeTab === tab.key ? styles.tabButtonActive : null]} onPress={() => setActiveTab(tab.key)} activeOpacity={0.88}>
              <MaterialCommunityIcons name={tab.icon} size={19} color={activeTab === tab.key ? "#0F766E" : "#6B7280"} />
              <Text style={[styles.tabText, activeTab === tab.key ? styles.tabTextActive : null]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? <View style={styles.stateBox}><ActivityIndicator /><Text style={styles.stateText}>جاري تحميل تفاصيل المالك...</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorTitle}>تعذر تحميل تفاصيل المالك</Text><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => load(false)}><Text style={styles.retryText}>إعادة المحاولة</Text></TouchableOpacity></View> : null}

        {!loading && !error && activeTab === "summary" ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>الملخص المالي</Text>
              <Text style={styles.sectionSubtitle}>أرقام سريعة تخص هذا المالك فقط</Text>
            </View>
            <View style={styles.moneyGrid}>
              <QuickMetric icon="cash-check" label="المحصل" value={money(summary.paid_income)} />
              <QuickMetric icon="cash-clock" label="المستحق" value={money(summary.due_income)} />
              <QuickMetric icon="chart-line" label="الصافي" value={money(summary.net_income)} accent />
            </View>
          </View>
        ) : null}

        {!loading && !error && activeTab === "properties" ? (
          <View>
            <View style={styles.sectionRow}>
              <View style={styles.sectionHeaderInline}>
                <Text style={styles.sectionTitle}>عقارات المالك</Text>
                <Text style={styles.sectionSubtitle}>{count(properties.length)} عقار</Text>
              </View>
              <TouchableOpacity style={styles.addPropertyButton} onPress={openAddPrivateProperty} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel="إضافة عقار للمالك">
                <Ionicons name="add" size={22} color="#fff" />
                <Text style={styles.addPropertyButtonText}>إضافة</Text>
              </TouchableOpacity>
            </View>

            {properties.map((property) => {
              const unitCount = Number(property.units_count ?? property.units?.length ?? 0);
              return (
                <TouchableOpacity key={property.id} style={styles.propertyCard} activeOpacity={0.9} onPress={() => router.push(`/property/${property.id}` as never)}>
                  <View style={styles.propertyHeader}>
                    <View style={styles.openHintIcon}><Ionicons name="chevron-back" size={20} color="#0F766E" /></View>
                    <View style={styles.propertyTitleBox}>
                      <View style={styles.propertyTitleRow}>
                        <Text style={styles.propertyType}>{typeText(property.property_type)}</Text>
                        <Text numberOfLines={1} style={styles.propertyTitle}>{property.name || "عقار بدون اسم"}</Text>
                      </View>
                      <View style={styles.locationLine}>
                        <Ionicons name="location-outline" size={13} color="#6B7280" />
                        <Text style={styles.propertyMeta}>{[property.district, property.city].filter(Boolean).join("، ") || "لا يوجد موقع مسجل"}</Text>
                      </View>
                    </View>
                    <View style={styles.propertyTypeIcon}><MaterialCommunityIcons name="office-building-outline" size={22} color="#0F766E" /></View>
                  </View>
                  <View style={styles.propertyMetricsRow}>
                    <PropertyMetric icon="home-outline" label="وحدات" value={count(unitCount)} />
                    <PropertyMetric icon="account-key-outline" label="مؤجرة" value={count(property.rented_units_count)} />
                    <PropertyMetric icon="file-document-outline" label="عقود" value={count(property.active_contracts_count)} />
                  </View>
                </TouchableOpacity>
              );
            })}

            {!properties.length ? <EmptyBox text="لا توجد عقارات تابعة لهذا المالك." /> : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAF8" },
  scroll: { flex: 1 },
  container: { padding: 14, paddingBottom: 44 },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E6EEE9",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  profileTopRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  ownerAvatar: { width: 58, height: 58, borderRadius: 20, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#A7F3D0" },
  profileTitleWrap: { flex: 1, alignItems: "flex-end" },
  ownerName: { color: "#111827", fontSize: 25, fontWeight: "900", textAlign: "right", lineHeight: 32 },
  ownerCaption: { color: "#0F766E", fontWeight: "900", textAlign: "right", marginTop: 3 },
  typeBadge: { backgroundColor: "#D1FAE5", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  typeBadgeText: { color: "#064E3B", fontWeight: "900" },
  contactGrid: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  contactChip: { flex: 1, minHeight: 62, borderRadius: 18, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5E7EB", padding: 8, alignItems: "flex-end", justifyContent: "space-between" },
  contactIconBox: { width: 28, height: 28, borderRadius: 11, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  contactTextBox: { alignItems: "flex-end", width: "100%" },
  contactLabel: { color: "#6B7280", fontWeight: "900", fontSize: 10, textAlign: "right" },
  contactValue: { color: "#111827", fontWeight: "900", fontSize: 11.5, textAlign: "right", marginTop: 2, maxWidth: "100%" },
  quickGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  quickMetric: { width: "48.7%", minHeight: 92, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 11, borderWidth: 1, borderColor: "#E6EEE9", alignItems: "flex-end", justifyContent: "center" },
  quickMetricAccent: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  quickMetricDanger: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  metricIconBox: { width: 36, height: 36, borderRadius: 14, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  metricIconAccent: { backgroundColor: "#D1FAE5" },
  metricIconDanger: { backgroundColor: "#FEE2E2" },
  metricValue: { color: "#111827", fontWeight: "900", fontSize: 18, textAlign: "right" },
  metricValueDanger: { color: "#DC2626" },
  metricLabel: { color: "#6B7280", fontWeight: "900", fontSize: 12, textAlign: "right", marginTop: 4 },
  metricLabelDanger: { color: "#991B1B" },
  tabsWrap: { flexDirection: "row-reverse", backgroundColor: "#E9ECE8", borderRadius: 20, padding: 5, marginBottom: 12, gap: 5 },
  tabButton: { flex: 1, borderRadius: 17, minHeight: 48, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6 },
  tabButtonActive: { backgroundColor: "#fff", shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  tabText: { color: "#6B7280", fontWeight: "900", fontSize: 13 },
  tabTextActive: { color: "#111827" },
  stateBox: { backgroundColor: "#fff", borderRadius: 18, padding: 18, alignItems: "center", marginBottom: 10, borderWidth: 1, borderColor: "#E6EEE9" },
  stateText: { color: "#6B7280", marginTop: 8, fontWeight: "800" },
  errorBox: { backgroundColor: "#FEE2E2", borderRadius: 18, padding: 14, marginBottom: 10 },
  errorTitle: { color: "#991B1B", fontWeight: "900", textAlign: "right", marginBottom: 5 },
  errorText: { color: "#991B1B", textAlign: "right", fontWeight: "700", lineHeight: 22 },
  retryButton: { backgroundColor: "#991B1B", borderRadius: 12, padding: 11, alignItems: "center", marginTop: 10 },
  retryText: { color: "#fff", fontWeight: "900" },
  sectionHeader: { alignItems: "flex-end", marginBottom: 10 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10 },
  sectionHeaderInline: { flex: 1, alignItems: "flex-end" },
  sectionTitle: { color: "#111827", fontSize: 20, fontWeight: "900", textAlign: "right" },
  sectionSubtitle: { color: "#7A766F", fontWeight: "800", textAlign: "right", marginTop: 3, lineHeight: 19 },
  addPropertyButton: { minHeight: 44, borderRadius: 999, backgroundColor: "#0F9B6F", alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 7, paddingHorizontal: 18, shadowColor: "#0F766E", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  addPropertyButtonText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  moneyGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  propertyCard: { backgroundColor: "#fff", borderRadius: 24, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: "#E6EEE9", shadowColor: "#0F172A", shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  propertyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  openHintIcon: { width: 40, height: 40, borderRadius: 16, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#A7F3D0" },
  propertyTypeIcon: { width: 43, height: 43, borderRadius: 17, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  propertyTitleBox: { flex: 1, alignItems: "flex-end", minWidth: 0 },
  propertyTitleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, maxWidth: "100%" },
  propertyTitle: { color: "#111827", fontWeight: "900", fontSize: 18, textAlign: "right", flexShrink: 1 },
  locationLine: { flexDirection: "row-reverse", alignItems: "center", gap: 3, marginTop: 5 },
  propertyMeta: { color: "#6B7280", fontWeight: "800", textAlign: "right", fontSize: 12 },
  propertyType: { color: "#0F766E", backgroundColor: "#ECFDF5", borderRadius: 999, overflow: "hidden", paddingHorizontal: 11, paddingVertical: 6, fontWeight: "900", fontSize: 12 },
  propertyMetricsRow: { flexDirection: "row-reverse", gap: 7, marginTop: 12 },
  propertyMetric: { flex: 1, minHeight: 42, borderRadius: 15, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#FBFCFC", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 6 },
  propertyMetricText: { color: "#475569", fontWeight: "900", fontSize: 11.5, textAlign: "center" },
  emptyBox: { backgroundColor: "#fff", borderRadius: 18, padding: 18, alignItems: "center", borderWidth: 1, borderColor: "#E7E9EA" },
  emptyText: { color: "#7A766F", fontWeight: "900", textAlign: "center", marginTop: 7 },
});