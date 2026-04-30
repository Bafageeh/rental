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
import { colors, typography, spacing, radii, money } from '../constants/theme';

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

type StatusFilterValue = string | null;

const statusOptions: Array<{ key: StatusFilterValue; label: string }> = [
  { key: null, label: 'الكل' },
  { key: 'active', label: 'نشط' },
  { key: 'ended', label: 'منتهي' },
  { key: 'cancelled', label: 'ملغي' },
];

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

function dateOnly(value?: string | null) {
  if (!value) return '-';
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : String(value);
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
          <Text style={styles.detailValue}>{dateOnly(item.start_date)}</Text>
        </View>
        <View style={styles.detailDivider} />
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>النهاية</Text>
          <Text style={styles.detailValue}>{dateOnly(item.end_date)}</Text>
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

  const { items, loading, refreshing, error, refresh, loadMore, search } =
    useList<ContractItem>({ endpoint: `/contracts${scopedQuery}`, scopedEndpoint: `/my/contracts${scopedQuery}` });

  const [searchText, setSearchText] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [statusMenuVisible, setStatusMenuVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(null);

  const currentStatusLabel = statusOptions.find((option) => option.key === statusFilter)?.label || 'الكل';

  const handleSearch = useCallback(
    (text: string) => {
      setSearchText(text);
      if (text.length === 0 || text.length >= 2) search(text);
    },
    [search]
  );

  function openCreateContract() {
    const createQuery = buildQuery({ property_id: propertyIdParam, property_name: propertyNameParam, unit_id: unitIdParam, unit_name: unitNameParam });
    router.push(`/create-contract${createQuery}` as any);
  }

  function toggleSearch() {
    setSearchVisible((current) => !current);
    setStatusMenuVisible(false);
  }

  function selectStatusFilter(value: StatusFilterValue) {
    setStatusFilter(value);
    setStatusMenuVisible(false);
  }

  const scopedFilteredItems = items.filter((item) => {
    if (propertyIdParam) {
      const propertyId = item.unit?.property?.id ?? item.unit?.property_id;
      if (String(propertyId || '') !== String(propertyIdParam)) return false;
    }
    if (unitIdParam && String(item.unit?.id || '') !== String(unitIdParam)) return false;
    return true;
  });

  const hasExistingScopedContract = isScoped && (loading || scopedFilteredItems.length > 0);
  const showCreateButton = !hasExistingScopedContract;

  const filteredItems = statusFilter
    ? scopedFilteredItems.filter((i) => i.status === statusFilter)
    : scopedFilteredItems;

  if (error && items.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {showCreateButton ? (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={openCreateContract}
              activeOpacity={0.86}
            >
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.headerTitleWrap}>
            {isScoped ? (
              <TouchableOpacity onPress={() => smartBack()} style={styles.backButton}>
                <Text style={styles.backText}>→</Text>
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
            style={[styles.searchToggle, searchVisible ? styles.searchToggleActive : null]}
            onPress={toggleSearch}
            activeOpacity={0.86}
          >
            <Text style={[styles.searchToggleText, searchVisible ? styles.searchToggleTextActive : null]}>⌕</Text>
          </TouchableOpacity>

          <View style={styles.statusDropdownWrap}>
            <TouchableOpacity
              style={styles.statusDropdownButton}
              onPress={() => {
                setStatusMenuVisible((current) => !current);
                setSearchVisible(false);
              }}
              activeOpacity={0.86}
            >
              <Text style={styles.statusDropdownText}>{currentStatusLabel}</Text>
              <Text style={styles.statusDropdownArrow}>{statusMenuVisible ? '⌃' : '⌄'}</Text>
            </TouchableOpacity>

            {statusMenuVisible ? (
              <View style={styles.statusMenu}>
                {statusOptions.map((option) => {
                  const active = statusFilter === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key || 'all'}
                      style={[styles.statusMenuItem, active ? styles.statusMenuItemActive : null]}
                      onPress={() => selectStatusFilter(option.key)}
                      activeOpacity={0.86}
                    >
                      <Text style={[styles.statusMenuText, active ? styles.statusMenuTextActive : null]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>

        {searchVisible ? (
          <TextInput
            style={styles.searchInput}
            placeholder="بحث بالرقم أو اسم المستأجر..."
            placeholderTextColor={colors.textTertiary}
            value={searchText}
            onChangeText={handleSearch}
            textAlign="right"
            autoFocus
          />
        ) : null}
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
              message={showCreateButton ? "أنشئ أول عقد إيجار" : "لا توجد عقود مطابقة للفلتر الحالي"}
              actionLabel={showCreateButton ? "عقد جديد" : undefined}
              icon="📄"
              onAction={showCreateButton ? openCreateContract : undefined}
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
    zIndex: 20,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    zIndex: 30,
  },
  headerTitleWrap: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { ...typography.bodyBold, color: colors.text },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'right',
  },
  scopeText: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  addBtnText: {
    color: colors.textInverse,
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '900',
  },
  searchToggle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchToggleActive: {
    backgroundColor: colors.primary,
  },
  searchToggleText: {
    color: colors.text,
    fontSize: 31,
    lineHeight: 34,
    fontWeight: '700',
  },
  searchToggleTextActive: {
    color: colors.textInverse,
  },
  statusDropdownWrap: {
    position: 'relative',
    zIndex: 40,
  },
  statusDropdownButton: {
    minWidth: 86,
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.surfaceSubtle,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  statusDropdownText: {
    ...typography.captionBold,
    color: colors.text,
  },
  statusDropdownArrow: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '900',
  },
  statusMenu: {
    position: 'absolute',
    top: 55,
    left: 0,
    width: 118,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 9,
  },
  statusMenuItem: {
    minHeight: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusMenuItemActive: {
    backgroundColor: colors.primary,
  },
  statusMenuText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  statusMenuTextActive: {
    color: colors.textInverse,
  },
  searchInput: {
    height: 42,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
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
