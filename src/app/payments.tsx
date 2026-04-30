import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGetScoped, apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  EmptyState,
  ErrorState,
  SkeletonList,
  StatusBadge,
} from '../components/ui/shared';
import {
  colors,
  spacing,
  radii,
  shadows,
  typography,
  money,
  formatDate,
  getStatusConfig,
} from '../constants/theme';

import { smartBack } from "@/lib/navigationHistory";
type Payment = {
  id: number;
  amount?: number;
  due_date?: string | null;
  paid_date?: string | null;
  status?: string | null;
  contract?: {
    id?: number;
    tenant?: { name?: string | null } | null;
    unit?: {
      unit_number?: string | null;
      property?: { name?: string | null } | null;
    } | null;
  } | null;
};

const STATUS_FILTERS = [
  { key: null, label: 'الكل' },
  { key: 'overdue', label: 'متأخرة' },
  { key: 'due', label: 'مستحقة' },
  { key: 'paid', label: 'مدفوعة' },
] as const;

function PaymentCard({
  item,
  onRefresh,
  canMark,
}: {
  item: Payment;
  onRefresh: () => void;
  canMark: boolean;
}) {
  const [marking, setMarking] = useState(false);
  const initial = (item.contract?.tenant?.name || '?').trim()[0]?.toUpperCase() || '?';

  async function markPaid() {
    Alert.alert(
      'تأكيد السداد',
      `هل أنت متأكد من تسجيل سداد ${money(item.amount)}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تسجيل',
          onPress: async () => {
            try {
              setMarking(true);
              await apiPost(`/payments/${item.id}/mark-paid`);
              onRefresh();
            } catch (e) {
              Alert.alert('خطأ', e instanceof Error ? e.message : 'تعذر التحديث');
            } finally {
              setMarking(false);
            }
          },
        },
      ],
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/contract/${item.contract?.id ?? item.id}` as any)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`دفعة ${item.contract?.tenant?.name || ''} ${money(item.amount)}`}
    >
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tenantName} numberOfLines={1}>
            {item.contract?.tenant?.name ?? 'مستأجر'}
          </Text>
          <Text style={styles.propText} numberOfLines={1}>
            {item.contract?.unit?.property?.name ?? '-'}
            {item.contract?.unit?.unit_number ? ` — ${item.contract.unit.unit_number}` : ''}
          </Text>
        </View>
        <StatusBadge status={item.status} size="sm" />
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.amount}>{money(item.amount)}</Text>
        <Text style={styles.date} numberOfLines={1}>
          {item.status === 'paid'
            ? `سُددت: ${formatDate(item.paid_date)}`
            : `تستحق: ${formatDate(item.due_date)}`}
        </Text>
        {canMark && item.status !== 'paid' && (
          <TouchableOpacity
            style={[styles.markBtn, marking && { opacity: 0.6 }]}
            onPress={markPaid}
            disabled={marking}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="تسجيل سداد"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.markBtnText}>{marking ? '...' : 'تسجيل سداد'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function PaymentsScreen() {
  const { loggedIn } = useAuth();
  const [items, setItems] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      const result = await apiGetScoped('/payments', '/my/payments');
      const data = result?.data ?? result;
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر التحميل');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );

  const filtered = statusFilter ? items.filter((i) => i.status === statusFilter) : items;
  const overdueTotal = items
    .filter((i) => i.status === 'overdue')
    .reduce((s, i) => s + (i.amount ?? 0), 0);

  if (error && items.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ErrorState message={error} onRetry={() => load(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => smartBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="العودة"
        >
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الدفعات</Text>
        <View style={styles.countWrap}>
          <Text style={styles.headerCount}>{filtered.length}</Text>
        </View>
      </View>

      {overdueTotal > 0 && (
        <TouchableOpacity
          style={styles.overdueAlert}
          onPress={() => setStatusFilter('overdue')}
          activeOpacity={0.85}
        >
          <Text style={styles.overdueText} numberOfLines={1}>
            ⚠️ متأخر: {money(overdueTotal)}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.chips}>
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key ?? 'all'}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setStatusFilter(f.key)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && items.length === 0 ? (
        <SkeletonList count={6} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => (
            <PaymentCard item={item} onRefresh={() => load(true)} canMark={loggedIn} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={statusFilter ? `لا توجد دفعات ${getStatusConfig(statusFilter).label}` : 'لا توجد دفعات'}
              icon="💰"
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

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
    gap: spacing.md,
  },
  backBtn: { width: 32 },
  backText: { fontSize: 22, color: colors.primary, fontWeight: '700' },
  headerTitle: { ...typography.h3, color: colors.text, flex: 1, textAlign: 'center' },
  countWrap: { minWidth: 36, alignItems: 'center' },
  headerCount: {
    ...typography.captionBold,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
    overflow: 'hidden',
  },

  overdueAlert: {
    backgroundColor: colors.dangerBg,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  overdueText: { ...typography.captionBold, color: colors.danger, textAlign: 'right' },

  chips: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.small, color: colors.textSecondary },
  chipTextActive: { color: colors.textInverse },

  list: { padding: spacing.lg, paddingBottom: 80, flexGrow: 1 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md + 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  tenantName: { ...typography.captionBold, color: colors.text, textAlign: 'right' },
  propText: { ...typography.small, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },

  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 10,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.sm,
  },
  amount: { ...typography.bodyBold, color: colors.text },
  date: { flex: 1, ...typography.small, color: colors.textSecondary, textAlign: 'center' },
  markBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.sm + 2,
  },
  markBtnText: { ...typography.small, fontWeight: '700', color: colors.textInverse },
});
