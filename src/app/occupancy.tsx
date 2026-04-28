import { useEffect, useState } from "react";
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
import { apiGetScoped } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type UnitPayload = {
  id: number;
  unit_number?: string | null;
  floor?: string | null;
  status?: string | null;
  rent_amount?: number;
  rooms_count?: number;
  bathrooms_count?: number;
  tenant_name?: string | null;
  tenant_phone?: string | null;
  contract_number?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type PropertyOccupancy = {
  property?: {
    id: number;
    name?: string | null;
    city?: string | null;
    district?: string | null;
    property_type?: string | null;
    owner_name?: string | null;
    parking_spots_count?: number;
  };
  summary?: {
    units_count?: number;
    rented_units_count?: number;
    vacant_units_count?: number;
    occupancy_rate?: number;
  };
  vacant_units?: UnitPayload[];
  rented_units?: UnitPayload[];
};

type OccupancyReport = {
  summary?: {
    properties_count?: number;
    units_count?: number;
    rented_units_count?: number;
    vacant_units_count?: number;
    occupancy_rate?: number;
  };
  properties?: PropertyOccupancy[];
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function propertyTypeLabel(type?: string | null) {
  if (type === "building") return "مبنى / عمارة";
  if (type === "apartment") return "شقة مستقلة";
  if (type === "villa") return "فيلا";
  if (type === "other") return "أخرى";
  return type || "-";
}

function UnitCard({ unit, rented }: { unit: UnitPayload; rented?: boolean }) {
  return (
    <View style={styles.unitBox}>
      <Text style={styles.unitTitle}>
        {unit.unit_number || "وحدة"} {rented ? "— مؤجرة" : "— شاغرة"}
      </Text>
      <Text style={styles.unitText}>الدور: {unit.floor || "-"}</Text>
      <Text style={styles.unitText}>الغرف: {unit.rooms_count ?? 0} | الحمامات: {unit.bathrooms_count ?? 0}</Text>
      <Text style={styles.unitText}>الإيجار: {money(unit.rent_amount)}</Text>

      {rented ? (
        <>
          <Text style={styles.unitText}>المستأجر: {unit.tenant_name || "-"}</Text>
          <Text style={styles.unitText}>الجوال: {unit.tenant_phone || "-"}</Text>
          <Text style={styles.unitText}>العقد: {unit.contract_number || "-"}</Text>
          <Text style={styles.unitText}>النهاية: {unit.end_date || "-"}</Text>
        </>
      ) : null}
    </View>
  );
}

export default function OccupancyScreen() {
  const [report, setReport] = useState<OccupancyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPropertyId, setExpandedPropertyId] = useState<number | null>(null);

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/occupancy-report",
        "/my/occupancy-report"
      );

      setReport(result as OccupancyReport);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل تقرير الإشغال");
    } finally {
      setLoading(false);
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

  const summary = report?.summary || {};
  const properties = report?.properties || [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>الإشغال والشواغر</Text>
        <Text style={styles.subtitle}>
          تقرير يوضح الوحدات المؤجرة والشاغرة ونسبة الإشغال لكل عقار
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>العقارات: {summary.properties_count ?? 0}</Text>
          <Text style={styles.summaryText}>الوحدات: {summary.units_count ?? 0}</Text>
          <Text style={styles.summaryText}>المؤجرة: {summary.rented_units_count ?? 0}</Text>
          <Text style={styles.summaryText}>الشاغرة: {summary.vacant_units_count ?? 0}</Text>
          <Text style={styles.rateText}>نسبة الإشغال: {summary.occupancy_rate ?? 0}%</Text>
        </View>
{loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل تقرير الإشغال...</Text>
          </View>
        ) : null}

        {!loading && properties.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد عقارات أو وحدات حاليًا</Text>
          </View>
        ) : null}

        {properties.map((item) => {
          const propertyId = item.property?.id || 0;
          const expanded = expandedPropertyId === propertyId;
          const itemSummary = item.summary || {};

          return (
            <View key={propertyId} style={styles.card}>
              <Text style={styles.cardTitle}>{item.property?.name || "عقار"}</Text>
              <Text style={styles.detail}>المالك: {item.property?.owner_name || "-"}</Text>
              <Text style={styles.detail}>النوع: {propertyTypeLabel(item.property?.property_type)}</Text>
              <Text style={styles.detail}>المدينة: {item.property?.city || "-"} | الحي: {item.property?.district || "-"}</Text>

              <View style={styles.statsRow}>
                <Text style={styles.stat}>الوحدات: {itemSummary.units_count ?? 0}</Text>
                <Text style={styles.stat}>مؤجرة: {itemSummary.rented_units_count ?? 0}</Text>
                <Text style={styles.stat}>شاغرة: {itemSummary.vacant_units_count ?? 0}</Text>
              </View>

              <View style={styles.rateBox}>
                <Text style={styles.rateBoxText}>نسبة الإشغال: {itemSummary.occupancy_rate ?? 0}%</Text>
              </View>

              <TouchableOpacity
                style={styles.detailsButton}
                onPress={() => setExpandedPropertyId(expanded ? null : propertyId)}
              >
                <Text style={styles.detailsButtonText}>
                  {expanded ? "إخفاء الوحدات" : "عرض الوحدات"}
                </Text>
              </TouchableOpacity>

              {expanded ? (
                <View style={styles.detailsBox}>
                  <Text style={styles.sectionTitle}>الوحدات الشاغرة</Text>
                  {(item.vacant_units || []).length === 0 ? (
                    <Text style={styles.emptyText}>لا توجد وحدات شاغرة</Text>
                  ) : (
                    (item.vacant_units || []).map((unit) => (
                      <UnitCard key={unit.id} unit={unit} />
                    ))
                  )}

                  <Text style={styles.sectionTitle}>الوحدات المؤجرة</Text>
                  {(item.rented_units || []).length === 0 ? (
                    <Text style={styles.emptyText}>لا توجد وحدات مؤجرة</Text>
                  ) : (
                    (item.rented_units || []).map((unit) => (
                      <UnitCard key={unit.id} unit={unit} rented />
                    ))
                  )}
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
  rateText: { color: "#93c5fd", fontWeight: "800", textAlign: "right", marginTop: 6, fontSize: 18 },
  primaryButton: { backgroundColor: "#111827", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F", textAlign: "right" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 21, fontWeight: "800", color: "#111827", textAlign: "right" },
  detail: { marginTop: 7, color: "#5E5B55", textAlign: "right" },
  statsRow: { marginTop: 12, flexDirection: "row-reverse", flexWrap: "wrap" },
  stat: { backgroundColor: "#f3f4f6", color: "#374151", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: "hidden", fontWeight: "700", marginLeft: 8, marginBottom: 8 },
  rateBox: { backgroundColor: "#eff6ff", borderRadius: 12, padding: 12, marginTop: 10 },
  rateBoxText: { color: "#065F44", fontWeight: "800", textAlign: "right" },
  detailsButton: { backgroundColor: "#0F9B6F", padding: 12, borderRadius: 12, alignItems: "center", marginTop: 14 },
  detailsButtonText: { color: "#fff", fontWeight: "800" },
  detailsBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 14 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#111827", textAlign: "right", marginBottom: 10, marginTop: 6 },
  unitBox: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 10 },
  unitTitle: { color: "#111827", fontWeight: "800", fontSize: 17, textAlign: "right" },
  unitText: { color: "#5E5B55", marginTop: 6, textAlign: "right" },
});
