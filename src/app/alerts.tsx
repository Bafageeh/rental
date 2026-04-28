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
import {
  colors,
  spacing,
  radii,
  shadows,
  typography,
  money,
  formatDate,
} from '../constants/theme';
import { Skeleton } from '../components/ui/shared';

import { smartBack } from "@/lib/navigationHistory";
type AlertData = {
  summary?: {
    overdue_count?: number;
    overdue_total?: number;
    upcoming_count?: number;
    upcoming_total?: number;
    ending_contracts_count?: number;
  };
  overdue_payments?: any[];
  upcoming_payments?: any[];
  ending_contracts?: any[];
};

// ─── Sub-components ──────────────────────────────────────

function SummaryCard({
  icon,
  label,
  count,
  amount,
  color,
}: {
  icon: string;
  label: string;
  count: number;
  amount?: number;
  color: string;
}) {
  return (
    <View style={[styles.summaryCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <Text style={{ fontSize: 24 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryLabel} numberOfLines={1}>
          {label}
        </Text>
        {amount !== undefined && (
          <Text style={[styles.summaryAmount, { color }]} numberOfLines={1}>
            {money(amount)}
          </Text>
        )}
      </View>
      <Text style={[styles.summaryCount, { color }]}>{count}</Text>
    </View>
  );
}

function AlertItem({
  icon,
  title,
  sub,
  value,
  color,
  onPress,
}: {
  icon: string;
  title: string;
  sub: string;
  value: string;
  color: string;
  onPress?: () => void;
}) {
  const Wrap: any = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      style={styles.alertItem}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${title} - ${value}` : undefined}
    >
      <View style={[styles.alertDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.alertTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.alertSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.alertValue, { color }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </Wrap>
  );
}

function AlertsSkeleton() {
  return (
    <View style={{ padding: spacing.lg, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Skeleton width="50%" height={70} radius={radii.md} />
        <Skeleton width="50%" height={70} radius={radii.md} />
      </View>
      <Skeleton width={200} height={16} style={{ marginTop: spacing.md }} />
      <Skeleton width="100%" height={120} radius={radii.lg} />
      <Skeleton width="100%" height={120} radius={radii.lg} />
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────

export default function AlertsScreen() {
  const [data, setData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const result = await apiGetScoped('/alerts', '/my/alerts');
      setData(result?.data ?? result);
    } catch {
      /* silent — non-critical */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const s = data?.summary;
  const allClear = !s?.overdue_count && !s?.upcoming_count && !s?.ending_contracts_count;

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <View style={{ width: 32 }} />
          <Text style={styles.headerTitle}>التنبيهات</Text>
          <View style={{ width: 32 }} />
        </View>
        <AlertsSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => smartBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="العودة"
        >
          <Text style={styles.backBtn}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>التنبيهات</Text>
        <View style={{ width: 32 }} />
      </View>

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
        {/* Summary */}
        {s && (
          <View style={styles.summaryRow}>
            <SummaryCard
              icon="⚠️"
              label="دفعات متأخرة"
              count={s.overdue_count ?? 0}
              amount={s.overdue_total}
              color={colors.danger}
            />
            <SummaryCard
              icon="⏰"
              label="مستحقة قريباً"
              count={s.upcoming_count ?? 0}
              amount={s.upcoming_total}
              color={colors.warning}
            />
          </View>
        )}

        {/* All clear */}
        {allClear && !loading && (
          <View style={styles.allClear}>
            <Text style={{ fontSize: 56 }}>✅</Text>
            <Text style={styles.allClearTitle}>كل شيء على ما يرام!</Text>
            <Text style={styles.allClearSub}>لا توجد تنبيهات حالياً</Text>
          </View>
        )}

        {/* Overdue */}
        {(data?.overdue_payments?.length ?? 0) > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              دفعات متأخرة ({data!.overdue_payments!.length})
            </Text>
            <View style={styles.listCard}>
              {data!.overdue_payments!.map((p, i, arr) => (
                <View key={p.id ?? i}>
                  <AlertItem
                    icon="⚠️"
                    color={colors.danger}
                    title={p.contract?.tenant?.name ?? 'مستأجر'}
                    sub={`${p.contract?.unit?.property?.name ?? ''} — ${formatDate(p.due_date)}`}
                    value={money(p.amount)}
                    onPress={() => router.push(`/contract/${p.contract?.id ?? p.id}` as any)}
                  />
                  {i < arr.length - 1 && <View style={styles.div} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Upcoming */}
        {(data?.upcoming_payments?.length ?? 0) > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              مستحقة خلال 30 يوماً ({data!.upcoming_payments!.length})
            </Text>
            <View style={styles.listCard}>
              {data!.upcoming_payments!.slice(0, 10).map((p, i, arr) => (
                <View key={p.id ?? i}>
                  <AlertItem
                    icon="⏰"
                    color={colors.warning}
                    title={p.contract?.tenant?.name ?? 'مستأجر'}
                    sub={`تستحق: ${formatDate(p.due_date)}`}
                    value={money(p.amount)}
                    onPress={() => router.push(`/contract/${p.contract?.id ?? p.id}` as any)}
                  />
                  {i < arr.length - 1 && <View style={styles.div} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Ending Contracts */}
        {(data?.ending_contracts?.length ?? 0) > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              عقود تنتهي قريباً ({data!.ending_contracts!.length})
            </Text>
            <View style={styles.listCard}>
              {data!.ending_contracts!.map((c, i, arr) => (
                <View key={c.id ?? i}>
                  <AlertItem
                    icon="📄"
                    color={colors.info}
                    title={c.tenant?.name ?? 'مستأجر'}
                    sub={c.unit?.property?.name ?? '-'}
                    value={`ينتهي: ${formatDate(c.end_date)}`}
                    onPress={() => router.push(`/contract/${c.id}` as any)}
                  />
                  {i < arr.length - 1 && <View style={styles.div} />}
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: { fontSize: 22, color: colors.primary, fontWeight: '700' },
  headerTitle: { ...typography.h3, color: colors.text },

  scroll: { padding: spacing.lg },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  summaryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  summaryLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'right' },
  summaryAmount: { fontSize: 13, fontWeight: '700', textAlign: 'right', marginTop: 2 },
  summaryCount: { fontSize: 26, fontWeight: '800' },

  allClear: { alignItems: 'center', paddingVertical: 60 },
  allClearTitle: { ...typography.h2, color: colors.text, marginTop: 12 },
  allClearSub: { ...typography.body, color: colors.textSecondary, marginTop: 6 },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
    marginBottom: 8,
    marginTop: spacing.lg,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadows.sm,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 14,
  },
  alertDot: { width: 8, height: 8, borderRadius: 4 },
  alertTitle: { ...typography.captionBold, color: colors.text, textAlign: 'right' },
  alertSub: { ...typography.small, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  alertValue: { ...typography.captionBold },
  div: { height: 1, backgroundColor: colors.surfaceMuted, marginHorizontal: 14 },
});
