import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import InlineEditDeleteActions from '../../components/InlineEditDeleteActions';
import { StatusBadge } from '../../components/ui/shared';
import { apiGetScoped, apiPost } from '../../lib/api';
import { colors, formatDate, money, radii, spacing, typography } from '../../constants/theme';

type Payment = {
  id: number;
  amount?: number;
  due_date?: string | null;
  paid_date?: string | null;
  status?: string | null;
  notes?: string | null;
  contract_id?: number | null;
  contract?: {
    id?: number;
    contract_number?: string | null;
    government_contract_number?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    rent_amount?: number | null;
    tenant?: { id?: number; name?: string | null; phone?: string | null } | null;
    unit?: {
      id?: number;
      unit_number?: string | null;
      property?: { id?: number; name?: string | null; city?: string | null; district?: string | null } | null;
    } | null;
  } | null;
};

function valueOrDash(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function statusArabic(status?: string | null) {
  if (status === 'paid') return 'مدفوعة';
  if (status === 'overdue') return 'متأخرة';
  if (status === 'due') return 'مستحقة';
  return valueOrDash(status);
}

function statusColor(status?: string | null) {
  if (status === 'paid') return colors.success;
  if (status === 'overdue') return colors.danger;
  if (status === 'due') return colors.warning;
  return colors.textSecondary;
}

function InfoRow({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoValue}>{valueOrDash(value)}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({ title, icon, variant = 'dark', onPress, disabled = false }: {
  title: string;
  icon: string;
  variant?: 'dark' | 'success' | 'warning' | 'danger' | 'muted';
  onPress: () => void;
  disabled?: boolean;
}) {
  const style =
    variant === 'success' ? styles.actionSuccess :
    variant === 'warning' ? styles.actionWarning :
    variant === 'danger' ? styles.actionDanger :
    variant === 'muted' ? styles.actionMuted :
    styles.actionDark;

  return (
    <TouchableOpacity style={[styles.actionButton, style, disabled ? styles.disabled : null]} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionText}>{title}</Text>
    </TouchableOpacity>
  );
}

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const paymentId = Number(id || 0);

  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      const result = await apiGetScoped('/payments', '/my/payments');
      const list = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
      const item = list.find((row: Payment) => Number(row.id) === paymentId) || null;

      if (!item) {
        setPayment(null);
        setError('لم يتم العثور على الدفعة المطلوبة.');
        return;
      }

      setPayment(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل بيانات الدفعة');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [paymentId]);

  useEffect(() => {
    load(false);
  }, [load]);

  const contract = payment?.contract || null;
  const tenant = contract?.tenant || null;
  const unit = contract?.unit || null;
  const property = unit?.property || null;
  const deadlineText = useMemo(() => {
    if (!payment?.due_date) return '-';
    const base = new Date(payment.due_date);
    if (Number.isNaN(base.getTime())) return '-';
    base.setDate(base.getDate() + 15);
    return base.toISOString().slice(0, 10);
  }, [payment?.due_date]);

  async function updateStatus(endpoint: string, successMessage: string) {
    if (!payment) return;
    try {
      setSaving(true);
      await apiPost(`/payments/${payment.id}/${endpoint}`, {});
      await load(true);
      Alert.alert('تم', successMessage);
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'تعذر تحديث الدفعة');
    } finally {
      setSaving(false);
    }
  }

  function confirmMarkPaid() {
    Alert.alert('تأكيد السداد', `هل تريد تسجيل سداد ${money(payment?.amount)}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تسجيل السداد', onPress: () => updateStatus('mark-paid', 'تم تسجيل الدفعة كمدفوعة') },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.centerText}>جاري تحميل الدفعة...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !payment) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerBox}>
          <Text style={styles.errorTitle}>تعذر تحميل الدفعة</Text>
          <Text style={styles.errorText}>{error || 'غير موجودة'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => load(false)}>
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <StatusBadge status={payment.status} size="sm" />
            <Text style={styles.heroLabel}>الدفعة</Text>
          </View>
          <Text style={styles.heroAmount}>{money(payment.amount)}</Text>
          <Text style={[styles.heroStatus, { color: statusColor(payment.status) }]}>{statusArabic(payment.status)}</Text>
          <View style={styles.pillsRow}>
            <Text style={styles.heroPill}>رقم الدفعة: {payment.id}</Text>
            <Text style={styles.heroPill}>العقد: {contract?.government_contract_number || contract?.contract_number || contract?.id || '-'}</Text>
          </View>
        </View>

        <View style={styles.actionsCard}>
          <InlineEditDeleteActions resource="payments" id={payment.id} hideDetails onChanged={() => load(true)} />
        </View>

        <View style={styles.statusActionsGrid}>
          {payment.status !== 'paid' ? <ActionButton title="تسجيل سداد" icon="✅" variant="success" onPress={confirmMarkPaid} disabled={saving} /> : null}
          {payment.status !== 'due' ? <ActionButton title="إرجاع مستحقة" icon="↩️" variant="warning" onPress={() => updateStatus('mark-due', 'تم إرجاع الدفعة إلى مستحقة')} disabled={saving} /> : null}
          {payment.status !== 'overdue' ? <ActionButton title="تسجيل متأخرة" icon="⚠️" variant="danger" onPress={() => updateStatus('mark-overdue', 'تم تسجيل الدفعة كمتأخرة')} disabled={saving} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>بيانات السداد</Text>
          <InfoRow label="قيمة الدفعة" value={money(payment.amount)} />
          <InfoRow label="تاريخ الاستحقاق" value={formatDate(payment.due_date)} />
          <InfoRow label="نهاية مهلة السداد" value={deadlineText} />
          <InfoRow label="تاريخ السداد" value={payment.paid_date ? formatDate(payment.paid_date) : '-'} />
          <InfoRow label="الحالة" value={statusArabic(payment.status)} />
          <InfoRow label="ملاحظات" value={payment.notes} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>بيانات العقد</Text>
          <InfoRow label="رقم العقد" value={contract?.government_contract_number || contract?.contract_number || contract?.id} />
          <InfoRow label="بداية العقد" value={formatDate(contract?.start_date)} />
          <InfoRow label="نهاية العقد" value={formatDate(contract?.end_date)} />
          <InfoRow label="إيجار العقد" value={money(contract?.rent_amount)} />
          {contract?.id ? (
            <TouchableOpacity style={styles.openButton} onPress={() => router.push(`/contract/${contract.id}` as any)}>
              <Text style={styles.openButtonText}>فتح العقد</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>المستأجر والعقار</Text>
          <InfoRow label="المستأجر" value={tenant?.name} />
          <InfoRow label="الجوال" value={tenant?.phone} />
          <InfoRow label="العقار" value={property?.name} />
          <InfoRow label="الوحدة" value={unit?.unit_number} />
          <InfoRow label="الموقع" value={[property?.district, property?.city].filter(Boolean).join('، ')} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: 60 },
  heroCard: { backgroundColor: '#111827', borderRadius: 26, padding: spacing.xl, marginBottom: spacing.md },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  heroLabel: { color: '#d1d5db', fontWeight: '900', textAlign: 'right' },
  heroAmount: { color: '#fff', fontSize: 34, fontWeight: '900', textAlign: 'right', marginTop: 4 },
  heroStatus: { fontSize: 16, fontWeight: '900', textAlign: 'right', marginTop: 6 },
  pillsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: spacing.lg },
  heroPill: { overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 7, fontWeight: '900', fontSize: 12 },
  actionsCard: { backgroundColor: colors.surface, borderRadius: radii.xl, paddingHorizontal: spacing.sm, paddingTop: 2, paddingBottom: 0, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  statusActionsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  actionButton: { width: '48%', minHeight: 56, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 7, paddingHorizontal: 8 },
  actionDark: { backgroundColor: '#111827' },
  actionSuccess: { backgroundColor: colors.success },
  actionWarning: { backgroundColor: colors.warning },
  actionDanger: { backgroundColor: colors.danger },
  actionMuted: { backgroundColor: colors.textSecondary },
  actionIcon: { fontSize: 16 },
  actionText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  disabled: { opacity: 0.55 },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  sectionTitle: { ...typography.bodyBold, color: colors.text, textAlign: 'right', marginBottom: spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoLabel: { ...typography.captionBold, color: colors.textSecondary, textAlign: 'right', width: 126 },
  infoValue: { flex: 1, ...typography.captionBold, color: colors.text, textAlign: 'right' },
  openButton: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radii.md, padding: 12, alignItems: 'center' },
  openButtonText: { color: '#fff', fontWeight: '900' },
  centerBox: { flex: 1, margin: spacing.lg, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderLight },
  centerText: { ...typography.captionBold, color: colors.textSecondary, marginTop: 10 },
  errorTitle: { ...typography.h3, color: colors.danger, textAlign: 'center' },
  errorText: { ...typography.body, color: colors.danger, textAlign: 'center', marginTop: 8 },
  retryButton: { marginTop: spacing.md, backgroundColor: '#111827', borderRadius: radii.md, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: '#fff', fontWeight: '900' },
});
