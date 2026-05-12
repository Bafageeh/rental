import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGetScoped, apiPost } from "../lib/api";

type Unit = {
  id: number;
  unit_number?: string | null;
  label?: string | null;
  status?: string | null;
  owner_id?: number | string | null;
  property_id?: number | string | null;
  property?: {
    name?: string | null;
    owner?: {
      name?: string | null;
    } | null;
  } | null;
};

type RelationOption = {
  id: number | string;
  label?: string | null;
  title?: string | null;
  owner_id?: number | string | null;
  property_id?: number | string | null;
  status?: string | null;
};

type PaymentCycle = "monthly" | "quarterly" | "semi_annual" | "annual";
type ContractScope = "property" | "unit";

function money(value: string) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function cycleLabel(value: PaymentCycle) {
  if (value === "monthly") return "شهري";
  if (value === "quarterly") return "ربع سنوي";
  if (value === "semi_annual") return "نصف سنوي";
  if (value === "annual") return "سنوي";
  return value;
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function cleanName(value: string) {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function addQueryParam(parts: string[], key: string, value?: string | number | null) {
  if (value === undefined || value === null || String(value).trim() === "") return;
  parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
}

export default function CreateContractScreen() {
  const params = useLocalSearchParams();
  const propertyIdParam = firstParam(params.property_id as string | string[] | undefined);
  const propertyNameParam = firstParam(params.property_name as string | string[] | undefined);
  const unitIdParam = firstParam(params.unit_id as string | string[] | undefined);
  const unitNameParam = firstParam(params.unit_name as string | string[] | undefined);
  const ownerIdParam = firstParam(params.owner_id as string | string[] | undefined);
  const ownerNameParam = firstParam(params.owner_name as string | string[] | undefined);
  const contractScopeParam = firstParam((params.contract_scope || params.target_type) as string | string[] | undefined);
  const contractScope: ContractScope = contractScopeParam === "property" ? "property" : "unit";
  const isPropertyContract = contractScope === "property";
  const scopedPropertyId = propertyIdParam ? Number(propertyIdParam) : null;
  const scopedPropertyName = cleanName(propertyNameParam);
  const scopedUnitId = unitIdParam ? Number(unitIdParam) : null;
  const scopedUnitName = cleanName(unitNameParam);
  const scopedOwnerId = ownerIdParam ? Number(ownerIdParam) : null;
  const scopedOwnerName = cleanName(ownerNameParam);

  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tenantName, setTenantName] = useState("");
  const [unitId, setUnitId] = useState<number | null>(null);

  const [contractNumber, setContractNumber] = useState("");
  const [startDate, setStartDate] = useState("2026-05-01");
  const [endDate, setEndDate] = useState("2027-04-30");
  const [rentAmount, setRentAmount] = useState("");
  const [parkingFee, setParkingFee] = useState("");
  const [servicesFee, setServicesFee] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [paymentsCount, setPaymentsCount] = useState("12");
  const [paymentCycle, setPaymentCycle] = useState<PaymentCycle>("monthly");

  const selectedUnit = useMemo(
    () => units.find((unit) => Number(unit.id) === Number(unitId)) || null,
    [unitId, units],
  );

  const contextOwnerName =
    scopedOwnerName ||
    selectedUnit?.property?.owner?.name ||
    (scopedOwnerId ? `مالك #${scopedOwnerId}` : "لم يتم تحديد المالك");

  const contextPropertyName =
    scopedPropertyName ||
    selectedUnit?.property?.name ||
    (scopedPropertyId ? `عقار #${scopedPropertyId}` : "وحدة مباشرة أو عقار غير محدد");

  const contextUnitName = isPropertyContract
    ? "العقار كامل"
    : scopedUnitName || selectedUnit?.unit_number || selectedUnit?.label || (scopedUnitId ? `وحدة #${scopedUnitId}` : unitId ? `وحدة #${unitId}` : "اختر الوحدة");

  async function load() {
    try {
      setLoading(true);

      const propertyFilter = scopedPropertyId
        ? `?property_id=${scopedPropertyId}`
        : scopedOwnerId
          ? `?owner_id=${scopedOwnerId}`
          : "";

      const [unitsResult, relationOptions] = await Promise.all([
        isPropertyContract ? Promise.resolve([]) : apiGetScoped(`/units${propertyFilter}`, `/my/units${propertyFilter}`),
        !isPropertyContract && scopedOwnerId ? apiGetScoped("/relation-manager/options", "/my/relation-manager/options") : Promise.resolve(null),
      ]);

      let loadedUnitsList: Unit[] = Array.isArray(unitsResult) ? unitsResult : [];

      if (!isPropertyContract && scopedOwnerId && relationOptions) {
        const properties = Array.isArray(relationOptions?.properties) ? relationOptions.properties as RelationOption[] : [];
        const propertyById = new Map(properties.map((property) => [String(property.id), property]));
        const relationUnits = Array.isArray(relationOptions?.units) ? relationOptions.units as RelationOption[] : [];
        const ownerUnits = relationUnits
          .filter((unit) => {
            const unitOwnerId = unit.owner_id ? String(unit.owner_id) : "";
            const property = unit.property_id ? propertyById.get(String(unit.property_id)) : null;
            const propertyOwnerId = property?.owner_id ? String(property.owner_id) : "";
            return unitOwnerId === String(scopedOwnerId) || propertyOwnerId === String(scopedOwnerId);
          })
          .map((unit) => {
            const property = unit.property_id ? propertyById.get(String(unit.property_id)) : null;
            return {
              id: Number(unit.id),
              unit_number: unit.title || unit.label || `وحدة #${unit.id}`,
              label: unit.label || unit.title || `وحدة #${unit.id}`,
              status: unit.status,
              owner_id: unit.owner_id,
              property_id: unit.property_id,
              property: property ? { name: property.title || property.label || "عقار" } : null,
            } as Unit;
          });

        if (ownerUnits.length > 0) {
          loadedUnitsList = ownerUnits;
        }
      }

      const unitsList = scopedUnitId
        ? loadedUnitsList.filter((unit: Unit) => Number(unit.id) === Number(scopedUnitId))
        : loadedUnitsList;

      setUnits(unitsList);

      if (isPropertyContract) {
        setUnitId(null);
      } else if (scopedUnitId && unitsList.some((unit: Unit) => Number(unit.id) === Number(scopedUnitId))) {
        setUnitId(scopedUnitId);
      } else if (!unitId && unitsList.length > 0) {
        const availableUnit = unitsList.find((unit: Unit) => unit.status !== "rented");
        setUnitId(availableUnit?.id || unitsList[0].id);
      }
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل بيانات العقد");
    } finally {
      setLoading(false);
    }
  }

  function openUploadContract() {
    const parts: string[] = [];
    addQueryParam(parts, "owner_id", scopedOwnerId);
    addQueryParam(parts, "owner_name", contextOwnerName);
    addQueryParam(parts, "property_id", scopedPropertyId || selectedUnit?.property_id || null);
    addQueryParam(parts, "property_name", contextPropertyName);
    addQueryParam(parts, "contract_scope", contractScope);
    addQueryParam(parts, "target_type", contractScope);
    if (!isPropertyContract) {
      addQueryParam(parts, "unit_id", scopedUnitId || unitId || null);
      addQueryParam(parts, "unit_name", contextUnitName);
    } else {
      addQueryParam(parts, "unit_name", "العقار كامل");
    }

    const query = parts.length ? `?${parts.join("&")}` : "";
    router.push(`/upload-contract${query}` as any);
  }

  async function saveContract() {
    if (!tenantName.trim()) {
      Alert.alert("تنبيه", "أدخل اسم المستأجر");
      return;
    }

    if (!isPropertyContract && !unitId) {
      Alert.alert("تنبيه", "اختر الوحدة");
      return;
    }

    if (isPropertyContract && !scopedPropertyId) {
      Alert.alert("تنبيه", "يجب تحديد العقار لإنشاء عقد على العقار بالكامل");
      return;
    }

    if (!startDate.trim() || !endDate.trim()) {
      Alert.alert("تنبيه", "أدخل تاريخ البداية والنهاية بصيغة YYYY-MM-DD");
      return;
    }

    if (!rentAmount.trim()) {
      Alert.alert("تنبيه", "أدخل قيمة الإيجار");
      return;
    }

    try {
      setSaving(true);

      const result = await apiPost("/contracts", {
        tenant_name: tenantName.trim(),
        unit_id: isPropertyContract ? null : unitId,
        property_id: scopedPropertyId || selectedUnit?.property_id || null,
        contract_scope: contractScope,
        contract_number: contractNumber.trim() || null,
        start_date: startDate.trim(),
        end_date: endDate.trim(),
        rent_amount: Number(rentAmount || 0),
        parking_fee: Number(parkingFee || 0),
        services_fee: Number(servicesFee || 0),
        deposit_amount: Number(depositAmount || 0),
        payment_cycle: paymentCycle,
        payments_count: Number(paymentsCount || 1),
      });

      setTenantName("");
      setContractNumber("");
      setRentAmount("");
      setParkingFee("");
      setServicesFee("");
      setDepositAmount("");
      setPaymentsCount("12");

      Alert.alert("تم", result.message || "تم إنشاء العقد بنجاح");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر إنشاء العقد");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
  }, [propertyIdParam, unitIdParam, ownerIdParam, contractScope]);

  const cycleOptions: PaymentCycle[] = ["monthly", "quarterly", "semi_annual", "annual"];
  const installmentValue = money(String(Number(rentAmount || 0) / Math.max(Number(paymentsCount || 1), 1)));

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="document-text-outline" size={24} color="#ffffff" />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.eyebrow}>عقد إيجار جديد</Text>
            <Text style={styles.title}>{isPropertyContract ? "إنشاء عقد وربطه بالعقار" : "إنشاء عقد وربطه بالوحدة"}</Text>
            <Text style={styles.subtitle}>تأكد من بيانات المالك والعقار ونطاق العقد ثم أدخل اسم المستأجر والبيانات المالية.</Text>
          </View>
          <TouchableOpacity style={styles.uploadButton} onPress={openUploadContract} activeOpacity={0.82}>
            <Ionicons name="cloud-upload-outline" size={18} color="#ffffff" />
            <Text style={styles.uploadButtonText}>رفع عقد</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contextCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>بيانات الربط</Text>
            <Text style={styles.sectionHint}>تظهر هذه البيانات في العقد الجديد</Text>
          </View>
          <View style={styles.contextGrid}>
            <View style={styles.contextItem}>
              <Ionicons name="person-outline" size={18} color="#0f766e" />
              <View style={styles.contextTextWrap}>
                <Text style={styles.contextLabel}>المالك</Text>
                <Text style={styles.contextValue} numberOfLines={1}>{contextOwnerName}</Text>
              </View>
            </View>
            <View style={styles.contextItem}>
              <Ionicons name="business-outline" size={18} color="#0f766e" />
              <View style={styles.contextTextWrap}>
                <Text style={styles.contextLabel}>العقار</Text>
                <Text style={styles.contextValue} numberOfLines={1}>{contextPropertyName}</Text>
              </View>
            </View>
            <View style={styles.contextItemWide}>
              <Ionicons name={isPropertyContract ? "business" : "home-outline"} size={18} color="#0f766e" />
              <View style={styles.contextTextWrap}>
                <Text style={styles.contextLabel}>نطاق العقد</Text>
                <Text style={styles.contextValue} numberOfLines={1}>{contextUnitName}</Text>
              </View>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>جاري تحميل بيانات العقد...</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>بيانات المستأجر</Text>
            <Text style={styles.sectionHint}>أدخل اسم المستأجر يدويًا كما تريد ظهوره في العقد</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="اسم المستأجر"
            value={tenantName}
            onChangeText={setTenantName}
            textAlign="right"
            returnKeyType="next"
          />
        </View>

        {!isPropertyContract ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>اختيار الوحدة</Text>
              <Text style={styles.sectionHint}>
                {scopedUnitId
                  ? "هذا العقد مرتبط بهذه الوحدة فقط"
                  : scopedPropertyId
                    ? "تظهر هنا وحدات هذا العقار فقط"
                    : scopedOwnerId
                      ? "تظهر هنا وحدات هذا المالك فقط"
                      : "اختر الوحدة التي سيصدر عليها العقد"}
              </Text>
            </View>

            <View style={styles.chips}>
              {units.map((unit) => (
                <TouchableOpacity
                  key={unit.id}
                  style={[styles.unitChip, unitId === unit.id ? styles.chipActive : null]}
                  onPress={() => {
                    if (scopedUnitId) return;
                    setUnitId(unit.id);
                  }}
                  activeOpacity={0.82}
                >
                  <Text style={[styles.unitChipTitle, unitId === unit.id ? styles.chipTextActive : null]} numberOfLines={1}>
                    {unit.unit_number || unit.label || "وحدة"}
                  </Text>
                  <Text style={[styles.unitChipMeta, unitId === unit.id ? styles.chipMetaActive : null]} numberOfLines={1}>
                    {unit.property?.name || "وحدة مباشرة"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {!loading && units.length === 0 ? (
              <Text style={styles.emptyHint}>
                {scopedUnitId
                  ? "تعذر العثور على هذه الوحدة."
                  : scopedOwnerId
                    ? "لا توجد وحدات لهذا المالك. أضف وحدة أولًا ثم أنشئ العقد."
                    : "لا توجد وحدات متاحة لهذا العقار. أضف وحدة أولًا ثم أنشئ العقد."}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>بيانات العقد</Text>
            <Text style={styles.sectionHint}>البيانات الأساسية وتواريخ العقد</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="رقم العقد اختياري"
            value={contractNumber}
            onChangeText={setContractNumber}
            textAlign="right"
          />

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="تاريخ البداية YYYY-MM-DD"
              value={startDate}
              onChangeText={setStartDate}
              textAlign="right"
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="تاريخ النهاية YYYY-MM-DD"
              value={endDate}
              onChangeText={setEndDate}
              textAlign="right"
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>القيم المالية</Text>
            <Text style={styles.sectionHint}>سيتم إنشاء الدفعات بناءً على هذه القيم</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="قيمة الإيجار الإجمالية"
            value={rentAmount}
            onChangeText={setRentAmount}
            keyboardType="number-pad"
            textAlign="right"
          />

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.thirdInput]}
              placeholder="رسوم الموقف"
              value={parkingFee}
              onChangeText={setParkingFee}
              keyboardType="number-pad"
              textAlign="right"
            />
            <TextInput
              style={[styles.input, styles.thirdInput]}
              placeholder="رسوم الخدمات"
              value={servicesFee}
              onChangeText={setServicesFee}
              keyboardType="number-pad"
              textAlign="right"
            />
            <TextInput
              style={[styles.input, styles.thirdInput]}
              placeholder="مبلغ الضمان"
              value={depositAmount}
              onChangeText={setDepositAmount}
              keyboardType="number-pad"
              textAlign="right"
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="عدد الدفعات"
            value={paymentsCount}
            onChangeText={setPaymentsCount}
            keyboardType="number-pad"
            textAlign="right"
          />

          <Text style={styles.label}>دورة السداد</Text>

          <View style={styles.chips}>
            {cycleOptions.map((cycle) => (
              <TouchableOpacity
                key={cycle}
                style={[styles.chip, paymentCycle === cycle ? styles.chipActive : null]}
                onPress={() => setPaymentCycle(cycle)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, paymentCycle === cycle ? styles.chipTextActive : null]}>
                  {cycleLabel(cycle)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.summaryBox}>
            <View style={styles.summaryIcon}>
              <Ionicons name="calculator-outline" size={18} color="#1d4ed8" />
            </View>
            <View style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>قيمة الدفعة التقريبية</Text>
              <Text style={styles.summaryText}>{installmentValue}</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.saveButton, saving ? styles.saveButtonDisabled : null]} onPress={saveContract} disabled={saving} activeOpacity={0.86}>
            <Ionicons name="checkmark-circle-outline" size={19} color="#ffffff" />
            <Text style={styles.saveButtonText}>{saving ? "جاري إنشاء العقد..." : "إنشاء العقد والدفعات"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 14, paddingBottom: 50 },
  heroCard: {
    backgroundColor: "#111827",
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextWrap: { flex: 1 },
  eyebrow: { color: "#A7F3D0", fontSize: 12, fontWeight: "900", textAlign: "right", marginBottom: 4 },
  title: { fontSize: 22, fontWeight: "900", color: "#ffffff", textAlign: "right" },
  subtitle: { marginTop: 6, color: "#D1D5DB", fontSize: 13, lineHeight: 21, textAlign: "right" },
  uploadButton: {
    backgroundColor: "#16a34a",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minWidth: 78,
  },
  uploadButtonText: { color: "#ffffff", fontWeight: "900", fontSize: 12 },
  loadingBox: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEEAE3",
  },
  loadingText: { marginTop: 8, color: "#5E5B55", fontWeight: "700" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEEAE3",
  },
  contextCard: {
    backgroundColor: "#ecfdf5",
    borderRadius: 22,
    padding: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    textAlign: "right",
  },
  sectionHint: {
    color: "#7A766F",
    fontSize: 13,
    textAlign: "right",
    marginTop: 4,
    lineHeight: 20,
  },
  contextGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  contextItem: {
    flexGrow: 1,
    flexBasis: "47%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 11,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  contextItemWide: {
    flexBasis: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 11,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  contextTextWrap: { flex: 1 },
  contextLabel: { color: "#0f766e", fontSize: 12, fontWeight: "900", textAlign: "right" },
  contextValue: { color: "#111827", fontSize: 14, fontWeight: "900", textAlign: "right", marginTop: 3 },
  input: {
    backgroundColor: "#F7F6F4",
    borderWidth: 1,
    borderColor: "#DDDBD6",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    color: "#111827",
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row-reverse",
    gap: 8,
  },
  halfInput: { flex: 1 },
  thirdInput: { flex: 1 },
  label: {
    color: "#374151",
    fontWeight: "900",
    textAlign: "right",
    marginBottom: 8,
    marginTop: 2,
  },
  chips: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  unitChip: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minWidth: 132,
    maxWidth: "100%",
  },
  chipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "800" },
  chipTextActive: { color: "#fff" },
  chipMetaActive: { color: "#D1D5DB" },
  unitChipTitle: { color: "#111827", fontWeight: "900", textAlign: "right" },
  unitChipMeta: { color: "#7A766F", marginTop: 4, fontSize: 12, fontWeight: "700", textAlign: "right" },
  emptyHint: { color: "#b91c1c", fontWeight: "800", textAlign: "right", marginTop: 10, lineHeight: 22 },
  summaryBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 16,
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryContent: { flex: 1 },
  summaryLabel: { color: "#1d4ed8", fontWeight: "800", fontSize: 12, textAlign: "right" },
  summaryText: {
    color: "#1d4ed8",
    fontWeight: "900",
    fontSize: 18,
    textAlign: "right",
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: "#16a34a",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row-reverse",
    gap: 8,
  },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },
});
