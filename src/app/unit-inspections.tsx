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
import InlineEditDeleteActions from "../components/InlineEditDeleteActions";
import { SafeAreaView } from "react-native-safe-area-context";

type Property = {
  id: number;
  name?: string | null;
  owner?: {
    name?: string | null;
  } | null;
};

type Unit = {
  id: number;
  property_id?: number | null;
  unit_number?: string | null;
  property?: Property | null;
};

type Tenant = {
  id: number;
  name?: string | null;
  phone?: string | null;
};

type Contract = {
  id: number;
  tenant_id?: number | null;
  unit_id?: number | null;
  contract_number?: string | null;
  government_contract_number?: string | null;
  tenant?: Tenant | null;
  unit?: Unit | null;
};

type Inspection = {
  id: number;
  property_id?: number | null;
  property_name?: string | null;
  owner_name?: string | null;
  unit_id?: number | null;
  unit_number?: string | null;
  tenant_id?: number | null;
  tenant_name?: string | null;
  contract_id?: number | null;
  contract_number?: string | number | null;
  inspection_type?: string | null;
  status?: string | null;
  inspection_date?: string | null;
  inspector_name?: string | null;
  electricity_meter_reading?: string | null;
  water_meter_reading?: string | null;
  keys_count?: number | null;
  checks?: Record<string, boolean>;
  failed_checks?: number;
  damage_notes?: string | null;
  estimated_repair_cost?: number | null;
  recommendations?: string | null;
  notes?: string | null;
};

type CheckKey =
  | "walls_ok"
  | "doors_ok"
  | "windows_ok"
  | "plumbing_ok"
  | "electricity_ok"
  | "ac_ok"
  | "kitchen_ok"
  | "bathrooms_ok"
  | "cleanliness_ok";

function pad(number: number) {
  return String(number).padStart(2, "0");
}

function todayString() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function typeLabel(value?: string | null) {
  if (value === "move_in") return "استلام";
  if (value === "move_out") return "تسليم";
  if (value === "maintenance") return "صيانة";
  if (value === "periodic") return "دورية";
  return value || "-";
}

function statusLabel(value?: string | null) {
  if (value === "open") return "مفتوحة";
  if (value === "completed") return "مكتملة";
  if (value === "needs_repair") return "تحتاج إصلاح";
  if (value === "cancelled") return "ملغاة";
  return value || "-";
}

function statusStyle(value?: string | null) {
  if (value === "completed") return styles.statusCompleted;
  if (value === "needs_repair") return styles.statusRepair;
  if (value === "cancelled") return styles.statusCancelled;
  return styles.statusOpen;
}

function checkLabel(key: CheckKey) {
  const labels: Record<CheckKey, string> = {
    walls_ok: "الجدران",
    doors_ok: "الأبواب",
    windows_ok: "النوافذ",
    plumbing_ok: "السباكة",
    electricity_ok: "الكهرباء",
    ac_ok: "المكيفات",
    kitchen_ok: "المطبخ",
    bathrooms_ok: "الحمامات",
    cleanliness_ok: "النظافة",
  };

  return labels[key];
}

const checkKeys: CheckKey[] = [
  "walls_ok",
  "doors_ok",
  "windows_ok",
  "plumbing_ok",
  "electricity_ok",
  "ac_ok",
  "kitchen_ok",
  "bathrooms_ok",
  "cleanliness_ok",
];

export default function UnitInspectionsScreen() {
  const [items, setItems] = useState<Inspection[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [contractId, setContractId] = useState<number | null>(null);
  const [inspectionType, setInspectionType] = useState("periodic");
  const [inspectionDate, setInspectionDate] = useState(todayString());
  const [inspectorName, setInspectorName] = useState("");
  const [electricityMeter, setElectricityMeter] = useState("");
  const [waterMeter, setWaterMeter] = useState("");
  const [keysCount, setKeysCount] = useState("");
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({
    walls_ok: true,
    doors_ok: true,
    windows_ok: true,
    plumbing_ok: true,
    electricity_ok: true,
    ac_ok: true,
    kitchen_ok: true,
    bathrooms_ok: true,
    cleanliness_ok: true,
  });
  const [damageNotes, setDamageNotes] = useState("");
  const [estimatedRepairCost, setEstimatedRepairCost] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    try {
      setLoading(true);

      const [inspectionsResult, propertiesResult, unitsResult, tenantsResult, contractsResult] = await Promise.all([
        apiGetScoped("/unit-inspections", "/my/unit-inspections"),
        apiGetScoped("/properties", "/my/properties"),
        apiGetScoped("/units", "/my/units"),
        apiGetScoped("/tenants", "/my/tenants"),
        apiGetScoped("/contracts", "/my/contracts"),
      ]);

      const propertyList = Array.isArray(propertiesResult) ? propertiesResult : [];
      setItems(Array.isArray(inspectionsResult) ? inspectionsResult : []);
      setProperties(propertyList);
      setUnits(Array.isArray(unitsResult) ? unitsResult : []);
      setTenants(Array.isArray(tenantsResult) ? tenantsResult : []);
      setContracts(Array.isArray(contractsResult) ? contractsResult : []);

      if (!propertyId && propertyList.length > 0) {
        setPropertyId(propertyList[0].id);
      }
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل معاينات الوحدات");
    } finally {
      setLoading(false);
    }
  }

  function toggleCheck(key: CheckKey) {
    setChecks((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  async function saveInspection() {
    if (!propertyId && !unitId && !contractId) {
      Alert.alert("تنبيه", "اختر عقارًا أو وحدة أو عقدًا");
      return;
    }

    try {
      setSaving(true);

      await apiPost("/unit-inspections", {
        property_id: propertyId,
        unit_id: unitId,
        tenant_id: tenantId,
        contract_id: contractId,
        inspection_type: inspectionType,
        status: Number(estimatedRepairCost || 0) > 0 || Object.values(checks).some((value) => !value)
          ? "needs_repair"
          : "open",
        inspection_date: inspectionDate.trim() || null,
        inspector_name: inspectorName.trim() || null,
        electricity_meter_reading: electricityMeter.trim() || null,
        water_meter_reading: waterMeter.trim() || null,
        keys_count: keysCount.trim() ? Number(keysCount) : null,
        ...checks,
        damage_notes: damageNotes.trim() || null,
        estimated_repair_cost: Number(estimatedRepairCost || 0),
        recommendations: recommendations.trim() || null,
        notes: notes.trim() || null,
      });

      setDamageNotes("");
      setRecommendations("");
      setNotes("");
      setEstimatedRepairCost("");
      setElectricityMeter("");
      setWaterMeter("");
      setKeysCount("");
      setInspectorName("");
      setShowForm(false);

      Alert.alert("تم", "تم حفظ معاينة الوحدة");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ معاينة الوحدة");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: number, status: string) {
    try {
      await apiPost(`/unit-inspections/${id}/status`, { status });
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحديث حالة المعاينة");
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

  const filteredUnits = units.filter((unit) => !propertyId || unit.property_id === propertyId || unit.property?.id === propertyId);
  const filteredContracts = contracts.filter((contract) => !unitId || contract.unit_id === unitId || contract.unit?.id === unitId);
  const openCount = items.filter((item) => item.status === "open").length;
  const needsRepairCount = items.filter((item) => item.status === "needs_repair").length;
  const completedCount = items.filter((item) => item.status === "completed").length;

  const typeOptions = [
    { value: "periodic", label: "دورية" },
    { value: "move_in", label: "استلام" },
    { value: "move_out", label: "تسليم" },
    { value: "maintenance", label: "صيانة" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>معاينات وتسليم الوحدات</Text>
        <Text style={styles.subtitle}>
          سجل فحص الوحدة عند الاستلام أو التسليم أو المعاينات الدورية
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>إجمالي المعاينات: {items.length}</Text>
          <Text style={styles.summaryText}>مفتوحة: {openCount}</Text>
          <Text style={styles.summaryText}>تحتاج إصلاح: {needsRepairCount}</Text>
          <Text style={styles.summaryText}>مكتملة: {completedCount}</Text>
        </View>

        <View style={styles.topActionsRow}>
<TouchableOpacity style={styles.addButton} onPress={() => setShowForm(!showForm)}>
            <Text style={styles.primaryButtonText}>
              {showForm ? "إغلاق النموذج" : "إضافة معاينة"}
            </Text>
          </TouchableOpacity>
        </View>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>بيانات المعاينة</Text>

            <Text style={styles.label}>نوع المعاينة</Text>
            <View style={styles.chips}>
              {typeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, inspectionType === option.value ? styles.chipActive : null]}
                  onPress={() => setInspectionType(option.value)}
                >
                  <Text style={[styles.chipText, inspectionType === option.value ? styles.chipTextActive : null]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>العقار</Text>
            <View style={styles.chips}>
              {properties.map((property) => (
                <TouchableOpacity
                  key={property.id}
                  style={[styles.chip, propertyId === property.id ? styles.chipActive : null]}
                  onPress={() => {
                    setPropertyId(property.id);
                    setUnitId(null);
                    setContractId(null);
                  }}
                >
                  <Text style={[styles.chipText, propertyId === property.id ? styles.chipTextActive : null]}>
                    {property.name || `عقار #${property.id}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>الوحدة</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, unitId === null ? styles.chipActive : null]}
                onPress={() => setUnitId(null)}
              >
                <Text style={[styles.chipText, unitId === null ? styles.chipTextActive : null]}>
                  بدون وحدة
                </Text>
              </TouchableOpacity>

              {filteredUnits.map((unit) => (
                <TouchableOpacity
                  key={unit.id}
                  style={[styles.chip, unitId === unit.id ? styles.chipActive : null]}
                  onPress={() => {
                    setUnitId(unit.id);
                    setContractId(null);
                  }}
                >
                  <Text style={[styles.chipText, unitId === unit.id ? styles.chipTextActive : null]}>
                    {unit.unit_number || `وحدة #${unit.id}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>العقد / المستأجر اختياري</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, contractId === null ? styles.chipActive : null]}
                onPress={() => {
                  setContractId(null);
                  setTenantId(null);
                }}
              >
                <Text style={[styles.chipText, contractId === null ? styles.chipTextActive : null]}>
                  بدون عقد
                </Text>
              </TouchableOpacity>

              {filteredContracts.slice(0, 25).map((contract) => (
                <TouchableOpacity
                  key={contract.id}
                  style={[styles.chip, contractId === contract.id ? styles.chipActive : null]}
                  onPress={() => {
                    setContractId(contract.id);
                    setTenantId(contract.tenant_id || contract.tenant?.id || null);
                  }}
                >
                  <Text style={[styles.chipText, contractId === contract.id ? styles.chipTextActive : null]}>
                    عقد #{contract.government_contract_number || contract.contract_number || contract.id} — {contract.tenant?.name || "مستأجر"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="تاريخ المعاينة YYYY-MM-DD"
              value={inspectionDate}
              onChangeText={setInspectionDate}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="اسم الفاحص"
              value={inspectorName}
              onChangeText={setInspectorName}
              textAlign="right"
            />

            <View style={styles.twoColumns}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="قراءة عداد الكهرباء"
                value={electricityMeter}
                onChangeText={setElectricityMeter}
                textAlign="right"
              />

              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="قراءة عداد الماء"
                value={waterMeter}
                onChangeText={setWaterMeter}
                textAlign="right"
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder="عدد المفاتيح"
              value={keysCount}
              onChangeText={setKeysCount}
              keyboardType="number-pad"
              textAlign="right"
            />

            <Text style={styles.label}>قائمة الفحص</Text>
            <View style={styles.checkGrid}>
              {checkKeys.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.checkItem, checks[key] ? styles.checkOk : styles.checkBad]}
                  onPress={() => toggleCheck(key)}
                >
                  <Text style={[styles.checkText, checks[key] ? styles.checkTextOk : styles.checkTextBad]}>
                    {checkLabel(key)}: {checks[key] ? "سليم" : "مشكلة"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="ملاحظات التلف أو النواقص"
              value={damageNotes}
              onChangeText={setDamageNotes}
              multiline
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="تكلفة الإصلاح التقديرية"
              value={estimatedRepairCost}
              onChangeText={setEstimatedRepairCost}
              keyboardType="number-pad"
              textAlign="right"
            />

            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="التوصيات"
              value={recommendations}
              onChangeText={setRecommendations}
              multiline
              textAlign="right"
            />

            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="ملاحظات عامة"
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlign="right"
            />

            <TouchableOpacity style={styles.saveButton} onPress={saveInspection} disabled={saving}>
              <Text style={styles.saveButtonText}>
                {saving ? "جاري الحفظ..." : "حفظ المعاينة"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل المعاينات...</Text>
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد معاينات حاليًا</Text>
          </View>
        ) : null}

        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <InlineEditDeleteActions resource="unit_inspections" id={item.id} onChanged={load} />
            <View style={styles.rowBetween}>
              <Text style={[styles.statusBadge, statusStyle(item.status)]}>
                {statusLabel(item.status)}
              </Text>
              <Text style={styles.cardTitle}>{typeLabel(item.inspection_type)} — {item.unit_number || "وحدة"}</Text>
            </View>

            <Text style={styles.detail}>العقار: {item.property_name || "-"}</Text>
            <Text style={styles.detail}>المالك: {item.owner_name || "-"}</Text>
            <Text style={styles.detail}>المستأجر: {item.tenant_name || "-"}</Text>
            <Text style={styles.detail}>العقد: {item.contract_number || "-"}</Text>
            <Text style={styles.detail}>تاريخ المعاينة: {item.inspection_date || "-"}</Text>
            <Text style={styles.detail}>الفاحص: {item.inspector_name || "-"}</Text>
            <Text style={styles.detail}>عداد الكهرباء: {item.electricity_meter_reading || "-"}</Text>
            <Text style={styles.detail}>عداد الماء: {item.water_meter_reading || "-"}</Text>
            <Text style={styles.detail}>عدد المفاتيح: {item.keys_count ?? "-"}</Text>
            <Text style={styles.repairText}>عناصر بها مشاكل: {item.failed_checks ?? 0}</Text>
            <Text style={styles.repairText}>تكلفة إصلاح تقديرية: {Number(item.estimated_repair_cost || 0).toLocaleString()} ريال</Text>

            {item.damage_notes ? <Text style={styles.notes}>التلف/النواقص: {item.damage_notes}</Text> : null}
            {item.recommendations ? <Text style={styles.notes}>التوصيات: {item.recommendations}</Text> : null}
            {item.notes ? <Text style={styles.notes}>ملاحظات: {item.notes}</Text> : null}

            <View style={styles.itemActionsRow}>
              <TouchableOpacity style={[styles.itemActionButton, styles.completeButton]} onPress={() => updateStatus(item.id, "completed")}>
                <Text style={styles.itemActionText}>مكتملة</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.itemActionButton, styles.repairButton]} onPress={() => updateStatus(item.id, "needs_repair")}>
                <Text style={styles.itemActionText}>تحتاج إصلاح</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.itemActionButton, styles.openButton]} onPress={() => updateStatus(item.id, "open")}>
                <Text style={styles.itemActionText}>فتح</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            يمكن استخدام هذه الشاشة لتوثيق حالة الوحدة قبل تسليمها للمستأجر أو عند استلامها بعد انتهاء العقد، مع تسجيل العدادات والمفاتيح والتلفيات.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 12, paddingBottom: 50 },
  title: { fontSize: 30, fontWeight: "900", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", fontSize: 15, textAlign: "right", lineHeight: 22 },
  summaryBox: { backgroundColor: "#111827", borderRadius: 14, padding: 12, marginBottom: 9 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  topActionsRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 9 },
  primaryButton: { flex: 1, backgroundColor: "#0F9B6F", padding: 13, borderRadius: 14, alignItems: "center" },
  addButton: { flex: 1, backgroundColor: "#16a34a", padding: 13, borderRadius: 14, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "900" },
  formCard: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 9 },
  formTitle: { fontSize: 16, fontWeight: "900", color: "#111827", textAlign: "right", marginBottom: 8 },
  label: { color: "#374151", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 8 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "800" },
  chipTextActive: { color: "#fff" },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  multilineInput: { minHeight: 70, textAlignVertical: "top" },
  twoColumns: { flexDirection: "row-reverse", gap: 8 },
  halfInput: { flex: 1 },
  checkGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  checkItem: { width: "48%", borderRadius: 12, padding: 10, alignItems: "center" },
  checkOk: { backgroundColor: "#dcfce7" },
  checkBad: { backgroundColor: "#fee2e2" },
  checkText: { fontWeight: "900", textAlign: "center" },
  checkTextOk: { color: "#166534" },
  checkTextBad: { color: "#991b1b" },
  saveButton: { backgroundColor: "#16a34a", padding: 13, borderRadius: 12, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "900" },
  box: { backgroundColor: "#fff", padding: 12, borderRadius: 14, alignItems: "center", marginBottom: 8 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  statusOpen: { backgroundColor: "#dbeafe", color: "#065F44" },
  statusCompleted: { backgroundColor: "#dcfce7", color: "#166534" },
  statusRepair: { backgroundColor: "#fef3c7", color: "#92400e" },
  statusCancelled: { backgroundColor: "#fee2e2", color: "#991b1b" },
  cardTitle: { color: "#111827", fontSize: 16, fontWeight: "900", textAlign: "right", flex: 1 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  repairText: { marginTop: 8, color: "#92400e", fontWeight: "900", textAlign: "right" },
  notes: { marginTop: 10, color: "#374151", fontWeight: "700", textAlign: "right", lineHeight: 22 },
  itemActionsRow: { flexDirection: "row-reverse", marginTop: 14 },
  itemActionButton: { flex: 1, padding: 11, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  completeButton: { backgroundColor: "#16a34a" },
  repairButton: { backgroundColor: "#d97706" },
  openButton: { backgroundColor: "#0F9B6F" },
  itemActionText: { color: "#fff", fontWeight: "900" },
  noteBox: { backgroundColor: "#fffbeb", borderRadius: 14, padding: 10, marginTop: 4 },
  noteText: { color: "#92400e", fontWeight: "700", textAlign: "right", lineHeight: 22 },
});
