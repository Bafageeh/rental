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
import { useLocalSearchParams } from "expo-router";
import { apiGetScoped, apiPostAny } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type ResourceItem = {
  key: string;
  label: string;
  editable_fields?: string[];
};

type LookupOption = {
  id: number;
  label: string;
  [key: string]: unknown;
};

type Lookups = {
  owners?: LookupOption[];
  properties?: LookupOption[];
  units?: LookupOption[];
  tenants?: LookupOption[];
  contracts?: LookupOption[];
  service_providers?: LookupOption[];
  owner_bank_accounts?: LookupOption[];
  expense_categories?: LookupOption[];
};

type RecordItem = {
  id: number;
  resource: string;
  resource_label: string;
  title: string;
  fields: Record<string, unknown>;
  editable_fields: string[];
  can_archive?: boolean;
};

type RecordsPayload = {
  resource: string;
  resource_label: string;
  editable_fields: string[];
  items: RecordItem[];
};

const fieldLabels: Record<string, string> = {
  name: "الاسم",
  phone: "الجوال",
  alternate_phone: "جوال بديل",
  email: "البريد",
  national_id: "رقم الهوية",
  nationality: "الجنسية",
  type: "النوع",
  notes: "ملاحظات",
  owner_id: "اسم المالك",
  property_id: "العقار",
  unit_id: "الوحدة",
  tenant_id: "المستأجر",
  contract_id: "العقد",
  parent_unit_id: "الوحدة الرئيسية",
  service_provider_id: "مقدم الخدمة",
  owner_bank_account_id: "حساب المالك البنكي",
  category_id: "التصنيف",
  title: "العنوان",
  city: "المدينة",
  district: "الحي",
  address: "العنوان",
  national_short_address: "العنوان الوطني المختصر",
  property_area: "مساحة العقار",
  deed_number: "رقم الصك",
  property_type: "نوع العقار",
  usage_type: "نوع الاستخدام",
  management_type: "نوع الإدارة",
  unit_number: "رقم الوحدة",
  floor: "الدور",
  status: "الحالة",
  rent_amount: "قيمة الإيجار",
  rooms_count: "عدد الغرف",
  bathrooms_count: "عدد دورات المياه",
  has_kitchen: "يوجد مطبخ",
  kitchen_type: "نوع المطبخ",
  is_kitchen_installed: "المطبخ مركب",
  has_living_room: "يوجد صالة",
  is_rooftop: "ملحق/سطح",
  orientation: "الاتجاه",
  amount: "المبلغ",
  due_date: "تاريخ الاستحقاق",
  paid_date: "تاريخ السداد",
  start_date: "بداية العقد",
  end_date: "نهاية العقد",
  contract_number: "رقم العقد",
  government_contract_number: "رقم العقد الحكومي",
  payment_cycle: "دورة السداد",
  parking_fee: "رسوم الموقف",
  services_fee: "رسوم الخدمات",
  deposit_amount: "التأمين",
  reference_number: "رقم المرجع",
  method: "الطريقة",
  received_date: "تاريخ الاستلام",
  expense_date: "تاريخ المصروف",
  description: "الوصف",
  provider: "المزود",
  bill_type: "نوع الفاتورة",
  bill_number: "رقم الفاتورة",
  priority: "الأولوية",
  request_date: "تاريخ الطلب",
  scheduled_date: "تاريخ الجدولة",
  completed_date: "تاريخ الإنجاز",
  estimated_cost: "التكلفة التقديرية",
  actual_cost: "التكلفة الفعلية",
  bank_name: "اسم البنك",
  account_name: "اسم الحساب",
  iban: "IBAN",
  account_number: "رقم الحساب",
  is_active: "نشط",
  is_default: "افتراضي",
  is_preferred: "مفضل",
  provider_type: "نوع الخدمة",
  default_visit_fee: "رسوم الزيارة",
  rating: "التقييم",
  inspection_type: "نوع المعاينة",
  inspection_date: "تاريخ المعاينة",
  inspector_name: "اسم الفاحص",
  electricity_meter_reading: "قراءة عداد الكهرباء",
  water_meter_reading: "قراءة عداد الماء",
  keys_count: "عدد المفاتيح",
  damage_notes: "ملاحظات التلف",
  recommendations: "التوصيات",
};

const importantFields = [
  "name",
  "title",
  "owner_id",
  "property_id",
  "unit_id",
  "tenant_id",
  "contract_id",
  "service_provider_id",
  "owner_bank_account_id",
  "phone",
  "email",
  "national_short_address",
  "property_area",
  "status",
  "amount",
  "rent_amount",
  "due_date",
  "start_date",
  "end_date",
];

const booleanFields = [
  "is_active",
  "is_default",
  "is_preferred",
  "has_kitchen",
  "is_kitchen_installed",
  "has_living_room",
  "is_rooftop",
  "is_subdivided",
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

const optionFields: Record<string, Array<{ value: string; label: string }>> = {
  property_type: [
    { value: "building", label: "عمارة" },
    { value: "apartment", label: "شقة مستقلة" },
    { value: "villa", label: "فيلا" },
  ],
  management_type: [
    { value: "owned", label: "مملوك" },
    { value: "managed", label: "إدارة للغير" },
  ],
  type: [
    { value: "apartment", label: "شقة" },
    { value: "studio", label: "استوديو" },
    { value: "room", label: "غرفة" },
    { value: "shop", label: "محل" },
    { value: "office", label: "مكتب" },
  ],
  status: [
    { value: "active", label: "نشط" },
    { value: "available", label: "متاح" },
    { value: "rented", label: "مؤجر" },
    { value: "maintenance", label: "صيانة" },
    { value: "due", label: "مستحق" },
    { value: "paid", label: "مدفوع" },
    { value: "overdue", label: "متأخر" },
    { value: "partial", label: "جزئي" },
    { value: "pending", label: "معلق" },
    { value: "open", label: "مفتوح" },
    { value: "completed", label: "مكتمل" },
    { value: "needs_repair", label: "يحتاج إصلاح" },
    { value: "cancelled", label: "ملغي" },
  ],
  priority: [
    { value: "urgent", label: "طارئ" },
    { value: "high", label: "عالي" },
    { value: "normal", label: "عادي" },
    { value: "low", label: "منخفض" },
  ],
  method: [
    { value: "cash", label: "نقدًا" },
    { value: "bank_transfer", label: "تحويل بنكي" },
    { value: "card", label: "بطاقة" },
    { value: "cheque", label: "شيك" },
    { value: "other", label: "أخرى" },
  ],
  provider_type: [
    { value: "general", label: "عام" },
    { value: "plumbing", label: "سباكة" },
    { value: "electricity", label: "كهرباء" },
    { value: "ac", label: "مكيفات" },
    { value: "cleaning", label: "نظافة" },
    { value: "security", label: "حراسة" },
    { value: "internet", label: "إنترنت" },
    { value: "elevator", label: "مصاعد" },
  ],
  inspection_type: [
    { value: "periodic", label: "دورية" },
    { value: "move_in", label: "استلام" },
    { value: "move_out", label: "تسليم" },
    { value: "maintenance", label: "صيانة" },
  ],
};

function labelFor(field: string, resourceKey?: string | null) {
  if ((resourceKey === "properties" || resourceKey === "property") && field === "name") {
    return "اسم العقار";
  }

  return fieldLabels[field] || field;
}

function valueToString(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "حدث خطأ غير متوقع";
}

function isPropertyResource(resource: string | null | undefined) {
  return resource === "properties" || resource === "property";
}

function isRequiredPropertyField(resource: string | null | undefined, field: string) {
  return isPropertyResource(resource) && field === "owner_id";
}

function isCompactPropertyOptionField(resource: string | null | undefined, field: string) {
  return isPropertyResource(resource) && field === "usage_type";
}


function normalizeRecordItem(item: any, fallbackResource: string, fallbackLabel: string, fallbackEditableFields: string[]): RecordItem {
  const fields = item?.fields && typeof item.fields === "object"
    ? item.fields
    : item?.values && typeof item.values === "object"
      ? item.values
      : item?.raw && typeof item.raw === "object"
        ? item.raw
        : {};

  const editableFields = Array.isArray(item?.editable_fields)
    ? item.editable_fields
    : Array.isArray(fallbackEditableFields)
      ? fallbackEditableFields
      : Object.keys(fields);

  return {
    id: Number(item?.id ?? item?.raw?.id ?? 0),
    resource: String(item?.resource || fallbackResource),
    resource_label: String(item?.resource_label || fallbackLabel || fallbackResource),
    title: String(item?.title || item?.record_title || item?.name || item?.raw?.name || item?.raw?.title || `#${item?.id ?? ""}`),
    fields,
    editable_fields: editableFields,
    can_archive: Boolean(item?.can_archive ?? item?.canArchive ?? true),
  };
}

function normalizeRecordsPayload(data: any, fallbackResource: string): RecordsPayload {
  const editableFields = Array.isArray(data?.editable_fields) ? data.editable_fields : [];
  const resourceLabel = String(data?.resource_label || fallbackResource);
  const rawItems = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];

  return {
    resource: String(data?.resource || fallbackResource),
    resource_label: resourceLabel,
    editable_fields: editableFields,
    items: rawItems.map((item: any) => normalizeRecordItem(item, fallbackResource, resourceLabel, editableFields)),
  };
}

function relationKeyForField(field: string): keyof Lookups | null {
  if (field === "owner_id") return "owners";
  if (field === "property_id") return "properties";
  if (field === "unit_id" || field === "parent_unit_id") return "units";
  if (field === "tenant_id") return "tenants";
  if (field === "contract_id") return "contracts";
  if (field === "service_provider_id") return "service_providers";
  if (field === "owner_bank_account_id") return "owner_bank_accounts";
  if (field === "category_id") return "expense_categories";
  return null;
}

export default function EditDeleteCenterScreen() {
  const params = useLocalSearchParams<{ resource?: string; id?: string }>();
  const paramResource = Array.isArray(params.resource) ? params.resource[0] : params.resource;
  const paramId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [lookups, setLookups] = useState<Lookups>({});
  const [resource, setResource] = useState<string>("");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);

  async function loadLookups() {
    try {
      const data = await apiGetScoped(
        "/edit-delete-center/lookups",
        "/my/edit-delete-center/lookups"
      );

      setLookups(data || {});
    } catch {
      setLookups({});
    }
  }

  async function loadResources(preferredResource?: string, preferredId?: string) {
    try {
      setLoadingResources(true);

      const data = await apiGetScoped(
        "/edit-delete-center/resources",
        "/my/edit-delete-center/resources"
      );

      const list = Array.isArray(data) ? data : [];
      setResources(list);

      const exists = preferredResource && list.some((item) => item.key === preferredResource);
      const nextResource = exists ? preferredResource : (resource || list[0]?.key || "");

      if (nextResource) {
        setResource(nextResource);
        await loadRecords(nextResource, "", preferredId);
      }
    } catch (e) {
      Alert.alert("خطأ", errorMessage(e));
    } finally {
      setLoadingResources(false);
    }
  }

  async function loadRecords(nextResource = resource, nextSearch = search, exactId?: string) {
    if (!nextResource) return;

    try {
      setLoadingRecords(true);
      setSelected(null);
      setForm({});
      setShowAllFields(false);

      let query = "";

      if (exactId) {
        query = `?id=${encodeURIComponent(exactId)}`;
      } else if (nextSearch) {
        query = `?q=${encodeURIComponent(nextSearch)}`;
      }

      const data = await apiGetScoped(
        `/edit-delete-center/${nextResource}${query}`,
        `/my/edit-delete-center/${nextResource}${query}`
      );

      const payload = normalizeRecordsPayload(data, nextResource);
      const nextItems = payload.items;
      setRecords(nextItems);

      if (exactId && nextItems.length > 0) {
        selectRecord(nextItems[0]);
      }
    } catch (e) {
      Alert.alert("خطأ", errorMessage(e));
    } finally {
      setLoadingRecords(false);
    }
  }

  function selectResource(nextResource: string) {
    setResource(nextResource);
    setSearch("");
    loadRecords(nextResource, "");
  }

  function selectRecord(item: RecordItem) {
    const safeItem = normalizeRecordItem(item, item.resource || resource, item.resource_label || selectedResourceLabel, item.editable_fields || []);
    const nextForm: Record<string, string> = {};

    const editableFields = Array.isArray(safeItem.editable_fields) ? safeItem.editable_fields : [];
    editableFields.forEach((field) => {
      nextForm[field] = valueToString(safeItem.fields?.[field]);
    });

    setSelected(safeItem);
    setForm(nextForm);
    setShowAllFields(false);
  }

  function setField(field: string, value: string) {
    const nextValue = field === "national_short_address" ? value.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() : value;

    setForm((prev) => ({
      ...prev,
      [field]: nextValue,
    }));
  }

  async function saveRecord() {
    if (!selected) {
      Alert.alert("تنبيه", "اختر سجلًا أولاً");
      return;
    }

    if (selected.resource === "properties" && !form.owner_id) {
      Alert.alert("تنبيه", "يجب اختيار اسم المالك قبل حفظ العقار.");
      return;
    }

    const shortAddress = form.national_short_address || "";
    if (selected.resource === "properties" && shortAddress && !/^[A-Za-z0-9]{1,8}$/.test(shortAddress)) {
      Alert.alert("تنبيه", "العنوان الوطني المختصر يجب ألا يزيد عن 8 أحرف أو أرقام إنجليزية فقط.");
      return;
    }

    try {
      setSaving(true);

      await apiPostAny([
        `/my/edit-delete-center/${selected.resource}/${selected.id}/update`,
        `/edit-delete-center/${selected.resource}/${selected.id}/update`,
      ], {
        fields: form,
      });

      Alert.alert("تم", "تم حفظ التعديل");
      await loadRecords(resource, search);
    } catch (e) {
      Alert.alert("خطأ", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function archiveRecord() {
    if (!selected) {
      Alert.alert("تنبيه", "اختر سجلًا أولاً");
      return;
    }

    try {
      setSaving(true);

      const result = await apiPostAny([
        `/my/edit-delete-center/${selected.resource}/${selected.id}/archive`,
        `/edit-delete-center/${selected.resource}/${selected.id}/archive`,
      ], {});
      Alert.alert("تم", result.message || "تم تغيير حالة السجل");
      await loadRecords(resource, search);
    } catch (e) {
      Alert.alert("خطأ", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord() {
    if (!selected) {
      Alert.alert("تنبيه", "اختر سجلًا أولاً");
      return;
    }

    Alert.alert(
      "تأكيد الحذف",
      `هل تريد حذف هذا السجل؟\n${selected.title}\n\nسيتم نقله إلى سلة المحذوفات إذا كان باتش السلة مثبتًا.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);

              await apiPostAny([
                `/my/edit-delete-center/${selected.resource}/${selected.id}/delete`,
                `/edit-delete-center/${selected.resource}/${selected.id}/delete`,
              ], {});
              Alert.alert("تم", "تم حذف السجل");
              await loadRecords(resource, search);
            } catch (e) {
              Alert.alert("تعذر الحذف", errorMessage(e));
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }

  useEffect(() => {
    loadLookups();
    loadResources(paramResource, paramId);
  }, []);

  useEffect(() => {
    if (!paramResource || resources.length === 0) return;

    if (paramResource !== resource && resources.some((item) => item.key === paramResource)) {
      setResource(paramResource);
      loadRecords(paramResource, "", paramId);
    }
  }, [paramResource, paramId, resources.length]);

  const selectedResourceLabel = useMemo(() => {
    return resources.find((item) => item.key === resource)?.label || resource;
  }, [resources, resource]);

  const isPropertyEditor = isPropertyResource(resource) && Boolean(selected);

  useEffect(() => {
    if (!isPropertyResource(resource) || !selected || form.owner_id) return;

    const owners = lookups.owners || [];
    if (owners.length === 1) {
      setForm((prev) => (prev.owner_id ? prev : { ...prev, owner_id: String(owners[0].id) }));
    }
  }, [resource, selected?.id, form.owner_id, lookups.owners?.length]);

  const visibleEditableFields = useMemo(() => {
    if (!selected) return [];

    const editableFields = Array.isArray(selected.editable_fields) ? selected.editable_fields : [];

    if (showAllFields) {
      return editableFields;
    }

    const first = editableFields.filter((field) => importantFields.includes(field));
    const rest = editableFields.filter((field) => !importantFields.includes(field));

    return [...first, ...rest.slice(0, 10)];
  }, [selected, showAllFields]);

  function renderField(field: string) {
    const relationKey = relationKeyForField(field);
    const relationOptions = relationKey ? (lookups[relationKey] || []) : [];
    const optionList = optionFields[field] || [];
    const isBoolean = booleanFields.includes(field);
    const isRequiredOwner = isRequiredPropertyField(selected?.resource, field);
    const fieldLabelText = `${labelFor(field, selected?.resource)}${isRequiredOwner ? " *" : ""}`;
    const allowEmptyRelation = !isRequiredOwner;

    if (optionList.length > 0 && !isBoolean && isCompactPropertyOptionField(selected?.resource, field)) {
      return (
        <View key={field} style={styles.compactFieldBox}>
          <Text style={styles.compactFieldLabel}>{fieldLabelText}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.compactOptionRow}
            style={styles.compactOptionScroll}
          >
            {optionList.map((option) => (
              <TouchableOpacity
                key={`${field}-${option.value}`}
                style={[styles.optionChip, form[field] === option.value ? styles.optionChipActive : null]}
                onPress={() => setField(field, option.value)}
              >
                <Text style={[styles.optionText, form[field] === option.value ? styles.optionTextActive : null]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }

    return (
      <View key={field} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{fieldLabelText}</Text>

        {relationKey ? (
          <>
            {relationOptions.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                {allowEmptyRelation ? (
                  <TouchableOpacity
                    style={[styles.optionChip, !form[field] ? styles.optionChipActive : null]}
                    onPress={() => setField(field, "")}
                  >
                    <Text style={[styles.optionText, !form[field] ? styles.optionTextActive : null]}>فارغ</Text>
                  </TouchableOpacity>
                ) : null}

                {relationOptions.slice(0, 80).map((option) => (
                  <TouchableOpacity
                    key={`${field}-${option.id}`}
                    style={[styles.optionChip, form[field] === String(option.id) ? styles.optionChipActive : null]}
                    onPress={() => setField(field, String(option.id))}
                  >
                    <Text style={[styles.optionText, form[field] === String(option.id) ? styles.optionTextActive : null]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.readOnlyRelationBox}>
                <Text style={styles.readOnlyRelationText}>
                  {isRequiredOwner ? "لم يتم العثور على قائمة الملاك. لا يمكن حفظ العقار بدون مالك." : "لا توجد اختيارات"}
                </Text>
              </View>
            )}

            {isRequiredOwner && !form[field] ? (
              <Text style={styles.requiredRelationText}>يجب اختيار اسم المالك</Text>
            ) : null}
          </>
        ) : null}

        {isBoolean ? (
          <View style={styles.booleanRow}>
            <TouchableOpacity
              style={[styles.booleanChip, form[field] === "1" ? styles.booleanChipYes : null]}
              onPress={() => setField(field, "1")}
            >
              <Text style={[styles.booleanText, form[field] === "1" ? styles.booleanTextActive : null]}>نعم</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.booleanChip, form[field] === "0" ? styles.booleanChipNo : null]}
              onPress={() => setField(field, "0")}
            >
              <Text style={[styles.booleanText, form[field] === "0" ? styles.booleanTextActive : null]}>لا</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {optionList.length > 0 && !isBoolean && !relationKey ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
            {optionList.map((option) => (
              <TouchableOpacity
                key={`${field}-${option.value}`}
                style={[styles.optionChip, form[field] === option.value ? styles.optionChipActive : null]}
                onPress={() => setField(field, option.value)}
              >
                <Text style={[styles.optionText, form[field] === option.value ? styles.optionTextActive : null]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {!relationKey && !isBoolean && optionList.length === 0 ? (
          <TextInput
            style={[
              styles.input,
              ["notes", "description", "address", "damage_notes", "recommendations"].includes(field) ? styles.multilineInput : null,
            ]}
            value={form[field] ?? ""}
            onChangeText={(value) => setField(field, value)}
            textAlign="right"
            multiline={["notes", "description", "address", "damage_notes", "recommendations"].includes(field)}
            maxLength={field === "national_short_address" ? 8 : undefined}
            autoCapitalize={field === "national_short_address" ? "characters" : undefined}
            keyboardType={field === "property_area" ? "decimal-pad" : "default"}
            placeholder={labelFor(field, selected?.resource)}
          />
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {isPropertyEditor ? (
          <View style={styles.propertyPageHeader}>
            <View style={styles.propertyPageTitleBlock}>
              <Text style={styles.propertyPageTitle}>تعديل عقار</Text>
              <Text style={styles.propertyPageSubtitle} numberOfLines={1}>{selected?.title || "اسم العقار"}</Text>
            </View>

            <View style={styles.topIconActions}>
              <TouchableOpacity style={[styles.topIconButton, styles.topSaveButton]} onPress={saveRecord} disabled={saving}>
                <Text style={styles.topIconText}>{saving ? "…" : "💾"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.topIconButton, styles.topDeleteButton]} onPress={deleteRecord} disabled={saving}>
                <Text style={styles.topIconText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.title}>مركز التعديل والحذف</Text>
            <Text style={styles.subtitle}>
              تعديل مباشر مع قوائم اختيار للعلاقات مثل المالك والعقار والوحدة والمستأجر والعقد
            </Text>
          </>
        )}

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>القسم الحالي: {selectedResourceLabel || "-"}</Text>
          <Text style={styles.summaryText}>عدد السجلات: {records.length}</Text>
          <Text style={styles.summaryText}>السجل المحدد: {selected ? `#${selected.id}` : "لا يوجد"}</Text>
        </View>

        {loadingResources ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل الأقسام...</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>الأقسام</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resourcesRow}>
          {resources.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.resourceChip, resource === item.key ? styles.resourceChipActive : null]}
              onPress={() => selectResource(item.key)}
            >
              <Text style={[styles.resourceText, resource === item.key ? styles.resourceTextActive : null]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            placeholder={`بحث في ${selectedResourceLabel || "السجلات"}`}
            value={search}
            onChangeText={setSearch}
            textAlign="right"
          />

          <TouchableOpacity style={styles.searchButton} onPress={() => loadRecords(resource, search)}>
            <Text style={styles.searchButtonText}>بحث</Text>
          </TouchableOpacity>
        </View>

        {loadingRecords ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل السجلات...</Text>
          </View>
        ) : null}

        {!loadingRecords && records.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد سجلات في هذا القسم</Text>
          </View>
        ) : null}

        {records.map((item) => (
          <TouchableOpacity
            key={`${item.resource}-${item.id}`}
            style={[styles.recordCard, selected?.id === item.id && selected?.resource === item.resource ? styles.recordCardActive : null]}
            onPress={() => selectRecord(item)}
          >
            <View style={styles.rowBetween}>
              <Text style={styles.recordId}>#{item.id}</Text>
              <Text style={styles.recordTitle}>{item.title}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {selected ? (
          <View style={styles.editorCard}>
            {!isPropertyEditor ? (
              <Text style={styles.editorTitle}>تعديل: {selected.title}</Text>
            ) : null}

            {visibleEditableFields.map((field) => renderField(field))}

            {(selected.editable_fields?.length ?? 0) > visibleEditableFields.length ? (
              <TouchableOpacity style={styles.moreFieldsButton} onPress={() => setShowAllFields(!showAllFields)}>
                <Text style={styles.moreFieldsText}>
                  {showAllFields ? "إخفاء الحقول الإضافية" : `عرض كل الحقول (${selected.editable_fields?.length ?? 0})`}
                </Text>
              </TouchableOpacity>
            ) : null}

            {!isPropertyEditor ? (
              <>
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={[styles.actionButton, styles.saveButton]} onPress={saveRecord} disabled={saving}>
                    <Text style={styles.actionText}>{saving ? "جاري الحفظ..." : "حفظ التعديل"}</Text>
                  </TouchableOpacity>

                  {selected.can_archive ? (
                    <TouchableOpacity style={[styles.actionButton, styles.archiveButton]} onPress={archiveRecord} disabled={saving}>
                      <Text style={styles.actionText}>تعطيل / أرشفة</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <TouchableOpacity style={styles.deleteButton} onPress={deleteRecord} disabled={saving}>
                  <Text style={styles.deleteButtonText}>حذف السجل</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <Text style={styles.warningText}>
              الحذف يمنع تلقائيًا إذا وجدت سجلات مرتبطة. بعد تثبيت سلة المحذوفات تحفظ نسخة قبل الحذف.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 18, paddingBottom: 50 },
  title: { fontSize: 30, fontWeight: "900", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", fontSize: 15, textAlign: "right", lineHeight: 22 },
  propertyPageHeader: {
    backgroundColor: "#111827",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  propertyPageTitleBlock: { flex: 1, alignItems: "flex-end" },
  propertyPageTitle: { color: "#fff", fontSize: 32, fontWeight: "900", textAlign: "right" },
  propertyPageSubtitle: { color: "#C4C1BB", fontSize: 14, fontWeight: "800", textAlign: "right", marginTop: 4 },
  topIconActions: { flexDirection: "row-reverse", gap: 8, alignItems: "center" },
  topIconButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  topSaveButton: { backgroundColor: "#16a34a" },
  topDeleteButton: { backgroundColor: "#dc2626" },
  topIconText: { fontSize: 18, color: "#fff", fontWeight: "900" },
  summaryBox: { backgroundColor: "#111827", borderRadius: 18, padding: 16, marginBottom: 14 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  sectionTitle: { color: "#111827", fontSize: 20, fontWeight: "900", textAlign: "right", marginBottom: 10 },
  resourcesRow: { flexDirection: "row-reverse", paddingBottom: 12 },
  resourceChip: { backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginLeft: 8, borderWidth: 1, borderColor: "#DDDBD6" },
  resourceChipActive: { backgroundColor: "#111827" },
  resourceText: { color: "#374151", fontWeight: "900" },
  resourceTextActive: { color: "#fff" },
  searchCard: { backgroundColor: "#fff", borderRadius: 18, padding: 14, marginBottom: 14 },
  searchInput: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, color: "#111827", marginBottom: 10 },
  searchButton: { backgroundColor: "#0F9B6F", padding: 12, borderRadius: 12, alignItems: "center" },
  searchButtonText: { color: "#fff", fontWeight: "900" },
  recordCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#fff" },
  recordCardActive: { borderColor: "#0F9B6F", backgroundColor: "#eff6ff" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  recordId: { color: "#7A766F", fontWeight: "900" },
  recordTitle: { color: "#111827", fontWeight: "900", textAlign: "right", flex: 1 },
  editorCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginTop: 8, marginBottom: 14 },
  editorTitle: { color: "#111827", fontSize: 20, fontWeight: "900", textAlign: "right", marginBottom: 12 },
  quickInfo: { backgroundColor: "#eff6ff", padding: 10, borderRadius: 12, marginBottom: 12 },
  quickInfoText: { color: "#065F44", fontWeight: "800", textAlign: "right", lineHeight: 20 },
  fieldBox: { marginBottom: 14 },
  compactFieldBox: {
    marginBottom: 14,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  compactFieldLabel: { color: "#374151", fontWeight: "900", textAlign: "right", minWidth: 82 },
  compactOptionScroll: { flex: 1 },
  compactOptionRow: { flexDirection: "row-reverse", alignItems: "center", paddingVertical: 2 },
  readOnlyRelationBox: { backgroundColor: "#fef3c7", borderRadius: 12, padding: 10, marginBottom: 8 },
  readOnlyRelationText: { color: "#92400e", fontWeight: "800", textAlign: "right" },
  requiredRelationText: { color: "#dc2626", fontWeight: "900", textAlign: "right", marginTop: 4 },
  fieldLabel: { color: "#374151", fontWeight: "900", textAlign: "right", marginBottom: 6 },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, color: "#111827", minHeight: 44 },
  multilineInput: { minHeight: 80, textAlignVertical: "top" },
  fieldKey: { color: "#9ca3af", fontSize: 12, textAlign: "left", marginTop: 4 },
  optionRow: { flexDirection: "row-reverse", paddingBottom: 8 },
  optionChip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8 },
  optionChipActive: { backgroundColor: "#111827" },
  optionText: { color: "#374151", fontWeight: "800" },
  optionTextActive: { color: "#fff" },
  booleanRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 8 },
  booleanChip: { flex: 1, backgroundColor: "#f3f4f6", padding: 10, borderRadius: 12, alignItems: "center" },
  booleanChipYes: { backgroundColor: "#16a34a" },
  booleanChipNo: { backgroundColor: "#dc2626" },
  booleanText: { color: "#374151", fontWeight: "900" },
  booleanTextActive: { color: "#fff" },
  moreFieldsButton: { backgroundColor: "#f3f4f6", padding: 12, borderRadius: 12, alignItems: "center", marginBottom: 10 },
  moreFieldsText: { color: "#374151", fontWeight: "900" },
  actionsRow: { flexDirection: "row-reverse", gap: 10, marginTop: 8 },
  actionButton: { flex: 1, padding: 13, borderRadius: 12, alignItems: "center" },
  saveButton: { backgroundColor: "#16a34a" },
  archiveButton: { backgroundColor: "#d97706" },
  actionText: { color: "#fff", fontWeight: "900" },
  deleteButton: { backgroundColor: "#dc2626", padding: 13, borderRadius: 12, alignItems: "center", marginTop: 10 },
  deleteButtonText: { color: "#fff", fontWeight: "900" },
  warningText: { color: "#991b1b", fontWeight: "700", textAlign: "right", lineHeight: 22, marginTop: 12 },
  noteBox: { backgroundColor: "#fffbeb", borderRadius: 18, padding: 14, marginTop: 4 },
  noteText: { color: "#92400e", fontWeight: "700", textAlign: "right", lineHeight: 22 },
});
