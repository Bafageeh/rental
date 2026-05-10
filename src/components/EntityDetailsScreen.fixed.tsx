import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { apiGet, apiPost } from "../lib/api";
import InlineEditDeleteActions from "./InlineEditDeleteActions";

type EntityKey = "owner" | "property" | "unit" | "tenant" | "contract" | string;

type FieldItem = {
  key: string;
  label: string;
  value: string | number | null;
  raw_value?: unknown;
  is_relation?: boolean;
};

type RelatedItem = {
  id: number;
  entity: EntityKey;
  entity_title?: string;
  title: string;
  subtitle?: string;
  badge?: string | null;
  meta?: string[];
  route?: string | null;
  amount?: number | string | null;
  due_date?: string | null;
  paid_date?: string | null;
  deadline_date?: string | null;
  notes?: string | null;
  status?: string | null;
};

type RelatedSection = {
  key: string;
  title: string;
  entity: EntityKey;
  count: number;
  items: RelatedItem[];
};

type LinkItem = {
  field: string;
  label: string;
  entity: EntityKey;
  id: number;
  title: string;
  route?: string;
};

type DetailsResponse = {
  entity: EntityKey;
  entity_title?: string;
  id: number;
  title: string;
  fields: FieldItem[];
  sections: RelatedSection[];
  links: LinkItem[];
};

const entityTitle: Record<string, string> = {
  owner: "المالك",
  property: "العقار",
  unit: "الوحدة",
  tenant: "المستأجر",
  contract: "العقد",
};

const routeByEntity: Record<string, string> = {
  owner: "/owner",
  property: "/property",
  unit: "/unit",
  tenant: "/tenant",
  contract: "/contract",
};

function valueOrDash(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function normalizeEntity(entity: string) {
  if (entity === "owners") return "owner";
  if (entity === "properties") return "property";
  if (entity === "units") return "unit";
  if (entity === "tenants") return "tenant";
  if (entity === "contracts") return "contract";
  return entity;
}

function relatedTabLabel(entity: string) {
  const key = normalizeEntity(entity);
  if (key === "contract") return "الدفعات";
  if (key === "unit") return "العقود";
  if (key === "tenant") return "العقود";
  if (key === "property") return "الوحدات والعقود";
  return "عقاراتي";
}

function relatedEmptyText(entity: string) {
  const key = normalizeEntity(entity);
  if (key === "contract") return "لا توجد دفعات مرتبطة بهذا العقد.";
  if (key === "unit") return "لا توجد عقود مرتبطة بهذه الوحدة.";
  if (key === "tenant") return "لا توجد عقود مرتبطة بهذا المستأجر.";
  if (key === "property") return "لا توجد وحدات أو عقود مرتبطة بهذا العقار.";
  return "لا توجد عقارات أو عناصر تابعة بهذا السجل.";
}

function resourceForEntity(entity: string) {
  const key = normalizeEntity(entity);
  if (key === "owner") return "owners";
  if (key === "property") return "properties";
  if (key === "unit") return "units";
  if (key === "tenant") return "tenants";
  if (key === "contract") return "contracts";
  return entity.endsWith("s") ? entity : `${entity}s`;
}

function makeRoute(entity: EntityKey, id: number, fallback?: string | null) {
  if (fallback) return fallback;
  const key = normalizeEntity(String(entity));
  return `${routeByEntity[key] || `/${key}`}/${id}`;
}

function badgeStyleForText(badge?: string | null) {
  const text = String(badge || "").trim().toLowerCase();
  if (text.includes("متأخر") || text.includes("متاخر") || text.includes("overdue")) return [styles.badge, styles.badgeDanger];
  if (text.includes("مستحق") || text.includes("due")) return [styles.badge, styles.badgeWarning];
  if (text.includes("مدفوع") || text.includes("paid")) return [styles.badge, styles.badgeSuccess];
  return styles.badge;
}

function paymentAmount(value: unknown) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n)) return valueOrDash(value);
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال`;
}

function isPaymentItem(item: RelatedItem) {
  return normalizeEntity(String(item.entity)) === "payment";
}

function isPrimaryField(key: string) {
  return [
    "name",
    "full_name",
    "title",
    "property_name",
    "unit_number",
    "contract_number",
    "government_contract_number",
    "owner_id",
    "property_id",
    "unit_id",
    "tenant_id",
    "status",
    "property_type",
    "management_type",
    "unit_scope",
    "rent_amount",
    "start_date",
    "end_date",
    "deed_number",
    "city",
    "district",
    "phone",
    "mobile",
    "email",
  ].includes(key);
}

function FieldRow({ field }: { field: FieldItem }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldValue}>{valueOrDash(field.value)}</Text>
      <Text style={styles.fieldLabel}>{field.label}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function ServiceChip({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.serviceChip} onPress={onPress} activeOpacity={0.86} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.serviceIconWrap}>
        <Ionicons name={icon as any} size={18} color="#4b5563" />
      </View>
      <Text numberOfLines={1} style={styles.serviceText}>{label}</Text>
    </TouchableOpacity>
  );
}

function DetailAccordionSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity style={styles.accordionHeader} onPress={onToggle} activeOpacity={0.85} accessibilityRole="button">
        <View style={styles.accordionChevronBox}>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#374151" />
        </View>
        <View style={styles.accordionTitleBlock}>
          <Text style={styles.accordionTitle}>{title}</Text>
        </View>
      </TouchableOpacity>
      {open ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
}

function RelatedCard({ item, expanded, onToggle, onMarkPaid }: { item: RelatedItem; expanded?: boolean; onToggle?: () => void; onMarkPaid?: () => void }) {
  const isPayment = isPaymentItem(item);
  const isPaid = String(item.status || item.badge || "").toLowerCase().includes("paid") || String(item.badge || "").includes("مدفوعة");

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.relatedCard}
      onPress={() => {
        if (isPayment) {
          onToggle?.();
          return;
        }
        router.push(makeRoute(item.entity, item.id, item.route) as never);
      }}
    >
      <View style={styles.relatedTopRow}>
        {item.badge ? <Text style={badgeStyleForText(item.badge)}>{item.badge}</Text> : <View />}
        <View style={styles.relatedTitleWrap}>
          <Text style={styles.relatedEntity}>{item.entity_title || entityTitle[String(item.entity)] || "سجل"}</Text>
          <Text numberOfLines={1} style={styles.relatedTitle}>{item.title}</Text>
        </View>
      </View>
      {item.subtitle ? <Text numberOfLines={2} style={styles.relatedSubtitle}>{item.subtitle}</Text> : null}
      {item.meta && item.meta.length ? (
        <View style={styles.metaRow}>
          {item.meta.slice(0, 3).map((meta) => (
            <Text key={meta} numberOfLines={1} style={styles.metaPill}>{meta}</Text>
          ))}
        </View>
      ) : null}

      {isPayment ? (
        <>
          <View style={styles.paymentQuickRow}>
            {!isPaid ? (
              <TouchableOpacity style={styles.payButton} onPress={(event) => { event.stopPropagation?.(); onMarkPaid?.(); }} activeOpacity={0.85}>
                <Text style={styles.payButtonText}>دفع</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.expandHint}>{expanded ? "إخفاء التفاصيل" : "عرض المبلغ والملاحظات"}</Text>
          </View>
          {expanded ? (
            <View style={styles.inlinePaymentDetails}>
              <View style={styles.inlineRow}><Text style={styles.inlineValue}>{paymentAmount(item.amount)}</Text><Text style={styles.inlineLabel}>المبلغ</Text></View>
              <View style={styles.inlineRow}><Text style={styles.inlineValue}>{valueOrDash(item.due_date || item.title)}</Text><Text style={styles.inlineLabel}>تاريخ الاستحقاق</Text></View>
              <View style={styles.inlineRow}><Text style={styles.inlineValue}>{valueOrDash(item.deadline_date)}</Text><Text style={styles.inlineLabel}>نهاية المهلة</Text></View>
              <View style={styles.inlineRow}><Text style={styles.inlineValue}>{valueOrDash(item.paid_date)}</Text><Text style={styles.inlineLabel}>تاريخ السداد</Text></View>
              <View style={styles.inlineRow}><Text style={styles.inlineValue}>{valueOrDash(item.notes)}</Text><Text style={styles.inlineLabel}>ملاحظات</Text></View>
            </View>
          ) : null}
        </>
      ) : null}
    </TouchableOpacity>
  );
}

function SegmentedTabs({ active, onChange, relatedLabel }: { active: string; onChange: (tab: string) => void; relatedLabel: string }) {
  const tabs = [
    ["details", "التفاصيل"],
    ["related", relatedLabel],
  ];
  return (
    <View style={styles.tabsWrap}>
      {tabs.map(([key, label]) => (
        <TouchableOpacity key={key} activeOpacity={0.85} onPress={() => onChange(key)} style={[styles.tabButton, active === key ? styles.tabButtonActive : null]}>
          <Text style={[styles.tabText, active === key ? styles.tabTextActive : null]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function EntityDetailsScreen({ entity, id }: { entity: EntityKey; id: string | number }) {
  const normalizedEntity = normalizeEntity(String(entity));
  const [activeTab, setActiveTab] = useState("details");
  const [data, setData] = useState<DetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedPaymentId, setExpandedPaymentId] = useState<number | null>(null);
  const [openDetailSections, setOpenDetailSections] = useState<Record<string, boolean>>({ primary: false, extra: false });
  const relatedLabel = relatedTabLabel(normalizedEntity);

  async function load(isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      const response = await apiGet(`/relation-manager/related/${normalizedEntity}/${id}`);
      setData(response as DetailsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(false);
  }, [normalizedEntity, id]);

  const primaryFields = useMemo(() => (data?.fields || []).filter((field) => isPrimaryField(field.key)), [data]);
  const otherFields = useMemo(() => (data?.fields || []).filter((field) => !isPrimaryField(field.key)), [data]);
  const relatedCount = useMemo(
    () => (data?.sections || []).reduce((total, section) => total + (section.count || section.items?.length || 0), 0),
    [data],
  );
  const encodedTitle = encodeURIComponent(data?.title || `${entityTitle[normalizedEntity] || "سجل"} #${id}`);

  function toggleDetailSection(key: "primary" | "extra") {
    setOpenDetailSections((current) => ({ ...current, [key]: !current[key] }));
  }

  async function markPaymentPaid(payment: RelatedItem) {
    Alert.alert("تأكيد الدفع", `هل تريد تسجيل دفع ${paymentAmount(payment.amount)}؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تسجيل الدفع",
        onPress: async () => {
          try {
            await apiPost(`/payments/${payment.id}/mark-paid`, {});
            await load(true);
          } catch (e) {
            Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تسجيل الدفع");
          }
        },
      },
    ]);
  }

  function openUnitService(path: string, extraQuery = "") {
    const separator = extraQuery ? "&" : "";
    router.push(`${path}?unit_id=${id}&unit_name=${encodedTitle}${separator}${extraQuery}` as never);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {normalizedEntity !== "unit" ? (
          <View style={styles.topBar}>
            <View style={styles.topTitleBlock}>
              <Text style={styles.topTitle}>{entityTitle[normalizedEntity] || "التفاصيل"}</Text>
              <Text style={styles.topSubtitle}>تفاصيل السجل والخدمات المرتبطة</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.headerCard}>
          <View style={styles.unitCardTopRow}>
            {normalizedEntity === "unit" ? (
              <View style={styles.unitCardActions}>
                <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails compact iconOnly onChanged={() => load(false)} />
              </View>
            ) : <View />}
            <Text style={styles.entityLabel}>{data?.entity_title || entityTitle[normalizedEntity] || "تفاصيل"}</Text>
          </View>
          <Text numberOfLines={2} style={styles.title}>{data?.title || "جاري التحميل..."}</Text>
          <View style={styles.headerStatsRow}>
            <Text style={styles.statPill}>{relatedLabel}: {relatedCount}</Text>
          </View>

          {normalizedEntity === "unit" ? (
            <View style={styles.headerServicesWrap}>
              <View style={styles.headerServicesHeader}>
                <Text style={styles.headerServicesTitle}>خدمات الوحدة</Text>
                <Ionicons name="grid-outline" size={16} color="#6b7280" />
              </View>
              <View style={styles.headerServicesGrid}>
                <ServiceChip icon="documents-outline" label="العقود" onPress={() => openUnitService("/contracts")} />
                <ServiceChip icon="create-outline" label="إنشاء عقد" onPress={() => openUnitService("/create-contract")} />
                <ServiceChip icon="cloud-upload-outline" label="رفع عقد" onPress={() => openUnitService("/upload-contract")} />
                <ServiceChip icon="images-outline" label="الوسائط" onPress={() => openUnitService("/files", "mode=media")} />
              </View>
            </View>
          ) : null}
        </View>

        {normalizedEntity !== "unit" ? (
          <View style={styles.detailsActionsBox}>
            <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails compact iconOnly onChanged={() => load(false)} />
          </View>
        ) : null}

        <SegmentedTabs active={activeTab} onChange={setActiveTab} relatedLabel={relatedLabel} />

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>جاري تحميل التفاصيل...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>تعذر تحميل التفاصيل</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => load(false)}>
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && !error && data && activeTab === "details" ? (
          <View>
            <DetailAccordionSection title="البيانات الأساسية" open={openDetailSections.primary !== false} onToggle={() => toggleDetailSection("primary")}>
              {primaryFields.length ? primaryFields.map((field) => <FieldRow key={field.key} field={field} />) : <EmptyState text="لا توجد بيانات أساسية." />}
            </DetailAccordionSection>

            {otherFields.length ? (
              <DetailAccordionSection title="بيانات إضافية" open={openDetailSections.extra !== false} onToggle={() => toggleDetailSection("extra")}>
                {otherFields.map((field) => <FieldRow key={field.key} field={field} />)}
              </DetailAccordionSection>
            ) : null}
          </View>
        ) : null}

        {!loading && !error && data && activeTab === "related" ? (
          <View>
            {data.sections.length ? data.sections.map((section) => (
              <View key={section.key} style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.countBadge}>{section.count}</Text>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                {section.items.length ? section.items.map((item) => (
                  <RelatedCard
                    key={`${item.entity}-${item.id}`}
                    item={item}
                    expanded={expandedPaymentId === item.id}
                    onToggle={() => setExpandedPaymentId((current) => current === item.id ? null : item.id)}
                    onMarkPaid={() => markPaymentPaid(item)}
                  />
                )) : <EmptyState text="لا توجد عناصر في هذا القسم." />}
              </View>
            )) : <EmptyState text={relatedEmptyText(normalizedEntity)} />}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f7fb" },
  scroll: { flex: 1 },
  container: { padding: 14, paddingBottom: 28 },
  topBar: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 2, marginBottom: 10, gap: 10 },
  topTitleBlock: { flex: 1, alignItems: "flex-end" },
  unitCardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 },
  unitCardActions: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 6 },
  topTitle: { color: "#111827", fontSize: 20, fontWeight: "900", textAlign: "right" },
  topSubtitle: { color: "#6b7280", fontSize: 11, fontWeight: "800", textAlign: "right", marginTop: 2 },
  detailsActionsBox: { alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 18, padding: 5, marginBottom: 10, borderWidth: 1, borderColor: "#EDECE9" },
  serviceChip: {
    width: "48.5%",
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  serviceIconWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#EEF2F7" },
  serviceText: { flex: 1, color: "#111827", fontSize: 12, fontWeight: "900", textAlign: "right" },
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E6E9E6",
    shadowColor: "#0f766e",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  entityLabel: {
    overflow: "hidden",
    alignSelf: "flex-end",
    color: "#0f766e",
    backgroundColor: "#ECFDF5",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 4,
  },
  title: {
    color: "#111827",
    fontSize: 22,
    lineHeight: 31,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 2,
  },
  headerStatsRow: { flexDirection: "row-reverse", gap: 8, marginTop: 12, flexWrap: "wrap" },
  statPill: {
    overflow: "hidden",
    backgroundColor: "#F0FDF4",
    color: "#065F46",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: "800",
    fontSize: 12,
  },
  headerServicesWrap: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  headerServicesHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  headerServicesTitle: { color: "#374151", fontSize: 12, fontWeight: "900", textAlign: "right" },
  headerServicesGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  tabsWrap: { backgroundColor: "#DDDBD6", borderRadius: 18, padding: 4, flexDirection: "row-reverse", gap: 4, marginBottom: 12 },
  tabButton: { flex: 1, borderRadius: 14, paddingVertical: 9, alignItems: "center" },
  tabButtonActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 },
  tabText: { fontSize: 12, fontWeight: "900", color: "#6b7280" },
  tabTextActive: { color: "#111827" },
  loadingBox: { backgroundColor: "#fff", borderRadius: 20, padding: 18, alignItems: "center", gap: 10 },
  loadingText: { color: "#6b7280", fontWeight: "800" },
  errorBox: { backgroundColor: "#fff1f2", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#fecdd3" },
  errorTitle: { color: "#9f1239", fontSize: 16, fontWeight: "900", textAlign: "right" },
  errorText: { color: "#be123c", marginTop: 8, textAlign: "right", lineHeight: 22 },
  retryButton: { marginTop: 12, backgroundColor: "#111827", borderRadius: 14, paddingVertical: 11, alignItems: "center" },
  retryText: { color: "#fff", fontWeight: "900" },
  sectionCard: { backgroundColor: "#fff", borderRadius: 22, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#EDECE9", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 1 },
  accordionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  accordionChevronBox: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F7F6F4", alignItems: "center", justifyContent: "center" },
  accordionTitleBlock: { flex: 1, alignItems: "flex-end" },
  accordionTitle: { color: "#111827", fontSize: 15, fontWeight: "900", textAlign: "right" },
  accordionBody: { marginTop: 8 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827", textAlign: "right", marginBottom: 8 },
  countBadge: { overflow: "hidden", backgroundColor: "#eff6ff", color: "#065F44", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontWeight: "900" },
  fieldRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  fieldLabel: { color: "#6b7280", fontSize: 13, fontWeight: "800", textAlign: "right", width: 116 },
  fieldValue: { flex: 1, color: "#111827", fontSize: 14, fontWeight: "800", textAlign: "right" },
  relatedCard: { backgroundColor: "#F7F6F4", borderRadius: 18, padding: 11, marginTop: 8, borderWidth: 1, borderColor: "#edf2f7" },
  relatedTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  relatedTitleWrap: { flex: 1, alignItems: "flex-end" },
  relatedEntity: { color: "#6b7280", fontSize: 11, fontWeight: "900" },
  relatedTitle: { color: "#111827", fontSize: 15, fontWeight: "900", marginTop: 2, textAlign: "right" },
  relatedSubtitle: { marginTop: 6, color: "#4b5563", fontSize: 12, fontWeight: "700", textAlign: "right" },
  badge: { overflow: "hidden", backgroundColor: "#ecfdf5", color: "#047857", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: "900" },
  badgeSuccess: { backgroundColor: "#ecfdf5", color: "#047857" },
  badgeWarning: { backgroundColor: "#fffbeb", color: "#b45309" },
  badgeDanger: { backgroundColor: "#fee2e2", color: "#dc2626" },
  metaRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 8 },
  metaPill: { overflow: "hidden", backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, color: "#6b7280", fontSize: 11, fontWeight: "800" },
  paymentQuickRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 },
  payButton: { backgroundColor: "#16a34a", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  payButtonText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  expandHint: { color: "#6b7280", fontSize: 12, fontWeight: "800" },
  inlinePaymentDetails: { backgroundColor: "#fff", borderRadius: 14, padding: 10, marginTop: 10, borderWidth: 1, borderColor: "#EDECE9" },
  inlineRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  inlineLabel: { width: 112, color: "#6b7280", fontWeight: "900", textAlign: "right", fontSize: 12 },
  inlineValue: { flex: 1, color: "#111827", fontWeight: "800", textAlign: "right", fontSize: 13 },
  emptyBox: { backgroundColor: "#F7F6F4", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#EDECE9" },
  emptyText: { color: "#6b7280", textAlign: "center", fontWeight: "800" },
});
