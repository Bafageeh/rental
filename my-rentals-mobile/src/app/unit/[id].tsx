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

type FieldItem = {
  key: string;
  label: string;
  value: string | number | null;
};

type RelatedItem = {
  id: number;
  entity: string;
  title: string;
  subtitle?: string;
  badge?: string | null;
  route?: string | null;
  meta?: string[];
};

type RelatedSection = {
  key: string;
  title: string;
  count: number;
  items: RelatedItem[];
};

type DetailsResponse = {
  id: number;
  title: string;
  entity_title?: string;
  fields: FieldItem[];
  sections: RelatedSection[];
};

function valueOrDash(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
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

export default function UnitDetailsRoute() {
  const params = useLocalSearchParams<{ id: string; source?: string; return_to?: string }>();
  const id = String(params.id || "");
  const [data, setData] = useState<DetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

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
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      const response = await apiGet(`/relation-manager/related/unit/${id}`);
      setData(response as DetailsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل تفاصيل الوحدة");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(false);
  }, [id]);

  const title = data?.title || "جاري التحميل...";
  const propertyId = valueOrDash(fieldValue(data?.fields, "property_id"));
  const sourceReturnTo = typeof params.return_to === "string" && params.return_to ? params.return_to : "";
  const detailsReturnTo = `/unit/${id}${sourceReturnTo ? `?return_to=${encodeURIComponent(sourceReturnTo)}` : ""}`;
  const deleteReturnTo = sourceReturnTo || (propertyId !== "-" ? `/property/${propertyId}` : "/properties");

  const primaryFields = useMemo(() => {
    const preferred = ["property_id", "owner_id", "unit_number", "floor", "type", "status", "rent_amount"];
    const fields = data?.fields || [];
    return [
      ...fields.filter((field) => preferred.includes(field.key)),
      ...fields.filter((field) => !preferred.includes(field.key)),
    ];
  }, [data?.fields]);

  const relatedCount = useMemo(
    () => (data?.sections || []).reduce((sum, section) => sum + (section.count || section.items.length || 0), 0),
    [data?.sections],
  );

  function openEditScreen() {
    router.push({
      pathname: "/unit-edit/[id]",
      params: {
        id,
        return_to: detailsReturnTo,
        delete_return_to: deleteReturnTo,
      },
    } as never);
  }

  function openUnitService(path: string, extraQuery = "") {
    const unitName = encodeURIComponent(title || `وحدة ${id}`);
    const suffix = extraQuery ? `&${extraQuery}` : "";
    router.push(`${path}?unit_id=${id}&unit_name=${unitName}${suffix}` as never);
  }

  function deleteUnit() {
    Alert.alert("حذف الوحدة", "هل تريد حذف هذه الوحدة؟ إذا كانت مرتبطة بعقود سيتم منع الحذف تلقائيًا.", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await apiPost(`/edit-delete-center/units/${id}/delete`, {});
            router.replace(deleteReturnTo as never);
          } catch (e) {
            Alert.alert("تعذر الحذف", e instanceof Error ? e.message : "فشل حذف الوحدة");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>الوحدة</Text>
          <Text style={styles.topSubtitle}>تفاصيل الوحدة والخدمات المرتبطة بها</Text>
        </View>

        <View style={styles.headerCard}>
          <Text style={styles.entityLabel}>وحدة</Text>
          <Text numberOfLines={2} style={styles.title}>{title}</Text>
          <View style={styles.headerStatsRow}>
            <Text style={styles.statPill}>العقود: {relatedCount}</Text>
            <Text style={styles.statPill}>رقم السجل: {valueOrDash(id)}</Text>
          </View>
        </View>

        <View style={styles.actionsBox}>
          <TouchableOpacity style={[styles.roundAction, styles.deleteAction]} onPress={deleteUnit} activeOpacity={0.85}>
            <Text style={styles.roundActionText}>🗑️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.roundAction, styles.editAction]} onPress={openEditScreen} activeOpacity={0.85}>
            <Text style={styles.roundActionText}>✏️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.servicesCard}>
          <View style={styles.servicesHeaderRow}>
            <View style={styles.servicesTitleBlock}>
              <Text style={styles.servicesTitle}>خدمات الوحدة</Text>
              <Text style={styles.servicesHint}>العقود والملفات لهذه الوحدة فقط</Text>
            </View>
            <Ionicons name="grid-outline" size={18} color="#6b7280" />
          </View>
          <View style={styles.servicesGrid}>
            <ServiceChip icon="documents-outline" label="العقود" onPress={() => openUnitService("/contracts")} />
            <ServiceChip icon="create-outline" label="إنشاء عقد" onPress={() => openUnitService("/create-contract")} />
            <ServiceChip icon="cloud-upload-outline" label="رفع عقد" onPress={() => openUnitService("/upload-contract")} />
            <ServiceChip icon="images-outline" label="الوسائط" onPress={() => openUnitService("/files", "mode=media")} />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>جاري تحميل التفاصيل...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>تعذر تحميل تفاصيل الوحدة</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => load(false)}>
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && !error ? (
          <>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>البيانات الأساسية</Text>
                <Text style={styles.sectionSubtitle}>{primaryFields.length} حقل</Text>
              </View>
              {primaryFields.map((field) => (
                <View key={field.key} style={styles.fieldRow}>
                  <Text style={styles.fieldValue}>{valueOrDash(field.value)}</Text>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                </View>
              ))}
            </View>

            {(data?.sections || []).map((section) => (
              <View key={section.key} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionSubtitle}>{section.count} عنصر</Text>
                </View>
                {section.items.length ? section.items.map((item) => (
                  <TouchableOpacity key={`${item.entity}-${item.id}`} style={styles.relatedCard} activeOpacity={0.86} onPress={() => router.push(relationRoute(item) as never)}>
                    <View style={styles.relatedTopRow}>
                      {item.badge ? <Text style={styles.badge}>{item.badge}</Text> : <View />}
                      <View style={styles.relatedTitleWrap}>
                        <Text numberOfLines={1} style={styles.relatedTitle}>{item.title}</Text>
                        {item.subtitle ? <Text numberOfLines={2} style={styles.relatedSubtitle}>{item.subtitle}</Text> : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                )) : <Text style={styles.emptyText}>لا توجد عناصر مرتبطة.</Text>}
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
  actionsBox: { alignSelf: "flex-start", flexDirection: "row", gap: 8, backgroundColor: "#fff", borderRadius: 18, padding: 5, marginBottom: 10, borderWidth: 1, borderColor: "#EDECE9" },
  roundAction: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  editAction: { backgroundColor: "#0F9B6F" },
  deleteAction: { backgroundColor: "#dc2626" },
  roundActionText: { fontSize: 22 },
  servicesCard: { backgroundColor: "#fff", borderRadius: 17, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#EDECE9" },
  servicesHeaderRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 },
  servicesTitleBlock: { flex: 1, alignItems: "flex-end" },
  servicesTitle: { color: "#111827", fontSize: 15, fontWeight: "900", textAlign: "right" },
  servicesHint: { color: "#6b7280", fontSize: 11, fontWeight: "800", textAlign: "right", marginTop: 1 },
  servicesGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  serviceChip: { width: "48.5%", minHeight: 46, borderRadius: 14, backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row-reverse", alignItems: "center", gap: 7, paddingHorizontal: 9, paddingVertical: 7 },
  serviceIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  serviceText: { flex: 1, color: "#111827", fontSize: 12, fontWeight: "900", textAlign: "right" },
  loadingBox: { backgroundColor: "#fff", borderRadius: 20, padding: 18, alignItems: "center", gap: 10 },
  loadingText: { color: "#6b7280", fontWeight: "800" },
  errorBox: { backgroundColor: "#fff1f2", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#fecdd3" },
  errorTitle: { color: "#9f1239", fontSize: 16, fontWeight: "900", textAlign: "right" },
  errorText: { color: "#be123c", marginTop: 8, textAlign: "right", lineHeight: 22 },
  retryButton: { marginTop: 12, backgroundColor: "#111827", borderRadius: 14, paddingVertical: 11, alignItems: "center" },
  retryText: { color: "#fff", fontWeight: "900" },
  sectionCard: { backgroundColor: "#fff", borderRadius: 22, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#EDECE9" },
  sectionHeader: { alignItems: "flex-end", marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827", textAlign: "right" },
  sectionSubtitle: { color: "#9ca3af", fontSize: 11, fontWeight: "800", textAlign: "right", marginTop: 2 },
  fieldRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  fieldLabel: { color: "#6b7280", fontSize: 13, fontWeight: "800", textAlign: "right", width: 116 },
  fieldValue: { flex: 1, color: "#111827", fontSize: 14, fontWeight: "800", textAlign: "right" },
  relatedCard: { backgroundColor: "#F7F6F4", borderRadius: 18, padding: 11, marginTop: 8, borderWidth: 1, borderColor: "#edf2f7" },
  relatedTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  relatedTitleWrap: { flex: 1, alignItems: "flex-end" },
  relatedTitle: { color: "#111827", fontSize: 15, fontWeight: "900", textAlign: "right" },
  relatedSubtitle: { marginTop: 5, color: "#4b5563", fontSize: 12, fontWeight: "700", textAlign: "right" },
  badge: { overflow: "hidden", backgroundColor: "#dcfce7", color: "#166534", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: "900" },
  emptyText: { color: "#6b7280", fontWeight: "800", textAlign: "center", padding: 14 },
});
