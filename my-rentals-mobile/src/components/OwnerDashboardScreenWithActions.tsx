import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGetScoped } from "../lib/api";

type OwnerDashboardOwner = {
  id: number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  national_id?: string | null;
  type?: string | null;
};

type OwnerDashboardSummary = {
  properties_count?: number;
  units_count?: number;
  rented_units_count?: number;
  available_units_count?: number;
  contracts_count?: number;
  active_contracts_count?: number;
  expiring_soon_contracts_count?: number;
  paid_income?: number;
  due_income?: number;
  overdue_income?: number;
  expenses?: number;
  net_income?: number;
  occupancy_rate?: number;
};

type OwnerDashboardUnit = {
  id: number;
  property_id?: number | string | null;
  owner_id?: number | string | null;
  unit_scope?: string | null;
  unit_number?: string | null;
  name?: string | null;
  type?: string | null;
  floor?: string | number | null;
  status?: string | null;
  rent_amount?: number | string | null;
  property_name?: string | null;
};

type OwnerDashboardProperty = {
  id: number;
  name?: string | null;
  city?: string | null;
  district?: string | null;
  property_type?: string | null;
  units_count?: number;
  rented_units_count?: number;
  active_contracts_count?: number;
  paid_income?: number;
  expenses?: number;
  units?: OwnerDashboardUnit[];
};

type OwnerDashboardContract = {
  id: number;
  contract_number?: string | null;
  government_contract_number?: string | null;
  tenant_name?: string | null;
  property_name?: string | null;
  unit_number?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  rent_amount?: number;
};

type OwnerDashboardPayment = {
  id: number;
  amount?: number;
  status?: string | null;
  due_date?: string | null;
  paid_date?: string | null;
  tenant_name?: string | null;
  property_name?: string | null;
  unit_number?: string | null;
};

type OwnerDashboardExpense = {
  id: number;
  amount?: number;
  expense_date?: string | null;
  title?: string | null;
  category_name?: string | null;
  property_name?: string | null;
};

type OwnerDashboardActivity = {
  id: number;
  action?: string | null;
  resource_label?: string | null;
  record_title?: string | null;
  user_name?: string | null;
  created_at?: string | null;
};

type OwnerDashboardData = {
  owner?: OwnerDashboardOwner;
  summary?: OwnerDashboardSummary;
  properties?: OwnerDashboardProperty[];
  units?: OwnerDashboardUnit[];
  contracts?: OwnerDashboardContract[];
  payments?: OwnerDashboardPayment[];
  overdue_payments?: OwnerDashboardPayment[];
  expenses?: OwnerDashboardExpense[];
  activities?: OwnerDashboardActivity[];
};

type TabKey = "summary" | "properties" | "contracts" | "financial" | "activity";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "summary", label: "الملخص" },
  { key: "properties", label: "العقارات" },
  { key: "financial", label: "المالية" },
  { key: "activity", label: "النشاط" },
];

const statusLabel: Record<string, string> = {
  active: "نشط",
  ended: "منتهي",
  cancelled: "ملغى",
  paid: "مدفوع",
  due: "مستحق",
  overdue: "متأخر",
  available: "متاح",
  rented: "مؤجر",
  maintenance: "صيانة",
};

const propertyTypeLabels: Record<string, string> = {
  building: "عمارة",
  apartment: "شقة",
  villa: "فيلا",
  land: "أرض",
  commercial: "تجاري",
  office: "مكتب",
  shop: "محل",
  mixed: "مختلط",
};

const unitTypeLabels: Record<string, string> = {
  apartment: "شقة",
  studio: "استوديو",
  room: "غرفة",
  shop: "محل",
  office: "مكتب",
  warehouse: "مستودع",
};

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown): string {
  return `${Math.round(asNumber(value)).toLocaleString("ar-SA")} ريال`;
}

function count(value: unknown): string {
  return Math.round(asNumber(value)).toLocaleString("ar-SA");
}

function valueOrDash(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function dateOnly(value?: string | null) {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : String(value);
}

function statusText(status?: string | null): string {
  if (!status) return "-";
  return statusLabel[status] || status;
}

function propertyTypeText(type?: string | null): string {
  if (!type) return "عقار";
  return propertyTypeLabels[type] || type;
}

function unitTypeText(type?: string | null): string {
  if (!type) return "وحدة";
  return unitTypeLabels[type] || type;
}

function unitDisplayName(unit: OwnerDashboardUnit): string {
  return unit.name || unit.unit_number || `وحدة #${unit.id}`;
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text numberOfLines={1} style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export default function OwnerDashboardScreenWithActions({ id }: { id: string | number }) {
  const ownerId = String(id || "");
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [data, setData] = useState<OwnerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(isRefresh = false) {
    if (!ownerId) return;

    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      const response = await apiGetScoped(
        `/owners/${ownerId}/dashboard`,
        `/my/owners/${ownerId}/dashboard`,
      );

      setData((response?.data ?? response) as OwnerDashboardData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل تفاصيل الأملاك");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(false);
  }, [ownerId]);

  const summary = data?.summary || {};
  const owner = data?.owner;
  const properties = data?.properties || [];
  const units = data?.units || [];
  const contracts = data?.contracts || [];
  const payments = data?.payments || [];
  const overduePayments = data?.overdue_payments || [];
  const expenses = data?.expenses || [];
  const activities = data?.activities || [];

  const ownerName = owner?.name || "مالك بدون اسم";
  const ownerNameForUrl = encodeURIComponent(ownerName);

  const directOwnerUnits = useMemo(
    () => units.filter((unit) => !unit.property_id || String(unit.unit_scope || "") === "owner"),
    [units],
  );

  const unitsWithoutDirect = useMemo(
    () => units.filter((unit) => !directOwnerUnits.some((direct) => direct.id === unit.id)),
    [units, directOwnerUnits],
  );

  function openAddProperty() {
    router.push(`/properties?owner_id=${encodeURIComponent(ownerId)}&owner_name=${ownerNameForUrl}&create=1` as never);
  }

  function openAddUnit() {
    router.push(`/units?owner_id=${encodeURIComponent(ownerId)}&owner_name=${ownerNameForUrl}&create=1` as never);
  }

  function renderAssetActions() {
    return (
      <View style={styles.addActionsRow}>
        <TouchableOpacity style={[styles.addActionButton, styles.addPropertyButton]} onPress={openAddProperty} activeOpacity={0.88}>
          <Text style={styles.addActionIcon}>＋</Text>
          <Text style={styles.addActionText}>إضافة عقار</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addActionButton, styles.addUnitButton]} onPress={openAddUnit} activeOpacity={0.88}>
          <Text style={styles.addActionIcon}>＋</Text>
          <Text style={styles.addActionText}>إضافة وحدة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.typeBadge}>مالك</Text>
            <View style={styles.heroTitleWrap}>
              <Text numberOfLines={2} style={styles.ownerName}>{ownerName}</Text>
            </View>
          </View>
          <View style={styles.contactGrid}>
            <Text style={styles.contactText}>الجوال: {valueOrDash(owner?.phone)}</Text>
            <Text style={styles.contactText}>البريد: {valueOrDash(owner?.email)}</Text>
            <Text style={styles.contactText}>الهوية/السجل: {valueOrDash(owner?.national_id)}</Text>
          </View>
        </View>

        <View style={styles.tabsWrap}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, activeTab === tab.key ? styles.tabButtonActive : null]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.88}
            >
              <View style={styles.tabInner}>
                <Text style={[styles.tabText, activeTab === tab.key ? styles.tabTextActive : null]}>{tab.label}</Text>
                {tab.key === "properties" ? (
                  <Text style={styles.tabBadge}>{count(properties.length || summary.properties_count)}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator />
            <Text style={styles.stateText}>جاري تحميل تفاصيل الأملاك...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>تعذر تحميل تفاصيل الأملاك</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => load(false)}>
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && !error && activeTab === "summary" ? (
          <View>
            <SectionTitle title="الملخص المالي" subtitle="إيرادات ومصروفات وصافي دخل المالك" />
            <View style={styles.statsGrid}>
              <StatCard label="المحصل" value={money(summary.paid_income)} color="#16a34a" />
              <StatCard label="المستحق" value={money(summary.due_income)} color="#d97706" />
              <StatCard label="المتأخر" value={money(summary.overdue_income)} color="#dc2626" />
              <StatCard label="المصروفات" value={money(summary.expenses)} color="#7c3aed" />
              <StatCard label="صافي الدخل" value={money(summary.net_income)} color="#111827" />
              <StatCard label="نسبة الإشغال" value={`${count(summary.occupancy_rate)}%`} color="#0f766e" />
            </View>

            <SectionTitle title="ملخص العقارات والعقود" />
            <View style={styles.statsGrid}>
              <StatCard label="العقارات" value={count(summary.properties_count)} />
              <StatCard label="الوحدات" value={count(summary.units_count)} />
              <StatCard label="الوحدات المؤجرة" value={count(summary.rented_units_count)} color="#16a34a" />
              <StatCard label="الوحدات الشاغرة" value={count(summary.available_units_count)} color="#0F9B6F" />
              <StatCard label="العقود النشطة" value={count(summary.active_contracts_count)} color="#0f766e" />
              <StatCard label="تنتهي قريبًا" value={count(summary.expiring_soon_contracts_count)} color="#d97706" />
            </View>

            <SectionTitle title="المتأخرات القريبة" />
            {overduePayments.length ? overduePayments.map((payment) => (
              <View key={payment.id} style={styles.listCard}>
                <View style={styles.listTopRow}>
                  <Text style={styles.amountDanger}>{money(payment.amount)}</Text>
                  <Text style={styles.listTitle}>{payment.tenant_name || "مستأجر غير محدد"}</Text>
                </View>
                <Text style={styles.listMeta}>{payment.property_name || "عقار"} / وحدة {valueOrDash(payment.unit_number)}</Text>
                <Text style={styles.listMeta}>تاريخ الاستحقاق: {dateOnly(payment.due_date)}</Text>
              </View>
            )) : <EmptyBox text="لا توجد دفعات متأخرة ضمن الفترة الحالية." />}
          </View>
        ) : null}

        {!loading && !error && activeTab === "properties" ? (
          <View>
            <View style={styles.assetsTitleRow}>
              <Text style={styles.assetsCountBadge}>{count(properties.length || summary.properties_count)} عقار</Text>
              <View style={{ flex: 1 }}>
                <SectionTitle
                  title="العقارات والوحدات"
                  subtitle={`${(properties.length + units.length).toLocaleString("ar-SA")} عنصر مرتبط بهذا المالك`}
                />
              </View>
            </View>

            {renderAssetActions()}

            <View style={styles.assetSummaryStrip}>
              <View style={styles.assetSummaryItem}>
                <Text style={styles.assetSummaryValue}>{count(properties.length)}</Text>
                <Text style={styles.assetSummaryLabel}>عقارات</Text>
              </View>
              <View style={styles.assetSummaryItem}>
                <Text style={styles.assetSummaryValue}>{count(units.length)}</Text>
                <Text style={styles.assetSummaryLabel}>وحدات</Text>
              </View>
              <View style={styles.assetSummaryItem}>
                <Text style={styles.assetSummaryValue}>{count(directOwnerUnits.length)}</Text>
                <Text style={styles.assetSummaryLabel}>مباشرة</Text>
              </View>
            </View>

            {properties.length ? properties.map((property) => {
              const propertyUnits = (property.units && property.units.length)
                ? property.units
                : unitsWithoutDirect.filter((unit) => String(unit.property_id || "") === String(property.id));

              return (
                <TouchableOpacity
                  key={property.id}
                  activeOpacity={0.9}
                  style={styles.propertyAssetCard}
                  onPress={() => router.push(`/property/${property.id}` as never)}
                >
                  <View style={styles.propertyAssetHeader}>
                    <Text style={styles.typeBadgeLight}>{propertyTypeText(property.property_type)}</Text>
                    <View style={styles.propertyAssetTitleWrap}>
                      <Text numberOfLines={1} style={styles.propertyAssetTitle}>{property.name || "عقار بدون اسم"}</Text>
                      <Text style={styles.propertyAssetLocation}>{[property.district, property.city].filter(Boolean).join("، ") || "لا يوجد موقع مسجل"}</Text>
                    </View>
                  </View>

                  <View style={styles.miniStatsRow}>
                    <Text style={styles.miniPill}>وحدات: {count(propertyUnits.length || property.units_count)}</Text>
                    <Text style={styles.miniPill}>مؤجرة: {count(property.rented_units_count)}</Text>
                    <Text style={styles.miniPill}>عقود نشطة: {count(property.active_contracts_count)}</Text>
                  </View>

                  {propertyUnits.length ? (
                    <View style={styles.unitsUnderPropertyBox}>
                      <Text style={styles.unitsUnderPropertyTitle}>وحدات هذا العقار</Text>
                      {propertyUnits.map((unit) => (
                        <TouchableOpacity
                          key={unit.id}
                          activeOpacity={0.85}
                          style={styles.unitInlineRow}
                          onPress={() => router.push(`/unit/${unit.id}` as never)}
                        >
                          <Text style={styles.unitInlineStatus}>{statusText(unit.status)}</Text>
                          <View style={styles.unitInlineTextWrap}>
                            <Text style={styles.unitInlineTitle}>{unitDisplayName(unit)}</Text>
                            <Text style={styles.unitInlineMeta}>{unitTypeText(unit.type)} | الدور: {valueOrDash(unit.floor)} | الإيجار: {money(unit.rent_amount)}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.propertyNoUnits}>لا توجد وحدات مسجلة تحت هذا العقار.</Text>
                  )}

                  <View style={styles.moneyRow}>
                    <Text style={styles.moneyText}>مصروفات: {money(property.expenses)}</Text>
                    <Text style={styles.moneyText}>محصل: {money(property.paid_income)}</Text>
                  </View>
                </TouchableOpacity>
              );
            }) : null}

            {directOwnerUnits.length ? (
              <View>
                <SectionTitle title="وحدات مباشرة على المالك" subtitle="وحدات غير مربوطة بعقار/عمارة" />
                {directOwnerUnits.map((unit) => (
                  <TouchableOpacity
                    key={unit.id}
                    activeOpacity={0.9}
                    style={styles.directUnitCard}
                    onPress={() => router.push(`/unit/${unit.id}` as never)}
                  >
                    <View style={styles.listTopRow}>
                      <Text style={styles.typeBadgeLight}>{statusText(unit.status)}</Text>
                      <Text numberOfLines={1} style={styles.listTitle}>{unitDisplayName(unit)}</Text>
                    </View>
                    <Text style={styles.listMeta}>نوع الوحدة: {unitTypeText(unit.type)} | الدور: {valueOrDash(unit.floor)}</Text>
                    <Text style={styles.listMeta}>الإيجار: {money(unit.rent_amount)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {!properties.length && !directOwnerUnits.length ? (
              <EmptyBox text="لا توجد عقارات أو وحدات تابعة لهذا المالك." />
            ) : null}
          </View>
        ) : null}

        {!loading && !error && false ? (
          <View>
            <SectionTitle title="عقود المالك" subtitle="آخر العقود التابعة لوحدات هذا المالك" />
            {contracts.length ? contracts.map((contract) => (
              <TouchableOpacity
                key={contract.id}
                activeOpacity={0.85}
                style={styles.listCard}
                onPress={() => router.push(`/contract/${contract.id}` as never)}
              >
                <View style={styles.listTopRow}>
                  <Text style={styles.typeBadgeLight}>{statusText(contract.status)}</Text>
                  <Text numberOfLines={1} style={styles.listTitle}>عقد {contract.government_contract_number || contract.contract_number || contract.id}</Text>
                </View>
                <Text style={styles.listMeta}>المستأجر: {contract.tenant_name || "-"}</Text>
                <Text style={styles.listMeta}>{contract.property_name || "عقار"} / وحدة {valueOrDash(contract.unit_number)}</Text>
                <View style={styles.moneyRow}>
                  <Text style={styles.moneyText}>النهاية: {dateOnly(contract.end_date)}</Text>
                  <Text style={styles.moneyText}>الإيجار: {money(contract.rent_amount)}</Text>
                </View>
              </TouchableOpacity>
            )) : <EmptyBox text="لا توجد عقود لهذا المالك." />}
          </View>
        ) : null}

        {!loading && !error && activeTab === "financial" ? (
          <View>
            <SectionTitle title="آخر الدفعات" />
            {payments.length ? payments.map((payment) => (
              <View key={payment.id} style={styles.listCard}>
                <View style={styles.listTopRow}>
                  <Text style={styles.typeBadgeLight}>{statusText(payment.status)}</Text>
                  <Text style={styles.listTitle}>{money(payment.amount)}</Text>
                </View>
                <Text style={styles.listMeta}>{payment.tenant_name || "مستأجر"} - {payment.property_name || "عقار"} / وحدة {valueOrDash(payment.unit_number)}</Text>
                <Text style={styles.listMeta}>استحقاق: {dateOnly(payment.due_date)} | دفع: {dateOnly(payment.paid_date)}</Text>
              </View>
            )) : <EmptyBox text="لا توجد دفعات ضمن الفترة المحددة." />}

            <SectionTitle title="آخر المصروفات" />
            {expenses.length ? expenses.map((expense) => (
              <View key={expense.id} style={styles.listCard}>
                <View style={styles.listTopRow}>
                  <Text style={styles.amountDanger}>{money(expense.amount)}</Text>
                  <Text numberOfLines={1} style={styles.listTitle}>{expense.title || expense.category_name || "مصروف"}</Text>
                </View>
                <Text style={styles.listMeta}>{expense.property_name || "عقار"}</Text>
                <Text style={styles.listMeta}>التاريخ: {dateOnly(expense.expense_date)}</Text>
              </View>
            )) : <EmptyBox text="لا توجد مصروفات ضمن الفترة المحددة." />}
          </View>
        ) : null}

        {!loading && !error && activeTab === "activity" ? (
          <View>
            <SectionTitle title="آخر نشاط" subtitle="آخر العمليات المسجلة على هذا المالك" />
            {activities.length ? activities.map((activity) => (
              <View key={activity.id} style={styles.activityCard}>
                <Text style={styles.activityTitle}>{activity.record_title || activity.resource_label || activity.action || "نشاط"}</Text>
                <Text style={styles.activityMeta}>الإجراء: {valueOrDash(activity.action)} | المستخدم: {valueOrDash(activity.user_name)}</Text>
                <Text style={styles.activityMeta}>التاريخ: {valueOrDash(activity.created_at)}</Text>
              </View>
            )) : <EmptyBox text="لا توجد أنشطة مسجلة لهذا المالك بعد." />}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  scroll: { flex: 1 },
  container: { padding: 12, paddingBottom: 40 },
  heroCard: { backgroundColor: "#111827", borderRadius: 18, padding: 12, marginBottom: 8 },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  heroTitleWrap: { flex: 1 },
  ownerName: { color: "#ffffff", fontSize: 22, fontWeight: "900", textAlign: "right" },
  typeBadge: { color: "#064e3b", backgroundColor: "#d1fae5", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: "hidden", fontWeight: "900", fontSize: 13 },
  contactGrid: { marginTop: 10, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
  contactText: { color: "#F7F6F4", textAlign: "right", fontWeight: "800", fontSize: 13 },
  tabsWrap: { flexDirection: "row-reverse", backgroundColor: "#deddd8", borderRadius: 18, padding: 4, marginBottom: 12, gap: 3 },
  tabButton: { flex: 1, borderRadius: 16, minHeight: 50, alignItems: "center", justifyContent: "center" },
  tabButtonActive: { backgroundColor: "#ffffff" },
  tabInner: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6 },
  tabText: { color: "#6b7280", fontWeight: "900", fontSize: 13 },
  tabTextActive: { color: "#111827" },
  tabBadge: { backgroundColor: "#0f766e", color: "#ffffff", borderRadius: 999, overflow: "hidden", paddingHorizontal: 7, paddingVertical: 2, fontSize: 11, fontWeight: "900" },
  stateBox: { backgroundColor: "#fff", borderRadius: 18, padding: 16, alignItems: "center", marginBottom: 10 },
  stateText: { color: "#6b7280", marginTop: 8, fontWeight: "800" },
  errorBox: { backgroundColor: "#fee2e2", borderRadius: 18, padding: 14, marginBottom: 10 },
  errorTitle: { color: "#991b1b", fontWeight: "900", textAlign: "right", marginBottom: 5 },
  errorText: { color: "#991b1b", textAlign: "right", fontWeight: "700", lineHeight: 22 },
  retryButton: { backgroundColor: "#991b1b", borderRadius: 12, padding: 11, alignItems: "center", marginTop: 10 },
  retryText: { color: "#fff", fontWeight: "900" },
  sectionHeader: { alignItems: "flex-end", marginTop: 10, marginBottom: 8 },
  sectionTitle: { color: "#111827", fontSize: 20, fontWeight: "900", textAlign: "right" },
  sectionSubtitle: { color: "#7A766F", fontWeight: "800", textAlign: "right", marginTop: 4, lineHeight: 20 },
  statsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  statCard: { width: "31.8%", backgroundColor: "#fff", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#EDECE9", minHeight: 82, justifyContent: "center" },
  statLabel: { color: "#7A766F", fontWeight: "800", textAlign: "right", fontSize: 12 },
  statValue: { color: "#111827", fontWeight: "900", textAlign: "right", fontSize: 16, marginTop: 7 },
  assetsTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  assetsCountBadge: { marginTop: 20, color: "#0f766e", backgroundColor: "#ecfdf5", borderRadius: 999, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 6, fontWeight: "900" },
  addActionsRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 12 },
  addActionButton: { flex: 1, minHeight: 54, borderRadius: 18, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  addPropertyButton: { backgroundColor: "#0f766e" },
  addUnitButton: { backgroundColor: "#111827" },
  addActionIcon: { color: "#ffffff", fontSize: 22, fontWeight: "900", marginTop: -2 },
  addActionText: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  assetSummaryStrip: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  assetSummaryItem: { flex: 1, backgroundColor: "#ffffff", borderRadius: 16, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#EDECE9" },
  assetSummaryValue: { color: "#111827", fontSize: 18, fontWeight: "900" },
  assetSummaryLabel: { color: "#7A766F", fontWeight: "800", marginTop: 5 },
  propertyAssetCard: { backgroundColor: "#fff", borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#EDECE9", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 1 },
  propertyAssetHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
  propertyAssetTitleWrap: { flex: 1 },
  propertyAssetTitle: { color: "#111827", fontWeight: "900", fontSize: 18, textAlign: "right" },
  propertyAssetLocation: { color: "#7A766F", fontWeight: "800", textAlign: "right", marginTop: 3 },
  typeBadgeLight: { color: "#0f766e", backgroundColor: "#ecfdf5", borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5, fontWeight: "900", fontSize: 12 },
  miniStatsRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  miniPill: { color: "#374151", backgroundColor: "#F7F6F4", borderRadius: 999, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5, fontWeight: "800", fontSize: 12 },
  unitsUnderPropertyBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 10, gap: 7 },
  unitsUnderPropertyTitle: { color: "#111827", fontWeight: "900", textAlign: "right", marginBottom: 2 },
  unitInlineRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderRadius: 12, padding: 9 },
  unitInlineTextWrap: { flex: 1 },
  unitInlineTitle: { color: "#111827", fontWeight: "900", textAlign: "right" },
  unitInlineMeta: { color: "#7A766F", textAlign: "right", fontSize: 12, marginTop: 3, fontWeight: "700" },
  unitInlineStatus: { color: "#0f766e", backgroundColor: "#ecfdf5", borderRadius: 999, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4, fontWeight: "900", fontSize: 11 },
  propertyNoUnits: { color: "#7A766F", backgroundColor: "#F7F6F4", borderRadius: 14, padding: 10, textAlign: "right", fontWeight: "800" },
  directUnitCard: { backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#EDECE9" },
  listCard: { backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#EDECE9" },
  listTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  listTitle: { flex: 1, color: "#111827", fontSize: 16, fontWeight: "900", textAlign: "right" },
  listMeta: { color: "#7A766F", fontWeight: "700", textAlign: "right", lineHeight: 21 },
  amountDanger: { color: "#dc2626", fontWeight: "900" },
  moneyRow: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 8, marginTop: 10 },
  moneyText: { color: "#374151", fontWeight: "800" },
  activityCard: { backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#EDECE9" },
  activityTitle: { color: "#111827", fontWeight: "900", textAlign: "right", fontSize: 16 },
  activityMeta: { color: "#7A766F", fontWeight: "700", textAlign: "right", marginTop: 5 },
  emptyBox: { backgroundColor: "#fff", borderRadius: 18, padding: 18, alignItems: "center", borderWidth: 1, borderColor: "#EDECE9", marginBottom: 10 },
  emptyText: { color: "#7A766F", fontWeight: "900", textAlign: "center", lineHeight: 22 },
});
