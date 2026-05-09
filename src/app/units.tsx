import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";
import DropdownSelect, { DropdownOption } from "../components/DropdownSelect";
import InlineEditDeleteActions from "../components/InlineEditDeleteActions";
import { apiGetScoped, apiPostAny } from "../lib/api";

type OptionRecord = {
  id: number;
  label: string;
  title?: string | null;
  owner_id?: number | string | null;
  property_id?: number | string | null;
  unit_scope?: string | null;
  rent_amount?: string | number | null;
  status?: string | null;
  floor?: string | number | null;
  type?: string | null;
  property_type?: string | null;
  [key: string]: unknown;
};

type UnitGroup = {
  propertyKey: string;
  propertyLabel: string;
  propertyTypeLabel: string;
  isDirectOwnerGroup: boolean;
  floors: {
    floorKey: string;
    floorLabel: string;
    units: OptionRecord[];
  }[];
};

const unitScopeOptions: DropdownOption[] = [
  { id: "owner", label: "وحدة خاصة بالمالك" },
  { id: "property", label: "وحدة تحت عقار / عمارة / فيلا" },
];

const unitTypeOptions: DropdownOption[] = [
  { id: "apartment", label: "شقة" },
  { id: "studio", label: "استوديو" },
  { id: "room", label: "غرفة" },
  { id: "shop", label: "محل" },
  { id: "office", label: "مكتب" },
];

const statusOptions: DropdownOption[] = [
  { id: "available", label: "متاح" },
  { id: "rented", label: "مؤجر" },
  { id: "maintenance", label: "صيانة" },
];

function optionName(options: OptionRecord[] = [], id: unknown) {
  if (!id) return "غير محدد";
  return options.find((item) => String(item.id) === String(id))?.label || "غير معروف";
}

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "حدث خطأ غير متوقع";
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function propertyTypeLabel(type: unknown) {
  const normalized = normalizeText(type).toLowerCase();

  if (["building", "apartment_building", "عمارة", "بناية"].includes(normalized)) return "عمارة";
  if (["villa", "فيلا"].includes(normalized)) return "فيلا";
  if (["apartment", "flat", "شقة"].includes(normalized)) return "شقة مستقلة";
  if (["land", "أرض", "ارض"].includes(normalized)) return "أرض";
  if (!normalized) return "عقار";

  return String(type);
}

function floorSortValue(value: unknown) {
  const text = normalizeText(value);
  if (!text) return 999999;

  if (["ground", "g", "أرضي", "ارضي", "الدور الأرضي", "الدور الارضي"].includes(text.toLowerCase())) return 0;
  if (["basement", "b", "قبو", "بدروم"].includes(text.toLowerCase())) return -1;

  const numeric = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 999998;
}

function floorDisplayLabel(value: unknown) {
  const text = normalizeText(value);
  if (!text) return "بدون دور محدد";

  if (["ground", "g"].includes(text.toLowerCase())) return "الدور الأرضي";
  if (["basement", "b"].includes(text.toLowerCase())) return "القبو";
  if (text.includes("دور") || text.includes("الدور")) return text;

  return `الدور ${text}`;
}

function unitSortText(unit: OptionRecord) {
  return normalizeText(unit.title || unit.label || unit.id).toLowerCase();
}

export default function UnitsScreen() {
  const params = useLocalSearchParams();
  const ownerIdParam = firstParam(params.owner_id as string | string[] | undefined);
  const ownerNameParam = firstParam(params.owner_name as string | string[] | undefined);
  const propertyIdParam = firstParam(params.property_id as string | string[] | undefined);
  const propertyNameParam = firstParam(params.property_name as string | string[] | undefined);
  const unitScopeParam = firstParam(params.unit_scope as string | string[] | undefined);
  const createParam = firstParam(params.create as string | string[] | undefined);
  const scopedOwnerName = ownerNameParam ? decodeURIComponent(ownerNameParam) : "";
  const scopedPropertyName = propertyNameParam ? decodeURIComponent(propertyNameParam) : "";
  const [owners, setOwners] = useState<OptionRecord[]>([]);
  const [properties, setProperties] = useState<OptionRecord[]>([]);
  const [units, setUnits] = useState<OptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(createParam === "1");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    owner_id: ownerIdParam,
    unit_scope: propertyIdParam || unitScopeParam === "property" ? "property" : "owner",
    property_id: propertyIdParam,
    unit_number: "",
    type: "apartment",
    floor: "",
    rent_amount: "",
    rooms_count: "",
    bathrooms_count: "",
    status: "available",
    notes: "",
  });

  async function loadData() {
    try {
      setLoading(true);
      const data = await apiGetScoped("/relation-manager/options", "/my/relation-manager/options");

      setOwners(Array.isArray(data?.owners) ? data.owners : []);
      setProperties(Array.isArray(data?.properties) ? data.properties : []);
      setUnits(Array.isArray(data?.units) ? data.units : []);
    } catch (e) {
      Alert.alert("خطأ", errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  async function refreshScreen() {
    try {
      setRefreshing(true);
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (createParam === "1") setShowCreate(true);

    setForm((previous) => ({
      ...previous,
      owner_id: ownerIdParam || previous.owner_id,
      unit_scope: propertyIdParam || unitScopeParam === "property" ? "property" : previous.unit_scope,
      property_id: propertyIdParam || previous.property_id,
    }));
  }, [ownerIdParam, propertyIdParam, unitScopeParam, createParam]);

  const ownerOptions = useMemo(() => {
    const options = owners.map((owner) => ({ id: owner.id, label: owner.label }));

    if (ownerIdParam && !options.some((owner) => String(owner.id) === String(ownerIdParam))) {
      options.unshift({ id: Number(ownerIdParam), label: scopedOwnerName || `مالك #${ownerIdParam}` });
    }

    return options;
  }, [owners, ownerIdParam, scopedOwnerName]);

  const propertyOptions = useMemo(() => {
    const options = properties.map((property) => ({
      id: property.id,
      label: property.label,
      title: property.title,
      owner_id: property.owner_id,
      property_type: property.property_type,
    }));

    if (propertyIdParam && !options.some((property) => String(property.id) === String(propertyIdParam))) {
      options.unshift({
        id: Number(propertyIdParam),
        label: scopedPropertyName || `عقار #${propertyIdParam}`,
        title: scopedPropertyName || `عقار #${propertyIdParam}`,
        owner_id: ownerIdParam || null,
        property_type: null,
      });
    }

    return options;
  }, [properties, propertyIdParam, scopedPropertyName, ownerIdParam]);

  const filteredPropertyOptions = useMemo(() => {
    if (!form.owner_id) return propertyOptions.map((property) => ({ id: property.id, label: property.label }));

    return propertyOptions
      .filter((property) => String(property.owner_id || "") === String(form.owner_id) || String(property.id) === String(propertyIdParam))
      .map((property) => ({ id: property.id, label: `${propertyTypeLabel(property.property_type)} - ${property.label}` }));
  }, [propertyOptions, form.owner_id, propertyIdParam]);

  function setField(key: keyof typeof form, value: string) {
    setForm((previous) => {
      if (key === "owner_id") {
        return { ...previous, owner_id: value, property_id: propertyIdParam || "" };
      }

      if (key === "unit_scope") {
        return { ...previous, unit_scope: value, property_id: value === "owner" ? "" : previous.property_id || propertyIdParam };
      }

      return { ...previous, [key]: value };
    });
  }

  function resetForm() {
    setForm({
      owner_id: ownerIdParam,
      unit_scope: propertyIdParam ? "property" : "owner",
      property_id: propertyIdParam,
      unit_number: "",
      type: "apartment",
      floor: "",
      rent_amount: "",
      rooms_count: "",
      bathrooms_count: "",
      status: "available",
      notes: "",
    });
  }

  async function createUnit() {
    if (!form.owner_id) {
      Alert.alert("تنبيه", "يجب اختيار المالك من القائمة أولًا");
      return;
    }

    if (form.unit_scope === "property" && !form.property_id) {
      Alert.alert("تنبيه", "اختر العقار/العمارة/الفيلا التابعة لهذا المالك");
      return;
    }

    if (form.unit_scope === "property" && !form.floor.trim()) {
      Alert.alert("تنبيه", "رقم الدور مطلوب لتصنيف الوحدة تحت العقار");
      return;
    }

    if (!form.unit_number.trim()) {
      Alert.alert("تنبيه", "اكتب رقم أو اسم الوحدة");
      return;
    }

    try {
      setSaving(true);

      await apiPostAny(["/relation-manager/create-unit", "/my/relation-manager/create-unit"], {
        ...form,
        property_id: form.unit_scope === "owner" ? "" : form.property_id,
      });

      Alert.alert("تم", form.unit_scope === "owner" ? "تم إنشاء وحدة خاصة بالمالك" : "تم إنشاء وحدة تحت العقار والدور المحدد");
      resetForm();
      setShowCreate(false);
      await loadData();
    } catch (e) {
      Alert.alert("تعذر إنشاء الوحدة", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function ownerIdForUnit(unit: OptionRecord) {
    if (unit.owner_id) return unit.owner_id;
    const property = propertyOptions.find((item) => String(item.id) === String(unit.property_id));
    return property?.owner_id;
  }

  function propertyForUnit(unit: OptionRecord) {
    return propertyOptions.find((item) => String(item.id) === String(unit.property_id));
  }

  const visibleUnits = useMemo(() => {
    if (propertyIdParam) return units.filter((unit) => String(unit.property_id || "") === String(propertyIdParam));
    if (!ownerIdParam) return units;
    return units.filter((unit) => String(ownerIdForUnit(unit) || "") === String(ownerIdParam));
  }, [units, propertyOptions, ownerIdParam, propertyIdParam]);

  const groupedUnits = useMemo<UnitGroup[]>(() => {
    const propertyMap = new Map<string, UnitGroup>();

    visibleUnits.forEach((unit) => {
      const property = propertyForUnit(unit);
      const isPropertyUnit = Boolean(unit.property_id);
      const propertyKey = isPropertyUnit ? `property-${unit.property_id}` : `owner-direct-${ownerIdForUnit(unit) || "none"}`;
      const propertyLabel = isPropertyUnit
        ? (property?.title || property?.label || `عقار #${unit.property_id}`)
        : "وحدات مستقلة خاصة بالمالك";
      const typeLabel = isPropertyUnit ? propertyTypeLabel(property?.property_type) : "وحدة مستقلة";

      if (!propertyMap.has(propertyKey)) {
        propertyMap.set(propertyKey, {
          propertyKey,
          propertyLabel,
          propertyTypeLabel: typeLabel,
          isDirectOwnerGroup: !isPropertyUnit,
          floors: [],
        });
      }

      const group = propertyMap.get(propertyKey)!;
      const floorKey = normalizeText(unit.floor) || "__no_floor__";
      let floorGroup = group.floors.find((item) => item.floorKey === floorKey);

      if (!floorGroup) {
        floorGroup = {
          floorKey,
          floorLabel: isPropertyUnit ? floorDisplayLabel(unit.floor) : "وحدات غير مرتبطة بدور داخل عقار",
          units: [],
        };
        group.floors.push(floorGroup);
      }

      floorGroup.units.push(unit);
    });

    return Array.from(propertyMap.values())
      .sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel, "ar"))
      .map((group) => ({
        ...group,
        floors: group.floors
          .sort((a, b) => floorSortValue(a.floorKey) - floorSortValue(b.floorKey))
          .map((floor) => ({
            ...floor,
            units: floor.units.sort((a, b) => unitSortText(a).localeCompare(unitSortText(b), "ar")),
          })),
      }));
  }, [visibleUnits, propertyOptions]);

  const screenTitle = propertyIdParam ? "وحدات العقار" : ownerIdParam ? "وحدات المالك" : "الوحدات";
  const screenSubtitle = propertyIdParam
    ? `تصنيف وحدات العقار حسب الدور: ${scopedPropertyName || `#${propertyIdParam}`}`
    : ownerIdParam
      ? `عرض وحدات المالك مصنفة حسب العقار ثم الدور: ${scopedOwnerName || `#${ownerIdParam}`}`
      : "تصنيف الوحدات يكون حسب العقار أولًا ثم رقم الدور ثم الوحدات";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{screenTitle}</Text>
          <Text style={styles.subtitle}>{screenSubtitle}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setShowCreate(!showCreate)}>
          <Text style={styles.primaryButtonText}>{showCreate ? "إغلاق نموذج الإضافة" : "إضافة وحدة جديدة"}</Text>
        </TouchableOpacity>

        {showCreate ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>إضافة وحدة</Text>

            <DropdownSelect
              label="المالك"
              value={form.owner_id}
              options={ownerOptions}
              placeholder="اختر المالك"
              required
              disabled={Boolean(ownerIdParam)}
              onChange={(value) => setField("owner_id", value)}
            />

            <DropdownSelect
              label="نوع إضافة الوحدة"
              value={form.unit_scope}
              options={unitScopeOptions}
              required
              disabled={Boolean(propertyIdParam)}
              onChange={(value) => setField("unit_scope", value)}
            />

            {form.unit_scope === "property" ? (
              <>
                <DropdownSelect
                  label="العقار / العمارة / الفيلا"
                  value={form.property_id}
                  options={filteredPropertyOptions}
                  placeholder={form.owner_id ? "اختر العقار" : "اختر المالك أولًا"}
                  required
                  disabled={!form.owner_id || Boolean(propertyIdParam)}
                  onChange={(value) => setField("property_id", value)}
                />

                {form.owner_id && filteredPropertyOptions.length === 0 ? (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>لا توجد عقارات لهذا المالك. أضف عقارًا له أولًا من شاشة العقارات.</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>هذه الوحدة ستسجل كوحدة مستقلة خاصة بالمالك، وليست تحت عقار/عمارة/فيلا.</Text>
              </View>
            )}

            <TextInput style={styles.input} value={form.unit_number} onChangeText={(value) => setField("unit_number", value)} placeholder="رقم / اسم الوحدة" textAlign="right" />

            <DropdownSelect label="نوع الوحدة" value={form.type} options={unitTypeOptions} onChange={(value) => setField("type", value)} />
            <DropdownSelect label="الحالة" value={form.status} options={statusOptions} onChange={(value) => setField("status", value)} />

            <TextInput
              style={styles.input}
              value={form.floor}
              onChangeText={(value) => setField("floor", value)}
              placeholder={form.unit_scope === "property" ? "رقم الدور - مطلوب للتصنيف" : "الدور"}
              keyboardType="numeric"
              textAlign="right"
            />
            <TextInput style={styles.input} value={form.rent_amount} onChangeText={(value) => setField("rent_amount", value)} placeholder="قيمة الإيجار" keyboardType="numeric" textAlign="right" />
            <TextInput style={styles.input} value={form.rooms_count} onChangeText={(value) => setField("rooms_count", value)} placeholder="عدد الغرف" keyboardType="numeric" textAlign="right" />
            <TextInput style={styles.input} value={form.bathrooms_count} onChangeText={(value) => setField("bathrooms_count", value)} placeholder="عدد دورات المياه" keyboardType="numeric" textAlign="right" />
            <TextInput style={[styles.input, styles.multiline]} value={form.notes} onChangeText={(value) => setField("notes", value)} placeholder="ملاحظات" textAlign="right" multiline />

            <TouchableOpacity style={styles.saveButton} onPress={createUnit} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? "جاري الحفظ..." : "حفظ الوحدة"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>جاري تحميل الوحدات...</Text>
          </View>
        ) : null}

        {!loading && visibleUnits.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>لا توجد وحدات</Text>
          </View>
        ) : null}

        {!loading && groupedUnits.map((propertyGroup) => (
          <View key={propertyGroup.propertyKey} style={styles.propertyGroupCard}>
            <View style={styles.propertyGroupHeader}>
              <Text style={styles.propertyTypeBadge}>{propertyGroup.propertyTypeLabel}</Text>
              <View style={styles.propertyHeaderTextWrap}>
                <Text style={styles.propertyGroupTitle}>{propertyGroup.propertyLabel}</Text>
                <Text style={styles.propertyGroupSubtitle}>تصنيف الوحدات حسب الدور</Text>
              </View>
            </View>

            {propertyGroup.floors.map((floorGroup) => (
              <View key={`${propertyGroup.propertyKey}-${floorGroup.floorKey}`} style={styles.floorGroupCard}>
                <View style={styles.floorHeader}>
                  <Text style={styles.floorCount}>{floorGroup.units.length} وحدة</Text>
                  <Text style={styles.floorTitle}>{floorGroup.floorLabel}</Text>
                </View>

                {floorGroup.units.map((unit) => {
                  const scope = unit.unit_scope === "property" || unit.property_id ? "تحت عقار" : "خاصة بالمالك";
                  const ownerId = ownerIdForUnit(unit);

                  return (
                    <View key={`unit-${unit.id}`} style={styles.card}>
                      <View style={styles.cardTop}>
                        <Text style={styles.badge}>{scope}</Text>
                        <Text style={styles.cardTitle}>{unit.title || unit.label}</Text>
                      </View>
                      <Text style={styles.cardLine}>المالك: {optionName(owners, ownerId)}</Text>
                      <Text style={styles.cardLine}>العقار: {unit.property_id ? optionName(propertyOptions, unit.property_id) : "لا يوجد - وحدة مستقلة"}</Text>
                      <Text style={styles.cardLine}>الدور: {floorDisplayLabel(unit.floor)}</Text>
                      <Text style={styles.cardLine}>الإيجار / الحالة: {valueText(unit.rent_amount)} / {valueText(unit.status)}</Text>
                      <InlineEditDeleteActions resource="units" id={unit.id} onChanged={loadData} />
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 12, paddingBottom: 60 },
  header: { backgroundColor: "#111827", borderRadius: 18, padding: 14, marginBottom: 10 },
  title: { color: "#fff", fontSize: 23, fontWeight: "900", textAlign: "right" },
  subtitle: { color: "rgba(255,255,255,0.78)", fontWeight: "600", textAlign: "right", marginTop: 5, lineHeight: 21 },
  primaryButton: { backgroundColor: "#0F9B6F", borderRadius: 12, padding: 12, alignItems: "center", marginBottom: 10 },
  primaryButtonText: { color: "#fff", fontWeight: "900" },
  refreshButton: { backgroundColor: "#111827", borderRadius: 12, padding: 11, alignItems: "center", marginBottom: 10 },
  refreshText: { color: "#fff", fontWeight: "900" },
  formCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#EDECE9" },
  formTitle: { color: "#1A1917", fontWeight: "900", fontSize: 16, textAlign: "right", marginBottom: 10 },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 11, color: "#1A1917", marginBottom: 10 },
  multiline: { minHeight: 76, textAlignVertical: "top" },
  warningBox: { backgroundColor: "#FFF8EB", borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#F5C549" },
  warningText: { color: "#825906", fontWeight: "700", textAlign: "right", lineHeight: 22 },
  infoBox: { backgroundColor: "#EFF6FF", borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#E3F2FD" },
  infoText: { color: "#0D47A1", fontWeight: "700", textAlign: "right", lineHeight: 22 },
  saveButton: { backgroundColor: "#22A356", borderRadius: 12, padding: 12, alignItems: "center", marginTop: 2 },
  saveButtonText: { color: "#fff", fontWeight: "900" },
  loadingBox: { backgroundColor: "#fff", borderRadius: 16, padding: 16, alignItems: "center", marginBottom: 10, borderWidth: 1, borderColor: "#EDECE9" },
  loadingText: { color: "#7A766F", marginTop: 8 },
  emptyBox: { backgroundColor: "#fff", borderRadius: 16, padding: 18, alignItems: "center", borderWidth: 1, borderColor: "#EDECE9" },
  emptyText: { color: "#7A766F", fontWeight: "700" },
  propertyGroupCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#EDECE9" },
  propertyGroupHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  propertyHeaderTextWrap: { flex: 1 },
  propertyGroupTitle: { color: "#111827", fontSize: 16, fontWeight: "900", textAlign: "right" },
  propertyGroupSubtitle: { color: "#7A766F", fontSize: 12, fontWeight: "700", textAlign: "right", marginTop: 2 },
  propertyTypeBadge: { backgroundColor: "#111827", color: "#FFFFFF", fontWeight: "900", overflow: "hidden", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11 },
  floorGroupCard: { backgroundColor: "#F7F6F4", borderRadius: 16, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: "#E5E2DC" },
  floorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  floorTitle: { color: "#0F9B6F", fontSize: 15, fontWeight: "900", textAlign: "right" },
  floorCount: { backgroundColor: "#EDFAF6", color: "#065F44", fontSize: 11, fontWeight: "900", overflow: "hidden", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#EDECE9", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 },
  cardTitle: { flex: 1, color: "#1A1917", fontSize: 16, fontWeight: "900", textAlign: "right" },
  badge: { backgroundColor: "#EDFAF6", color: "#065F44", fontWeight: "800", overflow: "hidden", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11 },
  cardLine: { color: "#5E5B55", fontWeight: "600", textAlign: "right", marginBottom: 2, fontSize: 13 },
});
