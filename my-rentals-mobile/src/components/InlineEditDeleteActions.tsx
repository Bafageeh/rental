import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { apiGetScoped, apiPost, apiPostAny } from "../lib/api";
import {
  Lookups,
  LookupOption,
  booleanFields,
  editableOptionFields,
  isRelationField,
  labelForResource,
  relationKeyForField,
  translateValue,
} from "../lib/arabicDisplay";

type Props = {
  resource: string;
  id: unknown;
  onChanged?: () => void | Promise<void>;
  hideDetails?: boolean;
  hideDelete?: boolean;
  compact?: boolean;
  iconOnly?: boolean;
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

function isUnitResource(resource: string | null | undefined) {
  return resource === "units" || resource === "unit";
}

function isRequiredPropertyField(resource: string | null | undefined, field: string) {
  return isPropertyResource(resource) && field === "owner_id";
}

function isCompactPropertyOptionField(resource: string | null | undefined, field: string) {
  return isPropertyResource(resource) && field === "usage_type";
}

const hiddenUnitEditFields = new Set(["parent_unit_id", "is_subdivided", "unit_scope"]);

const unitEditorSections = [
  { title: "الموقع والتصنيف", subtitle: "ربط الوحدة بالعقار وتحديد الدور والنوع.", icon: "🏢", fields: ["property_id", "floor", "type", "status"] },
  { title: "بيانات الوحدة", subtitle: "اسم الوحدة والقيمة الإيجارية المقترحة.", icon: "🏠", fields: ["unit_number", "rent_amount"] },
  { title: "المواصفات الداخلية", subtitle: "الغرف والحمامات والمرافق الأساسية.", icon: "🧩", fields: ["rooms_count", "bathrooms_count", "has_living_room", "is_rooftop", "orientation"] },
  { title: "المطبخ", subtitle: "خيارات المطبخ بدون حقول رقمية إضافية.", icon: "🍳", fields: ["has_kitchen", "kitchen_type", "is_kitchen_installed"] },
  { title: "ملاحظات", subtitle: "أي تفاصيل إضافية عن الوحدة.", icon: "📝", fields: ["notes"] },
];

export default function InlineEditDeleteActions({ resource, id, onChanged, hideDetails = false, hideDelete = false, compact = false, iconOnly = false }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [lookups, setLookups] = useState<Lookups>({});
  const [record, setRecord] = useState<RecordItem | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [openRelationField, setOpenRelationField] = useState<string | null>(null);
  const [relationSearches, setRelationSearches] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);

  const stringId = id === null || id === undefined ? "" : String(id);
  const optionFields = editableOptionFields();
  const isPropertyEditor = isPropertyResource(resource);

  function goDetails(tab: "details" = "details") {
    if (!stringId) {
      Alert.alert("تنبيه", "لا يوجد رقم للعنصر");
      return;
    }

    router.push({ pathname: "/record-details", params: { resource, id: stringId, tab } } as never);
  }

  async function loadLookups() {
    try {
      const data = await apiGetScoped("/edit-delete-center/lookups", "/my/edit-delete-center/lookups");
      setLookups(data || {});
    } catch {
      setLookups({});
    }
  }

  async function loadRecord() {
    if (!stringId) {
      Alert.alert("تنبيه", "لا يوجد رقم للعنصر");
      return;
    }

    try {
      setLoading(true);
      setRecord(null);
      setForm({});
      setShowAllFields(false);

      const data = await apiGetScoped(
        `/edit-delete-center/${resource}?id=${encodeURIComponent(stringId)}`,
        `/my/edit-delete-center/${resource}?id=${encodeURIComponent(stringId)}`
      );

      const item = Array.isArray(data?.items) ? data.items[0] : null;

      if (!item) {
        Alert.alert("تنبيه", "لم يتم العثور على البيانات");
        return;
      }

      let editableFields = resource === "owners"
        ? item.editable_fields.filter((field: string) => field !== "type")
        : item.editable_fields;

      if (isUnitResource(resource)) {
        editableFields = editableFields.filter((field: string) => !hiddenUnitEditFields.has(field));
      }

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

  async function openEditor() {
    setOpenRelationField(null);
    setModalVisible(true);
    await Promise.all([loadLookups(), loadRecord()]);
  }

  function setField(field: string, value: string) {
    const nextValue = field === "national_short_address" ? value.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() : value;
    setForm((prev) => ({ ...prev, [field]: nextValue }));
  }

  function fieldLabel(field: string) {
    return labelForResource(resource, field);
  }

  function setRelationSearch(field: string, value: string) {
    setRelationSearches((prev) => ({ ...prev, [field]: value }));
  }

  function selectedRelationLabel(field: string, options: LookupOption[]) {
    const selected = options.find((option) => String(option.id) === String(form[field] || ""));

    if (selected) return selected.label;
    if (form[field]) return "اختيار غير معروف";

    if (isRequiredPropertyField(resource, field)) {
      return "اختر اسم المالك";
    }

    return `اختر ${fieldLabel(field)}`;
  }

  function filteredRelationOptions(field: string, options: LookupOption[]) {
    const search = (relationSearches[field] || "").trim().toLowerCase();

    if (!search) return options.slice(0, 160);

    return options
      .filter((option) => {
        const label = String(option.label || "").toLowerCase();
        const idText = String(option.id || "").toLowerCase();

        return label.includes(search) || idText.includes(search);
      })
      .slice(0, 160);
  }

  async function saveRecord() {
    if (!record) {
      Alert.alert("تنبيه", "لا يوجد عنصر محدد");
      return;
    }

    if (isPropertyEditor && !form.owner_id) {
      Alert.alert("تنبيه", "يجب اختيار اسم المالك قبل حفظ العقار.");
      return;
    }

    const shortAddress = form.national_short_address || "";
    if (isPropertyEditor && shortAddress && !/^[A-Za-z0-9]{1,8}$/.test(shortAddress)) {
      Alert.alert("تنبيه", "العنوان الوطني المختصر يجب ألا يزيد عن 8 أحرف أو أرقام إنجليزية فقط.");
      return;
    }

    try {
      setSaving(true);
      const fieldsToSave = { ...form };
      if (resource === "owners") {
        delete fieldsToSave.type;
      }

      await apiPost(`/edit-delete-center/${resource}/${record.id}/update`, { fields: fieldsToSave });
      Alert.alert("تم", "تم حفظ التعديل");
      setModalVisible(false);

      if (onChanged) await onChanged();
    } catch (e) {
      Alert.alert("خطأ", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function archiveRecord() {
    if (!record) {
      Alert.alert("تنبيه", "لا يوجد عنصر محدد");
      return;
    }

    try {
      setSaving(true);
      const result = await apiPost(`/edit-delete-center/${resource}/${record.id}/archive`, {});
      Alert.alert("تم", result.message || "تم تغيير حالة العنصر");
      setModalVisible(false);

      if (onChanged) await onChanged();
    } catch (e) {
      Alert.alert("خطأ", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord() {
    if (!stringId) {
      Alert.alert("تنبيه", "لا يوجد رقم للعنصر");
      return;
    }

    if (resource === "owners") {
      Alert.alert(
        "حذف المالك",
        "سيتم حذف المالك وجميع العقارات والوحدات التابعة له. هل تريد المتابعة؟",
        [
          { text: "إلغاء", style: "cancel" },
          {
            text: "حذف الكل",
            style: "destructive",
            onPress: async () => {
              try {
                await apiPostAny([
                  `/relation-manager/delete-owner-cascade/${stringId}`,
                  `/my/relation-manager/delete-owner-cascade/${stringId}`,
                ], {});
                Alert.alert("تم", "تم حذف المالك وجميع عقاراته");
                setModalVisible(false);
                if (onChanged) await onChanged();
              } catch (e) {
                Alert.alert("تعذر الحذف", errorMessage(e));
              }
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      "تأكيد الحذف",
      "هل تريد حذف هذا العنصر؟ إذا كانت له سجلات تابعة سيتم منع الحذف تلقائيًا.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            try {
              await apiPost(`/edit-delete-center/${resource}/${stringId}/delete`, {});
              Alert.alert("تم", "تم حذف بنجاح");
              setModalVisible(false);

              if (onChanged) await onChanged();
            } catch (e) {
              Alert.alert("تعذر الحذف", errorMessage(e));
            }
          },
        },
      ]
    );
  }

  useEffect(() => {
    if (!isPropertyEditor || !record || form.owner_id) return;

    const owners = lookups.owners || [];
    if (owners.length === 1) {
      setForm((prev) => (prev.owner_id ? prev : { ...prev, owner_id: String(owners[0].id) }));
    }
  }, [isPropertyEditor, record?.id, form.owner_id, lookups.owners?.length]);

  const visibleEditableFields = useMemo(() => {
    if (!record) return [];

    if (showAllFields) return record.editable_fields;

    const first = record.editable_fields.filter((field) => importantFields.includes(field));
    const rest = record.editable_fields.filter((field) => !importantFields.includes(field));

    return [...first, ...rest.slice(0, 10)];
  }, [record, showAllFields]);

  function renderRelationDropdown(field: string, relationOptions: LookupOption[]) {
    const allowEmpty = !isRequiredPropertyField(resource, field);

    if (relationOptions.length === 0) {
      return (
        <View style={styles.readOnlyRelationBox}>
          <Text style={styles.readOnlyRelationText}>
            {isRequiredPropertyField(resource, field)
              ? "لم يتم العثور على قائمة الملاك. لا يمكن حفظ العقار بدون مالك."
              : form[field]
                ? "لم يتم العثور على الاسم التابع لهذا الحقل"
                : "لا يوجد اختيار"}
          </Text>
        </View>
      );
    }

    const visibleOptions = filteredRelationOptions(field, relationOptions);

    return (
      <View style={styles.dropdownWrapper}>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setOpenRelationField(openRelationField === field ? null : field)}
        >
          <Text style={styles.dropdownButtonText}>{selectedRelationLabel(field, relationOptions)}</Text>
          <Text style={styles.dropdownArrow}>{openRelationField === field ? "▲" : "▼"}</Text>
        </TouchableOpacity>

        {openRelationField === field ? (
          <View style={styles.dropdownPanel}>
            <TextInput
              style={styles.dropdownSearch}
              value={relationSearches[field] || ""}
              onChangeText={(value) => setRelationSearch(field, value)}
              placeholder={`بحث في ${fieldLabel(field)}`}
              textAlign="right"
            />

            {allowEmpty ? (
              <TouchableOpacity
                style={[styles.dropdownOption, styles.dropdownEmptyOption]}
                onPress={() => {
                  setField(field, "");
                  setOpenRelationField(null);
                }}
              >
                <Text style={styles.dropdownEmptyText}>بدون اختيار</Text>
              </TouchableOpacity>
            ) : null}

            <ScrollView style={styles.dropdownList} nestedScrollEnabled>
              {visibleOptions.map((option) => {
                const active = String(option.id) === String(form[field] || "");

                return (
                  <TouchableOpacity
                    key={`${field}-${option.id}`}
                    style={[styles.dropdownOption, active ? styles.dropdownOptionActive : null]}
                    onPress={() => {
                      setField(field, String(option.id));
                      setOpenRelationField(null);
                    }}
                  >
                    <Text style={[styles.dropdownOptionText, active ? styles.dropdownOptionTextActive : null]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {visibleOptions.length === 0 ? (
                <Text style={styles.dropdownNoResults}>لا توجد نتائج</Text>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  }

  function renderField(field: string) {
    const relationKey = relationKeyForField(field);
    const relationOptions = relationKey ? (lookups[relationKey] || []) : [];
    const options = optionFields[field] || {};
    const optionList = Object.entries(options).map(([value, label]) => ({ value, label }));
    const isBoolean = booleanFields.includes(field);
    const relationField = isRelationField(field);
    const isRequiredOwner = isRequiredPropertyField(resource, field);
    const label = `${fieldLabel(field)}${isRequiredOwner ? " *" : ""}`;

    if (optionList.length > 0 && !isBoolean && !relationField && isCompactPropertyOptionField(resource, field)) {
      return (
        <View key={field} style={styles.compactFieldBox}>
          <Text style={styles.compactFieldLabel}>{label}</Text>
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
        <Text style={styles.fieldLabel}>{label}</Text>

        {relationField ? renderRelationDropdown(field, relationOptions) : null}

        {isBoolean && !relationField ? (
          <View style={styles.booleanRow}>
            <TouchableOpacity
              style={[styles.booleanChip, form[field] === "1" || form[field] === "true" ? styles.booleanChipYes : null]}
              onPress={() => setField(field, "1")}
            >
              <Text style={[styles.booleanText, form[field] === "1" || form[field] === "true" ? styles.booleanTextActive : null]}>نعم</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.booleanChip, form[field] === "0" || form[field] === "false" ? styles.booleanChipNo : null]}
              onPress={() => setField(field, "0")}
            >
              <Text style={[styles.booleanText, form[field] === "0" || form[field] === "false" ? styles.booleanTextActive : null]}>لا</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {optionList.length > 0 && !isBoolean && !relationField ? (
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

        {!relationField && !isBoolean && optionList.length === 0 ? (
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
            placeholder={fieldLabel(field)}
          />
        ) : null}

        {relationField ? (
          <Text style={[styles.relationCurrentValue, isRequiredOwner && !form[field] ? styles.requiredRelationText : null]}>
            {isRequiredOwner && !form[field]
              ? "يجب اختيار اسم المالك"
              : `الاختيار الحالي: ${translateValue(field, form[field], lookups)}`}
          </Text>
        ) : null}
      </View>
    );
  }

  function renderUnitEditor() {
    const rendered = new Set<string>();
    const fields = visibleEditableFields.filter((field) => !hiddenUnitEditFields.has(field));
    const sectionNodes = unitEditorSections.map((section) => {
      const sectionFields = section.fields.filter((field) => fields.includes(field));
      if (sectionFields.length === 0) return null;
      sectionFields.forEach((field) => rendered.add(field));
      return (
        <View key={section.title} style={styles.unitSectionCard}>
          <View style={styles.unitSectionHeader}>
            <View style={styles.unitSectionIconBox}><Text style={styles.unitSectionIcon}>{section.icon}</Text></View>
            <View style={styles.unitSectionTitleBox}>
              <Text style={styles.unitSectionTitle}>{section.title}</Text>
              <Text style={styles.unitSectionSubtitle}>{section.subtitle}</Text>
            </View>
          </View>
          <View style={styles.unitSectionFields}>{sectionFields.map((field) => renderField(field))}</View>
        </View>
      );
    }).filter(Boolean);
    const remainingFields = fields.filter((field) => !rendered.has(field));
    return (
      <>
        <View style={styles.unitEditorHero}>
          <View style={styles.unitEditorHeroIcon}><Text style={styles.unitEditorHeroIconText}>🏠</Text></View>
          <View style={styles.unitEditorHeroTextBox}>
            <Text style={styles.unitEditorHeroTitle}>تعديل بيانات الوحدة</Text>
            <Text style={styles.unitEditorHeroSubtitle}>{record?.title || "حدّث بيانات الوحدة بدقة"}</Text>
          </View>
        </View>
        {sectionNodes}
        {remainingFields.length > 0 ? <View style={styles.unitSectionCard}><View style={styles.unitSectionFields}>{remainingFields.map((field) => renderField(field))}</View></View> : null}
      </>
    );
  }

  return (
    <>
      <View style={[styles.iconBar, compact ? styles.iconBarCompact : null]}>
        {!hideDetails ? (
          <TouchableOpacity style={[styles.iconButton, styles.detailsButton, compact ? styles.compactIconButton : null]} onPress={() => goDetails("details")}>
            <Text style={styles.iconText}>👁️</Text>
            {!iconOnly ? <Text style={styles.iconLabel}>تفاصيل</Text> : null}
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={[styles.iconButton, styles.editButton, compact ? styles.compactIconButton : null]} onPress={openEditor}>
          <Text style={styles.iconText}>✏️</Text>
          {!iconOnly ? <Text style={styles.iconLabel}>تعديل</Text> : null}
        </TouchableOpacity>

        {!hideDelete ? (
          <TouchableOpacity style={[styles.iconButton, styles.deleteButton, compact ? styles.compactIconButton : null]} onPress={deleteRecord}>
            <Text style={styles.iconText}>🗑️</Text>
            {!iconOnly ? <Text style={styles.iconLabel}>حذف</Text> : null}
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalRoot}>
          <View style={[styles.modalHeader, isPropertyEditor ? styles.propertyModalHeader : null]}>
            <TouchableOpacity style={isPropertyEditor ? styles.closeIconButton : styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={isPropertyEditor ? styles.closeIconButtonText : styles.closeButtonText}>
                {isPropertyEditor ? "✕" : "إغلاق"}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalTitleBlock}>
              <Text style={[styles.modalTitle, isPropertyEditor ? styles.propertyModalTitle : null]}>
                {isPropertyEditor ? "تعديل عقار" : record ? `تعديل: ${record.title}` : "تعديل"}
              </Text>
              {isPropertyEditor ? (
                <Text style={styles.propertyModalSubtitle} numberOfLines={1}>
                  {record?.title || "اسم العقار"}
                </Text>
              ) : null}
            </View>

            {isPropertyEditor && record ? (
              <View style={styles.topIconActions}>
                <TouchableOpacity style={[styles.topIconButton, styles.topSaveButton]} onPress={saveRecord} disabled={saving}>
                  <Text style={styles.topIconText}>{saving ? "…" : "💾"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.topIconButton, styles.topDeleteButton]} onPress={deleteRecord} disabled={saving}>
                  <Text style={styles.topIconText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>جاري تحميل البيانات...</Text>
              </View>
            ) : null}

            {!loading && record ? (
              <>
                {isPropertyEditor ? (
                  <View style={styles.noticeBox}>
                    <Text style={styles.noticeText}>
                      مالك هذا العقار: {form.owner_id ? translateValue("owner_id", form.owner_id, lookups) : "اختر اسم المالك"}
                    </Text>
                  </View>
                ) : null}

                {isUnitResource(resource) ? renderUnitEditor() : visibleEditableFields.map((field) => renderField(field))}

                {record.editable_fields.length > visibleEditableFields.length ? (
                  <TouchableOpacity style={styles.moreFieldsButton} onPress={() => setShowAllFields(!showAllFields)}>
                    <Text style={styles.moreFieldsText}>
                      {showAllFields ? "إخفاء الحقول الإضافية" : `عرض كل الحقول (${record.editable_fields.length})`}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {!isPropertyEditor ? (
                  <>
                    <View style={styles.modalActionsRow}>
                      <TouchableOpacity style={[styles.modalActionButton, styles.saveButton]} onPress={saveRecord} disabled={saving}>
                        <Text style={styles.modalActionText}>{saving ? "جاري الحفظ..." : "حفظ التعديل"}</Text>
                      </TouchableOpacity>

                      {record.can_archive ? (
                        <TouchableOpacity style={[styles.modalActionButton, styles.archiveButton]} onPress={archiveRecord} disabled={saving}>
                          <Text style={styles.modalActionText}>تعطيل / أرشفة</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <TouchableOpacity style={styles.modalDeleteButton} onPress={deleteRecord} disabled={saving}>
                      <Text style={styles.modalDeleteText}>حذف</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  unitEditorHero: { backgroundColor: "#0f172a", borderRadius: 24, padding: 16, marginBottom: 12, flexDirection: "row-reverse", alignItems: "center", gap: 12, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 14, elevation: 3 },
  unitEditorHeroIcon: { width: 54, height: 54, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  unitEditorHeroIconText: { fontSize: 26 },
  unitEditorHeroTextBox: { flex: 1, alignItems: "flex-end" },
  unitEditorHeroTitle: { color: "#fff", fontSize: 19, fontWeight: "900", textAlign: "right" },
  unitEditorHeroSubtitle: { color: "#cbd5e1", fontSize: 12, fontWeight: "800", textAlign: "right", marginTop: 4 },
  unitSectionCard: { backgroundColor: "#fff", borderRadius: 24, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#eceff3", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  unitSectionHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 10 },
  unitSectionIconBox: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  unitSectionIcon: { fontSize: 21 },
  unitSectionTitleBox: { flex: 1, alignItems: "flex-end" },
  unitSectionTitle: { color: "#111827", fontSize: 16, fontWeight: "900", textAlign: "right" },
  unitSectionSubtitle: { color: "#64748b", fontSize: 11, fontWeight: "700", textAlign: "right", marginTop: 2 },
  unitSectionFields: { gap: 0 },
  iconBar: {
    flexDirection: "row-reverse",
    gap: 7,
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 4,
  },
  iconBarCompact: {
    alignSelf: "flex-start",
    justifyContent: "flex-start",
    marginTop: 0,
    marginBottom: 0,
    paddingVertical: 0,
  },
  iconButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  detailsButton: { backgroundColor: "#0f172a" },
  editButton: { backgroundColor: "#0F9B6F" },
  deleteButton: { backgroundColor: "#dc2626" },
  compactIconButton: {
    flex: 0,
    width: 34,
    height: 34,
    minHeight: 34,
    borderRadius: 17,
    paddingVertical: 0,
  },
  iconText: { fontSize: 15, lineHeight: 20 },
  iconLabel: { color: "#fff", fontWeight: "900", fontSize: 10, marginTop: 1 },
  modalRoot: { flex: 1, backgroundColor: "#F7F6F4" },
  modalHeader: {
    backgroundColor: "#111827",
    paddingTop: 46,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  propertyModalHeader: { paddingTop: 58, paddingBottom: 18 },
  modalTitleBlock: { flex: 1, alignItems: "flex-end" },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "right",
  },
  propertyModalTitle: { fontSize: 31, lineHeight: 38 },
  propertyModalSubtitle: {
    color: "#d1d5db",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 4,
    maxWidth: 230,
  },
  closeButton: {
    backgroundColor: "#374151",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  closeButtonText: { color: "#fff", fontWeight: "900" },
  closeIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  closeIconButtonText: { color: "#fff", fontWeight: "900", fontSize: 18 },
  topIconActions: { flexDirection: "row-reverse", gap: 8, alignItems: "center" },
  topIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  topSaveButton: { backgroundColor: "#16a34a" },
  topDeleteButton: { backgroundColor: "#dc2626" },
  topIconText: { fontSize: 18, color: "#fff", fontWeight: "900" },
  modalBody: { padding: 12, paddingBottom: 50 },
  loadingBox: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  loadingText: { color: "#4b5563", marginTop: 8, textAlign: "center" },
  noticeBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  noticeText: {
    color: "#065F44",
    fontWeight: "800",
    textAlign: "right",
    lineHeight: 22,
  },
  fieldBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  compactFieldBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  compactFieldLabel: {
    color: "#374151",
    fontWeight: "900",
    textAlign: "right",
    minWidth: 82,
  },
  compactOptionScroll: { flex: 1 },
  compactOptionRow: { flexDirection: "row-reverse", alignItems: "center", paddingVertical: 2 },
  fieldLabel: {
    color: "#374151",
    fontWeight: "900",
    textAlign: "right",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F7F6F4",
    borderWidth: 1,
    borderColor: "#DDDBD6",
    borderRadius: 12,
    padding: 12,
    color: "#111827",
    minHeight: 44,
  },
  multilineInput: { minHeight: 80, textAlignVertical: "top" },
  fieldKey: {
    color: "#9ca3af",
    fontSize: 12,
    textAlign: "left",
    marginTop: 4,
  },
  dropdownWrapper: { marginBottom: 10 },
  dropdownButton: {
    backgroundColor: "#F7F6F4",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownButtonText: {
    flex: 1,
    color: "#111827",
    fontWeight: "900",
    textAlign: "right",
  },
  dropdownArrow: { color: "#111827", fontWeight: "900" },
  dropdownPanel: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#DDDBD6",
    borderRadius: 14,
    padding: 10,
    marginTop: 8,
  },
  dropdownSearch: {
    backgroundColor: "#F7F6F4",
    borderWidth: 1,
    borderColor: "#DDDBD6",
    borderRadius: 12,
    padding: 10,
    color: "#111827",
    marginBottom: 8,
  },
  dropdownList: { maxHeight: 260 },
  dropdownOption: {
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  dropdownOptionActive: { backgroundColor: "#111827" },
  dropdownEmptyOption: {
    backgroundColor: "#fef3c7",
    marginBottom: 6,
    borderBottomWidth: 0,
  },
  dropdownOptionText: {
    color: "#111827",
    fontWeight: "900",
    textAlign: "right",
  },
  dropdownOptionTextActive: { color: "#fff" },
  dropdownEmptyText: {
    color: "#92400e",
    fontWeight: "900",
    textAlign: "center",
  },
  dropdownNoResults: {
    color: "#6b7280",
    textAlign: "center",
    padding: 10,
  },
  relationCurrentValue: {
    color: "#4b5563",
    fontWeight: "800",
    textAlign: "right",
    marginTop: 6,
  },
  requiredRelationText: { color: "#dc2626" },
  readOnlyRelationBox: {
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  readOnlyRelationText: {
    color: "#92400e",
    fontWeight: "800",
    textAlign: "right",
  },
  optionRow: { flexDirection: "row-reverse", paddingBottom: 8 },
  optionChip: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginLeft: 8,
  },
  optionChipActive: { backgroundColor: "#111827" },
  optionText: { color: "#374151", fontWeight: "800" },
  optionTextActive: { color: "#fff" },
  booleanRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 8 },
  booleanChip: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    padding: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  booleanChipYes: { backgroundColor: "#16a34a" },
  booleanChipNo: { backgroundColor: "#dc2626" },
  booleanText: { color: "#374151", fontWeight: "900" },
  booleanTextActive: { color: "#fff" },
  moreFieldsButton: {
    backgroundColor: "#DDDBD6",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  moreFieldsText: { color: "#374151", fontWeight: "900" },
  modalActionsRow: { flexDirection: "row-reverse", gap: 10, marginTop: 6 },
  modalActionButton: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButton: { backgroundColor: "#16a34a" },
  archiveButton: { backgroundColor: "#d97706" },
  modalActionText: { color: "#fff", fontWeight: "900" },
  modalDeleteButton: {
    backgroundColor: "#dc2626",
    padding: 13,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  modalDeleteText: { color: "#fff", fontWeight: "900" },
});
