import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiPostFormData } from '../lib/api';
import { colors, radii, spacing, typography } from '../constants/theme';

type DeedPropertyData = {
  name?: string | null;
  deed_number?: string | null;
  document_number?: string | null;
  document_date_hijri?: string | null;
  document_date_gregorian?: string | null;
  document_status?: string | null;
  document_restrictions?: string | null;
  previous_document_date_hijri?: string | null;
  previous_document_number?: string | null;
  operation_type?: string | null;
  deed_owner_identifier?: string | null;
  deed_owner_name?: string | null;
  deed_owner_nationality?: string | null;
  deed_ownership_percentage?: string | number | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  national_short_address?: string | null;
  property_area?: string | number | null;
  property_type?: string | null;
  usage_type?: string | null;
  management_type?: string | null;
  real_estate_identity_number?: string | null;
  deed_property_type_text?: string | null;
  deed_usage_text?: string | null;
  plot_number?: string | null;
  plan_number?: string | null;
  block_number?: string | null;
  deed_neighboring_part?: string | null;
  deed_location_text?: string | null;
  deed_property_model?: string | null;
  deed_mortgage_status?: string | null;
  deed_mortgagee_name?: string | null;
  deed_mortgagee_entity_number?: string | null;
  deed_mortgage_amount?: string | number | null;
  deed_mortgage_due_date?: string | null;
  deed_mortgage_notes?: string | null;
  deed_north_boundary_type?: string | null;
  deed_north_boundary_description?: string | null;
  deed_north_boundary_length?: string | number | null;
  deed_south_boundary_type?: string | null;
  deed_south_boundary_description?: string | null;
  deed_south_boundary_length?: string | number | null;
  deed_east_boundary_type?: string | null;
  deed_east_boundary_description?: string | null;
  deed_east_boundary_length?: string | number | null;
  deed_west_boundary_type?: string | null;
  deed_west_boundary_description?: string | null;
  deed_west_boundary_length?: string | number | null;
  floors_count?: string | number | null;
  parking_spots_count?: string | number | null;
  elevators_count?: string | number | null;
};

const emptyDeedForm: DeedPropertyData = {
  name: '', deed_number: '', document_date_hijri: '', document_status: '', document_restrictions: '', previous_document_date_hijri: '', previous_document_number: '', operation_type: '',
  deed_owner_identifier: '', deed_owner_name: '', deed_owner_nationality: '', deed_ownership_percentage: '',
  city: '', district: '', address: '', national_short_address: '', property_area: '', property_type: 'عمارة', usage_type: 'residential', management_type: 'managed',
  real_estate_identity_number: '', deed_property_type_text: '', deed_usage_text: '', plot_number: '', plan_number: '', block_number: '', deed_neighboring_part: '', deed_location_text: '', deed_property_model: '',
  deed_mortgage_status: '', deed_mortgagee_name: '', deed_mortgagee_entity_number: '', deed_mortgage_amount: '', deed_mortgage_due_date: '', deed_mortgage_notes: '',
  deed_north_boundary_type: '', deed_north_boundary_description: '', deed_north_boundary_length: '',
  deed_south_boundary_type: '', deed_south_boundary_description: '', deed_south_boundary_length: '',
  deed_east_boundary_type: '', deed_east_boundary_description: '', deed_east_boundary_length: '',
  deed_west_boundary_type: '', deed_west_boundary_description: '', deed_west_boundary_length: '',
  floors_count: '', parking_spots_count: '', elevators_count: '',
};

function freshEmptyDeedForm(): DeedPropertyData {
  return { ...emptyDeedForm };
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function decodeParam(value: string) {
  try { return decodeURIComponent(value || ''); } catch { return value || ''; }
}

function valueToString(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizePropertyTypeForForm(value: unknown) {
  const raw = valueToString(value).trim().toLowerCase();
  if (['apartment', 'unit', 'flat', 'شقة', 'وحدة', 'وحده'].includes(raw)) return 'وحدة';
  if (['land', 'أرض', 'ارض', 'قطعة أرض', 'قطعة الارض', 'قطعة الأرض'].includes(raw)) return 'أرض';
  if (['villa', 'فيلا'].includes(raw)) return 'فيلا';
  if (['commercial', 'تجاري'].includes(raw)) return 'تجاري';
  return 'عمارة';
}

function normalizePropertyTypeForApi(value: unknown) {
  const raw = valueToString(value).trim().toLowerCase();
  if (['وحدة', 'وحده', 'شقة', 'apartment', 'unit', 'flat'].includes(raw)) return 'apartment';
  if (['أرض', 'ارض', 'قطعة أرض', 'قطعة الارض', 'قطعة الأرض', 'land'].includes(raw)) return 'land';
  if (['فيلا', 'villa'].includes(raw)) return 'villa';
  if (['تجاري', 'commercial'].includes(raw)) return 'commercial';
  return 'building';
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline ? styles.multilineInput : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        textAlign="right"
        multiline={multiline}
      />
    </View>
  );
}

export default function UploadPropertyDeedScreen() {
  const params = useLocalSearchParams();
  const ownerId = firstParam(params.owner_id as string | string[] | undefined);
  const ownerName = decodeParam(firstParam(params.owner_name as string | string[] | undefined));

  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [extracted, setExtracted] = useState<DeedPropertyData | null>(null);
  const [createdPropertyId, setCreatedPropertyId] = useState<number | null>(null);
  const [form, setForm] = useState<DeedPropertyData>(() => freshEmptyDeedForm());

  const ownerLabel = useMemo(() => ownerName || (ownerId ? `مالك #${ownerId}` : 'سيتم اختيار المالك الافتراضي'), [ownerId, ownerName]);

  function resetDeedScreen(successMessage = '') {
    setSelectedFile(null);
    setExtracted(null);
    setCreatedPropertyId(null);
    setError('');
    setMessage(successMessage);
    setForm(freshEmptyDeedForm());
  }

  function setField(key: keyof DeedPropertyData, value: string) { setForm((previous) => ({ ...previous, [key]: value })); }

  async function pickFile() {
    setError(''); setMessage(''); setCreatedPropertyId(null); setExtracted(null); setForm(freshEmptyDeedForm());
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return;
    setSelectedFile(result.assets?.[0] || null);
  }

  function fillFormFromExtracted(property: DeedPropertyData) {
    setExtracted(property);
    setForm((previous) => ({
      ...previous,
      ...property,
      deed_number: valueToString(property.deed_number || property.document_number),
      property_type: normalizePropertyTypeForForm(property.property_type || property.deed_property_type_text),
    }));
  }

  function buildFormData(apply: boolean) {
    if (!selectedFile) throw new Error('اختر ملف الصك PDF أولًا');
    const formData = new FormData();
    formData.append('file', { uri: selectedFile.uri, name: selectedFile.name || 'property-deed.pdf', type: selectedFile.mimeType || 'application/pdf' } as any);
    if (ownerId) formData.append('owner_id', ownerId);
    if (apply) formData.append('apply', '1');
    if (apply) {
      Object.entries(form).forEach(([key, value]) => {
        const text = valueToString(value).trim();
        if (text === '') return;
        formData.append(key, key === 'property_type' ? normalizePropertyTypeForApi(text) : text);
      });
    }
    return formData;
  }

  async function extractOnly() {
    try {
      setLoading(true); setError(''); setMessage(''); setCreatedPropertyId(null);
      const json = await apiPostFormData('/property-deeds/extract', buildFormData(false));
      fillFormFromExtracted(json?.extracted_data?.property || {});
      setMessage(json?.message || 'تم قراءة الصك. راجع البيانات قبل الحفظ.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر قراءة الصك');
    } finally { setLoading(false); }
  }

  async function applyCreate() {
    if (!form.name || !String(form.name).trim()) { Alert.alert('تنبيه', 'راجع اسم العقار قبل الحفظ.'); return; }
    try {
      setLoading(true); setError(''); setMessage('');
      const json = await apiPostFormData('/property-deeds/extract', buildFormData(true));
      const propertyId = Number(json?.property?.id || 0);
      const successMessage = json?.message || 'تم إنشاء العقار من الصك.';
      resetDeedScreen(successMessage);
      setLoading(false);
      Alert.alert('تم', successMessage, [
        { text: 'عرض العقار', onPress: () => propertyId ? router.replace(`/property/${propertyId}` as any) : router.replace('/properties' as any) },
        { text: 'إضافة صك آخر', style: 'cancel' },
      ]);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر إنشاء العقار من الصك'); }
    finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}><Ionicons name="document-text-outline" size={28} color={colors.primary} /></View>
          <Text style={styles.title}>إضافة عقار عن طريق رفع الصك</Text>
          <Text style={styles.subtitle}>ارفع ملف الصك PDF، ثم راجع البيانات المستخرجة قبل إنشاء العقار.</Text>
          <Text style={styles.ownerText}>المالك: {ownerLabel}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>1) اختيار ملف الصك</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={pickFile} disabled={loading} activeOpacity={0.85}>
            <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
            <Text style={styles.uploadButtonText}>اختيار ملف PDF</Text>
          </TouchableOpacity>
          {selectedFile ? <View style={styles.fileBox}><Text style={styles.fileName} numberOfLines={1}>{selectedFile.name}</Text><Text style={styles.fileMeta}>جاهز للقراءة</Text></View> : <Text style={styles.hintText}>لم يتم اختيار ملف بعد.</Text>}
          <TouchableOpacity style={[styles.secondaryButton, !selectedFile || loading ? styles.disabled : null]} onPress={extractOnly} disabled={!selectedFile || loading} activeOpacity={0.85}>
            <Text style={styles.secondaryButtonText}>قراءة الصك ومراجعة البيانات</Text>
          </TouchableOpacity>
        </View>

        {extracted ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>2) مراجعة البيانات المستخرجة</Text>
            <Text style={styles.cardHint}>تظهر هنا بيانات الصك كاملة؛ ويمكن تعديلها قبل الاعتماد.</Text>

            <SectionTitle title="بيانات الوثيقة" />
            <Field label="اسم العقار" value={valueToString(form.name)} onChangeText={(v) => setField('name', v)} />
            <Field label="رقم الصك / الوثيقة" value={valueToString(form.deed_number)} onChangeText={(v) => setField('deed_number', v)} />
            <Field label="تاريخ الوثيقة" value={valueToString(form.document_date_hijri)} onChangeText={(v) => setField('document_date_hijri', v)} />
            <Field label="الحالة" value={valueToString(form.document_status)} onChangeText={(v) => setField('document_status', v)} />
            <Field label="القيود" value={valueToString(form.document_restrictions)} onChangeText={(v) => setField('document_restrictions', v)} />
            <Field label="تاريخ الوثيقة السابقة" value={valueToString(form.previous_document_date_hijri)} onChangeText={(v) => setField('previous_document_date_hijri', v)} />
            <Field label="رقم الوثيقة السابقة" value={valueToString(form.previous_document_number)} onChangeText={(v) => setField('previous_document_number', v)} />
            <Field label="نوع العملية" value={valueToString(form.operation_type)} onChangeText={(v) => setField('operation_type', v)} />

            <SectionTitle title="بيانات المالك" />
            <Field label="رقم هوية المالك" value={valueToString(form.deed_owner_identifier)} onChangeText={(v) => setField('deed_owner_identifier', v)} />
            <Field label="اسم المالك في الصك" value={valueToString(form.deed_owner_name)} onChangeText={(v) => setField('deed_owner_name', v)} />
            <Field label="الجنسية" value={valueToString(form.deed_owner_nationality)} onChangeText={(v) => setField('deed_owner_nationality', v)} />
            <Field label="نسبة التملك" value={valueToString(form.deed_ownership_percentage)} onChangeText={(v) => setField('deed_ownership_percentage', v)} keyboardType="decimal-pad" />

            <SectionTitle title="بيانات العقار" />
            <Field label="نوع العقار" value={valueToString(form.property_type)} onChangeText={(v) => setField('property_type', v)} />
            <Field label="نوع العقار كما في الصك" value={valueToString(form.deed_property_type_text)} onChangeText={(v) => setField('deed_property_type_text', v)} />
            <Field label="نوع الاستخدام" value={valueToString(form.deed_usage_text || form.usage_type)} onChangeText={(v) => setField('deed_usage_text', v)} />
            <Field label="مساحة العقار" value={valueToString(form.property_area)} onChangeText={(v) => setField('property_area', v)} keyboardType="decimal-pad" />
            <Field label="رقم الهوية العقارية" value={valueToString(form.real_estate_identity_number)} onChangeText={(v) => setField('real_estate_identity_number', v)} />
            <Field label="رقم القطعة" value={valueToString(form.plot_number)} onChangeText={(v) => setField('plot_number', v)} />
            <Field label="رقم المخطط" value={valueToString(form.plan_number)} onChangeText={(v) => setField('plan_number', v)} />
            <Field label="البلك" value={valueToString(form.block_number)} onChangeText={(v) => setField('block_number', v)} />
            <Field label="المجاورة / الجزء" value={valueToString(form.deed_neighboring_part)} onChangeText={(v) => setField('deed_neighboring_part', v)} />
            <Field label="الموقع" value={valueToString(form.deed_location_text)} onChangeText={(v) => setField('deed_location_text', v)} />
            <Field label="نموذج العقار" value={valueToString(form.deed_property_model)} onChangeText={(v) => setField('deed_property_model', v)} />
            <Field label="المدينة" value={valueToString(form.city)} onChangeText={(v) => setField('city', v)} />
            <Field label="الحي" value={valueToString(form.district)} onChangeText={(v) => setField('district', v)} />
            <Field label="العنوان" value={valueToString(form.address)} onChangeText={(v) => setField('address', v)} multiline />

            <SectionTitle title="بيانات الرهن / القيود المالية" />
            <Field label="حالة الرهن" value={valueToString(form.deed_mortgage_status)} onChangeText={(v) => setField('deed_mortgage_status', v)} />
            <Field label="الجهة المرتهنة" value={valueToString(form.deed_mortgagee_name)} onChangeText={(v) => setField('deed_mortgagee_name', v)} />
            <Field label="رقم المنشأة" value={valueToString(form.deed_mortgagee_entity_number)} onChangeText={(v) => setField('deed_mortgagee_entity_number', v)} />
            <Field label="قيمة الرهن" value={valueToString(form.deed_mortgage_amount)} onChangeText={(v) => setField('deed_mortgage_amount', v)} keyboardType="decimal-pad" />
            <Field label="تاريخ الاستحقاق" value={valueToString(form.deed_mortgage_due_date)} onChangeText={(v) => setField('deed_mortgage_due_date', v)} />
            <Field label="ملاحظات الرهن" value={valueToString(form.deed_mortgage_notes)} onChangeText={(v) => setField('deed_mortgage_notes', v)} multiline />

            <SectionTitle title="حدود العقار" />
            <BoundaryFields side="north" title="شمالًا" form={form} setField={setField} />
            <BoundaryFields side="south" title="جنوبًا" form={form} setField={setField} />
            <BoundaryFields side="east" title="شرقًا" form={form} setField={setField} />
            <BoundaryFields side="west" title="غربًا" form={form} setField={setField} />

            <SectionTitle title="بيانات تشغيلية" />
            <Field label="عدد الأدوار" value={valueToString(form.floors_count)} onChangeText={(v) => setField('floors_count', v)} keyboardType="number-pad" />
            <Field label="عدد المواقف" value={valueToString(form.parking_spots_count)} onChangeText={(v) => setField('parking_spots_count', v)} keyboardType="number-pad" />
            <Field label="عدد المصاعد" value={valueToString(form.elevators_count)} onChangeText={(v) => setField('elevators_count', v)} keyboardType="number-pad" />

            <TouchableOpacity style={[styles.saveButton, loading ? styles.disabled : null]} onPress={applyCreate} disabled={loading} activeOpacity={0.85}>
              <Text style={styles.saveButtonText}>اعتماد وإنشاء العقار</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? <View style={styles.loadingBox}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>جاري المعالجة...</Text></View> : null}
        {message ? <Text style={styles.successText}>{message}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function BoundaryFields({ side, title, form, setField }: { side: 'north' | 'south' | 'east' | 'west'; title: string; form: DeedPropertyData; setField: (key: keyof DeedPropertyData, value: string) => void }) {
  const typeKey = `deed_${side}_boundary_type` as keyof DeedPropertyData;
  const descKey = `deed_${side}_boundary_description` as keyof DeedPropertyData;
  const lenKey = `deed_${side}_boundary_length` as keyof DeedPropertyData;
  return (
    <View style={styles.boundaryBox}>
      <Text style={styles.boundaryTitle}>{title}</Text>
      <Field label="النوع" value={valueToString(form[typeKey])} onChangeText={(v) => setField(typeKey, v)} />
      <Field label="وصف الحد" value={valueToString(form[descKey])} onChangeText={(v) => setField(descKey, v)} />
      <Field label="الطول" value={valueToString(form[lenKey])} onChangeText={(v) => setField(lenKey, v)} keyboardType="decimal-pad" />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: 60 },
  heroCard: { backgroundColor: '#111827', borderRadius: radii['2xl'], padding: spacing.lg, alignItems: 'flex-end', marginBottom: spacing.md },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  title: { color: '#fff', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  subtitle: { color: '#d1d5db', fontWeight: '700', textAlign: 'right', lineHeight: 22, marginTop: 6 },
  ownerText: { color: '#a7f3d0', fontWeight: '900', textAlign: 'right', marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: radii.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  cardTitle: { ...typography.bodyBold, color: colors.text, textAlign: 'right', marginBottom: spacing.sm },
  cardHint: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.md },
  sectionTitle: { color: colors.primary, fontWeight: '900', textAlign: 'right', fontSize: 16, marginTop: 14, marginBottom: 8 },
  uploadButton: { backgroundColor: colors.primary, borderRadius: radii.md, padding: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 8 },
  uploadButtonText: { color: '#fff', fontWeight: '900' },
  secondaryButton: { backgroundColor: '#111827', borderRadius: radii.md, padding: 12, alignItems: 'center', marginTop: spacing.sm },
  secondaryButtonText: { color: '#fff', fontWeight: '900' },
  saveButton: { backgroundColor: '#16a34a', borderRadius: radii.md, padding: 13, alignItems: 'center', marginTop: spacing.sm },
  saveButtonText: { color: '#fff', fontWeight: '900' },
  openButton: { backgroundColor: '#0f766e', borderRadius: radii.md, padding: 12, alignItems: 'center', marginTop: spacing.sm },
  openButtonText: { color: '#fff', fontWeight: '900' },
  disabled: { opacity: 0.55 },
  fileBox: { backgroundColor: '#ecfdf5', borderRadius: radii.md, padding: spacing.md, marginTop: spacing.sm },
  fileName: { color: colors.text, fontWeight: '900', textAlign: 'right' },
  fileMeta: { color: colors.primary, fontWeight: '800', textAlign: 'right', marginTop: 4 },
  hintText: { color: colors.textSecondary, fontWeight: '700', textAlign: 'center', marginTop: spacing.sm },
  fieldBox: { marginBottom: spacing.sm },
  fieldLabel: { color: colors.textSecondary, fontWeight: '900', textAlign: 'right', marginBottom: 5 },
  input: { minHeight: 44, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, color: '#111827' },
  multilineInput: { minHeight: 82, textAlignVertical: 'top', paddingTop: 10 },
  boundaryBox: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  boundaryTitle: { textAlign: 'right', color: colors.text, fontWeight: '900', marginBottom: 6 },
  loadingBox: { alignItems: 'center', marginVertical: spacing.md },
  loadingText: { color: colors.textSecondary, fontWeight: '800', marginTop: 8 },
  successText: { color: '#166534', backgroundColor: '#dcfce7', padding: 12, borderRadius: 12, textAlign: 'right', fontWeight: '800' },
  errorText: { color: '#991b1b', backgroundColor: '#fee2e2', padding: 12, borderRadius: 12, textAlign: 'right', fontWeight: '800' },
});
