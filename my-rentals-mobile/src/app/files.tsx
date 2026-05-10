import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { apiGet, apiPostFormData } from "../lib/api";

import { smartBack } from "@/lib/navigationHistory";
function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

type Property = {
  id: number;
  name?: string | null;
  owner?: { id?: number; name?: string | null } | null;
};

type Unit = {
  id: number;
  unit_number?: string | null;
  property?: Property | null;
};

type PropertyFile = {
  id: number;
  file_name?: string | null;
  file_type?: string | null;
  category?: string | null;
  notes?: string | null;
  property?: Property | null;
};

type UnitMedia = {
  id: number;
  file_name?: string | null;
  file_type?: string | null;
  media_type?: string | null;
  notes?: string | null;
  unit?: Unit | null;
};

type FilesMode = "all" | "property-file" | "media";

export default function FilesScreen() {
  const params = useLocalSearchParams();
  const ownerId = firstParam(params.owner_id as string | string[] | undefined);
  const ownerName = firstParam(params.owner_name as string | string[] | undefined);
  const propertyId = firstParam(params.property_id as string | string[] | undefined);
  const propertyName = firstParam(params.property_name as string | string[] | undefined);
  const decodedPropertyName = propertyName ? decodeURIComponent(propertyName) : "";
  const unitId = firstParam(params.unit_id as string | string[] | undefined);
  const unitName = firstParam(params.unit_name as string | string[] | undefined);
  const decodedUnitName = unitName ? decodeURIComponent(unitName) : "";
  const modeParam = firstParam(params.mode as string | string[] | undefined) as FilesMode;
  const mode: FilesMode = modeParam === "property-file" || modeParam === "media" ? modeParam : "all";

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [propertyFiles, setPropertyFiles] = useState<PropertyFile[]>([]);
  const [unitMedia, setUnitMedia] = useState<UnitMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [propertyNotes, setPropertyNotes] = useState("");
  const [mediaNotes, setMediaNotes] = useState("");
  const [propertyCategory, setPropertyCategory] = useState("official");
  const [mediaType, setMediaType] = useState("photo");

  const querySuffix = useMemo(() => {
    const searchParams = new URLSearchParams();
    if (ownerId) searchParams.set("owner_id", ownerId);
    if (propertyId) searchParams.set("property_id", propertyId);
    if (unitId) searchParams.set("unit_id", unitId);
    const text = searchParams.toString();
    return text ? `?${text}` : "";
  }, [ownerId, propertyId, unitId]);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const [propertiesResult, unitsResult, propertyFilesResult, unitMediaResult] = await Promise.all([
        apiGet(`/properties${querySuffix}`),
        apiGet(`/units${querySuffix}`),
        apiGet(`/property-files${querySuffix}`),
        apiGet(`/unit-media${querySuffix}`),
      ]);

      const propertyList = Array.isArray(propertiesResult) ? propertiesResult : [];
      const unitList = Array.isArray(unitsResult) ? unitsResult : [];

      setProperties(propertyList);
      setUnits(unitList);
      setPropertyFiles(Array.isArray(propertyFilesResult) ? propertyFilesResult : []);
      setUnitMedia(Array.isArray(unitMediaResult) ? unitMediaResult : []);

      if (propertyId) {
        setSelectedPropertyId(Number(propertyId));
      } else if (!selectedPropertyId && propertyList.length > 0) {
        setSelectedPropertyId(propertyList[0].id);
      }

      if (unitId) {
        setSelectedUnitId(Number(unitId));
      } else if (!selectedUnitId && unitList.length > 0) {
        setSelectedUnitId(unitList[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير معروف");
    } finally {
      setLoading(false);
    }
  }

  async function pickAndUploadPropertyFile() {
    if (!selectedPropertyId) {
      Alert.alert("تنبيه", "اختر العقار أولًا");
      return;
    }

    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (picked.canceled) return;

    const file = picked.assets?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const form = new FormData();
      if (ownerId) form.append("owner_id", ownerId);
      form.append("property_id", String(selectedPropertyId));
      form.append("category", propertyCategory);
      form.append("notes", propertyNotes);
      form.append("file", {
        uri: file.uri,
        name: file.name || "property-file",
        type: file.mimeType || "application/octet-stream",
      } as any);

      const json = await apiPostFormData("/property-files", form);

      setPropertyNotes("");
      Alert.alert("تم", json.message || "تم رفع الملف");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر رفع الملف");
    } finally {
      setUploading(false);
    }
  }

  async function pickAndUploadUnitMedia() {
    const targetUnitId = selectedUnitId || (unitId ? Number(unitId) : null);
    if (!targetUnitId) {
      Alert.alert("تنبيه", "اختر الوحدة أولًا");
      return;
    }

    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (picked.canceled) return;

    const file = picked.assets?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const form = new FormData();
      if (ownerId) form.append("owner_id", ownerId);
      form.append("unit_id", String(targetUnitId));
      form.append("media_type", mediaType);
      form.append("notes", mediaNotes);
      form.append("file", {
        uri: file.uri,
        name: file.name || "unit-media",
        type: file.mimeType || "application/octet-stream",
      } as any);

      const json = await apiPostFormData("/unit-media", form);

      setMediaNotes("");
      Alert.alert("تم", json.message || "تم رفع الوسائط");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر رفع الوسائط");
    } finally {
      setUploading(false);
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
  }, [querySuffix]);

  const showPropertyFiles = mode === "all" || mode === "property-file";
  const showMedia = mode === "all" || mode === "media";
  const scopedTitle = unitId
    ? `خاصة بالوحدة: ${decodedUnitName || `#${unitId}`}`
    : propertyId
      ? `خاصة بالعقار: ${decodedPropertyName || `#${propertyId}`}`
      : ownerId
        ? `خاصة بالمالك: ${ownerName || `#${ownerId}`}`
        : "رفع ملفات العقار الرسمية وصور أو فيديوهات الوحدات";
  const hasSelectedUnit = Boolean(selectedUnitId || unitId);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => smartBack()} style={styles.backButton}>
            <Text style={styles.backText}>→ رجوع</Text>
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>الملفات والوسائط</Text>
            <Text style={styles.subtitle}>{scopedTitle}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل البيانات...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>تعذر تحميل البيانات</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!loading && !error && (ownerId || propertyId) && properties.length === 0 && units.length === 0 ? (
          <View style={styles.emptyScopeBox}>
            <Text style={styles.emptyScopeTitle}>لا توجد بيانات متاحة</Text>
            <Text style={styles.emptyScopeText}>أضف عقارًا أو وحدة قبل رفع الملفات أو الصور والفيديو.</Text>
          </View>
        ) : null}

        {showPropertyFiles ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>رفع ملف رسمي للعقار</Text>
            <Text style={styles.label}>اختر العقار</Text>
            {propertyId ? (
              <View style={styles.scopedBox}>
                <Text style={styles.scopedText}>{decodedPropertyName || `عقار #${propertyId}`}</Text>
              </View>
            ) : (
              <View style={styles.chips}>
                {properties.map((property) => (
                  <TouchableOpacity
                    key={property.id}
                    style={[styles.chip, selectedPropertyId === property.id ? styles.chipActive : null]}
                    onPress={() => setSelectedPropertyId(property.id)}
                  >
                    <Text style={[styles.chipText, selectedPropertyId === property.id ? styles.chipTextActive : null]}>
                      {property.name || "عقار"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {!properties.length && !propertyId ? <Text style={styles.emptyText}>لا توجد عقارات متاحة للاختيار</Text> : null}

            <Text style={styles.label}>نوع الملف</Text>
            <View style={styles.chips}>
              {[
                ["official", "رسمي"],
                ["deed", "صك"],
                ["maintenance", "صيانة"],
                ["other", "أخرى"],
              ].map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, propertyCategory === value ? styles.chipActive : null]}
                  onPress={() => setPropertyCategory(value)}
                >
                  <Text style={[styles.chipText, propertyCategory === value ? styles.chipTextActive : null]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="ملاحظات الملف"
              value={propertyNotes}
              onChangeText={setPropertyNotes}
              textAlign="right"
            />

            <TouchableOpacity
              style={[styles.saveButton, !properties.length || uploading ? styles.saveButtonDisabled : null]}
              onPress={pickAndUploadPropertyFile}
              disabled={!properties.length || uploading}
            >
              <Text style={styles.saveButtonText}>{uploading ? "جاري الرفع..." : "اختيار ورفع ملف عقار"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {showMedia ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>رفع صور أو فيديو للوحدة</Text>
            {propertyId ? <Text style={styles.scopeHint}>تظهر هنا وحدات هذا العقار فقط.</Text> : null}
            <Text style={styles.label}>اختر الوحدة</Text>
            {unitId ? (
              <View style={styles.scopedBox}>
                <Text style={styles.scopedText}>{decodedUnitName || `وحدة #${unitId}`}</Text>
              </View>
            ) : (
              <>
                <View style={styles.chips}>
                  {units.map((unit) => (
                    <TouchableOpacity
                      key={unit.id}
                      style={[styles.chip, selectedUnitId === unit.id ? styles.chipActive : null]}
                      onPress={() => setSelectedUnitId(unit.id)}
                    >
                      <Text style={[styles.chipText, selectedUnitId === unit.id ? styles.chipTextActive : null]}>
                        {unit.property?.name || "عقار"} - {unit.unit_number || "وحدة"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!units.length ? <Text style={styles.emptyText}>لا توجد وحدات متاحة للاختيار</Text> : null}
              </>
            )}

            <Text style={styles.label}>نوع الوسائط</Text>
            <View style={styles.chips}>
              {[
                ["photo", "صورة"],
                ["video", "فيديو"],
                ["other", "أخرى"],
              ].map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, mediaType === value ? styles.chipActive : null]}
                  onPress={() => setMediaType(value)}
                >
                  <Text style={[styles.chipText, mediaType === value ? styles.chipTextActive : null]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="ملاحظات الوسائط"
              value={mediaNotes}
              onChangeText={setMediaNotes}
              textAlign="right"
            />

            <TouchableOpacity
              style={[styles.saveButton, !hasSelectedUnit || uploading ? styles.saveButtonDisabled : null]}
              onPress={pickAndUploadUnitMedia}
              disabled={!hasSelectedUnit || uploading}
            >
              <Text style={styles.saveButtonText}>{uploading ? "جاري الرفع..." : "اختيار ورفع وسائط وحدة"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {showPropertyFiles ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ملفات العقارات</Text>
            {propertyFiles.length === 0 ? <Text style={styles.emptyText}>لا توجد ملفات عقارات</Text> : null}
            {propertyFiles.map((file) => (
              <View key={file.id} style={styles.item}>
                <Text style={styles.itemTitle}>{file.file_name || "ملف"}</Text>
                <Text style={styles.detail}>العقار: {file.property?.name || "-"}</Text>
                <Text style={styles.detail}>المالك: {file.property?.owner?.name || ownerName || "-"}</Text>
                <Text style={styles.detail}>النوع: {file.category || "-"}</Text>
                <Text style={styles.detail}>الصيغة: {file.file_type || "-"}</Text>
                {file.notes ? <Text style={styles.notes}>ملاحظات: {file.notes}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {showMedia ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>وسائط الوحدات</Text>
            {unitMedia.length === 0 ? <Text style={styles.emptyText}>لا توجد وسائط وحدات</Text> : null}
            {unitMedia.map((media) => (
              <View key={media.id} style={styles.item}>
                <Text style={styles.itemTitle}>{media.file_name || "وسائط"}</Text>
                <Text style={styles.detail}>الوحدة: {media.unit?.unit_number || "-"}</Text>
                <Text style={styles.detail}>العقار: {media.unit?.property?.name || "-"}</Text>
                <Text style={styles.detail}>المالك: {media.unit?.property?.owner?.name || ownerName || "-"}</Text>
                <Text style={styles.detail}>النوع: {media.media_type || "-"}</Text>
                <Text style={styles.detail}>الصيغة: {media.file_type || "-"}</Text>
                {media.notes ? <Text style={styles.notes}>ملاحظات: {media.notes}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 14, paddingBottom: 40 },
  topBar: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  backButton: { backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#DDDBD6" },
  backText: { color: "#111827", fontWeight: "900" },
  titleWrap: { flex: 1 },
  title: { fontSize: 28, fontWeight: "900", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 6, marginBottom: 4, fontSize: 15, color: "#7A766F", textAlign: "right", lineHeight: 23 },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  errorBox: { backgroundColor: "#fee2e2", padding: 16, borderRadius: 18, marginBottom: 14 },
  errorTitle: { color: "#991b1b", fontSize: 18, fontWeight: "900", textAlign: "right" },
  errorText: { color: "#7f1d1d", marginTop: 8, textAlign: "right" },
  emptyScopeBox: { backgroundColor: "#fff7ed", borderRadius: 18, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#fed7aa" },
  emptyScopeTitle: { color: "#9a3412", fontWeight: "900", textAlign: "right", marginBottom: 6 },
  emptyScopeText: { color: "#c2410c", fontWeight: "700", textAlign: "right", lineHeight: 22 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 20, fontWeight: "900", color: "#111827", textAlign: "right", marginBottom: 12 },
  label: { color: "#374151", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 12 },
  scopedBox: { backgroundColor: "#ecfeff", borderWidth: 1, borderColor: "#99f6e4", borderRadius: 12, padding: 12, marginBottom: 10 },
  scopedText: { color: "#0f766e", fontWeight: "900", textAlign: "right" },
  scopeHint: { color: "#0f766e", fontWeight: "800", textAlign: "right", marginBottom: 10 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "800" },
  chipTextActive: { color: "#fff" },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  saveButton: { backgroundColor: "#16a34a", padding: 13, borderRadius: 12, alignItems: "center" },
  saveButtonDisabled: { backgroundColor: "#9ca3af" },
  saveButtonText: { color: "#fff", fontWeight: "900" },
  item: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginBottom: 10 },
  itemTitle: { color: "#111827", fontWeight: "900", textAlign: "right" },
  detail: { marginTop: 7, color: "#5E5B55", textAlign: "right", fontWeight: "700" },
  notes: { marginTop: 8, color: "#92400e", fontWeight: "800", textAlign: "right" },
  emptyText: { color: "#7A766F", textAlign: "center", marginBottom: 8, fontWeight: "700" },
});
