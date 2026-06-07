import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  properties_count?: number;
};

type OwnerDashboardSummary = {
  properties_count?: number;
  units_count?: number;
  rented_units_count?: number;
  available_units_count?: number;
  maintenance_units_count?: number;
  occupancy_rate?: number;
  contracts_count?: number;
  active_contracts_count?: number;
  ended_contracts_count?: number;
  expiring_soon_contracts_count?: number;
  paid_income?: number;
  due_income?: number;
  overdue_income?: number;
  expenses?: number;
  net_income?: number;
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
  due_income?: number;
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
  status?: string;
  owner?: OwnerDashboardOwner;
  filters?: { from?: string | null; to?: string | null };
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
  { key: "contracts", label: "العقود" },
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

function propertyTypeText(type?: string | null): string {
  if (!type) return "عقار";
  return propertyTypeLabels[type] || type;
}

const unitTypeLabels: Record<string, string> = {
  apartment: "شقة",
  studio: "استوديو",
  room: "غرفة",
  shop: "محل",
  office: "مكتب",
  warehouse: "مستودع",
};

function unitTypeText(type?: string | null): string {
  if (!type) return "وحدة";
  return unitTypeLabels[type] || type;
}

function unitDisplayName(unit: OwnerDashboardUnit): string {
  return unit.name || unit.unit_number || `وحدة #${unit.id}`;
}

function valueOrDash(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function statusText(status?: string | null): string {
  if (!status) return "-";
  return statusLabel[status] || status;
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

export default function OwnerDashboardScreen({ id }: { id: string | number }) {
  const ownerId = String(id || "");
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [data, setData] = useState<OwnerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

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

      const payload = (response?.data ?? response) as OwnerDashboardData;
      setData(payload);
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

  const ownerType = "مالك";
  const filteredText = useMemo(() => {
    const from = data?.filters?.from;
    const to = data?.filters?.to;
    if (from && to) return `الفترة: ${from} إلى ${to}`;
    if (from) return `من تاريخ: ${from}`;
    if (to) return `حتى تاريخ: ${to}`;
    return "كل الفترات";
  }, [data?.filters?.from, data?.filters?.to]);

  const hasOwnerAssets = asNumber(summary.properties_count) > 0 || asNumber(summary.units_count) > 0 || asNumber(summary.contracts_count) > 0;
  const ownerNameForUrl = encodeURIComponent(owner?.name || "مالك");
  const directOwnerUnits = useMemo(
    () => units.filter((unit) => !unit.property_id || String(unit.unit_scope || "") === "owner"),
    [units],
  );
  const unitsWithoutDirect = useMemo(
    () => units.filter((unit) => !directOwnerUnits.some((direct) => direct.id === unit.id)),
    [units, directOwnerUnits],
  );
  const totalAssetRows = properties.length + units.length;

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
            <Text style={styles.typeBadge}>{ownerType}</Text>
            <View style={styles.heroTitleWrap}>
              <Text numberOfLines={2} style={styles.ownerName}>{owner?.name || "مالك بدون اسم"}</Text>
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
                <Text style={styles.listMeta}>تاريخ الاستحقاق: {valueOrDash(payment.due_date)}</Text>
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
                  subtitle={`${totalAssetRows.toLocaleString("ar-SA")} عنصر مرتبط بهذا المالك`}
                />
              </View>
            </View>

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

        {!loading && !error && activeTab === "contracts" ? (
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
                  <Text style={styles.moneyText}>النهاية: {valueOrDash(contract.end_date)}</Text>
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
                <Text style={styles.listMeta}>استحقاق: {valueOrDash(payment.due_date)} | دفع: {valueOrDash(payment.paid_date)}</Text>
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
                <Text style={styles.listMeta}>التاريخ: {valueOrDash(expense.expense_date)}</Text>
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
  topBar: {
    alignItems: "flex-end",
    marginBottom: 6,
  },
  backButton: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#DDDBD6",
  },
  backText: { color: "#111827", fontWeight: "800" },
  heroCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  heroTitleWrap: { flex: 1 },
  ownerName: { color: "#ffffff", fontSize: 20, fontWeight: "900", textAlign: "right" },
  typeBadge: {
    color: "#064e3b",
    backgroundColor: "#d1fae5",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "900",
    fontSize: 12,
  },
  contactGrid: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 3,
  },
  contactText: { color: "#F7F6F4", textAlign: "right", fontWeight: "700", fontSize: 12 },
  filterCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EDECE9",
  },
  filterHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  filterTitle: { fontSize: 15, fontWeight: "900", color: "#111827", textAlign: "right" },
  filterHint: { color: "#6b7280", fontWeight: "700", flex: 1 },
  dateRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  dateInput: {
    flex: 1,
    backgroundColor: "#F7F6F4",
    borderWidth: 1,
    borderColor: "#DDDBD6",
    borderRadius: 12,
    padding: 10,
    color: "#111827",
  },
  filterButtonsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  filterButton: {
    flex: 1,
    backgroundColor: "#0f766e",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  filterButtonText: { color: "#ffffff", fontWeight: "900" },
  clearButton: { backgroundColor: "#f3f4f6" },
  clearButtonText: { color: "#374151", fontWeight: "900" },
  servicesCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EDECE9",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  servicesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  servicesTitle: { fontSize: 16, fontWeight: "900", color: "#111827", textAlign: "right" },
  servicesSubtitle: { flex: 1, color: "#6b7280", fontWeight: "700" },
  quickActionsRow: { flexDirection: "row-reverse", gap: 7, marginBottom: 10 },
  quickActionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionPrimary: { backgroundColor: "#0f766e" },
  quickActionBlue: { backgroundColor: "#0F9B6F" },
  quickActionDark: { backgroundColor: "#111827" },
  quickActionIcon: { fontSize: 18, marginBottom: 3 },
  quickActionText: { color: "#ffffff", fontWeight: "900", fontSize: 12, textAlign: "center" },
  servicesGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  serviceTile: {
    width: "48.7%",
    backgroundColor: "#F7F6F4",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DDDBD6",
    minHeight: 126,
    alignItems: "flex-end",
  },
  serviceIcon: { fontSize: 24, marginBottom: 8 },
  serviceTitle: { color: "#111827", fontWeight: "900", textAlign: "right" },
  serviceDesc: { color: "#6b7280", marginTop: 6, textAlign: "right", fontSize: 12, lineHeight: 18 },
  servicesEmpty: { color: "#9a3412", backgroundColor: "#fff7ed", borderRadius: 14, padding: 10, textAlign: "right", fontWeight: "800" },
  servicesHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  servicesHeroMetric: {
    width: 78,
    height: 78,
    borderRadius: 22,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
  },
  servicesMetricValue: { color: "#ffffff", fontSize: 22, fontWeight: "900" },
  servicesMetricLabel: { color: "#d1fae5", fontSize: 12, fontWeight: "900", marginTop: 2 },
  servicesHeroTextWrap: { flex: 1, alignItems: "flex-end" },
  serviceActionGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  serviceActionTile: {
    width: "48.7%",
    minHeight: 92,
    backgroundColor: "#F7F6F4",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E7E5E1",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  serviceActionTileActive: { backgroundColor: "#ecfdf5", borderColor: "#99f6e4" },
  serviceActionIcon: { fontSize: 22, marginBottom: 4 },
  serviceActionTitle: { color: "#111827", fontSize: 15, fontWeight: "900", textAlign: "right" },
  serviceActionHint: { color: "#6b7280", fontSize: 11, fontWeight: "700", textAlign: "right", marginTop: 3 },
  servicesFooterRow: { flexDirection: "row-reverse", gap: 8, marginTop: 10 },
  serviceFooterButton: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceFooterText: { color: "#ffffff", fontWeight: "900", textAlign: "center", fontSize: 12 },
  assetsTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  assetsCountBadge: { overflow: "hidden", backgroundColor: "#ecfdf5", color: "#047857", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: "900" },
  assetSummaryStrip: { flexDirection: "row-reverse", gap: 8, marginBottom: 10 },
  assetSummaryItem: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#EDECE9",
    alignItems: "center",
  },
  assetSummaryValue: { color: "#111827", fontSize: 20, fontWeight: "900" },
  assetSummaryLabel: { color: "#6b7280", fontWeight: "800", marginTop: 2 },
  propertyAssetCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EDECE9",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  propertyAssetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  propertyAssetTitleWrap: { flex: 1, alignItems: "flex-end" },
  propertyAssetTitle: { color: "#111827", fontSize: 17, fontWeight: "900", textAlign: "right" },
  propertyAssetLocation: { color: "#6b7280", marginTop: 3, textAlign: "right", fontWeight: "700" },
  unitsUnderPropertyBox: { marginTop: 10, backgroundColor: "#F7F6F4", borderRadius: 18, padding: 10, gap: 7 },
  unitsUnderPropertyTitle: { color: "#111827", fontWeight: "900", textAlign: "right", marginBottom: 2 },
  unitInlineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: "#ffffff", borderRadius: 14, padding: 9 },
  unitInlineStatus: { color: "#0f766e", backgroundColor: "#d1fae5", borderRadius: 999, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 3, fontWeight: "900", fontSize: 11 },
  unitInlineTextWrap: { flex: 1, alignItems: "flex-end" },
  unitInlineTitle: { color: "#111827", fontWeight: "900", textAlign: "right" },
  unitInlineMeta: { color: "#6b7280", fontSize: 12, marginTop: 3, textAlign: "right", fontWeight: "700" },
  propertyNoUnits: { color: "#92400e", backgroundColor: "#fffbeb", borderRadius: 14, padding: 9, marginTop: 9, textAlign: "right", fontWeight: "800" },
  directUnitCard: { backgroundColor: "#ffffff", borderRadius: 18, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#BBF7D0", borderRightWidth: 4, borderRightColor: "#16a34a" },
  tabsWrap: {
    flexDirection: "row",
    backgroundColor: "#DDDBD6",
    borderRadius: 16,
    padding: 4,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: "center",
  },
  tabButtonActive: { backgroundColor: "#ffffff" },
  tabInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  tabBadge: { overflow: "hidden", backgroundColor: "#0f766e", color: "#ffffff", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, fontSize: 10, fontWeight: "900" },
  tabText: { color: "#6b7280", fontSize: 12, fontWeight: "900" },
  tabTextActive: { color: "#111827" },
  stateBox: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  stateText: { color: "#4b5563", fontWeight: "700" },
  errorBox: { backgroundColor: "#fee2e2", borderRadius: 18, padding: 14, marginBottom: 10 },
  errorTitle: { color: "#991b1b", fontWeight: "900", fontSize: 16, textAlign: "right" },
  errorText: { color: "#7f1d1d", marginTop: 8, textAlign: "right" },
  retryButton: { marginTop: 12, backgroundColor: "#991b1b", padding: 12, borderRadius: 12, alignItems: "center" },
  retryText: { color: "#ffffff", fontWeight: "900" },
  sectionHeader: { marginTop: 6, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: "#111827", textAlign: "right" },
  sectionSubtitle: { color: "#6b7280", marginTop: 4, textAlign: "right" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  statCard: {
    width: "48.7%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EDECE9",
    minHeight: 84,
  },
  statLabel: { color: "#6b7280", textAlign: "right", fontWeight: "800" },
  statValue: { marginTop: 8, color: "#111827", textAlign: "right", fontSize: 19, fontWeight: "900" },
  listCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#EDECE9",
  },
  listTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  listTitle: { flex: 1, color: "#111827", fontSize: 16, fontWeight: "900", textAlign: "right" },
  listMeta: { color: "#4b5563", marginTop: 6, textAlign: "right", fontWeight: "700" },
  typeBadgeLight: {
    color: "#075985",
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "900",
  },
  miniStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  miniPill: {
    backgroundColor: "#f3f4f6",
    color: "#374151",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "800",
    fontSize: 12,
  },
  moneyRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 9 },
  moneyText: { color: "#111827", fontWeight: "800", textAlign: "right" },
  amountDanger: { color: "#dc2626", fontWeight: "900" },
  activityCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    borderRightWidth: 4,
    borderRightColor: "#0f766e",
  },
  activityTitle: { color: "#111827", fontSize: 16, fontWeight: "900", textAlign: "right" },
  activityMeta: { color: "#6b7280", marginTop: 6, textAlign: "right", fontWeight: "700" },
  emptyBox: { backgroundColor: "#ffffff", borderRadius: 18, padding: 18, alignItems: "center", marginBottom: 10 },
  emptyText: { color: "#6b7280", fontWeight: "800", textAlign: "center" },
});
