import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import InlineEditDeleteActions from "../components/InlineEditDeleteActions";
import { apiGetScoped } from "../lib/api";
import { Lookups, labelForResource, resourceLabel, translateValue } from "../lib/arabicDisplay";

import { smartBack } from "@/lib/navigationHistory";
type TabName = "details" | "related";

type RecordItem = {
  id: number;
  resource: string;
  resource_label: string;
  title: string;
  fields: Record<string, unknown>;
  editable_fields: string[];
};

type RelatedOption = {
  id: number;
  label: string;
  owner_id?: number | string | null;
  property_id?: number | string | null;
  unit_id?: number | string | null;
  tenant_id?: number | string | null;
  contract_number?: string | null;
  government_contract_number?: string | null;
  status?: string | null;
  type?: string | null;
  rent_amount?: string | number | null;
  unit_scope?: string | null;
  city?: string | null;
  district?: string | null;
  [key: string]: unknown;
};

type RelationOptionsPayload = {
  owners?: RelatedOption[];
  properties?: RelatedOption[];
  units?: RelatedOption[];
  tenants?: RelatedOption[];
  contracts?: RelatedOption[];
};

function optionName(options: RelatedOption[] = [], id: unknown) {
  if (!id) return "غير محدد";
  return options.find((item) => String(item.id) === String(id))?.label || "غير معروف";
}

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function normalizeInitialTab(value?: string | string[]): TabName {
  const tab = Array.isArray(value) ? value[0] : value;

  if (tab === "related") return "related";

  return "details";
}

function relatedTitleForResource(resource?: string | null) {
  if (resource === "owners") return "العقارات التابعة للمالك";
  if (resource === "properties") return "الوحدات التابعة للعقار";
  if (resource === "units") return "العقود التابعة للوحدة";
  if (resource === "tenants") return "عقود المستأجر";
  if (resource === "contracts") return "عقود ومرفقات العقد";
  return "عقاراتي";
}

export default function RecordDetailsScreen() {
  const params = useLocalSearchParams<{ resource?: string; id?: string; tab?: string }>();
  const resource = Array.isArray(params.resource) ? params.resource[0] : params.resource;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [tab, setTab] = useState<TabName>(normalizeInitialTab(params.tab));
  const [record, setRecord] = useState<RecordItem | null>(null);
  const [lookups, setLookups] = useState<Lookups>({});
  const [relationOptions, setRelationOptions] = useState<RelationOptionsPayload>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadAll() {
    if (!resource || !id) {
      Alert.alert("تنبيه", "بيانات الصفحة غير مكتملة");
      return;
    }

    try {
      setLoading(true);

      const [recordData, lookupData, optionsData] = await Promise.all([
        apiGetScoped(
          `/edit-delete-center/${resource}?id=${encodeURIComponent(id)}`,
          `/my/edit-delete-center/${resource}?id=${encodeURIComponent(id)}`
        ),
        apiGetScoped("/relation-manager/options", "/my/relation-manager/options").catch(() => ({})),
        apiGetScoped("/relation-manager/options", "/my/relation-manager/options").catch(() => ({})),
      ]);

      const item = Array.isArray(recordData?.items) ? recordData.items[0] : null;

      setRecord(item || null);
      setLookups(lookupData || {});
      setRelationOptions(optionsData || {});
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل التفاصيل");
    } finally {
      setLoading(false);
    }
  }
  async function refreshScreen() {
    try {
      setRefreshing(true);
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [resource, id]);

  const displayFields = useMemo(() => {
    if (!record) return [];

    const preferred = [
      "name",
      "title",
      "owner_id",
      "property_id",
      "unit_id",
      "tenant_id",
      "contract_id",
      "phone",
      "email",
      "status",
      "property_type",
      "usage_type",
      "management_type",
      "national_short_address",
      "property_area",
      "amount",
      "rent_amount",
      "due_date",
      "start_date",
      "end_date",
      "city",
      "district",
      "address",
      "notes",
    ];

    const hidden = ["password", "remember_token", "location_lat", "location_lng", "national_address"];
    const keys = Object.keys(record.fields || {}).filter((field) => !hidden.includes(field));

    return [...preferred.filter((field) => keys.includes(field)), ...keys.filter((field) => !preferred.includes(field))];
  }, [record]);

  const relatedGroups = useMemo(() => {
    const groups: Array<{
      title: string;
      resource: string;
      items: RelatedOption[];
      icon: string;
      emptyText: string;
    }> = [];

    if (!id || !resource) return groups;

    if (resource === "owners") {
      groups.push({
        title: "العقارات التابعة لهذا المالك",
        resource: "properties",
        icon: "🏢",
        emptyText: "لا توجد عقارات تابعة لهذا المالك",
        items: (relationOptions.properties || []).filter((item) => String(item.owner_id || "") === String(id)),
      });

      groups.push({
        title: "الوحدات الخاصة بهذا المالك",
        resource: "units",
        icon: "🚪",
        emptyText: "لا توجد وحدات خاصة بهذا المالك",
        items: (relationOptions.units || []).filter((item) => {
          const directOwner = String(item.owner_id || "") === String(id);
          const noProperty = !item.property_id;
          return directOwner && noProperty;
        }),
      });
    }

    if (resource === "properties") {
      groups.push({
        title: "الوحدات التابعة لهذا العقار",
        resource: "units",
        icon: "🚪",
        emptyText: "لا توجد وحدات تحت هذا العقار",
        items: (relationOptions.units || []).filter((item) => String(item.property_id || "") === String(id)),
      });

      groups.push({
        title: "العقود التابعة لهذا العقار",
        resource: "contracts",
        icon: "📄",
        emptyText: "لا توجد عقود تابعة لهذا العقار",
        items: (relationOptions.contracts || []).filter((item) => String(item.property_id || "") === String(id)),
      });
    }

    if (resource === "units") {
      groups.push({
        title: "العقود التابعة لهذه الوحدة",
        resource: "contracts",
        icon: "📄",
        emptyText: "لا توجد عقود لهذه الوحدة",
        items: (relationOptions.contracts || []).filter((item) => String(item.unit_id || "") === String(id)),
      });
    }

    if (resource === "tenants") {
      groups.push({
        title: "عقود هذا المستأجر",
        resource: "contracts",
        icon: "📄",
        emptyText: "لا توجد عقود لهذا المستأجر",
        items: (relationOptions.contracts || []).filter((item) => String(item.tenant_id || "") === String(id)),
      });
    }

    return groups;
  }, [resource, id, relationOptions]);

  const relatedCount = relatedGroups.reduce((total, group) => total + group.items.length, 0);

  function goToRelatedItem(targetResource: string, targetId: number) {
    router.push({
      pathname: "/record-details",
      params: { resource: targetResource, id: String(targetId), tab: "details" },
    } as never);
  }

  function renderRelatedItem(groupResource: string, item: RelatedOption, icon: string) {
    return (
      <TouchableOpacity
        key={`${groupResource}-${item.id}`}
        style={styles.relatedCard}
        activeOpacity={0.85}
        onPress={() => goToRelatedItem(groupResource, item.id)}
      >
        <View style={styles.relatedIconBox}>
          <Text style={styles.relatedIcon}>{icon}</Text>
        </View>

        <View style={styles.relatedBody}>
          <Text style={styles.relatedTitle}>{item.label}</Text>

          {groupResource === "properties" ? (
            <Text style={styles.relatedMeta}>
              {valueText(item.city)} / {valueText(item.district)} • المالك: {optionName(relationOptions.owners || [], item.owner_id)}
            </Text>
          ) : null}

          {groupResource === "units" ? (
            <Text style={styles.relatedMeta}>
              {item.property_id ? `تحت عقار: ${optionName(relationOptions.properties || [], item.property_id)}` : "وحدة مستقلة"} • الحالة: {valueText(item.status)}
            </Text>
          ) : null}

          {groupResource === "contracts" ? (
            <Text style={styles.relatedMeta}>
              المستأجر: {optionName(relationOptions.tenants || [], item.tenant_id)} • الحالة: {valueText(item.status)}
            </Text>
          ) : null}
        </View>

        <Text style={styles.relatedArrow}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => smartBack()}>
            <Text style={styles.backText}>رجوع</Text>
          </TouchableOpacity>

          <View style={styles.headerTextBox}>
            <Text style={styles.title}>{record?.title || "تفاصيل"}</Text>
            <Text style={styles.subtitle}>{record?.resource_label || resourceLabel(resource)}</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tabButton, tab === "details" ? styles.tabActive : null]} onPress={() => setTab("details")}>
            <Text style={[styles.tabIcon, tab === "details" ? styles.tabTextActive : null]}>📋</Text>
            <Text style={[styles.tabText, tab === "details" ? styles.tabTextActive : null]}>التفاصيل</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tabButton, tab === "related" ? styles.tabActive : null]} onPress={() => setTab("related")}>
            <Text style={[styles.tabIcon, tab === "related" ? styles.tabTextActive : null]}>🏢</Text>
            <Text style={[styles.tabText, tab === "related" ? styles.tabTextActive : null]}>عقاراتي</Text>
          </TouchableOpacity>
        </View>
{!loading && record && relatedCount > 0 ? (
          <TouchableOpacity style={styles.relatedShortcut} onPress={() => setTab("related")}>
            <Text style={styles.relatedShortcutText}>
              عرض {relatedCount} من {relatedTitleForResource(resource)}
            </Text>
          </TouchableOpacity>
        ) : null}

        {!loading && record && resource && id ? (
          <View style={styles.detailsActionsBox}>
            <Text style={styles.detailsActionsTitle}>إجراءات</Text>
            <InlineEditDeleteActions resource={resource} id={id} hideDetails onChanged={loadAll} />
          </View>
        ) : null}

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل التفاصيل...</Text>
          </View>
        ) : null}

        {!loading && !record ? (
          <View style={styles.box}>
            <Text style={styles.boxText}>لم يتم العثور على البيانات</Text>
          </View>
        ) : null}

        {!loading && record && tab === "details" ? (
          <View style={styles.card}>
            {displayFields.map((field) => (
              <View key={field} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{labelForResource(resource, field)}</Text>
                <Text style={styles.fieldValue}>{translateValue(field, record.fields?.[field], lookups)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {!loading && record && tab === "related" ? (
          <>
            <View style={styles.relatedHeaderCard}>
              <Text style={styles.relatedHeaderTitle}>{relatedTitleForResource(resource)}</Text>
              <Text style={styles.relatedHeaderText}>
                اضغط على أي بطاقة للانتقال مباشرة إلى صفحة تفاصيلها.
              </Text>
            </View>

            {relatedGroups.length === 0 ? (
              <View style={styles.box}>
                <Text style={styles.boxText}>لا توجد عناصر تابعة مخصصة لهذا النوع</Text>
              </View>
            ) : null}

            {relatedGroups.map((group) => (
              <View key={`${group.resource}-${group.title}`} style={styles.relatedGroup}>
                <View style={styles.relatedGroupHeader}>
                  <Text style={styles.relatedGroupCount}>{group.items.length}</Text>
                  <Text style={styles.relatedGroupTitle}>{group.title}</Text>
                </View>

                {group.items.length === 0 ? (
                  <Text style={styles.relatedEmpty}>{group.emptyText}</Text>
                ) : null}

                {group.items.map((item) => renderRelatedItem(group.resource, item, group.icon))}
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 16, paddingBottom: 50 },
  header: { backgroundColor: "#111827", borderRadius: 18, padding: 14, flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 12 },
  backButton: { backgroundColor: "#374151", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  backText: { color: "#fff", fontWeight: "900" },
  headerTextBox: { flex: 1 },
  title: { color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "right" },
  subtitle: { color: "#C4C1BB", fontWeight: "800", textAlign: "right", marginTop: 4 },
  tabs: { flexDirection: "row-reverse", gap: 7, marginBottom: 10 },
  tabButton: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 8, alignItems: "center" },
  tabActive: { backgroundColor: "#111827" },
  tabIcon: { fontSize: 17, marginBottom: 2 },
  tabText: { color: "#374151", fontWeight: "900", fontSize: 11 },
  tabTextActive: { color: "#fff" },
  refreshButton: { backgroundColor: "#0F9B6F", borderRadius: 12, padding: 11, alignItems: "center", marginBottom: 10 },
  refreshText: { color: "#fff", fontWeight: "900" },
  relatedShortcut: { backgroundColor: "#ecfeff", borderRadius: 12, padding: 11, alignItems: "center", marginBottom: 10, borderWidth: 1, borderColor: "#bae6fd" },
  relatedShortcutText: { color: "#0369a1", fontWeight: "900", textAlign: "center" },
  detailsActionsBox: { backgroundColor: "#fff", borderRadius: 16, padding: 10, marginBottom: 10 },
  detailsActionsTitle: { color: "#111827", fontWeight: "900", textAlign: "right", marginBottom: 4 },
  box: { backgroundColor: "#fff", borderRadius: 16, padding: 18, alignItems: "center", marginBottom: 12 },
  boxText: { color: "#5E5B55", marginTop: 8, textAlign: "center", fontWeight: "800" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 12 },
  fieldRow: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6", paddingVertical: 9 },
  fieldLabel: { color: "#374151", fontWeight: "900", textAlign: "right", marginBottom: 4 },
  fieldValue: { color: "#111827", fontWeight: "800", textAlign: "right", lineHeight: 22 },
  relatedHeaderCard: { backgroundColor: "#111827", borderRadius: 16, padding: 14, marginBottom: 10 },
  relatedHeaderTitle: { color: "#fff", fontSize: 18, fontWeight: "900", textAlign: "right" },
  relatedHeaderText: { color: "#C4C1BB", fontWeight: "800", textAlign: "right", marginTop: 5 },
  relatedGroup: { backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 12 },
  relatedGroupHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  relatedGroupTitle: { flex: 1, color: "#111827", fontWeight: "900", fontSize: 17, textAlign: "right" },
  relatedGroupCount: { backgroundColor: "#0F9B6F", color: "#fff", fontWeight: "900", borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 4 },
  relatedEmpty: { color: "#7A766F", fontWeight: "800", textAlign: "center", padding: 12 },
  relatedCard: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 10, marginBottom: 8, flexDirection: "row-reverse", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#EDECE9" },
  relatedIconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#e0f2fe", alignItems: "center", justifyContent: "center" },
  relatedIcon: { fontSize: 20 },
  relatedBody: { flex: 1 },
  relatedTitle: { color: "#111827", fontWeight: "900", textAlign: "right", marginBottom: 3 },
  relatedMeta: { color: "#7A766F", fontWeight: "700", textAlign: "right", lineHeight: 19 },
  relatedArrow: { color: "#9ca3af", fontSize: 28, fontWeight: "900" },
  historyCard: { backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 12 },
  historyHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: { backgroundColor: "#dbeafe", color: "#065F44", fontWeight: "900", borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 4 },
  badgeDanger: { backgroundColor: "#fee2e2", color: "#991b1b" },
  badgeOk: { backgroundColor: "#dcfce7", color: "#166534" },
  historyDate: { flex: 1, color: "#111827", fontWeight: "900", textAlign: "right" },
  historyText: { color: "#5E5B55", textAlign: "right", marginTop: 8, fontWeight: "700" },
  actionRow: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  darkButton: { flex: 1, backgroundColor: "#111827", borderRadius: 12, padding: 10, alignItems: "center" },
  greenButton: { flex: 1, backgroundColor: "#16a34a", borderRadius: 12, padding: 10, alignItems: "center" },
  whiteText: { color: "#fff", fontWeight: "900" },
  changeBox: { backgroundColor: "#F7F6F4", borderRadius: 12, padding: 10, marginTop: 10 },
  changeRow: { borderBottomWidth: 1, borderBottomColor: "#DDDBD6", paddingVertical: 8 },
  oldValue: { color: "#991b1b", textAlign: "right", marginBottom: 3 },
  newValue: { color: "#166534", textAlign: "right" },
  relationsTitle: { color: "#111827", fontWeight: "900", fontSize: 18, textAlign: "right" },
  blockersBox: { backgroundColor: "#fee2e2", borderRadius: 16, padding: 14, marginBottom: 12 },
  blockersTitle: { color: "#991b1b", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  blockerText: { color: "#991b1b", fontWeight: "800", textAlign: "right", marginBottom: 4 },
  relationCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12 },
});
