import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGet } from "../lib/api";
import InlineEditDeleteActions from "./InlineEditDeleteActions";

import { smartBack } from "@/lib/navigationHistory";
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
  route?: string;
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

function makeRoute(entity: EntityKey, id: number, fallback?: string) {
  if (fallback) return fallback;
  const key = normalizeEntity(String(entity));
  return `${routeByEntity[key] || `/${key}`}/${id}`;
}

function badgeStyleForText(badge?: string | null) {
  const text = String(badge || "").trim().toLowerCase();

  if (text.includes("متأخر") || text.includes("متاخر") || text.includes("overdue")) {
    return [styles.badge, styles.badgeDanger];
  }

  if (text.includes("مستحق") || text.includes("due")) {
    return [styles.badge, styles.badgeWarning];
  }

  if (text.includes("مدفوع") || text.includes("paid")) {
    return [styles.badge, styles.badgeSuccess];
  }

  return styles.badge;
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

function RelatedCard({ item }: { item: RelatedItem }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.relatedCard}
      onPress={() => router.push(makeRoute(item.entity, item.id, item.route) as never)}
    >
      <View style={styles.relatedTopRow}>
        {item.badge ? <Text style={badgeStyleForText(item.badge)}>{item.badge}</Text> : <View />}
        <View style={styles.relatedTitleWrap}>
          <Text style={styles.relatedEntity}>{item.entity_title || entityTitle[String(item.entity)] || "سجل"}</Text>
          <Text numberOfLines={1} style={styles.relatedTitle}>{item.title}</Text>
        </View>
      </View>
      {item.subtitle ? <Text numberOfLines={1} style={styles.relatedSubtitle}>{item.subtitle}</Text> : null}
      {item.meta && item.meta.length ? (
        <View style={styles.metaRow}>
          {item.meta.slice(0, 3).map((meta) => (
            <Text key={meta} numberOfLines={1} style={styles.metaPill}>{meta}</Text>
          ))}
        </View>
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
        <TouchableOpacity
          key={key}
          activeOpacity={0.85}
          onPress={() => onChange(key)}
          style={[styles.tabButton, active === key ? styles.tabButtonActive : null]}
        >
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

  function getDetailFieldValue(keys: string[]) {
    const fields = data?.fields || [];
    for (const key of keys) {
      const field = fields.find((item) => item.key === key);
      const value = field?.raw_value ?? field?.value;
      if (value !== null && value !== undefined && value !== "") return String(value);
    }
    return "";
  }

  function openAddUnit() {
    const query = new URLSearchParams();
    query.set("create", "1");
    const propertyId = getDetailFieldValue(["property_id"]);
    const ownerId = getDetailFieldValue(["owner_id"]);
    if (propertyId) query.set("property_id", propertyId);
    if (ownerId) query.set("owner_id", ownerId);
    router.push(`/units?${query.toString()}` as never);
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
        <View style={styles.topBar}>
          <View style={styles.topActions}>
            {normalizedEntity === "unit" ? (
              <TouchableOpacity onPress={openAddUnit} style={styles.addUnitButton} activeOpacity={0.85}>
                <Text style={styles.addUnitButtonText}>＋</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => smartBack()} style={styles.backButton}>
              <Text style={styles.backText}>→ رجوع</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.topTitle}>{entityTitle[normalizedEntity] || "التفاصيل"}</Text>
        </View>

        <View style={styles.headerCard}>
          <Text style={styles.entityLabel}>{data?.entity_title || entityTitle[normalizedEntity] || "تفاصيل"}</Text>
          <Text numberOfLines={2} style={styles.title}>{data?.title || "جاري التحميل..."}</Text>
          <View style={styles.headerStatsRow}>
            <Text style={styles.statPill}>{relatedLabel}: {relatedCount}</Text>
            <Text style={styles.statPill}>رقم السجل: {valueOrDash(id)}</Text>
          </View>
        </View>

        <View style={styles.detailsActionsBox}>
          <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails onChanged={() => load(false)} />
        </View>

        {normalizedEntity === "unit" ? (
          <View style={styles.servicesCard}>
            <Text style={styles.sectionTitle}>خدمات الوحدة</Text>
            <Text style={styles.servicesHint}>العقود والملفات هنا مرتبطة بهذه الوحدة فقط.</Text>
            <View style={styles.servicesGrid}>
              <TouchableOpacity style={styles.serviceButton} onPress={() => openUnitService("/contracts")}>
                <Text style={styles.serviceIcon}>📑</Text>
                <Text style={styles.serviceText}>العقود</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.serviceButton} onPress={() => openUnitService("/create-contract")}>
                <Text style={styles.serviceIcon}>📝</Text>
                <Text style={styles.serviceText}>إنشاء عقد</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.serviceButton} onPress={() => openUnitService("/upload-contract")}>
                <Text style={styles.serviceIcon}>📤</Text>
                <Text style={styles.serviceText}>رفع عقد</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.serviceButton} onPress={() => openUnitService("/files", "mode=media")}>
                <Text style={styles.serviceIcon}>🖼️</Text>
                <Text style={styles.serviceText}>الملفات والوسائط</Text>
              </TouchableOpacity>
            </View>
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
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>البيانات الأساسية</Text>
            {primaryFields.length ? primaryFields.map((field) => <FieldRow key={field.key} field={field} />) : <EmptyState text="لا توجد بيانات أساسية." />}
            {otherFields.length ? (
              <>
                <Text style={styles.subSectionTitle}>بيانات إضافية</Text>
                {otherFields.map((field) => <FieldRow key={field.key} field={field} />)}
              </>
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
                {section.items.length ? section.items.map((item) => <RelatedCard key={`${item.entity}-${item.id}`} item={item} />) : <EmptyState text="لا توجد عناصر في هذا القسم." />}
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
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  addUnitButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center" },
  addUnitButtonText: { color: "#ffffff", fontSize: 24, lineHeight: 28, fontWeight: "900" },
  topTitle: { flex: 1, color: "#111827", fontSize: 20, fontWeight: "900", textAlign: "right" },
  backButton: { backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#DDDBD6" },
  backText: { color: "#111827", fontWeight: "900" },
  detailsActionsBox: { backgroundColor: "#fff", borderRadius: 18, padding: 8, marginBottom: 12, borderWidth: 1, borderColor: "#EDECE9" },
  servicesCard: { backgroundColor: "#fff", borderRadius: 18, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#EDECE9" },
  servicesHint: { color: "#6b7280", fontSize: 12, fontWeight: "800", textAlign: "right", marginBottom: 10 },
  servicesGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  serviceButton: { width: "48%", minHeight: 78, borderRadius: 16, backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", alignItems: "center", justifyContent: "center", padding: 8 },
  serviceIcon: { fontSize: 24, marginBottom: 4 },
  serviceText: { color: "#111827", fontSize: 13, fontWeight: "900", textAlign: "center" },
  headerCard: {
    backgroundColor: "#111827",
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },
  entityLabel: {
    alignSelf: "flex-end",
    color: "#c7d2fe",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 6,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    lineHeight: 31,
    fontWeight: "900",
    textAlign: "right",
  },
  headerStatsRow: {
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  statPill: {
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#fff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: "800",
    fontSize: 12,
  },
  tabsWrap: {
    backgroundColor: "#DDDBD6",
    borderRadius: 18,
    padding: 4,
    flexDirection: "row-reverse",
    gap: 4,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 9,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  tabText: { fontSize: 12, fontWeight: "900", color: "#6b7280" },
  tabTextActive: { color: "#111827" },
  loadingBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    alignItems: "center",
    gap: 10,
  },
  loadingText: { color: "#6b7280", fontWeight: "800" },
  errorBox: {
    backgroundColor: "#fff1f2",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorTitle: { color: "#9f1239", fontSize: 16, fontWeight: "900", textAlign: "right" },
  errorText: { color: "#be123c", marginTop: 8, textAlign: "right", lineHeight: 22 },
  retryButton: {
    marginTop: 12,
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
  },
  retryText: { color: "#fff", fontWeight: "900" },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EDECE9",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    textAlign: "right",
    marginBottom: 8,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#374151",
    textAlign: "right",
    marginTop: 14,
    marginBottom: 8,
  },
  countBadge: {
    overflow: "hidden",
    backgroundColor: "#eff6ff",
    color: "#065F44",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontWeight: "900",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  fieldLabel: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    width: 116,
  },
  fieldValue: {
    flex: 1,
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  relatedCard: {
    backgroundColor: "#F7F6F4",
    borderRadius: 18,
    padding: 11,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#edf2f7",
  },
  relatedTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  relatedTitleWrap: { flex: 1, alignItems: "flex-end" },
  relatedEntity: { color: "#6b7280", fontSize: 11, fontWeight: "900" },
  relatedTitle: { color: "#111827", fontSize: 15, fontWeight: "900", marginTop: 2, textAlign: "right" },
  relatedSubtitle: { marginTop: 6, color: "#4b5563", fontSize: 12, fontWeight: "700", textAlign: "right" },
  badge: {
    overflow: "hidden",
    backgroundColor: "#ecfdf5",
    color: "#047857",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "900",
  },
  badgeSuccess: {
    backgroundColor: "#ecfdf5",
    color: "#047857",
  },
  badgeWarning: {
    backgroundColor: "#fffbeb",
    color: "#b45309",
  },
  badgeDanger: {
    backgroundColor: "#fee2e2",
    color: "#dc2626",
  },
  metaRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 8 },
  metaPill: {
    overflow: "hidden",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "800",
  },
  emptyBox: {
    backgroundColor: "#F7F6F4",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EDECE9",
  },
  emptyText: { color: "#6b7280", textAlign: "center", fontWeight: "800" },
});
