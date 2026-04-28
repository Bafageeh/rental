import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGetScoped } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  colors,
  spacing,
  radii,
  shadows,
  typography,
  moneyCompact,
  formatDate,
} from '../constants/theme';
import { Skeleton, SkeletonCard } from '../components/ui/shared';

// ─── Types ───────────────────────────────────────────────
type Summary = {
  properties_count?: number;
  units_count?: number;
  rented_units_count?: number;
  vacant_units_count?: number;
  occupancy_rate?: number;
  active_contracts_count?: number;
  tenants_count?: number;
  paid_income?: number;
  due_income?: number;
  overdue_income?: number;
  expenses?: number;
  net_income?: number;
  open_followups_count?: number;
  critical_alerts_count?: number;
};

type DashData = {
  summary?: Summary;
  recent_due_payments?: any[];
};

// ─── Helpers ─────────────────────────────────────────────
function go(path: string) {
  router.push(path as any);
}

function getOccupancyColor(rate: number): string {
  if (rate >= 75) return colors.success;
  if (rate >= 50) return colors.warning;
  return colors.danger;
}

function getStatusInfo(status?: string | null) {
  switch (status) {
    case 'overdue':
      return { color: colors.overdue, bg: colors.overdueBg, label: 'متأخرة' };
    case 'paid':
      return { color: colors.paid, bg: colors.paidBg, label: 'مدفوعة' };
    case 'due':
    default:
      return { color: colors.due, bg: colors.dueBg, label: 'مستحقة' };
  }
}

// ─── Sub-components ──────────────────────────────────────

function StatBox({
  label,
  value,
  color,
  onPress,
}: {
  label: string;
  value: string | number;
  color?: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, color ? { color } : null]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  return onPress ? (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ flex: 1 }}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      {content}
    </TouchableOpacity>
  ) : (
    <View style={{ flex: 1 }}>{content}</View>
  );
}

function QuickAction({ icon, label, path }: { icon: string; label: string; path: string }) {
  return (
    <TouchableOpacity
      style={styles.quickAction}
      onPress={() => go(path)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function PaymentRow({ p }: { p: any }) {
  const status = getStatusInfo(p.status);

  return (
    <TouchableOpacity
      style={styles.paymentRow}
      onPress={() => go(`/contract/${p.contract_id ?? p.id}`)}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <View style={styles.paymentLeft}>
        <Text style={styles.paymentTenant} numberOfLines={1}>
          {p.tenant_name ?? p.contract?.tenant?.name ?? 'مستأجر'}
        </Text>
        <Text style={styles.paymentProp} numberOfLines={1}>
          {p.property_name ?? p.contract?.unit?.property?.name ?? '-'}
          {(p.unit_number ?? p.contract?.unit?.unit_number)
            ? ` — ${p.unit_number ?? p.contract?.unit?.unit_number}`
            : ''}
        </Text>
      </View>
      <View style={styles.paymentRight}>
        <Text style={[styles.paymentAmount, { color: status.color }]}>
          {moneyCompact(p.amount)}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Skeleton Loader for Dashboard ───────────────────────

function DashboardSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md }}>
      {/* Header skeleton */}
      <View style={styles.header}>
        <View style={{ gap: 6 }}>
          <Skeleton width={160} height={22} />
          <Skeleton width={100} height={13} />
        </View>
      </View>

      {/* Occupancy card skeleton */}
      <View style={[styles.card, { padding: spacing.lg }]}>
        <View style={styles.occupancyRow}>
          <Skeleton width={90} height={90} radius={45} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="80%" height={20} />
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={14} />
          </View>
        </View>
      </View>

      {/* Section title skeleton */}
      <Skeleton width={100} height={16} style={{ marginTop: spacing.md }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SkeletonCard />
        </View>
        <View style={{ flex: 1 }}>
          <SkeletonCard />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SkeletonCard />
        </View>
        <View style={{ flex: 1 }}>
          <SkeletonCard />
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────

export default function DashboardScreen() {
  const { user, loggedIn, isAdmin } = useAuth();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setHasError(false);

      const result = await apiGetScoped('/dashboard', '/my/dashboard');
      setData(result?.data ?? result);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const s = data?.summary;
  const occupancy = Math.round(s?.occupancy_rate ?? 0);
  const occupancyColor = getOccupancyColor(occupancy);
  const firstName = user?.name?.split(' ')[0]?.trim() || 'مدير';
  const greeting = loggedIn ? `مرحبا عزيزي، ${firstName} 👋` : 'إيجاراتي 🏢';
  const subGreeting = loggedIn
    ? isAdmin
      ? 'لوحة المدير'
      : 'لوحة المالك'
    : 'سجّل دخولك لعرض كامل البيانات';

  // Show skeleton on first load
  if (loading && !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DashboardSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting} numberOfLines={1}>
              {greeting}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {subGreeting}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {(s?.critical_alerts_count ?? 0) > 0 && (
              <TouchableOpacity
                style={styles.alertBtn}
                onPress={() => go('/alerts')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${s!.critical_alerts_count} تنبيه`}
              >
                <Text style={styles.alertBtnText}>🔔 {s!.critical_alerts_count}</Text>
              </TouchableOpacity>
            )}
            {!loggedIn && (
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={() => go('/login')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="تسجيل الدخول"
              >
                <Text style={styles.loginBtnText}>دخول</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ─── Error banner (non-blocking) ─── */}
        {hasError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ تعذر تحميل بعض البيانات. اسحب للتحديث.</Text>
          </View>
        )}

        {/* ─── Guest Banner ─── */}
        {!loggedIn && (
          <TouchableOpacity
            style={styles.guestBanner}
            onPress={() => go('/login')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="تسجيل الدخول للوصول الكامل"
          >
            <Text style={styles.guestIcon}>🔐</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.guestTitle}>سجّل دخولك للوصول الكامل</Text>
              <Text style={styles.guestSub}>رؤية جميع البيانات والتقارير المالية</Text>
            </View>
            <Text style={styles.guestArrow}>←</Text>
          </TouchableOpacity>
        )}

        {/* ─── Occupancy Ring ─── */}
        {s && (
          <View style={styles.card}>
            <View style={styles.occupancyRow}>
              <View style={styles.ringWrap}>
                <View style={[styles.ring, { borderColor: occupancyColor }]}>
                  <Text style={styles.ringPct}>{occupancy}%</Text>
                  <Text style={styles.ringLbl}>إشغال</Text>
                </View>
              </View>
              <View style={styles.occupancyStats}>
                <View style={styles.occStat}>
                  <Text style={[styles.occNum, { color: colors.primary }]}>
                    {s.rented_units_count ?? 0}
                  </Text>
                  <Text style={styles.occLbl}>مؤجرة</Text>
                </View>
                <View style={styles.occDivider} />
                <View style={styles.occStat}>
                  <Text style={[styles.occNum, { color: colors.warning }]}>
                    {s.vacant_units_count ?? 0}
                  </Text>
                  <Text style={styles.occLbl}>شاغرة</Text>
                </View>
                <View style={styles.occDivider} />
                <View style={styles.occStat}>
                  <Text style={styles.occNum}>{s.units_count ?? 0}</Text>
                  <Text style={styles.occLbl}>الإجمالي</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ─── Financial Summary ─── */}
        {s && loggedIn && (
          <>
            <Text style={styles.sectionTitle}>الملخص المالي</Text>
            <View style={styles.statsRow}>
              <StatBox label="محصّل" value={moneyCompact(s.paid_income)} color={colors.success} />
              <StatBox label="مستحق" value={moneyCompact(s.due_income)} color={colors.warning} />
            </View>
            <View style={styles.statsRow}>
              <StatBox label="متأخر" value={moneyCompact(s.overdue_income)} color={colors.danger} />
              <StatBox label="صافي الدخل" value={moneyCompact(s.net_income)} color={colors.primary} />
            </View>
          </>
        )}

        {/* ─── Overview Stats ─── */}
        {s && (
          <>
            <Text style={styles.sectionTitle}>نظرة عامة</Text>
            <View style={styles.statsRow}>
              <StatBox
                label="العقارات"
                value={s.properties_count ?? 0}
                onPress={() => go('/properties')}
              />
              <StatBox
                label="العقود النشطة"
                value={s.active_contracts_count ?? 0}
                onPress={() => go('/contracts')}
              />
            </View>
            <View style={styles.statsRow}>
              <StatBox
                label="المستأجرين"
                value={s.tenants_count ?? 0}
                onPress={() => go('/tenants')}
              />
              <StatBox
                label="المتابعات"
                value={s.open_followups_count ?? 0}
                onPress={() => go('/follow-ups')}
              />
            </View>
          </>
        )}

        {/* ─── Recent Due Payments ─── */}
        {(data?.recent_due_payments?.length ?? 0) > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>دفعات مستحقة</Text>
              <TouchableOpacity onPress={() => go('/payments')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.sectionLink}>عرض الكل</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              {data!.recent_due_payments!.slice(0, 5).map((p, i, arr) => (
                <View key={p.id ?? i}>
                  <PaymentRow p={p} />
                  {i < arr.length - 1 && i < 4 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* ─── Quick Actions ─── */}
        <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
        <View style={styles.quickRow}>
          <QuickAction icon="🏢" label="العقارات" path="/properties" />
          <QuickAction icon="🚪" label="الوحدات" path="/units" />
          <QuickAction icon="💰" label="الدفعات" path="/payments" />
          <QuickAction icon="🔔" label="التنبيهات" path="/alerts" />
        </View>

        {!loggedIn && (
          <View style={styles.quickRow}>
            <QuickAction icon="👤" label="تسجيل الدخول" path="/login" />
            <View style={{ flex: 3 }} />
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  greeting: { ...typography.h2, color: colors.text, textAlign: 'right' },
  headerSub: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: 6 },
  alertBtn: {
    backgroundColor: colors.dangerBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  alertBtnText: { ...typography.captionBold, color: colors.danger },
  loginBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  loginBtnText: { ...typography.captionBold, color: colors.textInverse },

  errorBanner: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  errorText: { ...typography.caption, color: colors.warningDark, textAlign: 'right' },

  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  guestIcon: { fontSize: 28 },
  guestTitle: { ...typography.bodyBold, color: colors.textInverse, textAlign: 'right' },
  guestSub: { ...typography.caption, color: 'rgba(255,255,255,0.85)', textAlign: 'right', marginTop: 2 },
  guestArrow: { fontSize: 20, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },

  occupancyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  ringWrap: { alignItems: 'center' },
  ring: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: { fontSize: 22, fontWeight: '800', color: colors.text },
  ringLbl: { ...typography.small, color: colors.textSecondary, marginTop: -2 },
  occupancyStats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  occStat: { alignItems: 'center' },
  occNum: { ...typography.numberSmall, color: colors.text },
  occLbl: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  occDivider: { width: 1, height: 32, backgroundColor: colors.borderLight },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    textAlign: 'right',
    marginBottom: 10,
    marginTop: spacing.lg,
  },
  sectionLink: { ...typography.captionBold, color: colors.primary, marginBottom: 10, marginTop: spacing.lg },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'flex-end',
    ...shadows.sm,
  },
  statValue: { ...typography.h4, color: colors.text, marginBottom: 4 },
  statLabel: { ...typography.caption, color: colors.textSecondary },

  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    gap: spacing.md,
  },
  paymentLeft: { flex: 1 },
  paymentRight: { alignItems: 'flex-end', gap: 4 },
  paymentTenant: { ...typography.captionBold, color: colors.text, textAlign: 'right' },
  paymentProp: { ...typography.small, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  paymentAmount: { fontSize: 14, fontWeight: '700' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full },
  statusPillText: { fontSize: 11, fontWeight: '600' },

  divider: { height: 1, backgroundColor: colors.surfaceMuted },

  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  quickAction: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  quickIcon: { fontSize: 26, marginBottom: 6 },
  quickLabel: { ...typography.small, color: colors.text, fontWeight: '600' },
});
