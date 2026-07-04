import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGetScoped } from "../lib/api";

type Owner = { id: number; name?: string | null; phone?: string | null; email?: string | null; national_id?: string | null };
type Property = { id: number; name?: string | null; city?: string | null; district?: string | null; property_type?: string | null; units_count?: number; rented_units_count?: number; active_contracts_count?: number };
type DashboardData = { owner?: Owner; summary?: any; properties?: Property[]; units?: any[] };
type TabKey = "properties" | "summary";

const typeLabels: Record<string, string> = { building: "عمارة", apartment: "شقة", villa: "فيلا", land: "أرض", commercial: "تجاري", mixed: "مختلط" };

function n(v: unknown) { const x = Number(v ?? 0); return Number.isFinite(x) ? x : 0; }
function count(v: unknown) { return Math.round(n(v)).toLocaleString("ar-SA"); }
function money(v: unknown) { return `${Math.round(n(v)).toLocaleString("ar-SA")} ريال`; }
function dash(v: unknown) { const t = String(v ?? "").trim(); return t || "-"; }
function short(v: unknown, max = 15) { const t = dash(v); return t.length > max ? t.slice(0, max) : t; }
function goOwners() { router.replace("/owners" as never); }

function Contact({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: unknown }) {
  return (
    <View style={styles.contact}>
      <Ionicons name={icon} size={15} color="#0F766E" />
      <Text style={styles.contactLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.contactValue}>{short(value, label === "البريد" ? 14 : 18)}</Text>
    </View>
  );
}

function Metric({ icon, label, value, green, danger, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; green?: boolean; danger?: boolean; onPress?: () => void }) {
  const Box: any = onPress ? TouchableOpacity : View;
  return (
    <Box onPress={onPress} activeOpacity={0.86} style={[styles.metric, green && styles.metricGreen, danger && styles.metricDanger]}>
      <View style={[styles.metricIcon, danger && styles.metricIconDanger]}>
        <MaterialCommunityIcons name={icon} size={17} color={danger ? "#DC2626" : "#0F766E"} />
      </View>
      <Text numberOfLines={1} style={[styles.metricValue, danger && styles.metricValueDanger]}>{value}</Text>
      <Text numberOfLines={1} style={[styles.metricLabel, danger && styles.metricLabelDanger]}>{label}</Text>
    </Box>
  );
}

function PropertyMini({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.propertyMini}>
      <MaterialCommunityIcons name={icon} size={15} color="#0F766E" />
      <Text style={styles.propertyMiniText}>{label}: {value}</Text>
    </View>
  );
}

function AddChoiceCard({ icon, title, subtitle, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.choiceCard} activeOpacity={0.88} onPress={onPress}>
      <Ionicons name="chevron-back" size={24} color="#475569" />
      <View style={styles.choiceTextBox}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.choiceIconOuter}>
        <View style={styles.choiceIconInner}>
          <Ionicons name={icon} size={34} color="#0F9B6F" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function OwnerAssetsDashboardCompactScreen({ id }: { id: string | number }) {
  const ownerId = String(id || "");
  const [tab, setTab] = useState<TabKey>("properties");
  const [menu, setMenu] = useState(false);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      setError("");
      const res = await apiGetScoped(`/owners/${ownerId}/dashboard`, `/my/owners/${ownerId}/dashboard`);
      setData((res?.data ?? res) as DashboardData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل تفاصيل المالك");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(false); }, [ownerId]);
  useEffect(() => {
    const s = BackHandler.addEventListener("hardwareBackPress", () => {
      if (addSheetVisible) {
        setAddSheetVisible(false);
        return true;
      }
      goOwners();
      return true;
    });
    return () => s.remove();
  }, [addSheetVisible]);

  const owner = data?.owner;
  const ownerName = owner?.name || "مالك بدون اسم";
  const ownerNameUrl = encodeURIComponent(ownerName);
  const summary = data?.summary || {};
  const properties = data?.properties || [];
  const units = data?.units || [];
  const overdue = n(summary.overdue_income);
  const returnTo = encodeURIComponent(`/owner/${ownerId}`);

  function ownerAccount() { setMenu(false); router.push(`/owner-account-statement?owner_id=${ownerId}&owner_name=${ownerNameUrl}` as never); }
  function ownerEdit() { setMenu(false); router.push(`/edit-record?resource=owners&id=${ownerId}` as never); }
  function ownerDetails() { setMenu(false); setTab("summary"); }
  function ownerDelete() { setMenu(false); Alert.alert("حذف المالك", "للحذف النهائي افتح شاشة الملاك واستخدم نفس قائمة الحذف حتى تظهر رسالة التأكيد كاملة.", [{ text: "إلغاء", style: "cancel" }, { text: "فتح الملاك", onPress: goOwners }]); }
  function addManual() { setAddSheetVisible(false); router.push(`/property-form?owner_id=${ownerId}&owner_name=${ownerNameUrl}&management_type=owned&owner_private=1&return_to=${returnTo}` as never); }
  function addPdf() { setAddSheetVisible(false); router.push(`/upload-property-deed?owner_id=${ownerId}&owner_name=${ownerNameUrl}&management_type=owned&owner_private=1&return_to=${returnTo}` as never); }
  function addProperty() { setMenu(false); setAddSheetVisible(true); }
  function overdueUnits() { setMenu(false); router.push(`/owner-overdue-units?owner_id=${ownerId}&owner_name=${ownerNameUrl}` as never); }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0F766E" />}>
        <View style={styles.profile}>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.action} onPress={() => setMenu(v => !v)}><Ionicons name="ellipsis-vertical" size={19} color="#111827" /></TouchableOpacity>
            <TouchableOpacity style={[styles.action, styles.wallet]} onPress={ownerAccount}><Ionicons name="wallet-outline" size={20} color="#0F766E" /></TouchableOpacity>
          </View>
          {menu ? <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItem} onPress={ownerDetails}><Ionicons name="eye-outline" size={18} color="#0F766E" /><Text style={styles.menuText}>تفاصيل</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={ownerAccount}><Ionicons name="wallet-outline" size={18} color="#0F766E" /><Text style={styles.menuText}>حساب المالك</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={ownerEdit}><Ionicons name="create-outline" size={18} color="#0F766E" /><Text style={styles.menuText}>تعديل</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={ownerDelete}><Ionicons name="trash-outline" size={18} color="#DC2626" /><Text style={[styles.menuText, styles.dangerText]}>حذف</Text></TouchableOpacity>
          </View> : null}
          <View style={styles.profileRow}>
            <View style={styles.avatar}><Ionicons name="person-outline" size={24} color="#0F766E" /></View>
            <View style={styles.nameBox}><Text numberOfLines={2} style={styles.name}>{ownerName}</Text><Text style={styles.caption}>حساب مالك</Text></View>
            <View style={styles.badge}><Text style={styles.badgeText}>مالك</Text></View>
          </View>
          <View style={styles.contacts}>
            <Contact icon="call-outline" label="الجوال" value={owner?.phone} />
            <Contact icon="mail-outline" label="البريد" value={owner?.email} />
            <Contact icon="id-card-outline" label="الهوية" value={owner?.national_id} />
          </View>
        </View>

        <View style={styles.metrics}>
          <Metric icon="office-building-outline" label="العقارات" value={count(summary.properties_count ?? properties.length)} green />
          <Metric icon="home-city-outline" label="الوحدات" value={count(summary.units_count ?? units.length)} />
          <Metric icon="file-document-check-outline" label="العقود" value={count(summary.active_contracts_count)} />
          <Metric icon="cash-alert" label="المتأخر" value={overdue > 0 ? money(overdue) : "٠ ريال"} danger={overdue > 0} onPress={overdueUnits} />
        </View>

        <View style={styles.tabs}>{[{ key: "properties", label: "العقارات", icon: "office-building-outline" }, { key: "summary", label: "الملخص", icon: "chart-box-outline" }].map((t: any) => <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => { setMenu(false); setTab(t.key); }}><MaterialCommunityIcons name={t.icon} size={18} color={tab === t.key ? "#0F766E" : "#6B7280"} /><Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text></TouchableOpacity>)}</View>

        {loading ? <View style={styles.state}><ActivityIndicator /><Text style={styles.stateText}>جاري التحميل...</Text></View> : null}
        {error ? <View style={styles.error}><Text style={styles.errorTitle}>تعذر التحميل</Text><Text style={styles.errorText}>{error}</Text></View> : null}

        {!loading && !error && tab === "summary" ? <View><Text style={styles.sectionTitle}>الملخص المالي</Text><View style={styles.moneyGrid}><Metric icon="cash-check" label="المحصل" value={money(summary.paid_income)} /><Metric icon="cash-clock" label="المستحق" value={money(summary.due_income)} /><Metric icon="chart-line" label="الصافي" value={money(summary.net_income)} green /></View></View> : null}

        {!loading && !error && tab === "properties" ? <View>
          <View style={styles.sectionRow}>
            <View><Text style={styles.sectionTitle}>عقارات المالك</Text><Text style={styles.sectionSub}>{count(properties.length)} عقار</Text></View>
            <TouchableOpacity style={styles.addBtn} onPress={addProperty}><Ionicons name="add" size={20} color="#fff" /><Text style={styles.addText}>إضافة</Text></TouchableOpacity>
          </View>
          {properties.map((p) => <TouchableOpacity key={p.id} style={styles.propertyCard} activeOpacity={0.9} onPress={() => router.push(`/property/${p.id}` as never)}>
            <View style={styles.propertyHead}>
              <View style={styles.openIcon}><Ionicons name="chevron-back" size={18} color="#0F766E" /></View>
              <View style={styles.propertyTitleBox}>
                <View style={styles.propertyTitleRow}><Text style={styles.type}>{typeLabels[p.property_type || ""] || p.property_type || "عقار"}</Text><Text numberOfLines={1} style={styles.propertyTitle}>{p.name || "عقار بدون اسم"}</Text></View>
                <View style={styles.location}><Ionicons name="location-outline" size={13} color="#6B7280" /><Text style={styles.locationText}>{[p.district, p.city].filter(Boolean).join("، ") || "لا يوجد موقع مسجل"}</Text></View>
              </View>
              <View style={styles.buildingIcon}><MaterialCommunityIcons name="office-building-outline" size={20} color="#0F766E" /></View>
            </View>
            <View style={styles.propertyMetrics}>
              <PropertyMini icon="home-outline" label="وحدات" value={count(p.units_count)} />
              <PropertyMini icon="account-key-outline" label="مؤجرة" value={count(p.rented_units_count)} />
              <PropertyMini icon="file-document-outline" label="عقود" value={count(p.active_contracts_count)} />
            </View>
          </TouchableOpacity>)}
          {!properties.length ? <View style={styles.empty}><Text style={styles.emptyText}>لا توجد عقارات تابعة لهذا المالك.</Text></View> : null}
        </View> : null}
      </ScrollView>

      <Modal visible={addSheetVisible} transparent animationType="fade" onRequestClose={() => setAddSheetVisible(false)}>
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setAddSheetVisible(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <View style={styles.sparkle}><Ionicons name="sparkles" size={27} color="#0F9B6F" /></View>
              <View style={styles.sheetTitleBox}>
                <Text style={styles.sheetTitle}>إضافة عقار جديد</Text>
                <Text style={styles.sheetSub}>اختر طريقة الإضافة الأنسب</Text>
              </View>
            </View>
            <AddChoiceCard icon="cloud-upload-outline" title="رفع ملف PDF" subtitle="استيراد بيانات العقار من ملف أو عقد" onPress={addPdf} />
            <AddChoiceCard icon="create-outline" title="إدخال يدوي" subtitle="إضافة بيانات العقار خطوة بخطوة" onPress={addManual} />
            <TouchableOpacity style={styles.cancelChoice} activeOpacity={0.82} onPress={() => setAddSheetVisible(false)}>
              <Text style={styles.cancelChoiceText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAF8" }, scroll: { flex: 1 }, container: { padding: 10, paddingTop: 4, paddingBottom: 32 },
  profile: { backgroundColor: "#fff", borderRadius: 24, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#E6EEE9", shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2, zIndex: 20 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 6, alignSelf: "flex-start" }, action: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" }, wallet: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  menu: { position: "absolute", top: 54, left: 12, width: 196, backgroundColor: "#fff", borderRadius: 22, padding: 8, borderWidth: 1, borderColor: "#E5E7EB", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8, zIndex: 100 }, menuItem: { minHeight: 48, borderRadius: 15, paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }, menuText: { fontSize: 16, fontWeight: "900", color: "#111827" }, dangerText: { color: "#DC2626" },
  profileRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 }, avatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#A7F3D0" }, nameBox: { flex: 1, alignItems: "flex-end" }, name: { color: "#111827", fontSize: 23, fontWeight: "900", textAlign: "right", lineHeight: 29 }, caption: { color: "#0F766E", fontWeight: "900", textAlign: "right", marginTop: 2, fontSize: 13 }, badge: { backgroundColor: "#D1FAE5", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }, badgeText: { color: "#064E3B", fontWeight: "900", fontSize: 12 },
  contacts: { flexDirection: "row-reverse", gap: 6, marginTop: 9 }, contact: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5E7EB", padding: 7, alignItems: "flex-end", justifyContent: "space-between" }, contactLabel: { color: "#6B7280", fontWeight: "900", fontSize: 10, textAlign: "right" }, contactValue: { color: "#111827", fontWeight: "900", fontSize: 11, textAlign: "right", maxWidth: "100%" }, contactTextBox: { alignItems: "flex-end", width: "100%" },
  metrics: { flexDirection: "row-reverse", gap: 6, marginBottom: 8 }, metric: { flex: 1, minHeight: 70, backgroundColor: "#fff", borderRadius: 18, padding: 8, borderWidth: 1, borderColor: "#E6EEE9", alignItems: "flex-end", justifyContent: "center" }, metricGreen: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }, metricDanger: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }, metricIcon: { width: 28, height: 28, borderRadius: 12, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: 3 }, metricIconDanger: { backgroundColor: "#FEE2E2" }, metricValue: { color: "#111827", fontWeight: "900", fontSize: 15, textAlign: "right", maxWidth: "100%" }, metricValueDanger: { color: "#DC2626" }, metricLabel: { color: "#6B7280", fontWeight: "900", fontSize: 10, textAlign: "right", marginTop: 2 }, metricLabelDanger: { color: "#991B1B" },
  tabs: { flexDirection: "row-reverse", backgroundColor: "#E9ECE8", borderRadius: 18, padding: 4, marginBottom: 9, gap: 4 }, tab: { flex: 1, borderRadius: 15, minHeight: 43, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6 }, tabActive: { backgroundColor: "#fff", shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, tabText: { color: "#6B7280", fontWeight: "900", fontSize: 13 }, tabTextActive: { color: "#111827" },
  state: { backgroundColor: "#fff", borderRadius: 18, padding: 14, alignItems: "center", marginBottom: 8, borderWidth: 1, borderColor: "#E6EEE9" }, stateText: { color: "#6B7280", marginTop: 8, fontWeight: "800" }, error: { backgroundColor: "#FEE2E2", borderRadius: 18, padding: 14, marginBottom: 8 }, errorTitle: { color: "#991B1B", fontWeight: "900", textAlign: "right", marginBottom: 5 }, errorText: { color: "#991B1B", textAlign: "right", fontWeight: "700", lineHeight: 22 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }, sectionTitle: { color: "#111827", fontSize: 20, fontWeight: "900", textAlign: "right" }, sectionSub: { color: "#7A766F", fontWeight: "800", textAlign: "right", marginTop: 2 }, addBtn: { minHeight: 42, borderRadius: 999, backgroundColor: "#0F9B6F", alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6, paddingHorizontal: 16, elevation: 2 }, addText: { color: "#fff", fontWeight: "900", fontSize: 14 }, moneyGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  propertyCard: { backgroundColor: "#fff", borderRadius: 22, padding: 12, marginBottom: 9, borderWidth: 1, borderColor: "#E6EEE9", shadowColor: "#0F172A", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, propertyHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, openIcon: { width: 36, height: 36, borderRadius: 15, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#A7F3D0" }, buildingIcon: { width: 38, height: 38, borderRadius: 16, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" }, propertyTitleBox: { flex: 1, alignItems: "flex-end", minWidth: 0 }, propertyTitleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 7, maxWidth: "100%" }, propertyTitle: { color: "#111827", fontWeight: "900", fontSize: 17, textAlign: "right", flexShrink: 1 }, location: { flexDirection: "row-reverse", alignItems: "center", gap: 3, marginTop: 4 }, locationText: { color: "#6B7280", fontWeight: "800", textAlign: "right", fontSize: 12 }, type: { color: "#0F766E", backgroundColor: "#ECFDF5", borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5, fontWeight: "900", fontSize: 11 }, propertyMetrics: { flexDirection: "row-reverse", gap: 6, marginTop: 10 }, propertyMini: { flex: 1, minHeight: 38, borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#FBFCFC", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 5 }, propertyMiniText: { color: "#475569", fontWeight: "900", fontSize: 11, textAlign: "center" }, empty: { backgroundColor: "#fff", borderRadius: 18, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#E7E9EA" }, emptyText: { color: "#7A766F", fontWeight: "900", textAlign: "center" },
  sheetRoot: { flex: 1, justifyContent: "flex-end" }, sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.62)" }, sheetCard: { backgroundColor: "#fff", borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 18 }, sheetHandle: { alignSelf: "center", width: 70, height: 6, borderRadius: 999, backgroundColor: "#D1D5DB", marginBottom: 18 }, sheetHead: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 18 }, sparkle: { width: 54, height: 54, borderRadius: 22, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" }, sheetTitleBox: { flex: 1, alignItems: "flex-end" }, sheetTitle: { color: "#111827", fontSize: 28, fontWeight: "900", textAlign: "right", lineHeight: 36 }, sheetSub: { color: "#6B7280", fontSize: 15, fontWeight: "800", textAlign: "right", marginTop: 4 },
  choiceCard: { minHeight: 112, borderRadius: 24, backgroundColor: "#F8FFFC", borderWidth: 1, borderColor: "#D8EFE7", padding: 15, marginBottom: 13, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 }, choiceTextBox: { flex: 1, alignItems: "flex-end" }, choiceTitle: { color: "#0F8A63", fontSize: 22, fontWeight: "900", textAlign: "right" }, choiceSubtitle: { color: "#6B7280", fontSize: 14, fontWeight: "800", textAlign: "right", marginTop: 7, lineHeight: 21 }, choiceIconOuter: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 13, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, choiceIconInner: { width: 58, height: 58, borderRadius: 24, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" }, cancelChoice: { minHeight: 54, borderRadius: 999, borderWidth: 1, borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center", marginTop: 4 }, cancelChoiceText: { color: "#6B7280", fontWeight: "900", fontSize: 16 },
});
