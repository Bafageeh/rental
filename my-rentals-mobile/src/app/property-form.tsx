import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGet, apiPost } from "../lib/api";

type PropertyForm = {
  owner_id: string;
  name: string;
  deed_number: string;
  city: string;
  district: string;
  address: string;
  national_short_address: string;
  property_area: string;
  property_type: string;
  usage_type: string;
  floors_count: string;
  parking_spots_count: string;
  elevators_count: string;
  rooms_count: string;
  bathrooms_count: string;
  unit_floor: string;
  notes: string;
};

const propertyTypes = [
  { value: "building", label: "عمارة", icon: "business-outline" },
  { value: "apartment", label: "شقة", icon: "home-outline" },
  { value: "villa", label: "فيلا", icon: "storefront-outline" },
  { value: "land", label: "أرض", icon: "map-outline" },
  { value: "commercial", label: "تجاري", icon: "briefcase-outline" },
];

const usageTypes = [
  { value: "residential", label: "سكني" },
  { value: "commercial", label: "تجاري" },
  { value: "mixed", label: "مختلط" },
];

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function emptyForm(ownerId = "", propertyType = "building"): PropertyForm {
  return {
    owner_id: ownerId,
    name: "",
    deed_number: "",
    city: "",
    district: "",
    address: "",
    national_short_address: "",
    property_area: "",
    property_type: propertyType || "building",
    usage_type: "residential",
    floors_count: "",
    parking_spots_count: "",
    elevators_count: "",
    rooms_count: "",
    bathrooms_count: "",
    unit_floor: "",
    notes: "",
  };
}

function valueToString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function optionalNumber(value: string) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const number = Number(text.replace(/,/g, ""));
  return Number.isFinite(number) ? number : undefined;
}

function cleanPayload(form: PropertyForm, isEdit: boolean, hideApartmentDirectFields = false) {
  const payload: Record<string, string | number | null> = {};
  Object.entries(form).forEach(([key, value]) => {
    if (key === "unit_floor") return;
    if (form.property_type === "apartment") {
      if (["floors_count", "parking_spots_count", "elevators_count"].includes(key)) return;
      if (hideApartmentDirectFields && ["deed_number", "city", "district", "address", "national_short_address"].includes(key)) return;
    }
    if (form.property_type === "building" && ["rooms_count", "bathrooms_count"].includes(key)) return;
    const text = String(value ?? "").trim();
    if (text === "") {
      if (isEdit) payload[key] = "";
      return;
    }
    if (["owner_id", "floors_count", "parking_spots_count", "elevators_count", "rooms_count", "bathrooms_count"].includes(key)) {
      payload[key] = Number(text);
      return;
    }
    if (key === "property_area") {
      payload[key] = Number(text.replace(/,/g, ""));
      return;
    }
    payload[key] = text;
  });
  if (form.property_type === "apartment") {
    payload.default_unit_number = form.name || "الشقة";
  }
  return payload;
}

function cleanUnitPayload(form: PropertyForm, sourcePropertyId: string) {
  return {
    property_id: Number(sourcePropertyId),
    unit_number: form.name.trim(),
    floor: form.unit_floor.trim() || null,
    type: "apartment",
    is_subdivided: false,
    rooms_count: optionalNumber(form.rooms_count) ?? 0,
    bathrooms_count: optionalNumber(form.bathrooms_count) ?? 0,
    rent_amount: 0,
    status: "available",
    notes: form.notes.trim() || null,
  };
}

function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconBox}>
          <Ionicons name={icon} size={19} color="#0F766E" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = "default", multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: "default" | "number-pad" | "decimal-pad"; multiline?: boolean; }) {
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline ? styles.textArea : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        textAlign="right"
        multiline={multiline}
      />
    </View>
  );
}

function ChoiceGroup({ options, value, onChange, disabled = false }: { options: Array<{ value: string; label: string; icon?: keyof typeof Ionicons.glyphMap }>; value: string; onChange: (value: string) => void; disabled?: boolean; }) {
  return (
    <View style={styles.choiceRow}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.choiceChip, selected ? styles.choiceChipActive : null, disabled && !selected ? styles.choiceChipDisabled : null]}
            activeOpacity={disabled ? 1 : 0.86}
            disabled={disabled}
            onPress={() => onChange(option.value)}
          >
            {option.icon ? <Ionicons name={option.icon} size={16} color={selected ? "#fff" : "#475569"} /> : null}
            <Text style={[styles.choiceText, selected ? styles.choiceTextActive : null]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function PropertyFormScreen() {
  const params = useLocalSearchParams<{ id?: string; owner_id?: string; property_type?: string; lock_property_type?: string; source_property_id?: string; source_property_name?: string }>();
  const id = firstParam(params.id);
  const initialOwnerId = firstParam(params.owner_id);
  const requestedPropertyType = firstParam(params.property_type);
  const lockPropertyType = firstParam(params.lock_property_type) === "1";
  const sourcePropertyId = firstParam(params.source_property_id);
  const sourcePropertyName = firstParam(params.source_property_name);
  const isEdit = Boolean(id);
  const lockedApartmentMode = !isEdit && lockPropertyType && requestedPropertyType === "apartment";
  const isAddingUnderBuilding = lockedApartmentMode && Boolean(sourcePropertyId);
  const initialPropertyType = lockedApartmentMode ? "apartment" : requestedPropertyType || "building";
  const [form, setForm] = useState<PropertyForm>(() => emptyForm(initialOwnerId, initialPropertyType));
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const isApartment = form.property_type === "apartment";
  const isBuilding = form.property_type === "building";
  const hideApartmentDirectFields = isApartment && isAddingUnderBuilding;
  const showDeedField = !hideApartmentDirectFields;
  const showLocationSection = !hideApartmentDirectFields;
  const title = useMemo(() => lockedApartmentMode ? "إضافة شقة" : isEdit ? "تعديل العقار" : "إضافة عقار يدويًا", [isEdit, lockedApartmentMode]);
  const propertyTypeChoices = lockedApartmentMode ? propertyTypes.filter((item) => item.value === "apartment") : propertyTypes;
  const lockNotice = isAddingUnderBuilding
    ? `تنبيه: نوع العقار مثبت على شقة لأن الإضافة تتم تحت عقار${sourcePropertyName ? ` (${sourcePropertyName})` : ""}.`
    : "نوع العقار مثبت على شقة ولا يمكن تغييره من هذا المسار.";

  function setField<K extends keyof PropertyForm>(key: K, value: PropertyForm[K]) {
    setForm((previous) => {
      const next = {
        ...previous,
        [key]: key === "national_short_address"
          ? String(value).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase()
          : key === "unit_floor"
            ? String(value).replace(/[^0-9]/g, "")
            : value,
      };
      if (key === "property_type" && value === "apartment") {
        next.floors_count = "";
        next.parking_spots_count = "";
        next.elevators_count = "";
      }
      if (key === "property_type" && value === "building") {
        next.rooms_count = "";
        next.bathrooms_count = "";
        next.unit_floor = "";
      }
      return next;
    });
  }

  async function loadProperty() {
    if (!id) return;
    try {
      setLoading(true);
      const property = await apiGet(`/properties/${encodeURIComponent(id)}`);
      const defaultUnit = Array.isArray(property?.units) ? property.units.find((unit: any) => unit?.type === "apartment" || unit?.unit_number === "الشقة") || property.units[0] : null;
      setForm({
        owner_id: valueToString(property?.owner_id || property?.owner?.id || initialOwnerId),
        name: valueToString(property?.name),
        deed_number: valueToString(property?.deed_number || property?.document_number),
        city: valueToString(property?.city),
        district: valueToString(property?.district),
        address: valueToString(property?.address),
        national_short_address: valueToString(property?.national_short_address),
        property_area: valueToString(property?.property_area),
        property_type: valueToString(property?.property_type || "building"),
        usage_type: valueToString(property?.usage_type || "residential"),
        floors_count: valueToString(property?.floors_count),
        parking_spots_count: valueToString(property?.parking_spots_count),
        elevators_count: valueToString(property?.elevators_count),
        rooms_count: valueToString(defaultUnit?.rooms_count),
        bathrooms_count: valueToString(defaultUnit?.bathrooms_count),
        unit_floor: valueToString(defaultUnit?.floor),
        notes: valueToString(property?.notes),
      });
    } catch (e) {
      Alert.alert("تعذر التحميل", e instanceof Error ? e.message : "حدث خطأ غير متوقع", [{ text: "حسنًا", onPress: () => router.back() }]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProperty(); }, [id]);
  useEffect(() => {
    if (!lockedApartmentMode) return;
    setForm((previous) => ({ ...previous, property_type: "apartment", floors_count: "", parking_spots_count: "", elevators_count: "" }));
  }, [lockedApartmentMode]);

  async function save() {
    if (!form.name.trim()) return Alert.alert("تنبيه", isApartment ? "اسم الشقة مطلوب." : "اسم العقار مطلوب.");
    try {
      setSaving(true);
      const normalizedForm = lockedApartmentMode ? { ...form, property_type: "apartment" } : form;
      if (isEdit) {
        const fields = cleanPayload(normalizedForm, true, hideApartmentDirectFields);
        delete fields.owner_id;
        await apiPost(`/edit-delete-center/properties/${id}/update`, { fields });
        Alert.alert("تم", "تم تحديث بيانات العقار.", [
          { text: "عرض العقار", onPress: () => router.replace(`/property/${id}` as never) },
          { text: "رجوع", onPress: () => router.back() },
        ]);
        return;
      }

      if (isAddingUnderBuilding) {
        const unitPayload = cleanUnitPayload(normalizedForm, sourcePropertyId);
        const json = await apiPost("/units", unitPayload);
        const unitId = Number(json?.unit?.id || 0);
        Alert.alert("تم", "تم إنشاء الشقة تحت العقار المحدد.", [
          { text: "عرض العقار", onPress: () => router.replace(`/property/${sourcePropertyId}` as never) },
          { text: "عرض الشقة", onPress: () => unitId ? router.replace(`/unit/${unitId}` as never) : router.replace(`/property/${sourcePropertyId}` as never) },
          { text: "إضافة شقة أخرى", onPress: () => setForm(emptyForm(initialOwnerId, "apartment")) },
        ]);
        return;
      }

      const payload = cleanPayload(normalizedForm, false, hideApartmentDirectFields);
      const json = await apiPost("/properties", payload);
      const propertyId = Number(json?.property?.id || 0);
      Alert.alert("تم", isApartment ? "تم إنشاء الشقة." : "تم إنشاء العقار يدويًا.", [
        { text: isApartment ? "عرض الشقة" : "عرض العقار", onPress: () => propertyId ? router.replace(`/property/${propertyId}` as never) : router.replace("/properties" as never) },
        { text: isApartment ? "إضافة شقة أخرى" : "إضافة آخر", onPress: () => setForm(emptyForm(initialOwnerId, initialPropertyType)) },
      ]);
    } catch (e) {
      Alert.alert("تعذر الحفظ", e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <TouchableOpacity style={styles.backButton} activeOpacity={0.86} onPress={() => router.back()}>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.heroTextBox}>
              <Text style={styles.heroKicker}>{lockedApartmentMode ? "إضافة شقة تابعة" : isEdit ? "تحديث البيانات" : "إدخال مباشر"}</Text>
              <Text style={styles.heroTitle}>{title}</Text>
              <Text style={styles.heroSubtitle}>{lockedApartmentMode ? lockNotice : isEdit ? "نفس شاشة الإضافة تستخدم للتعديل حتى تكون البيانات مرتبة وواضحة." : "اختر نوع العقار وستتغير الحقول تلقائيًا حسب النوع."}</Text>
            </View>
            <View style={styles.heroIconBox}>
              <Ionicons name={isApartment ? "home-outline" : isEdit ? "create-outline" : "add-circle-outline"} size={30} color="#0F766E" />
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>جاري تحميل بيانات العقار...</Text>
            </View>
          ) : (
            <>
              <Section title="البيانات الأساسية" icon="business-outline">
                <Field label={isApartment ? "اسم الشقة" : "اسم العقار"} value={form.name} onChangeText={(value) => setField("name", value)} placeholder={isApartment ? "مثال: شقة الدور الأول" : "مثال: عمارة الصفا"} />
                {showDeedField ? <Field label={isApartment ? "رقم الصك إن كانت مباشرة مع المالك" : "رقم الصك إن وجد"} value={form.deed_number} onChangeText={(value) => setField("deed_number", value)} placeholder="رقم الصك إن وجد" keyboardType="number-pad" /> : null}
                <Text style={styles.fieldLabel}>نوع العقار</Text>
                <ChoiceGroup options={propertyTypeChoices} value={form.property_type} onChange={(value) => setField("property_type", value)} disabled={lockedApartmentMode} />
                {lockedApartmentMode ? (
                  <View style={isAddingUnderBuilding ? styles.lockWarning : styles.lockInfo}>
                    <Ionicons name={isAddingUnderBuilding ? "alert-circle-outline" : "lock-closed-outline"} size={16} color={isAddingUnderBuilding ? "#92400E" : "#0F766E"} />
                    <Text style={isAddingUnderBuilding ? styles.lockWarningText : styles.lockInfoText}>{lockNotice}</Text>
                  </View>
                ) : null}
              </Section>

              {showLocationSection ? (
                <Section title={isApartment ? "الموقع إن كانت مباشرة مع المالك" : "الموقع"} icon="location-outline">
                  <Field label="المدينة" value={form.city} onChangeText={(value) => setField("city", value)} />
                  <Field label="الحي" value={form.district} onChangeText={(value) => setField("district", value)} />
                  <Field label="العنوان" value={form.address} onChangeText={(value) => setField("address", value)} multiline />
                  <Field label="العنوان الوطني المختصر" value={form.national_short_address} onChangeText={(value) => setField("national_short_address", value)} placeholder="مثال: JEDA1234" />
                </Section>
              ) : null}

              <Section title="المواصفات" icon="options-outline">
                <Field label="المساحة" value={form.property_area} onChangeText={(value) => setField("property_area", value)} keyboardType="decimal-pad" />
                {isApartment && isAddingUnderBuilding ? <Field label="الوحدة في الدور" value={form.unit_floor} onChangeText={(value) => setField("unit_floor", value)} keyboardType="number-pad" /> : null}
                {isApartment ? (
                  <>
                    <Field label="عدد الغرف" value={form.rooms_count} onChangeText={(value) => setField("rooms_count", value)} keyboardType="number-pad" />
                    <Field label="عدد الحمامات" value={form.bathrooms_count} onChangeText={(value) => setField("bathrooms_count", value)} keyboardType="number-pad" />
                  </>
                ) : null}
                {isBuilding ? (
                  <>
                    <Field label="عدد الأدوار" value={form.floors_count} onChangeText={(value) => setField("floors_count", value)} keyboardType="number-pad" />
                    <Field label="عدد المواقف" value={form.parking_spots_count} onChangeText={(value) => setField("parking_spots_count", value)} keyboardType="number-pad" />
                    <Field label="عدد المصاعد" value={form.elevators_count} onChangeText={(value) => setField("elevators_count", value)} keyboardType="number-pad" />
                  </>
                ) : null}
                {!isApartment && !isBuilding ? (
                  <>
                    <Field label="عدد الأدوار" value={form.floors_count} onChangeText={(value) => setField("floors_count", value)} keyboardType="number-pad" />
                    <Field label="عدد المواقف" value={form.parking_spots_count} onChangeText={(value) => setField("parking_spots_count", value)} keyboardType="number-pad" />
                  </>
                ) : null}
              </Section>

              <Section title="الاستخدام والملاحظات" icon="shield-checkmark-outline">
                <Text style={styles.fieldLabel}>نوع الاستخدام</Text>
                <ChoiceGroup options={usageTypes} value={form.usage_type} onChange={(value) => setField("usage_type", value)} />
                <Field label="ملاحظات" value={form.notes} onChangeText={(value) => setField("notes", value)} multiline />
              </Section>

              <TouchableOpacity style={[styles.saveButton, saving ? styles.disabled : null]} activeOpacity={0.88} disabled={saving} onPress={save}>
                {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={20} color="#fff" />}
                <Text style={styles.saveText}>{saving ? "جاري الحفظ..." : isEdit ? "حفظ التعديل" : isApartment ? "حفظ الشقة" : "حفظ العقار"}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  content: { padding: 14, paddingBottom: 48 },
  hero: { backgroundColor: "#111827", borderRadius: 28, padding: 15, marginBottom: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 15, backgroundColor: "#374151", alignItems: "center", justifyContent: "center" },
  heroTextBox: { flex: 1, alignItems: "flex-end" },
  heroKicker: { color: "#5EEAD4", fontWeight: "900", fontSize: 12, textAlign: "right" },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "900", textAlign: "right", marginTop: 3 },
  heroSubtitle: { color: "#CBD5E1", fontWeight: "800", lineHeight: 21, textAlign: "right", marginTop: 6, fontSize: 12 },
  heroIconBox: { width: 56, height: 56, borderRadius: 22, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  loadingCard: { backgroundColor: "#fff", borderRadius: 22, padding: 18, alignItems: "center" },
  loadingText: { color: "#64748B", fontWeight: "800", marginTop: 8 },
  sectionCard: { backgroundColor: "#fff", borderRadius: 24, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#ECEFF3", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  sectionHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionIconBox: { width: 34, height: 34, borderRadius: 14, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: "#111827", fontWeight: "900", fontSize: 17, textAlign: "right" },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { color: "#334155", fontWeight: "900", textAlign: "right", marginBottom: 7 },
  input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 16, minHeight: 48, paddingHorizontal: 12, color: "#111827", fontWeight: "800" },
  textArea: { minHeight: 88, textAlignVertical: "top", paddingTop: 11 },
  choiceRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  choiceChip: { backgroundColor: "#F1F5F9", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row-reverse", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#E2E8F0" },
  choiceChipActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" },
  choiceChipDisabled: { opacity: 0.45 },
  choiceText: { color: "#475569", fontWeight: "900", fontSize: 12 },
  choiceTextActive: { color: "#fff" },
  lockInfo: { backgroundColor: "#ECFDF5", borderRadius: 14, padding: 10, flexDirection: "row-reverse", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "#A7F3D0", marginBottom: 6 },
  lockInfoText: { flex: 1, color: "#0F766E", fontWeight: "900", textAlign: "right", fontSize: 12, lineHeight: 18 },
  lockWarning: { backgroundColor: "#FFFBEB", borderRadius: 14, padding: 10, flexDirection: "row-reverse", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "#FCD34D", marginBottom: 6 },
  lockWarningText: { flex: 1, color: "#92400E", fontWeight: "900", textAlign: "right", fontSize: 12, lineHeight: 18 },
  saveButton: { backgroundColor: "#111827", borderRadius: 20, padding: 16, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 8, marginTop: 4 },
  saveText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  disabled: { opacity: 0.65 },
});