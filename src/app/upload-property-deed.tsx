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
  city?: string | null;
  district?: string | null;
  address?: string | null;
  national_short_address?: string | null;
  property_area?: string | number | null;
  property_type?: string | null;
  usage_type?: string | null;
  management_type?: string | null;
  floors_count?: string | number | null;
  parking_spots_count?: string | number | null;
  elevators_count?: string | number | null;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function decodeParam(value: string) {
  try {
    return decodeURIComponent(value || '');
  } catch {
    return value || '';
  }
}

function valueToString(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizePropertyTypeForForm(value: unknown) {
  const raw = valueToString(value).trim().toLowerCase();
  if (['apartment', 'unit', 'flat', 'شقة', 'وحدة', 'وحده'].includes(raw)) return 'وحدة';
  if (['land', 'أرض', 'ارض', 'قطعة أرض', 'قطعة الارض'].includes(raw)) return 'أرض';
  if (['villa', 'فيلا'].includes(raw)) return 'فيلا';
  if (['commercial', 'تجاري'].includes(raw)) return 'تجاري';
  return 'عمارة';
}

function normalizePropertyTypeForApi(value: unknown) {
  const raw = valueToString(value).trim().toLowerCase();
  if (['وحدة', 'وحده', 'شقة', 'apartment', 'unit', 'flat'].includes(raw)) return 'apartment';
  if (['أرض', 'ارض', 'قطعة أرض', 'قطعة الارض', 'land'].includes(raw)) return 'land';
  if (['فيلا', 'villa'].includes(raw)) return 'villa';
  if (['تجاري', 'commercial'].includes(raw)) return 'commercial';
  return 'building';
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
}) {
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        textAlign="right"
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
  const [form, setForm] = useState<DeedPropertyData>({
    name: '',
    deed_number: '',
    city: '',
    district: '',
    address: '',
    national_short_address: '',
    property_area: '',
    property_type: 'عمارة',
    usage_type: 'residential',
    management_type: 'managed',
    floors_count: '',
    parking_spots_count: '',
    elevators_count: '',
  });

  const ownerLabel = useMemo(() => ownerName || (ownerId ? `مالك #${ownerId}` : 'سيتم اختيار المالك الافتراضي'), [ownerId, ownerName]);

  function setField(key: keyof DeedPropertyData, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function pickFile() {
    setError('');
    setMessage('');
    setCreatedPropertyId(null);

    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;
    setSelectedFile(result.assets?.[0] || null);
    setExtracted(null);
  }

  function fillFormFromExtracted(property: DeedPropertyData) {
    setExtracted(property);
    setForm({
      name: valueToString(property.name),
      deed_number: valueToString(property.deed_number),
      city: valueToString(property.city),
      district: valueToString(property.district),
      address: valueToString(property.address),
      national_short_address: valueToString(property.national_short_address),
      property_area: valueToString(property.property_area),
      property_type: normalizePropertyTypeForForm(property.property_type),
      usage_type: valueToString(property.usage_type || 'residential'),
      management_type: valueToString(property.management_type || 'managed'),
      floors_count: valueToString(property.floors_count),
      parking_spots_count: valueToString(property.parking_spots_count),
      elevators_count: valueToString(property.elevators_count),
    });
  }

  function buildFormData(apply: boolean) {
    if (!selectedFile) {
      throw new Error('اختر ملف الصك PDF أولًا');
    }

    const formData = new FormData();
    formData.append('file', {
      uri: selectedFile.uri,
      name: selectedFile.name || 'property-deed.pdf',
      type: selectedFile.mimeType || 'application/pdf',
    } as any);

    if (ownerId) formData.append('owner_id', ownerId);
    if (apply) formData.append('apply', '1');

    // لا نرسل الحقول الافتراضية عند القراءة فقط حتى لا تغطي على بيانات الصك المستخرجة.
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
      setLoading(true);
      setError('');
      setMessage('');
      setCreatedPropertyId(null);

      const json = await apiPostFormData('/property-deeds/extract', buildFormData(false));
      const property = json?.extracted_data?.property || {};
      fillFormFromExtracted(property);
      setMessage(json?.message || 'تم قراءة الصك. راجع البيانات قبل الحفظ.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر قراءة الصك');
    } finally {
      setLoading(false);
    }
  }

  async function applyCreate() {
    if (!form.name || !String(form.name).trim()) {
      Alert.alert('تنبيه', 'راجع اسم العقار قبل الحفظ.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setMessage('');

      const json = await apiPostFormData('/property-deeds/extract', buildFormData(true));
      const propertyId = Number(json?.property?.id || 0);
      setCreatedPropertyId(propertyId || null);
      setMessage(json?.message || 'تم إنشاء العقار من الصك.');
      Alert.alert('تم', json?.message || 'تم إنشاء العقار من الصك.', [
        {
          text: 'عرض العقار',
          onPress: () => {
            if (propertyId) router.replace(`/property/${propertyId}` as any);
            else router.replace('/properties' as any);
          },
        },
        { text: 'البقاء هنا', style: 'cancel' },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إنشاء العقار من الصك');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="document-text-outline" size={28} color={colors.primary} />
          </View>
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

          {selectedFile ? (
            <View style={styles.fileBox}>
              <Text style={styles.fileName} numberOfLines={1}>{selectedFile.name}</Text>
              <Text style={styles.fileMeta}>جاهز للقراءة</Text>
            </View>
          ) : (
            <Text style={styles.hintText}>لم يتم اختيار ملف بعد.</Text>
          )}

          <TouchableOpacity
            style={[styles.secondaryButton, !selectedFile || loading ? styles.disabled : null]}
            onPress={extractOnly}
            disabled={!selectedFile || loading}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>قراءة الصك ومراجعة البيانات</Text>
          </TouchableOpacity>
        </View>

        {extracted ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>2) مراجعة البيانات المستخرجة</Text>
            <Text style={styles.cardHint}>إذا كان الصك يحتوي على كلمة شقة فسيتم تسجيله كوحدة مملوكة مباشرة للمالك.</Text>

            <Field label="اسم العقار" value={valueToString(form.name)} onChangeText={(value) => setField('name', value)} />
            <Field label="رقم الصك" value={valueToString(form.deed_number)} onChangeText={(value) => setField('deed_number', value)} />
            <Field label="المدينة" value={valueToString(form.city)} onChangeText={(value) => setField('city', value)} />
            <Field label="الحي" value={valueToString(form.district)} onChangeText={(value) => setField('district', value)} />
            <Field label="العنوان" value={valueToString(form.address)} onChangeText={(value) => setField('address', value)} />
            <Field label="العنوان الوطني المختصر" value={valueToString(form.national_short_address)} onChangeText={(value) => setField('national_short_address', value)} />
            <Field label="مساحة العقار" value={valueToString(form.property_area)} onChangeText={(value) => setField('property_area', value)} keyboardType="decimal-pad" />
            <Field label="نوع العقار" value={valueToString(form.property_type)} onChangeText={(value) => setField('property_type', value)} />
            <Field label="عدد الأدوار" value={valueToString(form.floors_count)} onChangeText={(value) => setField('floors_count', value)} keyboardType="number-pad" />
            <Field label="عدد المواقف" value={valueToString(form.parking_spots_count)} onChangeText={(value) => setField('parking_spots_count', value)} keyboardType="number-pad" />
            <Field label="عدد المصاعد" value={valueToString(form.elevators_count)} onChangeText={(value) => setField('elevators_count', value)} keyboardType="number-pad" />

            <TouchableOpacity
              style={[styles.saveButton, loading ? styles.disabled : null]}
              onPress={applyCreate}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.saveButtonText}>اعتماد وإنشاء العقار</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>جاري المعالجة...</Text>
          </View>
        ) : null}

        {message ? <Text style={styles.successText}>{message}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {createdPropertyId ? (
          <TouchableOpacity style={styles.openButton} onPress={() => router.replace(`/property/${createdPropertyId}` as any)}>
            <Text style={styles.openButtonText}>فتح العقار الجديد</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: 60 },
  heroCard: {
    backgroundColor: '#111827',
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { color: '#fff', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  subtitle: { color: '#d1d5db', fontWeight: '700', textAlign: 'right', lineHeight: 22, marginTop: 6 },
  ownerText: { color: '#a7f3d0', fontWeight: '900', textAlign: 'right', marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardTitle: { ...typography.bodyBold, color: colors.text, textAlign: 'right', marginBottom: spacing.sm },
  cardHint: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.md },
  uploadButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
  },
  uploadButtonText: { color: '#fff', fontWeight: '900' },
  secondaryButton: {
    backgroundColor: '#111827',
    borderRadius: radii.md,
    padding: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryButtonText: { color: '#fff', fontWeight: '900' },
  saveButton: {
    backgroundColor: '#16a34a',
    borderRadius: radii.md,
    padding: 13,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonText: { color: '#fff', fontWeight: '900' },
  openButton: {
    backgroundColor: '#0f766e',
    borderRadius: radii.md,
    padding: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  openButtonText: { color: '#fff', fontWeight: '900' },
  disabled: { opacity: 0.55 },
  fileBox: { backgroundColor: '#ecfdf5', borderRadius: radii.md, padding: spacing.md, marginTop: spacing.sm },
  fileName: { color: colors.text, fontWeight: '900', textAlign: 'right' },
  fileMeta: { color: colors.primary, fontWeight: '800', textAlign: 'right', marginTop: 4 },
  hintText: { color: colors.textSecondary, fontWeight: '700', textAlign: 'center', marginTop: spacing.sm },
  fieldBox: { marginBottom: spacing.sm },
  fieldLabel: { color: colors.textSecondary, fontWeight: '900', textAlign: 'right', marginBottom: 5 },
  input: {
    minHeight: 44,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#111827',
  },
  loadingBox: { alignItems: 'center', marginVertical: spacing.md },
  loadingText: { color: colors.textSecondary, fontWeight: '800', marginTop: 8 },
  successText: { color: '#166534', backgroundColor: '#dcfce7', padding: 12, borderRadius: 12, textAlign: 'right', fontWeight: '800' },
  errorText: { color: '#991b1b', backgroundColor: '#fee2e2', padding: 12, borderRadius: 12, textAlign: 'right', fontWeight: '800' },
});
