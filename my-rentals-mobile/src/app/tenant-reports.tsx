import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet } from '../lib/api';
import { colors, radii, spacing, typography } from '../constants/theme';

type ReportPayload = {
  tenant?: { name?: string | null; phone?: string | null };
  reports?: {
    overdue_payments_count?: number;
    overdue_amount?: number;
    next_payment_date?: string | null;
    next_payment?: any;
    open_tickets_count?: number;
    contract_end_date?: string | null;
    contract_number?: string | null;
    contract_status?: string | null;
    contracts_count?: number;
  };
};

type StatTone = 'default' | 'danger' | 'warning' | 'success' | 'dark';

function numberValue(v: unknown) {
  const n = Number(String(v ?? 0).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function money(v: unknown) {
  return `${numberValue(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال`;
}

function dateText(v: unknown) {
  const raw = String(v ?? '').trim();
  return raw ? raw.slice(0, 10) : '-';
}

function paymentStatus(item: any) {
  const amount = numberValue(item?.amount);
  const paid = numberValue(item?.paid_amount);
  const remaining = numberValue(item?.remaining_amount ?? Math.max(0, amount - paid));
  const status = String(item?.status ?? '').toLowerCase();
  if (remaining <= 0.009 && paid > 0) return 'paid';
  if (status.includes('overdue') || status.includes('متأخر')) return 'overdue';
  return 'due';
}

async function fallbackReports(): Promise<ReportPayload> {
  const [paymentsResponse, threadsResponse] = await Promise.all([
    apiGet('/tenant/payments'),
    apiGet('/chat/threads').catch(() => null),
  ]);
  const paymentsData = paymentsResponse?.data ?? paymentsResponse;
  const threadsData = threadsResponse?.data ?? threadsResponse;
  const payments = Array.isArray(paymentsData?.payments) ? paymentsData.payments : [];
  const threads = Array.isArray(threadsData?.threads) ? threadsData.threads : [];
  const today = new Date().toISOString().slice(0, 10);
  const overdue = payments.filter((item: any) => {
    const dueDate = String(item?.due_date ?? '').slice(0, 10);
    const rem = numberValue(item?.remaining_amount);
    return rem > 0.009 && (paymentStatus(item) === 'overdue' || (!!dueDate && dueDate <= today));
  });
  const upcoming = payments
    .filter((item: any) => numberValue(item?.remaining_amount) > 0.009 && String(item?.due_date ?? '').slice(0, 10) > today)
    .sort((a: any, b: any) => String(a?.due_date ?? '').localeCompare(String(b?.due_date ?? '')))[0] ?? null;
  const lastPayment = [...payments].sort((a: any, b: any) => String(b?.due_date ?? '').localeCompare(String(a?.due_date ?? '')))[0] ?? null;

  return {
    tenant: paymentsData?.tenant ?? {},
    reports: {
      overdue_payments_count: overdue.length,
      overdue_amount: overdue.reduce((sum: number, item: any) => sum + numberValue(item?.remaining_amount), 0),
      next_payment_date: upcoming?.due_date ?? null,
      next_payment: upcoming,
      open_tickets_count: threads.filter((item: any) => String(item?.status ?? '') !== 'closed').length,
      contract_end_date: paymentsData?.contract_end_date ?? lastPayment?.contract_end_date ?? lastPayment?.due_date ?? null,
      contract_number: upcoming?.contract_number ?? lastPayment?.contract_number ?? null,
      contracts_count: paymentsData?.contracts_count ?? 0,
    },
  };
}

function StatCard({ title, value, subtitle, icon, tone = 'default' }: { title: string; value: string; subtitle?: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tone?: StatTone }) {
  return (
    <View style={[styles.statCard, tone === 'danger' ? styles.cardDanger : null, tone === 'warning' ? styles.cardWarning : null, tone === 'success' ? styles.cardSuccess : null, tone === 'dark' ? styles.cardDark : null]}>
      <View style={[styles.iconBox, tone === 'danger' ? styles.iconDanger : null, tone === 'warning' ? styles.iconWarning : null, tone === 'success' ? styles.iconSuccess : null]}>
        <MaterialCommunityIcons name={icon} size={24} color={tone === 'danger' ? '#B91C1C' : tone === 'warning' ? '#92400E' : tone === 'dark' ? '#fff' : '#0F766E'} />
      </View>
      <Text style={[styles.statValue, tone === 'dark' ? styles.darkText : null]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.statTitle, tone === 'dark' ? styles.darkSubText : null]}>{title}</Text>
      {subtitle ? <Text style={[styles.statSubtitle, tone === 'dark' ? styles.darkSubText : null]}>{subtitle}</Text> : null}
    </View>
  );
}

export default function TenantReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState('المستأجر');
  const [payload, setPayload] = useState<ReportPayload>({});
  const [warning, setWarning] = useState('');

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setWarning('');
      let data: ReportPayload;
      try {
        const response = await apiGet('/tenant/reports');
        data = (response?.data ?? response) as ReportPayload;
      } catch {
        data = await fallbackReports();
        setWarning('تم حساب التقرير من الدفعات والتذاكر المتاحة.');
      }
      setPayload(data);
      setName(data?.tenant?.name || 'المستأجر');
    } catch (e) {
      setWarning(e instanceof Error ? e.message : 'تعذر تحميل تقارير المستأجر.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const reports = payload.reports || {};
  const next = reports.next_payment;
  const overdueCount = numberValue(reports.overdue_payments_count);
  const overdueAmount = numberValue(reports.overdue_amount);
  const openTickets = numberValue(reports.open_tickets_count);

  const summaryTone = useMemo<StatTone>(() => {
    if (overdueCount > 0 || overdueAmount > 0) return 'danger';
    if (openTickets > 0) return 'warning';
    return 'success';
  }, [openTickets, overdueAmount, overdueCount]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}><Ionicons name="analytics-outline" size={32} color="#0F766E" /></View>
          <Text style={styles.heroTitle}>تقاريري</Text>
          <Text style={styles.heroSubtitle}>{name}</Text>
          <Text style={styles.heroHint}>ملخص سريع عن الدفعات، التذاكر، وبيانات العقد الحالي.</Text>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>جاري تحميل تقاريرك...</Text>
          </View>
        ) : null}

        {warning && !loading ? <Text style={styles.warningText}>{warning}</Text> : null}

        {!loading ? (
          <>
            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>حالة الحساب</Text>
              <Text style={[styles.statusValue, summaryTone === 'danger' ? styles.statusDanger : summaryTone === 'warning' ? styles.statusWarning : styles.statusSuccess]}>
                {summaryTone === 'danger' ? 'يوجد متأخرات' : summaryTone === 'warning' ? 'يوجد تذاكر مفتوحة' : 'الوضع جيد'}
              </Text>
            </View>

            <View style={styles.grid}>
              <StatCard title="عدد الدفعات المتأخرة" value={String(Math.round(overdueCount)).toLocaleString('ar-SA')} subtitle="دفعات غير مكتملة ومستحقة" icon="calendar-alert" tone={overdueCount > 0 ? 'danger' : 'success'} />
              <StatCard title="المبالغ المتأخرة" value={money(overdueAmount)} subtitle="إجمالي المتبقي المستحق" icon="cash-alert" tone={overdueAmount > 0 ? 'danger' : 'success'} />
              <StatCard title="أقرب دفعة قادمة" value={dateText(reports.next_payment_date)} subtitle={next ? `المتبقي: ${money(next.remaining_amount ?? next.amount)}` : 'لا توجد دفعات قادمة'} icon="calendar-clock" tone="warning" />
              <StatCard title="التذاكر المفتوحة" value={String(Math.round(openTickets)).toLocaleString('ar-SA')} subtitle="تذاكر مراسلات لم تغلق" icon="chat-alert-outline" tone={openTickets > 0 ? 'warning' : 'success'} />
              <StatCard title="تاريخ انتهاء العقد" value={dateText(reports.contract_end_date)} subtitle={reports.contract_number ? `العقد: ${reports.contract_number}` : 'العقد الحالي'} icon="file-document-check-outline" tone="dark" />
              <StatCard title="عدد العقود" value={String(Math.round(numberValue(reports.contracts_count))).toLocaleString('ar-SA')} subtitle="عقود مرتبطة بحسابك" icon="file-document-multiple-outline" />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 110 },
  heroCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, alignItems: 'flex-end', borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing.md },
  heroIcon: { width: 66, height: 66, borderRadius: 24, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  heroTitle: { ...typography.h2, color: colors.text, textAlign: 'right' },
  heroSubtitle: { color: colors.textSecondary, textAlign: 'right', marginTop: 4, fontWeight: '900' },
  heroHint: { color: colors.textSecondary, textAlign: 'right', marginTop: spacing.sm, lineHeight: 22, fontWeight: '700' },
  loadingCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight },
  loadingText: { color: colors.textSecondary, marginTop: spacing.sm, fontWeight: '800' },
  warningText: { backgroundColor: '#FFFBEB', color: '#92400E', borderColor: '#FDE68A', borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, textAlign: 'right', marginBottom: spacing.md, fontWeight: '800' },
  statusCard: { backgroundColor: '#0F172A', borderRadius: radii.xl, padding: spacing.lg, marginBottom: spacing.md, alignItems: 'flex-end' },
  statusLabel: { color: '#CBD5E1', fontWeight: '800', textAlign: 'right' },
  statusValue: { fontSize: 24, fontWeight: '900', textAlign: 'right', marginTop: 6 },
  statusDanger: { color: '#FCA5A5' },
  statusWarning: { color: '#FDE68A' },
  statusSuccess: { color: '#86EFAC' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  statCard: { width: '48.5%', minHeight: 152, backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'flex-end', justifyContent: 'center' },
  cardDanger: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  cardWarning: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  cardSuccess: { backgroundColor: '#ECFDF5', borderColor: '#86EFAC' },
  cardDark: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  iconBox: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  iconDanger: { backgroundColor: '#FEE2E2' },
  iconWarning: { backgroundColor: '#FEF3C7' },
  iconSuccess: { backgroundColor: '#DCFCE7' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right' },
  statTitle: { color: colors.text, fontSize: 13, fontWeight: '900', textAlign: 'right', marginTop: 6 },
  statSubtitle: { color: colors.textSecondary, fontSize: 11, fontWeight: '800', textAlign: 'right', marginTop: 5, lineHeight: 17 },
  darkText: { color: '#fff' },
  darkSubText: { color: '#CBD5E1' },
});
