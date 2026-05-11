import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGetScoped, apiPost } from "../../lib/api";
import { editableOptionFields, labelForResource, translateValue } from "../../lib/arabicDisplay";

type RecordItem = {
  id: number;
  title: string;
  fields: Record<string, unknown>;
  editable_fields: string[];
};

type LookupOption = { id: number | string; label: string };
type Lookups = Record<string, LookupOption[]>;

const hiddenFields = new Set(["parent_unit_id", "is_subdivided", "unit_scope"]);
const fieldOrder = [
  "property_id",
  "unit_number",
  "floor",
  "type",
  "status",
  "rent_amount",
  "rooms_count",
  "bathrooms_count",
  "has_living_room",
  "is_rooftop",
  "orientation",
  "has_kitchen",
  "kitchen_type",
  "is_kitchen_installed",
  "notes",
];
const booleanFields = new Set(["has_living_room", "is_rooftop", "has_kitchen", "is_kitchen_installed"]);
const decimalFields = new Set(["rent_amount"]);
const integerOnlyFields = new Set(["rooms_count", "bathrooms_count", "floor"]);
const blockedTypeOptionText = new Set(["مالك", "مدير", "owner", "admin", "manager"]);

function valueToString(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "حدث خطأ غير متوقع";
}

function relationOptions(field: string, lookups: Lookups) {
  if (field === "property_id") return lookups.properties || [];
  return [];
}

function fieldLabel(field: string) {
  if (field === "floor") return "الوحدة في الدور";
  return labelForResource("units", field);
}

function filterTypeOptions(options: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(options).filter(([value, label]) => {
      const v = String(value || "").trim().toLowerCase();
      const l = String(label || "").trim().toLowerCase();
      return !blockedTypeOptionText.has(v) && !blockedTypeOptionText.has(l);
    }),
  );
}

function numericOnlyValue(field: string, value: string) {
  if (integerOnlyFields.has(field)) return value.replace(/[^0-9]/g, "");
  if (decimalFields.has(field)) return value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
  return value;
}

export default function UnitEditRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id || "");
  const [record, setRecord] = useState<RecordItem | null>(null);
  const [lookups, setLookups] = useState<Lookups>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!id) return;
    try {
      setLoading(true);
      globalThis.__RENTAL_EDIT_CONTEXT__ = { resource: "units", id };
      const [lookupData, recordData] = await Promise.all([
        apiGetScoped("/edit-delete-center/lookups", "/my/edit-delete-center/lookups"),
        apiGetScoped(`/edit-delete-center/units?id=${encodeURIComponent(id)}`, `/my/edit-delete-center/units?id=${encodeURIComponent(id)}`),
      ]);

      setLookups(lookupData || {});
      const item = Array.isArray(recordData?.items) ? recordData.items[0] : null;
      if (!item) {
        Alert.alert("تنبيه", "لم يتم العثور على الوحدة");
        router.back();
        return;
      }

      const editableFields = (item.editable_fields || [])
        .filter((field: string) => !hiddenFields.has(field))
        .sort((a: string, b: string) => {
          const ai = fieldOrder.indexOf(a);
          const bi = fieldOrder.indexOf(b);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });

      const nextForm: Record<string, string> = {};
      editableFields.forEach((field: string) => {
        nextForm[field] = valueToString(item.fields?.[field]);
      });

      setRecord({ ...item, editable_fields: editableFields });
      setForm(nextForm);
    } catch (e) {
      Alert.alert("خطأ", errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => {
      if (globalThis.__RENTAL_EDIT_CONTEXT__?.resource === "units" && String(globalThis.__RENTAL_EDIT_CONTEXT__?.id || "") === id) {
        globalThis.__RENTAL_EDIT_CONTEXT__ = undefined;
      }
    };
  }, [id]);

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: numericOnlyValue(field, value) }));
  }

  async function save() {
    if (!record) return;
    try {
      setSaving(true);
      const fieldsToSave = { ...form };
      delete fieldsToSave.property_id;
      await apiPost(`/edit-delete-center/units/${record.id}/update`, { fields: fieldsToSave });
      Alert.alert("تم", "تم حفظ تعديل الوحدة", [
        { text: "حسنًا", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("خطأ", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function renderChoiceField(field: string, options: Record<string, string>) {
    const cleanOptions = field === "type" ? filterTypeOptions(options) : options;
    return (
      <View style={styles.choiceRow}>
        {Object.entries(cleanOptions).map(([value, label]) => {
          const active = form[field] === value;
          return (
            <TouchableOpacity key={value} style={[styles.choiceChip, active ? styles.choiceChipActive : null]} onPress={() => setField(field, value)}>
              <Text style={[styles.choiceText, active ? styles.choiceTextActive : null]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  function renderBooleanField(field: string) {
    return (
      <View style={styles.choiceRow}>
        <TouchableOpacity style={[styles.choiceChip, ["1", "true"].includes(form[field]) ? styles.choiceChipActive : null]} onPress={() => setField(field, "1")}>
          <Text style={[styles.choiceText, ["1", "true"].includes(form[field]) ? styles.choiceTextActive : null]}>نعم</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.choiceChip, ["0", "false", ""].includes(form[field]) ? styles.choiceChipActive : null]} onPress={() => setField(field, "0")}>
          <Text style={[styles.choiceText, ["0", "false", ""].includes(form[field]) ? styles.choiceTextActive : null]}>لا</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderLockedPropertyField(field: string) {
    return (
      <View style={styles.lockedBox}>
        <Ionicons name="lock-closed-outline" size={17} color="#64748B" />
        <Text style={styles.lockedText}>{translateValue(field, form[field], lookups)}</Text>
      </View>
    );
  }

  function renderField(field: string) {
    const rawOptionMap = editableOptionFields()[field] || {};
    const optionMap = field === "type" ? filterTypeOptions(rawOptionMap) : rawOptionMap;
    const hasOptions = Object.keys(optionMap).length > 0;
    const isRelation = field === "property_id";
    const label = fieldLabel(field);

    return (
      <View key={field} style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {isRelation ? renderLockedPropertyField(field) : null}
        {booleanFields.has(field) ? renderBooleanField(field) : null}
        {hasOptions && !booleanFields.has(field) && !isRelation ? renderChoiceField(field, optionMap) : null}
        {!isRelation && !booleanFields.has(field) && !hasOptions ? (
          <TextInput
            style={[styles.input, field === "notes" ? styles.multilineInput : null]}
            value={form[field] || ""}
            onChangeText={(value) => setField(field, value)}
            placeholder={label}
            textAlign="right"
            multiline={field === "notes"}
            keyboardType={integerOnlyFields.has(field) || decimalFields.has(field) ? "numeric" : "default"}
          />
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.heroIcon}><Ionicons name="home-outline" size={28} color="#fff" /></View>
            <View style={styles.heroTextBox}>
              <Text style={styles.heroKicker}>شاشة مستقلة</Text>
              <Text style={styles.heroTitle}>تعديل الوحدة</Text>
              <Text numberOfLines={1} style={styles.heroSubtitle}>{record?.title || "تعديل بيانات الوحدة فقط"}</Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>جاري تحميل بيانات الوحدة...</Text>
            </View>
          ) : null}

          {!loading && record ? (
            <>
              {record.editable_fields.map((field) => renderField(field))}
              <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving} activeOpacity={0.9}>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveText}>{saving ? "جاري الحفظ..." : "حفظ تعديل الوحدة"}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  scroll: { flex: 1 },
  container: { padding: 14, paddingBottom: 34 },
  hero: { backgroundColor: "#111827", borderRadius: 26, padding: 16, flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 12 },
  heroIcon: { width: 58, height: 58, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  heroTextBox: { flex: 1, alignItems: "flex-end" },
  heroKicker: { color: "#A7F3D0", fontSize: 12, fontWeight: "900" },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "900", textAlign: "right", marginTop: 2 },
  heroSubtitle: { color: "#CBD5E1", fontSize: 12, fontWeight: "800", textAlign: "right", marginTop: 4 },
  loadingBox: { backgroundColor: "#fff", borderRadius: 18, padding: 18, alignItems: "center", gap: 10 },
  loadingText: { color: "#64748B", fontWeight: "800" },
  fieldCard: { backgroundColor: "#fff", borderRadius: 18, padding: 13, borderWidth: 1, borderColor: "#EDECE9", marginBottom: 10 },
  fieldLabel: { color: "#111827", fontSize: 14, fontWeight: "900", textAlign: "right", marginBottom: 9 },
  input: { minHeight: 46, borderRadius: 14, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, color: "#111827", fontWeight: "800" },
  multilineInput: { minHeight: 90, textAlignVertical: "top", paddingTop: 12 },
  lockedBox: { minHeight: 48, borderRadius: 14, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  lockedText: { flex: 1, color: "#334155", fontWeight: "900", textAlign: "right" },
  choiceRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  choiceChip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5E7EB" },
  choiceChipActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" },
  choiceText: { color: "#475569", fontWeight: "900", fontSize: 12 },
  choiceTextActive: { color: "#fff" },
  saveButton: { minHeight: 54, borderRadius: 18, backgroundColor: "#0F766E", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6 },
  saveText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
