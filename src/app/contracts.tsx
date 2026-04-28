import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useList } from '../hooks/useCrud';
import {
  Card,
  StatusBadge,
  ErrorState,
  EmptyState,
  SkeletonList,
} from '../components/ui/shared';
import { colors, typography, spacing, radii, money, getStatusConfig } from '../constants/theme';

import { smartBack } from "@/lib/navigationHistory";
type ContractItem = {
  id: number;
  contract_number?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  rent_amount?: number;
  status?: string | null;
  tenant?: { name?: string | null; phone?: string | null } | null;
  unit?: {
    id?: number;
    unit_number?: string | null;
    property_id?: number;
    property?: { id?: number; name?: string | null; owner?: { name?: string | null } | null } | null;
  } | null;
  payments?: Array<{ status?: string | null; amount?: number }>;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function buildQuery(params: Record<string, string>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

function paymentProgress(payments?: ContractItem['payments']) {
  if (!payments || payments.length === 0) return { paid: 0, total: 0, pct: 0 };
  const paid = payments.filter((p) => p.status === 'paid').length;
  return { paid, total: payments.length, pct: Math.round((paid / payments.length) * 100) };
}

function ContractCard({ item }: { item: ContractItem }) {
  const prog = paymentProgress(item.payments);
  const overdue = (item.payments || []).filter((p) => p.status === 'overdue').length;

  return (
    <Card
      style={styles.contractCard}
      onPress={() => router.push(`/contract/${item.id}` as any)}
    >
      {/* Top section */}
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.tenantRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(item.tenant?.name || '?')[0]}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tenantName}>{item.tenant?.name || 'مستأجر'}</Text>
              <Text style={styles.propertyInfo}>
                {item.unit?.property?.name} — {item.unit?.unit_number}
              </Text>
            </View>
          </View>
        </View>
        <StatusBadge status={item.status} />
      </View>

      {/* Details row */}
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>الإيجار</Text>
          <Text style={styles.detailValue}>{money(item.rent_amount)}</Text>
        </View>
        <View style={styles.detailDivider} />
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>البداية</Text>
          <Text style={styles.detailValue}>{item.start_date || '-'}</Text>
        </View>
        <View style={styles.detailDivider} />
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>النهاية</Text>
          <Text style={styles.detailValue}>{item.end_date || '-'}</Text>
        </View>
      </View>

      {/* Payment progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>
            الدفعات: {prog.paid}/{prog.total}
          </Text>
          {overdue > 0 && (
            <Text style={styles.overdueLabel}>{overdue} متأخرة</Text>
          )}
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${prog.pct}%`,
                backgroundColor: prog.pct === 100 ? colors.success : colors.primary,
              },
            ]}
          />
        </View>
      </View>
    </Card>
  );
}

export default function ContractsScreen() {
  const params = useLocalSearchParams();
  const propertyIdParam = firstParam(params.property_id as string | string[] | undefined);
  const propertyNameParam = firstParam(params.property_name as string | string[] | undefined);
  const unitIdParam = firstParam(params.unit_id as string | string[] | undefined);
  const unitNameParam = firstParam(params.unit_name as string | string[] | undefined);
  const propertyName = propertyNameParam ? decodeURIComponent(propertyNameParam) : '';
  const unitName = unitNameParam ? decodeURIComponent(unitNameParam) : '';
  const scopedQuery = buildQuery({ property_id: propertyIdParam, unit_id: unitIdParam });
  const isScoped = Boolean(propertyIdParam || unitIdParam);

  const { items, loading, refreshing, error, total, refresh, loadMore, search } =
    useList<ContractItem>({ endpoint: `/contracts${scopedQuery}`, scopedEndpoint: `/my/contracts${scopedQuery}` });

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const handleSearch = useCallback(
    (text: string) => {
      setSearchText(text);
      if (text.length === 0 || text.length >= 2) search(text);
    },
    [search]
  );

  const scopedFilteredItems = items.filter((item) => {
    if (propertyIdParam) {
      const propertyId = item.unit?.property?.id ?? item.unit?.property_id;
      if (String(propertyId || '') !== String(propertyIdParam)) return false;
    }
    if (unitIdParam && String(item.unit?.id || '') !== String(unitIdParam)) return false;
    return true;
  });

  const filteredItems = statusFilter
    ? scopedFilteredItems.filter((i) => i.status === statusFilter)
    : scopedFilteredItems;

  if (error && items.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleWrap}>
            {isScoped ? (
              <TouchableOpacity onPress={() => smartBack()}>
                <Text style={styles.backText}>→ رجوع</Text>
              </TouchableOpacity>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{unitIdParam ? 'عقود الوحدة' : propertyIdParam ? 'عقود العقار' : 'العقود'}</Text>
              {isScoped ? (
                <Text style={styles.scopeText} numberOfLines={1}>
                  {unitIdParam ? `الوحدة: ${unitName || `#${unitIdParam}`}` : `العقار: ${propertyName || `#${propertyIdParam}`}`}
                </Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              const createQuery = buildQuery({ property_id: propertyIdParam, property_name: propertyNameParam, unit_id: unitIdParam, unit_name: unitNameParam });
              router.push(`/create-contract${createQuery}` as any);
            }}
          >
            <Text style={styles.addBtnText}>+ عقد جديد</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="بحث بالرقم أو اسم المستأجر..."
          placeholderTextColor={colors.textTertiary}
          value={searchText}
          onChangeText={handleSearch}
          textAlign="right"
        />

        {/* Status filter chips */}
        <View style={styles.chipRow}>
          {[
            { key: null, label: 'الكل' },
            { key: 'active', label: 'نشط' },
            { key: 'ended', label: 'منتهي' },
            { key: 'cancelled', label: 'ملغى' },
          ].map((chip) => (
            <TouchableOpacity
              key={chip.key || 'all'}
              style={[
                styles.chip,
                statusFilter === chip.key && styles.chipActive,
              ]}
              onPress={() => setStatusFilter(chip.key)}
            >
              <Text
                style={[
                  styles.chipText,
                  statusFilter === chip.key && styles.chipTextActive,
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading && items.length === 0 ? (
        <SkeletonList count={5} />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ContractCard item={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <EmptyState
              title="لا توجد عقود"
              message="أنشئ أول عقد إيجار"
              actionLabel="عقد جديد"
              icon="📄"
              onAction={() => {
                const createQuery = buildQuery({ property_id: propertyIdParam, property_name: propertyNameParam, unit_id: unitIdParam, unit_name: unitNameParam });
                router.push(`/create-contract${createQuery}` as any);
              }}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  headerTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backText: { ...typography.captionBold, color: colors.primary },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'right',
  },
  scopeText: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  addBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
  },
  searchInput: {
    height: 42,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textInverse,
  },

  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },

  contractCard: { padding: 0, overflow: 'hidden' },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacing.lg,
    gap: spacing.md,
  },
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  tenantName: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'right',
  },
  propertyInfo: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: 2,
  },

  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    ...typography.small,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  detailValue: {
    ...typography.captionBold,
    color: colors.text,
  },
  detailDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderLight,
  },

  progressSection: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  overdueLabel: {
    ...typography.small,
    color: colors.danger,
    fontWeight: '600',
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
