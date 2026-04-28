import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGetScoped, apiPost } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type Property = {
  id: number;
  name?: string | null;
  owner?: {
    name?: string | null;
  } | null;
};

type ParkingSpot = {
  id: number;
  property_id?: number;
  spot_number?: string | null;
  location?: string | null;
  monthly_fee?: number;
  status?: string | null;
  notes?: string | null;
  property?: Property | null;
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function statusLabel(value?: string | null) {
  if (value === "available") return "متاح";
  if (value === "reserved") return "محجوز";
  if (value === "occupied") return "مشغول";
  if (value === "maintenance") return "صيانة";
  return value || "-";
}

function statusStyle(value?: string | null) {
  if (value === "available") return styles.statusAvailable;
  if (value === "reserved") return styles.statusReserved;
  if (value === "occupied") return styles.statusOccupied;
  if (value === "maintenance") return styles.statusMaintenance;
  return styles.statusNeutral;
}

export default function ParkingScreen() {
  const [items, setItems] = useState<ParkingSpot[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [spotNumber, setSpotNumber] = useState("");
  const [location, setLocation] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [status, setStatus] = useState("available");
  const [notes, setNotes] = useState("");

  async function load() {
    try {
      setLoading(true);

      const [spotsResult, propertiesResult] = await Promise.all([
        apiGetScoped("/parking-spots", "/my/parking-spots"),
        apiGetScoped("/properties", "/my/properties"),
      ]);

      const propertyList = Array.isArray(propertiesResult) ? propertiesResult : [];

      setItems(Array.isArray(spotsResult) ? spotsResult : []);
      setProperties(propertyList);

      if (!propertyId && propertyList.length > 0) {
        setPropertyId(propertyList[0].id);
      }
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل المواقف");
    } finally {
      setLoading(false);
    }
  }

  async function saveSpot() {
    if (!propertyId) {
      Alert.alert("تنبيه", "اختر العقار");
      return;
    }

    if (!spotNumber.trim()) {
      Alert.alert("تنبيه", "اكتب رقم أو اسم الموقف");
      return;
    }

    try {
      setSaving(true);

      await apiPost("/parking-spots", {
        property_id: propertyId,
        spot_number: spotNumber.trim(),
        location: location.trim() || null,
        monthly_fee: Number(monthlyFee || 0),
        status,
        notes: notes.trim() || null,
      });

      setSpotNumber("");
      setLocation("");
      setMonthlyFee("");
      setStatus("available");
      setNotes("");
      setShowForm(false);

      Alert.alert("تم", "تم حفظ الموقف بنجاح");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ الموقف");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: number, newStatus: string) {
    try {
      await apiPost(`/parking-spots/${id}/status`, { status: newStatus });
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحديث حالة الموقف");
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

  const total = items.length;
  const available = items.filter((item) => item.status === "available").length;
  const occupied = items.filter((item) => item.status === "occupied").length;
  const reserved = items.filter((item) => item.status === "reserved").length;
  const monthlyExpected = items
    .filter((item) => item.status === "occupied" || item.status === "reserved")
    .reduce((sum, item) => sum + Number(item.monthly_fee || 0), 0);

  const statusOptions = [
    { value: "available", label: "متاح" },
    { value: "reserved", label: "محجوز" },
    { value: "occupied", label: "مشغول" },
    { value: "maintenance", label: "صيانة" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>المواقف</Text>
        <Text style={styles.subtitle}>إدارة مواقف العقارات ورسومها الشهرية</Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>إجمالي المواقف: {total}</Text>
          <Text style={styles.summaryText}>المتاح: {available} | المشغول: {occupied} | المحجوز: {reserved}</Text>
          <Text style={styles.summaryText}>رسوم شهرية متوقعة: {money(monthlyExpected)}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setShowForm(!showForm)}>
          <Text style={styles.primaryButtonText}>
            {showForm ? "إغلاق نموذج الإضافة" : "إضافة موقف"}
          </Text>
        </TouchableOpacity>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>بيانات الموقف</Text>

            <Text style={styles.label}>العقار</Text>
            <View style={styles.chips}>
              {properties.map((property) => (
                <TouchableOpacity
                  key={property.id}
                  style={[styles.chip, propertyId === property.id ? styles.chipActive : null]}
                  onPress={() => setPropertyId(property.id)}
                >
                  <Text style={[styles.chipText, propertyId === property.id ? styles.chipTextActive : null]}>
                    {property.name || "عقار"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="رقم أو اسم الموقف"
              value={spotNumber}
              onChangeText={setSpotNumber}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="الموقع داخل العقار"
              value={location}
              onChangeText={setLocation}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="رسوم الموقف الشهرية"
              value={monthlyFee}
              onChangeText={setMonthlyFee}
              keyboardType="number-pad"
              textAlign="right"
            />

            <Text style={styles.label}>الحالة</Text>
            <View style={styles.chips}>
              {statusOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, status === option.value ? styles.chipActive : null]}
                  onPress={() => setStatus(option.value)}
                >
                  <Text style={[styles.chipText, status === option.value ? styles.chipTextActive : null]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="ملاحظات"
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlign="right"
            />

            <TouchableOpacity style={styles.saveButton} onPress={saveSpot} disabled={saving}>
              <Text style={styles.saveButtonText}>
                {saving ? "جاري الحفظ..." : "حفظ الموقف"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل المواقف...</Text>
          </View>
        ) : null}

        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[styles.statusBadge, statusStyle(item.status)]}>
                {statusLabel(item.status)}
              </Text>
              <Text style={styles.cardTitle}>{item.spot_number || "موقف"}</Text>
            </View>

            <Text style={styles.detail}>العقار: {item.property?.name || "-"}</Text>
            <Text style={styles.detail}>المالك: {item.property?.owner?.name || "-"}</Text>
            <Text style={styles.detail}>الموقع: {item.location || "-"}</Text>
            <Text style={styles.amount}>الرسوم الشهرية: {money(item.monthly_fee)}</Text>
            {item.notes ? <Text style={styles.notes}>ملاحظات: {item.notes}</Text> : null}

            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionButton, styles.availableButton]} onPress={() => updateStatus(item.id, "available")}>
                <Text style={styles.actionText}>متاح</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.reservedButton]} onPress={() => updateStatus(item.id, "reserved")}>
                <Text style={styles.actionText}>محجوز</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.occupiedButton]} onPress={() => updateStatus(item.id, "occupied")}>
                <Text style={styles.actionText}>مشغول</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {!loading && items.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد مواقف حاليًا</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 18, paddingBottom: 50 },
  title: { fontSize: 30, fontWeight: "800", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", fontSize: 15, textAlign: "right" },
  summaryBox: { backgroundColor: "#111827", borderRadius: 18, padding: 16, marginBottom: 14 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  primaryButton: { backgroundColor: "#111827", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  formCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14 },
  formTitle: { fontSize: 19, fontWeight: "800", color: "#111827", textAlign: "right", marginBottom: 12 },
  label: { color: "#374151", fontWeight: "800", textAlign: "right", marginBottom: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 12 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  multilineInput: { minHeight: 70, textAlignVertical: "top" },
  saveButton: { backgroundColor: "#16a34a", padding: 13, borderRadius: 12, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "800" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  cardTitle: { fontSize: 20, fontWeight: "800", color: "#111827", textAlign: "right", flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  statusAvailable: { backgroundColor: "#dcfce7", color: "#166534" },
  statusReserved: { backgroundColor: "#fef3c7", color: "#92400e" },
  statusOccupied: { backgroundColor: "#dbeafe", color: "#065F44" },
  statusMaintenance: { backgroundColor: "#fee2e2", color: "#991b1b" },
  statusNeutral: { backgroundColor: "#f3f4f6", color: "#374151" },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  amount: { marginTop: 8, color: "#166534", fontWeight: "800", textAlign: "right" },
  notes: { marginTop: 10, color: "#92400e", fontWeight: "700", textAlign: "right" },
  actionsRow: { flexDirection: "row-reverse", marginTop: 14 },
  actionButton: { flex: 1, padding: 11, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  availableButton: { backgroundColor: "#16a34a" },
  reservedButton: { backgroundColor: "#d97706" },
  occupiedButton: { backgroundColor: "#0F9B6F" },
  actionText: { color: "#fff", fontWeight: "800" },
});
