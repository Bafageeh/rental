import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { apiGetScoped, apiPost, apiPostFormData } from "../lib/api";
import InlineEditDeleteActions from "../components/InlineEditDeleteActions";
import { SafeAreaView } from "react-native-safe-area-context";

import { smartBack } from "@/lib/navigationHistory";
type EntityOption = {
  id: number;
  label: string;
};

type DocumentRecord = {
  id: number;
  entity_type?: string | null;
  entity_id?: number | null;
  entity_label?: string | null;
  title?: string | null;
  document_type?: string | null;
  original_file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  file_url?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  days_to_expiry?: number | null;
  status?: string | null;
  notes?: string | null;
};

type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

function entityLabel(value?: string | null) {
  if (value === "property") return "عقار";
  if (value === "unit") return "وحدة";
  if (value === "tenant") return "مستأجر";
  if (value === "contract") return "عقد";
  if (value === "owner") return "مالك";
  return "عام";
}

function documentTypeLabel(value?: string | null) {
  if (value === "deed") return "صك";
  if (value === "contract") return "عقد";
  if (value === "id") return "هوية";
  if (value === "bill") return "فاتورة";
  if (value === "photo") return "صورة";
  if (value === "video") return "فيديو";
  if (value === "official") return "مستند رسمي";
  return "أخرى";
}

function statusLabel(value?: string | null) {
  if (value === "active") return "نشط";
  if (value === "archived") return "مؤرشف";
  if (value === "expired") return "منتهي";
  return value || "-";
}

function expiryText(item: DocumentRecord) {
  if (!item.expiry_date) return "لا يوجد تاريخ انتهاء";

  const days = Number(item.days_to_expiry ?? 0);

  if (days < 0) {
    return `منتهي منذ ${Math.abs(days)} يوم`;
  }

  if (days === 0) {
    return "ينتهي اليوم";
  }

  return `ينتهي بعد ${days} يوم`;
}

function expiryStyle(item: DocumentRecord) {
  const days = item.days_to_expiry;

  if (days === null || days === undefined) return styles.expiryNeutral;
  if (days < 0) return styles.expiryExpired;
  if (days <= 30) return styles.expirySoon;
  return styles.expiryOk;
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default function DocumentsScreen() {
  const params = useLocalSearchParams();
  const propertyIdParam = firstParam(params.property_id as string | string[] | undefined);
  const propertyNameParam = firstParam(params.property_name as string | string[] | undefined);
  const requestedEntityType = firstParam(params.entity_type as string | string[] | undefined);
  const scopedPropertyId = propertyIdParam ? Number(propertyIdParam) : null;
  const scopedPropertyName = propertyNameParam ? decodeURIComponent(propertyNameParam) : "";
  const isPropertyScoped = !!scopedPropertyId;

  const [items, setItems] = useState<DocumentRecord[]>([]);
  const [properties, setProperties] = useState<EntityOption[]>([]);
  const [units, setUnits] = useState<EntityOption[]>([]);
  const [tenants, setTenants] = useState<EntityOption[]>([]);
  const [contracts, setContracts] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [entityType, setEntityType] = useState(requestedEntityType || "property");
  const [entityId, setEntityId] = useState<number | null>(scopedPropertyId || null);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("official");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);

  async function load() {
    try {
      setLoading(true);

      const documentFilter = scopedPropertyId ? `?property_id=${scopedPropertyId}` : "";
      const propertyFilter = scopedPropertyId ? `?property_id=${scopedPropertyId}` : "";

      const [documentsResult, propertiesResult, unitsResult, tenantsResult, contractsResult] = await Promise.all([
        apiGetScoped(`/document-records${documentFilter}`, `/my/document-records${documentFilter}`),
        apiGetScoped(`/properties${propertyFilter}`, `/my/properties${propertyFilter}`),
        apiGetScoped(`/units${propertyFilter}`, `/my/units${propertyFilter}`),
        apiGetScoped("/tenants", "/my/tenants"),
        apiGetScoped("/contracts", "/my/contracts"),
      ]);

      const propertyOptions = Array.isArray(propertiesResult)
        ? propertiesResult.map((item: any) => ({
            id: item.id,
            label: item.name || `عقار #${item.id}`,
          }))
        : [];

      const unitOptions = Array.isArray(unitsResult)
        ? unitsResult.map((item: any) => ({
            id: item.id,
            label: `${item.property?.name || "عقار"} — ${item.unit_number || `وحدة #${item.id}`}`,
          }))
        : [];

      const tenantOptions = Array.isArray(tenantsResult)
        ? tenantsResult.map((item: any) => ({
            id: item.id,
            label: item.name || `مستأجر #${item.id}`,
          }))
        : [];

      const contractOptions = Array.isArray(contractsResult)
        ? contractsResult.map((item: any) => ({
            id: item.id,
            label: `عقد #${item.government_contract_number || item.contract_number || item.id} — ${item.tenant?.name || "مستأجر"}`,
          }))
        : [];

      setItems(Array.isArray(documentsResult) ? documentsResult : []);
      setProperties(propertyOptions);
      setUnits(unitOptions);
      setTenants(tenantOptions);
      setContracts(contractOptions);

      if (scopedPropertyId) {
        setEntityType("property");
        setEntityId(scopedPropertyId);
      } else if (!entityId && propertyOptions.length > 0) {
        setEntityId(propertyOptions[0].id);
      }
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل المستندات");
    } finally {
      setLoading(false);
    }
  }

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];

      if (!asset?.uri) {
        Alert.alert("تنبيه", "لم يتم اختيار ملف");
        return;
      }

      setPickedFile({
        uri: asset.uri,
        name: asset.name || "document",
        mimeType: asset.mimeType || "application/octet-stream",
      });
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر اختيار الملف");
    }
  }

  async function saveDocument() {
    if (!title.trim()) {
      Alert.alert("تنبيه", "اكتب عنوان المستند");
      return;
    }

    if (entityType !== "general" && !entityId) {
      Alert.alert("تنبيه", "اختر الجهة المرتبطة بالمستند");
      return;
    }

    try {
      setSaving(true);

      const formData = new FormData();
      formData.append("entity_type", entityType);

      if (entityType !== "general" && entityId) {
        formData.append("entity_id", String(entityId));
      }

      formData.append("title", title.trim());
      formData.append("document_type", documentType);
      formData.append("status", "active");

      if (issueDate.trim()) {
        formData.append("issue_date", issueDate.trim());
      }

      if (expiryDate.trim()) {
        formData.append("expiry_date", expiryDate.trim());
      }

      if (notes.trim()) {
        formData.append("notes", notes.trim());
      }

      if (pickedFile) {
        formData.append("file", {
          uri: pickedFile.uri,
          name: pickedFile.name,
          type: pickedFile.mimeType || "application/octet-stream",
        } as any);
      }

      await apiPostFormData("/document-records", formData);

      setTitle("");
      setIssueDate("");
      setExpiryDate("");
      setNotes("");
      setPickedFile(null);
      setDocumentType("official");
      setShowForm(false);

      Alert.alert("تم", "تم حفظ المستند");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ المستند");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: number, status: string) {
    try {
      await apiPost(`/document-records/${id}/status`, { status });
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحديث حالة المستند");
    }
  }

  async function openFile(item: DocumentRecord) {
    if (!item.file_url) {
      Alert.alert("تنبيه", "لا يوجد ملف مرفوع لهذا المستند");
      return;
    }

    const canOpen = await Linking.canOpenURL(item.file_url);

    if (!canOpen) {
      Alert.alert("تنبيه", "تعذر فتح رابط الملف");
      return;
    }

    await Linking.openURL(item.file_url);
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
  }, [propertyIdParam]);

  const entityOptions = useMemo(() => {
    if (entityType === "property") return properties;
    if (entityType === "unit") return units;
    if (entityType === "tenant") return tenants;
    if (entityType === "contract") return contracts;
    return [];
  }, [entityType, properties, units, tenants, contracts]);

  const active = items.filter((item) => item.status === "active");
  const expiring = items.filter((item) => item.days_to_expiry !== null && item.days_to_expiry !== undefined && item.days_to_expiry <= 30);
  const expired = items.filter((item) => Number(item.days_to_expiry ?? 999999) < 0);

  const entityTypes = [
    { value: "property", label: "عقار" },
    { value: "unit", label: "وحدة" },
    { value: "tenant", label: "مستأجر" },
    { value: "contract", label: "عقد" },
    { value: "general", label: "عام" },
  ];

  const documentTypes = [
    { value: "official", label: "رسمي" },
    { value: "deed", label: "صك" },
    { value: "contract", label: "عقد" },
    { value: "id", label: "هوية" },
    { value: "bill", label: "فاتورة" },
    { value: "photo", label: "صورة" },
    { value: "video", label: "فيديو" },
    { value: "other", label: "أخرى" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => smartBack()}>
          <Text style={styles.backText}>→ رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>المستندات</Text>
        <Text style={styles.subtitle}>
          {isPropertyScoped
            ? `مستندات العقار: ${scopedPropertyName || `#${scopedPropertyId}`}`
            : "رفع وحفظ ملفات العقارات والوحدات والمستأجرين والعقود"}
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>المستندات النشطة: {active.length}</Text>
          <Text style={styles.summaryText}>قريبة الانتهاء: {expiring.length}</Text>
          <Text style={styles.summaryText}>منتهية: {expired.length}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setShowForm(!showForm)}>
          <Text style={styles.primaryButtonText}>
            {showForm ? "إغلاق نموذج الإضافة" : "إضافة مستند"}
          </Text>
        </TouchableOpacity>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>بيانات المستند</Text>

            <Text style={styles.label}>مرتبط بـ</Text>
            {isPropertyScoped ? (
              <View style={styles.scopedBox}>
                <Text style={styles.scopedText}>عقار: {scopedPropertyName || `#${scopedPropertyId}`}</Text>
              </View>
            ) : (
              <View style={styles.chips}>
                {entityTypes.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.chip, entityType === option.value ? styles.chipActive : null]}
                    onPress={() => {
                      setEntityType(option.value);
                      setEntityId(null);
                    }}
                  >
                    <Text style={[styles.chipText, entityType === option.value ? styles.chipTextActive : null]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {entityType !== "general" && !isPropertyScoped ? (
              <>
                <Text style={styles.label}>اختيار السجل</Text>
                <View style={styles.chips}>
                  {entityOptions.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.chip, entityId === option.id ? styles.chipActive : null]}
                      onPress={() => setEntityId(option.id)}
                    >
                      <Text style={[styles.chipText, entityId === option.id ? styles.chipTextActive : null]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="عنوان المستند"
              value={title}
              onChangeText={setTitle}
              textAlign="right"
            />

            <Text style={styles.label}>نوع المستند</Text>
            <View style={styles.chips}>
              {documentTypes.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, documentType === option.value ? styles.chipActive : null]}
                  onPress={() => setDocumentType(option.value)}
                >
                  <Text style={[styles.chipText, documentType === option.value ? styles.chipTextActive : null]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="تاريخ الإصدار YYYY-MM-DD اختياري"
              value={issueDate}
              onChangeText={setIssueDate}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="تاريخ الانتهاء YYYY-MM-DD اختياري"
              value={expiryDate}
              onChangeText={setExpiryDate}
              textAlign="right"
            />

            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="ملاحظات"
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlign="right"
            />

            <TouchableOpacity style={styles.fileButton} onPress={pickFile}>
              <Text style={styles.fileButtonText}>
                {pickedFile ? `الملف: ${pickedFile.name}` : "اختيار ملف للرفع"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveButton} onPress={saveDocument} disabled={saving}>
              <Text style={styles.saveButtonText}>
                {saving ? "جاري الحفظ..." : "حفظ المستند"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل المستندات...</Text>
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد مستندات حاليًا</Text>
          </View>
        ) : null}

        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <InlineEditDeleteActions resource="document_records" id={item.id} onChanged={load} />
            <View style={styles.rowBetween}>
              <Text style={[styles.expiryBadge, expiryStyle(item)]}>
                {expiryText(item)}
              </Text>
              <Text style={styles.cardTitle}>{item.title || "مستند"}</Text>
            </View>

            <Text style={styles.detail}>النوع: {documentTypeLabel(item.document_type)}</Text>
            <Text style={styles.detail}>مرتبط بـ: {entityLabel(item.entity_type)} — {item.entity_label || "-"}</Text>
            <Text style={styles.detail}>الحالة: {statusLabel(item.status)}</Text>
            <Text style={styles.detail}>الملف: {item.original_file_name || "-"}</Text>
            <Text style={styles.detail}>الإصدار: {item.issue_date || "-"}</Text>
            <Text style={styles.detail}>الانتهاء: {item.expiry_date || "-"}</Text>
            {item.notes ? <Text style={styles.notes}>ملاحظات: {item.notes}</Text> : null}

            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionButton, styles.openButton]} onPress={() => openFile(item)}>
                <Text style={styles.actionText}>فتح الملف</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.archiveButton]} onPress={() => updateStatus(item.id, "archived")}>
                <Text style={styles.actionText}>أرشفة</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.activeButton]} onPress={() => updateStatus(item.id, "active")}>
                <Text style={styles.actionText}>تنشيط</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 12, paddingBottom: 50 },
  backButton: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 4, marginBottom: 4 },
  backText: { color: "#111827", fontWeight: "800" },
  title: { fontSize: 30, fontWeight: "800", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", fontSize: 15, textAlign: "right", lineHeight: 22 },
  summaryBox: { backgroundColor: "#111827", borderRadius: 14, padding: 12, marginBottom: 9 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  primaryButton: { backgroundColor: "#0F9B6F", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 9 },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  formCard: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 9 },
  formTitle: { fontSize: 17, fontWeight: "800", color: "#111827", textAlign: "right", marginBottom: 8 },
  label: { color: "#374151", fontWeight: "800", textAlign: "right", marginBottom: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 8 },
  scopedBox: { backgroundColor: "#ecfeff", borderWidth: 1, borderColor: "#99f6e4", borderRadius: 12, padding: 12, marginBottom: 10 },
  scopedText: { color: "#0f766e", fontWeight: "800", textAlign: "right" },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  multilineInput: { minHeight: 70, textAlignVertical: "top" },
  fileButton: { backgroundColor: "#eff6ff", padding: 12, borderRadius: 12, alignItems: "center", marginBottom: 10 },
  fileButtonText: { color: "#065F44", fontWeight: "800", textAlign: "center" },
  saveButton: { backgroundColor: "#16a34a", padding: 13, borderRadius: 12, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "800" },
  box: { backgroundColor: "#fff", padding: 12, borderRadius: 14, alignItems: "center", marginBottom: 8 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  expiryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  expiryOk: { backgroundColor: "#dcfce7", color: "#166534" },
  expirySoon: { backgroundColor: "#fef3c7", color: "#92400e" },
  expiryExpired: { backgroundColor: "#fee2e2", color: "#991b1b" },
  expiryNeutral: { backgroundColor: "#f3f4f6", color: "#374151" },
  cardTitle: { fontSize: 17, fontWeight: "800", color: "#111827", textAlign: "right", flex: 1 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  notes: { marginTop: 10, color: "#92400e", fontWeight: "700", textAlign: "right" },
  actionsRow: { flexDirection: "row-reverse", marginTop: 14 },
  actionButton: { flex: 1, padding: 11, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  openButton: { backgroundColor: "#0F9B6F" },
  archiveButton: { backgroundColor: "#7A766F" },
  activeButton: { backgroundColor: "#16a34a" },
  actionText: { color: "#fff", fontWeight: "800" },
});
