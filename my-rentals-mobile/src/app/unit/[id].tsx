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

function shouldOfferCascadeDelete(message: string) {
  return /ارتباط|الارتباطات|راجع التفاصيل|أكد الحذف|تأكيد|cascade|requires_confirmation/i.test(message);
}

export default function UnitDetailsRoute() {
  const params = useLocalSearchParams<{ id: string; source?: string; return_to?: string }>();
  const id = String(params.id || "");
  const [data, setData] = useState<DetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

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

  function closeMenu() {
    setMenuOpen(false);
  }

  function openEditScreen() {
    closeMenu();
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
    closeMenu();
    const unitName = encodeURIComponent(title || `وحدة ${id}`);
    const suffix = extraQuery ? `&${extraQuery}` : "";
    router.push(`${path}?unit_id=${id}&unit_name=${unitName}${suffix}` as never);
  }

  async function performUnitDelete(force = false) {
    try {
      await apiPost(`/edit-delete-center/units/${id}/delete`, force ? { force: true } : {});
      router.replace(deleteReturnTo as never);
    } catch (e) {
      const message = e instanceof Error ? e.message : "فشل حذف الوحدة";

      if (!force && shouldOfferCascadeDelete(message)) {
        Alert.alert(
          "تأكيد حذف الارتباطات",
          `${message}\n\nهل تؤكد حذف الوحدة مع جميع الارتباطات التابعة لها؟ سيتم حذف العقود والدفعات والملفات المرتبطة بهذه الوحدة.`,
          [
            { text: "إلغاء", style: "cancel" },
            {
              text: "تأكيد الحذف",
              style: "destructive",
              onPress: () => performUnitDelete(true),
            },
          ],
        );
        return;
      }

      Alert.alert("تعذر الحذف", message);
    }
  }

  function deleteUnit() {
    closeMenu();
    Alert.alert(
      "حذف الوحدة",
      "سيتم حذف الوحدة. إذا كانت عليها عقود أو دفعات أو ملفات مرتبطة سيظهر لك تأكيد إضافي لحذفها معها.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => performUnitDelete(false),
        },
      ],
    );
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

      {menuOpen ? <TouchableOpacity style={styles.floatingBackdrop} activeOpacity={1} onPress={closeMenu} /> : null}
      {menuOpen ? (
        <View style={styles.floatingMenu}>
          <FloatingMenuAction icon="create-outline" label="تعديل" color="#0F766E" onPress={openEditScreen} />
          <FloatingMenuAction icon="trash-outline" label="حذف" color="#DC2626" onPress={deleteUnit} />
          <FloatingMenuAction icon="documents-outline" label="العقود" onPress={() => openUnitService("/contracts")} />
          <FloatingMenuAction icon="create-outline" label="إنشاء عقد" onPress={() => openUnitService("/create-contract")} />
          <FloatingMenuAction icon="cloud-upload-outline" label="رفع عقد" onPress={() => openUnitService("/upload-contract")} />
          <FloatingMenuAction icon="cash-outline" label="المصروفات" onPress={() => openUnitService("/expenses")} />
          <FloatingMenuAction icon="images-outline" label="الوسائط" onPress={() => openUnitService("/files", "mode=media")} />
        </View>
      ) : null}
      <TouchableOpacity style={styles.floatingButton} activeOpacity={0.88} onPress={() => setMenuOpen((value) => !value)}>
        <Ionicons name={menuOpen ? "close" : "ellipsis-vertical"} size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function FloatingMenuAction({ icon, label, color = "#0F172A", onPress }: { icon: string; label: string; color?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.floatingMenuAction} activeOpacity={0.86} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.floatingMenuText, { color }]}>{label}</Text>
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
  floatingButton: { position: "absolute", left: 18, top: 14, width: 56, height: 56, borderRadius: 28, backgroundColor: "#0F766E", alignItems: "center", justifyContent: "center", shadowColor: "#0F172A", shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 10, zIndex: 60 },
  floatingBackdrop: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "transparent", zIndex: 40 },
  floatingMenu: { position: "absolute", left: 18, top: 78, width: 210, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", paddingVertical: 6, shadowColor: "#0F172A", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 12, zIndex: 70 },
  floatingMenuAction: { minHeight: 42, flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 10, paddingHorizontal: 14 },
  floatingMenuText: { fontWeight: "900", fontSize: 13, textAlign: "right" },
});