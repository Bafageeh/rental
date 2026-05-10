import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGetScoped } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type UnitListing = {
  id: number;
  unit_number?: string | null;
  floor?: string | null;
  type?: string | null;
  status?: string | null;
  rent_amount?: number;
  rooms_count?: number;
  bathrooms_count?: number;
  has_kitchen?: boolean | null;
  kitchen_type?: string | null;
  is_kitchen_installed?: boolean | null;
  has_living_room?: boolean | null;
  is_rooftop?: boolean | null;
  orientation?: string | null;
  listing_text?: string | null;
  property?: {
    id?: number;
    name?: string | null;
    city?: string | null;
    district?: string | null;
    address?: string | null;
    property_type?: string | null;
    parking_spots_count?: number;
    owner_name?: string | null;
    owner_phone?: string | null;
  } | null;
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function orientationLabel(value?: string | null) {
  if (value === "front") return "أمامية";
  if (value === "back") return "خلفية";
  return value || "-";
}

function kitchenLabel(item: UnitListing) {
  if (!item.has_kitchen) {
    return "لا";
  }

  const parts = ["نعم"];

  if (item.kitchen_type === "open") {
    parts.push("مفتوح");
  } else if (item.kitchen_type === "closed") {
    parts.push("مغلق");
  }

  if (item.is_kitchen_installed === true) {
    parts.push("مركب");
  } else if (item.is_kitchen_installed === false) {
    parts.push("غير مركب");
  }

  return parts.join(" - ");
}

export default function UnitMarketingScreen() {
  const [items, setItems] = useState<UnitListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterPropertyId, setFilterPropertyId] = useState("all");

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/unit-listings",
        "/my/unit-listings"
      );

      setItems(Array.isArray(result) ? result : []);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل الوحدات القابلة للتسويق");
    } finally {
      setLoading(false);
    }
  }

  async function shareListing(item: UnitListing) {
    try {
      await Share.share({
        message: item.listing_text || "وحدة متاحة للإيجار",
      });
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر مشاركة الإعلان");
    }
  }
  async function refreshScreen() {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const properties = useMemo(() => {
    const map = new Map<string, string>();

    items.forEach((item) => {
      const id = String(item.property?.id || "none");
      const name = item.property?.name || "عقار غير محدد";
      map.set(id, name);
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const visibleItems = filterPropertyId === "all"
    ? items
    : items.filter((item) => String(item.property?.id || "none") === filterPropertyId);

  const totalRent = visibleItems.reduce((sum, item) => sum + Number(item.rent_amount || 0), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>تسويق الشواغر</Text>
        <Text style={styles.subtitle}>
          إنشاء نص إعلان جاهز ومشاركة الوحدات الشاغرة في وسائل التواصل
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>الوحدات الشاغرة: {visibleItems.length}</Text>
          <Text style={styles.summaryText}>إجمالي الإيجارات المعروضة: {money(totalRent)}</Text>
        </View>
<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterChip, filterPropertyId === "all" ? styles.filterChipActive : null]}
            onPress={() => setFilterPropertyId("all")}
          >
            <Text style={[styles.filterText, filterPropertyId === "all" ? styles.filterTextActive : null]}>
              كل العقارات
            </Text>
          </TouchableOpacity>

          {properties.map((property) => (
            <TouchableOpacity
              key={property.id}
              style={[styles.filterChip, filterPropertyId === property.id ? styles.filterChipActive : null]}
              onPress={() => setFilterPropertyId(property.id)}
            >
              <Text style={[styles.filterText, filterPropertyId === property.id ? styles.filterTextActive : null]}>
                {property.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل الشواغر...</Text>
          </View>
        ) : null}

        {!loading && visibleItems.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد وحدات شاغرة قابلة للتسويق حاليًا</Text>
          </View>
        ) : null}

        {visibleItems.map((item) => {
          const expanded = expandedId === item.id;

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.badge}>متاحة</Text>
                <Text style={styles.cardTitle}>
                  {item.property?.name || "عقار"} — {item.unit_number || "وحدة"}
                </Text>
              </View>

              <Text style={styles.detail}>المدينة/الحي: {item.property?.city || "-"} / {item.property?.district || "-"}</Text>
              <Text style={styles.detail}>الدور: {item.floor || "-"}</Text>
              <Text style={styles.detail}>الغرف: {item.rooms_count ?? 0} | الحمامات: {item.bathrooms_count ?? 0}</Text>
              <Text style={styles.detail}>المطبخ: {kitchenLabel(item)}</Text>
              <Text style={styles.detail}>الصالة: {item.has_living_room ? "نعم" : "لا"}</Text>
              <Text style={styles.detail}>روف: {item.is_rooftop ? "نعم" : "لا"}</Text>
              <Text style={styles.detail}>الاتجاه: {orientationLabel(item.orientation)}</Text>
              <Text style={styles.amount}>الإيجار: {money(item.rent_amount)}</Text>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.previewButton]}
                  onPress={() => setExpandedId(expanded ? null : item.id)}
                >
                  <Text style={styles.actionText}>
                    {expanded ? "إخفاء النص" : "معاينة النص"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.shareButton]}
                  onPress={() => shareListing(item)}
                >
                  <Text style={styles.actionText}>مشاركة</Text>
                </TouchableOpacity>
              </View>

              {expanded ? (
                <View style={styles.previewBox}>
                  <Text style={styles.previewText}>{item.listing_text || "-"}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 18, paddingBottom: 50 },
  title: { fontSize: 30, fontWeight: "800", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", fontSize: 15, textAlign: "right", lineHeight: 22 },
  summaryBox: { backgroundColor: "#111827", borderRadius: 18, padding: 16, marginBottom: 14 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  primaryButton: { backgroundColor: "#0F9B6F", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  filtersRow: { flexDirection: "row-reverse", paddingBottom: 12 },
  filterChip: { backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginLeft: 8, borderWidth: 1, borderColor: "#DDDBD6" },
  filterChipActive: { backgroundColor: "#111827" },
  filterText: { color: "#374151", fontWeight: "800" },
  filterTextActive: { color: "#fff" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  badge: { backgroundColor: "#dcfce7", color: "#166534", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  cardTitle: { fontSize: 19, fontWeight: "800", color: "#111827", textAlign: "right", flex: 1 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  amount: { marginTop: 8, color: "#166534", fontWeight: "800", textAlign: "right" },
  actionsRow: { flexDirection: "row-reverse", marginTop: 14 },
  actionButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  previewButton: { backgroundColor: "#111827" },
  shareButton: { backgroundColor: "#16a34a" },
  actionText: { color: "#fff", fontWeight: "800" },
  previewBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 14 },
  previewText: { color: "#374151", textAlign: "right", lineHeight: 24 },
});
