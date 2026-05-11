import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import {
  Lookups,
  booleanFields,
  editableOptionFields,
  isRelationField,
  labelForResource,
  relationKeyForField,
  translateValue,
} from "../lib/arabicDisplay";

type RecordItem = {
  id: number;
  title: string;
  fields: Record<string, unknown>;
  editable_fields: string[];
};

const hiddenFields = new Set(["parent_unit_id", "is_subdivided", "unit_scope"]);
const textAreaFields = new Set(["notes", "description", "address"]);

const sections = [
  { title: "الارتباط والموقع", icon: "🏢", fields: ["owner_id", "property_id", "floor", "type", "status"] },
  { title: "البيانات الأساسية", icon: "🏠", fields: ["name", "title", "unit_number", "rent_amount", "property_area", "national_short_address"] },
  { title: "مواصفات الوحدة", icon: "🧩", fields: ["rooms_count", "bathrooms_count", "has_living_room", "is_rooftop", "orientation"] },
  { title: "المطبخ", icon: "🍳", fields: ["has_kitchen", "kitchen_type", "is_kitchen_installed"] },
  { title: "تفاصيل العقار", icon: "📍", fields: ["city", "district", "address", "deed_number", "property_type", "usage_type", "management_type", "floors_count", "parking_spots_count", "elevators_count"] },
  { title: "ملاحظات", icon: "📝", fields: ["notes"] },
];

function valueToString(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

function isUnit(resource: string) {
  return resource === "units" || resource === "unit";
}

function isProperty(resource: string) {
  return resource === "properties" || resource === "property";
}

function titleForResource(resource: string) {
  if (isUnit(resource)) return "تعديل الوحدة";
  if (isProperty(resource)) return "تعديل العقار";
  return "تعديل السجل";
}

export default function EditRecordScreen() {
  const params = useLocalSearchParams<{ resource?: string; id?: string }>();
  const resource = String(params.resource || "");
  const id = String(params.id || "");
  const [record, setRecord] = useState<RecordItem | null>(null);
  const [lookups, setLookups] = useState<Lookups>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openField, setOpenField] = useState<string | null>(null);
  const optionFields = editableOptionFields();

  async function load() {
    if (!resource || !id) return;
    try {
      setLoading(true);
      const [lookupData, recordData] = await Promise.all([
        apiGetScoped("/edit-delete-center/lookups", "/my/edit-delete-center/lookups"),
        apiGetScoped(`/edit-delete-center/${resource}?id=${encodeURIComponent(id)}`, `/my/edit-delete-center/${resource}?id=${encodeURIComponent(id)}`),
      ]);
      const item = Array.isArray(recordData?.items) ? recordData.items[0] : null;
      if (!item) {
        Alert.alert("تنبيه", "لم يتم العثور على السجل");
        router.back();
        return;
      }
      const editableFields = (item.editable_fields || []).filter((field: string) => !(isUnit(resource) && hiddenFields.has(field)));
      const nextForm: Record<string, string> = {};
      editableFields.forEach((field: string) => {
        nextForm[field] = valueToString(item.fields?.[field]);
      });
      setLookups(lookupData || {});
      setRecord({ ...item, editable_fields: editableFields });
      setForm(nextForm);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل السجل");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [resource, id]);

  const groupedSections = useMemo(() => {
    if (!record) return [];
    const fields = record.editable_fields;
    const used = new Set<string>();
    const groups = sections
      .map((section) => {
        const sectionFields = section.fields.filter((field) => fields.includes(field));
        sectionFields.forEach((field) => used.add(field));
        return { ...section, fields: sectionFields };
      })
      .filter((section) => section.fields.length > 0);
    const remaining = fields.filter((field) => !used.has(field));
    if (remaining.length) groups.push({ title: "حقول إضافية", icon: "⚙️", fields: remaining });
    return groups;
  }, [record]);

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: field === "national_short_address" ? value.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() : value }));
  }

  async function save() {
    if (!record) return;
    try {
      setSaving(true);
      await apiPost(`/edit-delete-center/${resource}/${record.id}/update`, { fields: form });
      Alert.alert("تم", "تم حفظ التعديل بنجاح", [{ text: "حسنًا", onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  function renderRelation(field: string) {
    const key = relationKeyForField(field);
    const options = key ? lookups[key] || [] : [];
    const selected = options.find((option) => String(option.id) === String(form[field] || ""));
    return (
      <View>
        <TouchableOpacity style={styles.selectButton} onPress={() => setOpenField(openField === field ? null : field)}>
          <Text style={styles.selectText}>{selected?.label || (form[field] ? translateValue(field, form[field], lookups) : `اختر ${labelForResource(resource, field)}`)}</Text>
          <Text style={styles.selectArrow}>{openField === field ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {openField === field ? (
          <View style={styles.optionsBox}>
            {options.map((option) => (
              <TouchableOpacity key={`${field}-${option.id}`} style={[styles.optionRow, String(option.id) === String(form[field]) ? styles.optionActive : null]} onPress={() => { setField(field, String(option.id)); setOpenField(null); }}>
                <Text style={[styles.optionText, String(option.id) === String(form[field]) ? styles.optionTextActive : null]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  function renderField(field: string) {
    const isBool = booleanFields.includes(field);
    const relation = isRelationField(field);
    const options = optionFields[field] || {};
    const optionList = Object.entries(options);
    return (
      <View key={field} style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>{labelForResource(resource, field)}</Text>
        {relation ? renderRelation(field) : null}
        {isBool && !relation ? (
          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.toggleButton, ["1", "true"].includes(form[field]) ? styles.toggleYes : null]} onPress={() => setField(field, "1")}>
              <Text style={[styles.toggleText, ["1", "true"].includes(form[field]) ? styles.toggleTextActive : null]}>نعم</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleButton, ["0", "false", ""].includes(form[field]) ? styles.toggleNo : null]} onPress={() => setField(field, "0")}>
              <Text style={[styles.toggleText, ["0", "false", ""].includes(form[field]) ? styles.toggleTextActive : null]}>لا</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {!isBool && !relation && optionList.length ? (
          <View style={styles.chipsRow}>
            {optionList.map(([value, label]) => (
              <TouchableOpacity key={`${field}-${value}`} style={[styles.chip, form[field] === value ? styles.chipActive : null]} onPress={() => setField(field, value)}>
                <Text style={[styles.chipText, form[field] === value ? styles.chipTextActive : null]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        {!isBool && !relation && !optionList.length ? (
          <TextInput style={[styles.input, textAreaFields.has(field) ? styles.textArea : null]} value={form[field] || ""} onChangeText={(value) => setField(field, value)} textAlign="right" multiline={textAreaFields.has(field)} placeholder={labelForResource(resource, field)} keyboardType={["rent_amount", "property_area", "rooms_count", "bathrooms_count", "floors_count", "parking_spots_count", "elevators_count"].includes(field) ? "decimal-pad" : "default"} />
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}><Text style={styles.closeText}>إغلاق</Text></TouchableOpacity>
        <View style={styles.headerTextBox}>
          <Text style={styles.headerTitle}>{titleForResource(resource)}</Text>
          <Text style={styles.headerSubtitle}>{record?.title || ""}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <View style={styles.loadingCard}><ActivityIndicator /><Text style={styles.loadingText}>جاري تحميل البيانات...</Text></View> : null}
        {!loading && record ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroIcon}>{isUnit(resource) ? "🏠" : "🏢"}</Text>
              <View style={styles.heroTextBox}>
                <Text style={styles.heroTitle}>{record.title}</Text>
                <Text style={styles.heroSubtitle}>شاشة تعديل منفصلة بتصميم حديث</Text>
              </View>
            </View>
            {groupedSections.map((section) => (
              <View key={section.title} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionIcon}>{section.icon}</Text>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                {section.fields.map((field) => renderField(field))}
              </View>
            ))}
            <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
              <Text style={styles.saveText}>{saving ? "جاري الحفظ..." : "حفظ التعديل"}</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  header: { backgroundColor: "#111827", paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  closeButton: { backgroundColor: "#374151", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  closeText: { color: "#fff", fontWeight: "900" },
  headerTextBox: { flex: 1, alignItems: "flex-end" },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "900", textAlign: "right" },
  headerSubtitle: { color: "#d1d5db", fontWeight: "800", marginTop: 4, textAlign: "right" },
  content: { padding: 14, paddingBottom: 48 },
  loadingCard: { backgroundColor: "#fff", borderRadius: 22, padding: 18, alignItems: "center" },
  loadingText: { color: "#64748b", fontWeight: "800", marginTop: 8 },
  heroCard: { backgroundColor: "#0f172a", borderRadius: 26, padding: 16, marginBottom: 14, flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  heroIcon: { fontSize: 30 },
  heroTextBox: { flex: 1, alignItems: "flex-end" },
  heroTitle: { color: "#fff", fontSize: 19, fontWeight: "900", textAlign: "right" },
  heroSubtitle: { color: "#cbd5e1", fontWeight: "800", fontSize: 12, marginTop: 4, textAlign: "right" },
  sectionCard: { backgroundColor: "#fff", borderRadius: 24, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#eceff3", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  sectionHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionIcon: { fontSize: 22 },
  sectionTitle: { color: "#111827", fontSize: 17, fontWeight: "900", textAlign: "right" },
  fieldCard: { backgroundColor: "#F8FAFC", borderRadius: 18, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#EEF2F7" },
  fieldLabel: { color: "#334155", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d9dee7", borderRadius: 14, minHeight: 46, padding: 12, color: "#111827" },
  textArea: { minHeight: 86, textAlignVertical: "top" },
  toggleRow: { flexDirection: "row-reverse", gap: 10 },
  toggleButton: { flex: 1, minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#eef2f7" },
  toggleYes: { backgroundColor: "#0f766e" },
  toggleNo: { backgroundColor: "#dc2626" },
  toggleText: { color: "#334155", fontWeight: "900" },
  toggleTextActive: { color: "#fff" },
  chipsRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: "#eef2f7", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#334155", fontWeight: "900" },
  chipTextActive: { color: "#fff" },
  selectButton: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d9dee7", borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  selectText: { flex: 1, color: "#111827", fontWeight: "900", textAlign: "right" },
  selectArrow: { color: "#111827", fontWeight: "900" },
  optionsBox: { backgroundColor: "#fff", borderRadius: 16, padding: 8, marginTop: 8, borderWidth: 1, borderColor: "#e5e7eb" },
  optionRow: { padding: 11, borderRadius: 12 },
  optionActive: { backgroundColor: "#111827" },
  optionText: { color: "#111827", fontWeight: "900", textAlign: "right" },
  optionTextActive: { color: "#fff" },
  saveButton: { backgroundColor: "#16a34a", borderRadius: 20, padding: 16, alignItems: "center", marginTop: 4 },
  saveText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
