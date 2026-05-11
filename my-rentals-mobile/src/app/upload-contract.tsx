import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiPostFormData } from '../lib/api';
import { smartBack } from '../lib/navigationHistory';
import { colors, radii, shadows, spacing, typography, money as formatMoney } from '../constants/theme';
import { MetaPill, Notice, ScreenHero, Stepper } from '../components/ui/phase3';

type PaymentScheduleRow = {
  sequence?: number | string;
  due_date?: string | null;
  payment_deadline?: string | null;
  due_date_hijri?: string | null;
  payment_deadline_hijri?: string | null;
  rental_period_days?: number | string | null;
  amount?: number | string | null;
  source?: string | null;
};

type ExtractedData = {
  contract?: Record<string, any>;
  tenant?: Record<string, any>;
  lessor?: Record<string, any>;
  property?: Record<string, any>;
  unit?: Record<string, any>;
  financial?: Record<string, any>;
  payments?: PaymentScheduleRow[];
  payments_source?: string;
  payments_count_from_schedule?: number;
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

function stripBidi(value: string) {
  return String(value || '')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function reverseText(value: string) {
  return Array.from(value).reverse().join('');
}

function hasArabic(value: string) {
  return /[\u0600-\u06FF]/.test(value);
}

function mostlyNumericOrDate(value: string) {
  const compact = value.replace(/\s/g, '');
  if (!compact) return false;
  const numericLike = compact.replace(/[0-9٠-٩.,:/\-+]/g, '');
  return numericLike.length === 0;
}

function normalizeExtractedArabic(value: any) {
  const raw = stripBidi(displayRaw(value, ''));
  if (!raw) return '';
  if (!hasArabic(raw) || mostlyNumericOrDate(raw)) return raw;

  const reversedMarkers = [
    'دنه',
    'هيجو',
    'زيمق',
    'زيمقل',
    'ةدج',
    'دقع',
    'دوقع',
    'ةقش',
    'يراجيإ',
    'يعبر',
    'يرهش',
    'يونس',
  ];
  const forwardMarkers = [
    'مهند',
    'وجيه',
    'القميز',
    'جدة',
    'عقد',
    'شقة',
    'شهري',
    'سنوي',
    'ربع',
    'إيجار',
  ];

  const hasReversedMarker = reversedMarkers.some((marker) => raw.includes(marker));
  const hasForwardMarker = forwardMarkers.some((marker) => raw.includes(marker));

  if (hasReversedMarker && !hasForwardMarker) return stripBidi(reverseText(raw));

  const arabicLetters = raw.match(/[\u0600-\u06FF]/g)?.length || 0;
  const latinLetters = raw.match(/[A-Za-z]/g)?.length || 0;
  const digitCount = raw.match(/[0-9٠-٩]/g)?.length || 0;

  if (arabicLetters >= 3 && latinLetters === 0 && digitCount === 0 && !hasForwardMarker) {
    return stripBidi(reverseText(raw));
  }

  return raw;
}

function displayRaw(value: any, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function display(value: any, fallback = '-') {
  const raw = displayRaw(value, fallback);
  if (raw === fallback) return fallback;
  return normalizeExtractedArabic(raw) || fallback;
}

function money(value: any) {
  const numeric = Number(String(value ?? '').replace(/,/g, '') || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return '-';
  return formatMoney(numeric);
}

function cleanCycleText(value: any) {
  return displayRaw(value)
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cycleLabel(value: any) {
  const raw = cleanCycleText(value);
  const reversed = reverseText(raw);
  const both = `${raw} ${reversed}`.toLowerCase();

  if (value === 'quarterly') return 'ربع سنوي';
  if (value === 'monthly') return 'شهري';
  if (value === 'semi_annual') return 'نصف سنوي';
  if (value === 'annual') return 'سنوي';

  if (both.includes('quarter') || both.includes('ربعي') || both.includes('ربع سنوي') || both.includes('يعبر')) {
    return 'ربع سنوي';
  }

  if (both.includes('monthly') || both.includes('شهري') || both.includes('يرهش')) {
    return 'شهري';
  }

  if (both.includes('semi') || both.includes('نصف سنوي') || both.includes('يونس فصن')) {
    return 'نصف سنوي';
  }

  if (both.includes('annual') || both.includes('سنوي') || both.includes('يونس')) {
    return 'سنوي';
  }

  return normalizeExtractedArabic(raw) || '-';
}

function scheduleSourceLabel(source?: string) {
  if (source === 'official_ejar_schedule') return 'جدول PDF الرسمي';
  if (!source) return 'غير محدد';
  return source;
}

function paymentRowsFromExtracted(extracted: ExtractedData | null): PaymentScheduleRow[] {
  if (!Array.isArray(extracted?.payments)) return [];
  return extracted.payments
    .filter((item) => item && (item.due_date || item.payment_deadline || item.amount))
    .map((item, index) => ({ ...item, sequence: item.sequence || index + 1 }));
}

function InfoRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  const isMissing = value === '-';
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoValue, warning || isMissing ? styles.infoValueWarning : null]} numberOfLines={2}>{value}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

function PreviewCard({ title, icon, children }: { title: string; icon: any; children: ReactNode }) {
  return (
    <View style={styles.previewCard}>
      <View style={styles.previewHeader}>
        <View style={styles.previewIcon}><Ionicons name={icon} size={17} color={colors.primaryDark} /></View>
        <Text style={styles.previewTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function PaymentScheduleCard({ rows, source }: { rows: PaymentScheduleRow[]; source?: string }) {
  const total = rows.reduce((sum, row) => {
    const value = Number(String(row.amount ?? '').replace(/,/g, ''));
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  return (
    <PreviewCard title="جدول الدفعات من ملف PDF" icon="calendar-outline">
      <Notice
        tone="info"
        icon="information-circle-outline"
        message="سيتم اعتماد تواريخ الاستحقاق ونهاية مهلة السداد كما تظهر هنا في قاعدة البيانات عند الضغط على اعتماد وحفظ."
        style={styles.scheduleNotice}
      />

      <View style={styles.scheduleSummaryRow}>
        <MetaPill label="المصدر" value={scheduleSourceLabel(source || rows[0]?.source || '')} />
        <MetaPill label="عدد الدفعات" value={`${rows.length}`} />
        <MetaPill label="الإجمالي" value={money(total)} />
      </View>

      {rows.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scheduleScrollContent}>
          <View style={styles.scheduleTable}>
            <View style={[styles.scheduleRow, styles.scheduleHeaderRow]}>
              <Text style={[styles.scheduleCell, styles.scheduleSeqCell, styles.scheduleHeaderText]}>#</Text>
              <Text style={[styles.scheduleCell, styles.scheduleDateCell, styles.scheduleHeaderText]}>تاريخ الاستحقاق</Text>
              <Text style={[styles.scheduleCell, styles.scheduleDateCell, styles.scheduleHeaderText]}>نهاية مهلة السداد</Text>
              <Text style={[styles.scheduleCell, styles.scheduleHijriCell, styles.scheduleHeaderText]}>الاستحقاق هـ</Text>
              <Text style={[styles.scheduleCell, styles.scheduleHijriCell, styles.scheduleHeaderText]}>نهاية المهلة هـ</Text>
              <Text style={[styles.scheduleCell, styles.schedulePeriodCell, styles.scheduleHeaderText]}>الفترة</Text>
              <Text style={[styles.scheduleCell, styles.scheduleAmountCell, styles.scheduleHeaderText]}>المبلغ</Text>
            </View>

            {rows.map((row, index) => (
              <View key={`${row.sequence || index}-${row.due_date || index}`} style={styles.scheduleRow}>
                <Text style={[styles.scheduleCell, styles.scheduleSeqCell]}>{display(row.sequence || index + 1)}</Text>
                <Text style={[styles.scheduleCell, styles.scheduleDateCell, styles.strongScheduleCell]}>{display(row.due_date)}</Text>
                <Text style={[styles.scheduleCell, styles.scheduleDateCell]}>{display(row.payment_deadline)}</Text>
                <Text style={[styles.scheduleCell, styles.scheduleHijriCell]}>{display(row.due_date_hijri)}</Text>
                <Text style={[styles.scheduleCell, styles.scheduleHijriCell]}>{display(row.payment_deadline_hijri)}</Text>
                <Text style={[styles.scheduleCell, styles.schedulePeriodCell]}>{row.rental_period_days ? `${row.rental_period_days} يوم` : '-'}</Text>
                <Text style={[styles.scheduleCell, styles.scheduleAmountCell, styles.strongScheduleCell]}>{money(row.amount)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <Notice tone="warning" icon="warning-outline" message="لم يتم العثور على جدول الدفعات داخل ملف PDF. لن يتم الاعتماد إلا بعد ظهور الجدول هنا أو ستحتاج مراجعة الدفعات يدويًا." />
      )}
    </PreviewCard>
  );
}

export default function UploadContractScreen() {
  const params = useLocalSearchParams();
  const ownerId = firstParam(params.owner_id as string | string[] | undefined);
  const ownerName = decodeParam(firstParam(params.owner_name as string | string[] | undefined));
  const propertyId = firstParam(params.property_id as string | string[] | undefined);
  const propertyName = decodeParam(firstParam(params.property_name as string | string[] | undefined));
  const unitId = firstParam(params.unit_id as string | string[] | undefined);
  const unitName = decodeParam(firstParam(params.unit_name as string | string[] | undefined));
  const contractScope = firstParam((params.contract_scope || params.target_type) as string | string[] | undefined) === 'property' ? 'property' : 'unit';
  const isPropertyContract = contractScope === 'property';

  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [lastImportResult, setLastImportResult] = useState<any>(null);

  const contextItems = useMemo(() => [
    { label: 'المالك', value: ownerName || (ownerId ? `مالك #${ownerId}` : 'يتم أخذه من العقد') },
    { label: 'العقار', value: propertyName || (propertyId ? `عقار #${propertyId}` : 'يتم أخذه من العقد') },
    { label: 'نطاق العقد', value: isPropertyContract ? 'العقار كامل' : (unitName || (unitId ? `وحدة #${unitId}` : 'يتم أخذها من العقد')) },
  ], [ownerName, ownerId, propertyName, propertyId, unitName, unitId, isPropertyContract]);

  function returnToPreviousScreen() {
    smartBack('/contracts');
  }

  async function pickFile() {
    setError('');
    setMessage('');
    setExtracted(null);
    setLastImportResult(null);

    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;
    setSelectedFile(result.assets?.[0] || null);
  }

  async function upload(apply: boolean) {
    if (!selectedFile) {
      setError('اختر ملف PDF أولًا');
      return;
    }

    if (apply && isPropertyContract && !propertyId) {
      setError('يجب تحديد العقار عند رفع عقد على العقار بالكامل.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setMessage('');

      const formData = new FormData();
      formData.append('file', {
        uri: selectedFile.uri,
        name: selectedFile.name || 'contract.pdf',
        type: selectedFile.mimeType || 'application/pdf',
      } as any);

      if (ownerId) formData.append('owner_id', ownerId);
      if (propertyId) formData.append('property_id', propertyId);
      if (!isPropertyContract && unitId) formData.append('unit_id', unitId);
      formData.append('contract_scope', contractScope);
      formData.append('target_type', contractScope);
      if (apply) formData.append('apply', '1');

      const json = await apiPostFormData('/contract-files/extract', formData);
      const extractedData = json.extracted_data || null;
      const rows = paymentRowsFromExtracted(extractedData);

      setExtracted(extractedData);
      setLastImportResult(json.import_result || null);
      setMessage(json.message || 'تم رفع العقد واستخراج البيانات');

      if (apply) {
        Alert.alert(
          'تم',
          rows.length
            ? `${json.message || 'تم استخراج العقد وحفظ بياناته'}\n\nتم اعتماد ${rows.length} دفعات من جدول PDF الرسمي وتسجيل تواريخ الاستحقاق كما هي.`
            : `${json.message || 'تم استخراج العقد وحفظ بياناته'}\n\nتنبيه: لم يظهر جدول دفعات مقروء من PDF، راجع الدفعات يدويًا.`,
          [{ text: 'موافق', onPress: returnToPreviousScreen }],
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ غير معروف');
    } finally {
      setLoading(false);
    }
  }

  const contract = extracted?.contract || {};
  const tenant = extracted?.tenant || {};
  const financial = extracted?.financial || {};
  const unit = extracted?.unit || {};
  const paymentRows = paymentRowsFromExtracted(extracted);
  const paymentsCount = paymentRows.length;
  const currentStep = lastImportResult ? 2 : extracted ? 1 : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ScreenHero
          eyebrow="استيراد ذكي"
          title="رفع عقد إيجار ومراجعة البيانات"
          subtitle="اختر الملف، راجع البيانات المستخرجة، ثم اعتمد الحفظ عند التأكد."
          icon="cloud-upload-outline"
          tone="primary"
        />

        <Stepper steps={['اختيار الملف', 'مراجعة البيانات', 'اعتماد وحفظ']} current={currentStep} />

        <View style={styles.contextCard}>
          {contextItems.map((item) => (
            <MetaPill key={item.label} label={item.label} value={item.value} />
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardIcon}><Ionicons name="document-attach-outline" size={20} color={colors.primaryDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>ملف العقد</Text>
              <Text style={styles.cardSubtitle}>يدعم ملفات PDF الصادرة من إيجار أو العقود الحكومية المماثلة.</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.selectButton} onPress={pickFile} disabled={loading} activeOpacity={0.85}>
            <Ionicons name="document-attach-outline" size={20} color={colors.textInverse} />
            <Text style={styles.selectButtonText}>اختيار ملف PDF</Text>
          </TouchableOpacity>

          {selectedFile ? (
            <View style={styles.fileBox}>
              <Ionicons name="document-text-outline" size={22} color={colors.primaryDark} />
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>{selectedFile.name}</Text>
                <Text style={styles.fileMeta}>جاهز للاستخراج والمراجعة</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyFileBox}>
              <Text style={styles.hint}>لم يتم اختيار ملف بعد</Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.previewButton, loading ? styles.disabledButton : null]}
              onPress={() => upload(false)}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.actionButtonText}>استخراج للمراجعة</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.applyButton, loading ? styles.disabledButton : null]}
              onPress={() => upload(true)}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.actionButtonText}>اعتماد وحفظ</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>جاري رفع العقد وقراءة البيانات...</Text>
            </View>
          ) : null}

          {message ? <Notice tone="success" icon="checkmark-circle-outline" message={message} style={styles.noticeSpacing} /> : null}
          {error ? <Notice tone="danger" icon="warning-outline" title="حدث خطأ" message={error} style={styles.noticeSpacing} /> : null}
        </View>

        {extracted ? (
          <View style={styles.previewWrap}>
            <Notice
              icon="sparkles-outline"
              tone="info"
              message="راجع الحقول التالية قبل الاعتماد. الحقول التي تظهر بعلامة - تحتاج مراجعة أو إدخال يدوي لاحقًا."
            />

            <PreviewCard title="بيانات العقد" icon="reader-outline">
              <InfoRow label="رقم سجل العقد" value={display(contract.contract_number || contract.ejar_record_number)} />
              <InfoRow label="تاريخ إبرام العقد" value={display(contract.sealing_date)} />
              <InfoRow label="مكان الإبرام" value={display(contract.sealing_location)} />
              <InfoRow label="بداية الإيجار" value={display(contract.start_date)} />
              <InfoRow label="نهاية الإيجار" value={display(contract.end_date)} />
            </PreviewCard>

            <PreviewCard title="بيانات المستأجر" icon="person-circle-outline">
              <InfoRow label="الاسم" value={display(tenant.name)} />
              <InfoRow label="الجنسية" value={display(tenant.nationality)} />
              <InfoRow label="نوع الهوية" value={display(tenant.identity_type || tenant.id_type)} />
              <InfoRow label="رقم الهوية" value={display(tenant.national_id)} />
              <InfoRow label="رقم الجوال" value={display(tenant.phone)} />
            </PreviewCard>

            <PreviewCard title="الوحدة والقيم المالية" icon="wallet-outline">
              <InfoRow label="نطاق العقد" value={isPropertyContract ? 'العقار كامل' : display(unit.unit_number)} />
              <InfoRow label="نوع الوحدة" value={display(unit.type)} />
              <InfoRow label="قيمة الإيجار" value={money(financial.rent_amount)} />
              <InfoRow label="دفعة الإيجار الدورية" value={money(financial.regular_payment_amount)} />
              <InfoRow label="دفعة الإيجار الأخيرة" value={money(financial.last_payment_amount)} />
              <InfoRow label="عدد دفعات الإيجار" value={display(financial.rent_payments_count)} />
              <InfoRow label="دورة السداد" value={cycleLabel(financial.payment_cycle)} />
              <InfoRow label="دفعات الجدول المقروءة" value={`${paymentsCount}`} warning={paymentsCount === 0} />
            </PreviewCard>

            <PaymentScheduleCard rows={paymentRows} source={extracted.payments_source} />

            {lastImportResult ? (
              <Notice
                tone="success"
                icon="checkmark-done-outline"
                title="تم الحفظ"
                message={`العقد: #${lastImportResult?.contract?.id || '-'} — المستأجر: ${normalizeExtractedArabic(lastImportResult?.tenant?.name || '-') || '-'} — الدفعات المعتمدة من PDF: ${lastImportResult?.payments_count || paymentsCount || 0}`}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  contextCard: { gap: spacing.sm, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  cardTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { ...typography.h4, color: colors.text, textAlign: 'right' },
  cardSubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 3, lineHeight: 19 },
  selectButton: {
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
  },
  selectButtonText: { color: colors.textInverse, fontWeight: '900', fontSize: 16 },
  fileBox: {
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  fileInfo: { flex: 1 },
  fileName: { color: colors.text, fontWeight: '900', textAlign: 'right' },
  fileMeta: { color: colors.primaryDark, marginTop: 4, textAlign: 'right', fontWeight: '700' },
  emptyFileBox: { marginTop: spacing.md, backgroundColor: colors.surfaceSubtle, borderRadius: radii.lg, padding: spacing.md },
  hint: { color: colors.textSecondary, textAlign: 'center', fontWeight: '700' },
  actionsRow: { flexDirection: 'row-reverse', gap: spacing.sm, marginTop: spacing.md },
  actionButton: { flex: 1, padding: 13, borderRadius: radii.lg, alignItems: 'center' },
  previewButton: { backgroundColor: colors.primary },
  applyButton: { backgroundColor: colors.success },
  disabledButton: { opacity: 0.65 },
  actionButtonText: { color: colors.textInverse, fontWeight: '900' },
  loadingBox: { marginTop: spacing.lg, alignItems: 'center' },
  loadingText: { marginTop: spacing.sm, color: colors.textSecondary, fontWeight: '700' },
  noticeSpacing: { marginTop: spacing.md },
  previewWrap: { marginTop: spacing.lg, gap: spacing.md },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  previewHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  previewIcon: { width: 32, height: 32, borderRadius: radii.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'right' },
  infoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
  },
  infoLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '900', minWidth: 112, textAlign: 'right', writingDirection: 'rtl' },
  infoValue: { flex: 1, color: colors.text, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', lineHeight: 20 },
  infoValueWarning: { color: colors.warningDark },
  scheduleNotice: { marginBottom: spacing.sm },
  scheduleSummaryRow: { gap: spacing.sm, marginBottom: spacing.md },
  scheduleScrollContent: { paddingBottom: 2 },
  scheduleTable: {
    minWidth: 860,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  scheduleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  scheduleHeaderRow: {
    borderTopWidth: 0,
    backgroundColor: colors.surfaceSubtle,
  },
  scheduleCell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderLeftWidth: 1,
    borderLeftColor: colors.borderLight,
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'ltr',
  },
  scheduleHeaderText: { color: colors.textSecondary, fontSize: 11, fontWeight: '900', writingDirection: 'rtl' },
  strongScheduleCell: { color: colors.primaryDark, fontWeight: '900' },
  scheduleSeqCell: { width: 46 },
  scheduleDateCell: { width: 132 },
  scheduleHijriCell: { width: 124 },
  schedulePeriodCell: { width: 90 },
  scheduleAmountCell: { width: 140 },
});
