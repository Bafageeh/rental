import { router, useLocalSearchParams } from "expo-router";
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

type UnitItem = {
  id: number;
  property_id?: number | string | null;
  unit_scope?: string | null;
  unit_number?: string | null;
  name?: string | null;
  type?: string | null;
  floor?: string | number | null;
  status?: string | null;
  rent_amount?: number | string | null;
};

type PropertyItem = {
  id: number;
  name?: string | null;
  city?: string | null;
  district?: string | null;
  property_type?: string | null;
  units_count?: number;
  rented_units_count?: number;
  active_contracts_count?: number;
  units?: UnitItem[];
};

type OwnerPropertiesData = {
  owner?: { id: number; name?: string | null };
  properties?: PropertyItem[];
  units?: UnitItem[];
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

const statusLabels: Record<string, string> = {
  available: "متاح",
  rented: "مؤجر",
  maintenance: "صيانة",
  needs_repair: "يحتاج إصلاح",
  archived: "مؤرشف",
};

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return `${Math.round(n(value)).toLocaleString("ar-SA")} ريال`;
}

function count(value: unknown) {
  return Math.round(n(value)).toLocaleString("ar-SA");
}

function propertyTypeText(value?: string | null) {
  return value ? propertyTypeLabels[value] || value : "عقار";
}

function unitTypeText(value?: string | null) {
  return value ? unitTypeLabels[value] || value : "وحدة";
}

function statusText(value?: string | null) {
  return value ? statusLabels[value] || value : "غير محدد";
}

function unitName(unit: UnitItem) {
  return unit.name || unit.unit_number || `وحدة #${unit.id}`;
}

export default function OwnerPropertiesScreen() {
  const params = useLocalSearchParams<{ owner_id?: string; owner_name?: string }>();
  const ownerId = String(params.owner_id || "");
  const ownerNameParam = params.owner_name ? decodeURIComponent(String(params.owner_name)) : "";
  const [data, setData] = useState<OwnerPropertiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    if (!ownerId) return;
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      const response = await apiGetScoped(`/owners/${ownerId}/dashboard`, `/my/owners/${ownerId}/dashboard`);
      setData((response?.data ?? response) as OwnerPropertiesData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل عقارات المالك");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(false);
  }, [ownerId]);

  const ownerName = data?.owner?.name || ownerNameParam || "المالك";
  const properties = data?.properties || [];
  const allUnits = data?.units || [];
  const directUnits = useMemo(
    () => allUnits.filter((unit) => !unit.property_id || String(unit.unit_scope || "") === "owner"),
    [allUnits],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeText}>رجوع</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>عقارات المالك</Text>
          <Text style={styles.headerSubtitle}>{ownerName}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator />
            <Text style={styles.stateText}>جاري تحميل العقارات...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>تعذر التحميل</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => load(false)}>
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && !error ? (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{count(properties.length)}</Text>
                <Text style={styles.summaryLabel}>عقارات</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{count(allUnits.length)}</Text>
                <Text style={styles.summaryLabel}>وحدات</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{count(directUnits.length)}</Text>
                <Text style={styles.summaryLabel}>وحدات مباشرة</Text>
              </View>
            </View>

            {properties.map((property) => {
              const units = property.units?.length
                ? property.units
                : allUnits.filter((unit) => String(unit.property_id || "") === String(property.id));
              return (
                <View key={property.id} style={styles.propertyCard}>
                  <TouchableOpacity activeOpacity={0.88} onPress={() => router.push(`/property/${property.id}` as never)}>
                    <View style={styles.propertyHeader}>
                      <Text style={styles.badge}>{propertyTypeText(property.property_type)}</Text>
                      <View style={styles.propertyTitleBox}>
                        <Text numberOfLines={1} style={styles.propertyTitle}>{property.name || `عقار #${property.id}`}</Text>
                        <Text style={styles.propertyLocation}>{[property.district, property.city].filter(Boolean).join("، ") || "لا يوجد موقع"}</Text>
                      </View>
                    </View>
                    <View style={styles.propertyStats}>
                      <Text style={styles.pill}>الوحدات {count(units.length || property.units_count)}</Text>
                      <Text style={styles.pill}>المؤجرة {count(property.rented_units_count)}</Text>
                      <Text style={styles.pill}>العقود {count(property.active_contracts_count)}</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.primaryAction} onPress={() => router.push(`/property/${property.id}` as never)}>
                      <Text style={styles.actionText}>فتح العقار</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push(`/edit-record?resource=properties&id=${property.id}` as never)}>
                      <Text style={styles.secondaryActionText}>تعديل</Text>
                    </TouchableOpacity>
                  </View>

                  {units.length ? (
                    <View style={styles.unitsBox}>
                      <Text style={styles.unitsTitle}>الوحدات</Text>
                      {units.map((unit) => (
                        <TouchableOpacity key={unit.id} style={styles.unitRow} activeOpacity={0.85} onPress={() => router.push(`/unit/${unit.id}` as never)}>
                          <Text style={styles.unitStatus}>{statusText(unit.status)}</Text>
                          <View style={styles.unitTextBox}>
                            <Text style={styles.unitTitle}>{unitName(unit)}</Text>
                            <Text style={styles.unitMeta}>{unitTypeText(unit.type)} • الدور {unit.floor || "-"} • {money(unit.rent_amount)}</Text>
                          </View>
                          <TouchableOpacity style={styles.unitEditButton} onPress={() => router.push(`/edit-record?resource=units&id=${unit.id}` as never)}>
                            <Text style={styles.unitEditText}>تعديل</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : <Text style={styles.emptyText}>لا توجد وحدات تحت هذا العقار.</Text>}
                </View>
              );
            })}

            {directUnits.length ? (
              <View style={styles.directBox}>
                <Text style={styles.directTitle}>وحدات مباشرة على المالك</Text>
                {directUnits.map((unit) => (
                  <TouchableOpacity key={unit.id} style={styles.directUnitCard} activeOpacity={0.88} onPress={() => router.push(`/unit/${unit.id}` as never)}>
                    <View style={styles.unitTextBox}>
                      <Text style={styles.unitTitle}>{unitName(unit)}</Text>
                      <Text style={styles.unitMeta}>{unitTypeText(unit.type)} • الدور {unit.floor || "-"} • {money(unit.rent_amount)}</Text>
                    </View>
                    <TouchableOpacity style={styles.unitEditButton} onPress={() => router.push(`/edit-record?resource=units&id=${unit.id}` as never)}>
                      <Text style={styles.unitEditText}>تعديل</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {!properties.length && !directUnits.length ? <Text style={styles.emptyText}>لا توجد عقارات أو وحدات لهذا المالك.</Text> : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  header: { backgroundColor: "#111827", paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  closeButton: { backgroundColor: "#374151", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  closeText: { color: "#fff", fontWeight: "900" },
  headerTitleBox: { flex: 1, alignItems: "flex-end" },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "900", textAlign: "right" },
  headerSubtitle: { color: "#d1d5db", marginTop: 4, fontWeight: "800", textAlign: "right" },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 40 },
  stateCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, alignItems: "center" },
  stateText: { color: "#64748b", fontWeight: "800", marginTop: 8 },
  errorCard: { backgroundColor: "#fee2e2", borderRadius: 18, padding: 14 },
  errorTitle: { color: "#991b1b", fontWeight: "900", textAlign: "right" },
  errorText: { color: "#991b1b", textAlign: "right", marginTop: 6 },
  retryButton: { backgroundColor: "#991b1b", borderRadius: 14, padding: 12, alignItems: "center", marginTop: 12 },
  retryText: { color: "#fff", fontWeight: "900" },
  summaryRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: "#fff", borderRadius: 18, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#eceff3" },
  summaryValue: { color: "#111827", fontSize: 20, fontWeight: "900" },
  summaryLabel: { color: "#64748b", fontWeight: "800", marginTop: 5, fontSize: 12 },
  propertyCard: { backgroundColor: "#fff", borderRadius: 24, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#eceff3", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  propertyHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  propertyTitleBox: { flex: 1, alignItems: "flex-end" },
  propertyTitle: { color: "#111827", fontSize: 19, fontWeight: "900", textAlign: "right" },
  propertyLocation: { color: "#64748b", fontWeight: "800", marginTop: 4, textAlign: "right" },
  badge: { backgroundColor: "#ecfdf5", color: "#0f766e", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  propertyStats: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 12 },
  pill: { backgroundColor: "#F1F5F9", color: "#334155", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, overflow: "hidden", fontWeight: "900", fontSize: 12 },
  cardActions: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  primaryAction: { flex: 1, backgroundColor: "#111827", borderRadius: 16, padding: 12, alignItems: "center" },
  secondaryAction: { width: 90, backgroundColor: "#F1F5F9", borderRadius: 16, padding: 12, alignItems: "center" },
  actionText: { color: "#fff", fontWeight: "900" },
  secondaryActionText: { color: "#111827", fontWeight: "900" },
  unitsBox: { marginTop: 12, backgroundColor: "#F8FAFC", borderRadius: 18, padding: 10 },
  unitsTitle: { color: "#111827", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  unitRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderRadius: 16, padding: 10, marginBottom: 8 },
  unitStatus: { color: "#0f766e", backgroundColor: "#ecfdf5", borderRadius: 999, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5, fontWeight: "900", fontSize: 11 },
  unitTextBox: { flex: 1, alignItems: "flex-end" },
  unitTitle: { color: "#111827", fontWeight: "900", fontSize: 15, textAlign: "right" },
  unitMeta: { color: "#64748b", fontWeight: "700", marginTop: 3, textAlign: "right", fontSize: 12 },
  unitEditButton: { backgroundColor: "#e0e7ff", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  unitEditText: { color: "#3730a3", fontWeight: "900", fontSize: 12 },
  directBox: { marginTop: 10 },
  directTitle: { color: "#111827", fontSize: 18, fontWeight: "900", textAlign: "right", marginBottom: 8 },
  directUnitCard: { backgroundColor: "#fff", borderRadius: 18, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  emptyText: { color: "#64748b", fontWeight: "800", textAlign: "center", padding: 14 },
});
