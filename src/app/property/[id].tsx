import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDetail } from '../../hooks/useCrud';
import {
  Card,
  StatusBadge,
  InfoRow,
  SectionHeader,
  StatCard,
  LoadingState,
  ErrorState,
} from '../../components/ui/shared';
import { colors, typography, spacing, radii, money } from '../../constants/theme';
import InlineEditDeleteActions from '../../components/InlineEditDeleteActions';

import { smartBack } from "@/lib/navigationHistory";
type PropertyDetail = {
  id: number;
  name?: string;
  city?: string;
  district?: string;
  address?: string;
  deed_number?: string;
  national_short_address?: string;
  property_area?: number | string;
  property_type?: string;
  usage_type?: string;
  management_type?: string;
  floors_count?: number;
  elevators_count?: number;
  notes?: string;
  owner?: { id: number; name?: string; type?: string };
  units?: Array<{
    id: number;
    unit_number?: string;
    floor?: string;
    type?: string;
    status?: string;
    rent_amount?: number;
    contracts_count?: number;
    contracts?: Array<{ id: number }>;
  }>;
  parking_spots?: Array<{ id: number; spot_number?: string; status?: string }>;
  expenses?: Array<{ id: number; amount?: number; title?: string }>;
};

const typeMap: Record<string, string> = {
  building: 'عمارة', apartment: 'وحدة', villa: 'فيلا',
  land: 'أرض', commercial: 'تجاري', other: 'أخرى',
};
const usageMap: Record<string, string> = {
  residential: 'سكني', commercial: 'تجاري', mixed: 'مختلط',
};
const mgmtMap: Record<string, string> = {
  owned: 'ملك خاص', managed: 'مُدار',
};

function unitContractsCount(unit: NonNullable<PropertyDetail['units']>[number]) {
  if (typeof unit.contracts_count === 'number') return unit.contracts_count;
  return Array.isArray(unit.contracts) ? unit.contracts.length : 0;
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useDetail<PropertyDetail>({
    endpoint: `/properties/${id}`,
  });

  const shouldReturnAfterDelete = !!error && /No query results|not found|غير موجود/i.test(String(error));

  useEffect(() => {
    if (!shouldReturnAfterDelete) return;

    const timer = setTimeout(() => {
      smartBack();
    }, 250);

    return () => clearTimeout(timer);
  }, [shouldReturnAfterDelete]);

  if (loading || shouldReturnAfterDelete) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'غير موجود'} onRetry={reload} />;

  const units = data.units || [];
  const rented = units.filter((u) => u.status === 'rented').length;
  const available = units.filter((u) => u.status === 'available').length;
  const totalRent = units.reduce((s, u) => s + (u.rent_amount || 0), 0);
  const totalExpenses = (data.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const totalContracts = units.reduce((sum, unit) => sum + unitContractsCount(unit), 0);
  const hasAnyContracts = totalContracts > 0;
  const hasUnitsWithoutContract = units.some((unit) => unitContractsCount(unit) === 0);
  const propertyId = data.id;
  const encodedPropertyName = encodeURIComponent(data.name || `عقار #${propertyId}`);

  function openPropertyService(path: string, extraQuery = '') {
    const separator = extraQuery ? '&' : '';
    router.push(`${path}?property_id=${propertyId}&property_name=${encodedPropertyName}${separator}${extraQuery}` as any);
  }

  function openCreateContractForUnit(unit?: NonNullable<PropertyDetail['units']>[number]) {
    const parts = [
      `property_id=${propertyId}`,
      `property_name=${encodedPropertyName}`,
    ];

    if (data.owner?.id) parts.push(`owner_id=${data.owner.id}`);
    if (data.owner?.name) parts.push(`owner_name=${encodeURIComponent(data.owner.name)}`);
    if (unit?.id) parts.push(`unit_id=${unit.id}`);
    if (unit?.unit_number) parts.push(`unit_name=${encodeURIComponent(unit.unit_number)}`);

    router.push(`/create-contract?${parts.join('&')}` as any);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.primary} />}
      >
        <Card style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Text style={{ fontSize: 32 }}>
                {data.property_type === 'villa' ? '🏡' : data.property_type === 'apartment' ? '🏠' : '🏢'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <InlineEditDeleteActions resource="properties" id={data.id} hideDetails compact iconOnly onChanged={reload} />
                <Text style={styles.heroName}>{data.name}</Text>
              </View>
              <Text style={styles.heroLocation}>
                {[data.district, data.city].filter(Boolean).join('، ')}
              </Text>
              {data.owner && (
                <Text style={styles.heroOwner}>المالك: {data.owner.name}</Text>
              )}
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{units.length}</Text>
              <Text style={styles.statLbl}>وحدة</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.success }]}>{rented}</Text>
              <Text style={styles.statLbl}>مؤجرة</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.warning }]}>{available}</Text>
              <Text style={styles.statLbl}>شاغرة</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.servicesCard}>
          <Text style={styles.actionsTitle}>خدمات العقار</Text>
          <Text style={styles.servicesHint}>كل خدمة هنا خاصة بهذا العقار فقط.</Text>
          <View style={styles.servicesGrid}>
            <TouchableOpacity style={styles.serviceButton} onPress={() => openPropertyService('/expenses')}>
              <Text style={styles.serviceIcon}>📉</Text>
              <Text style={styles.serviceText}>المصروفات</Text>
            </TouchableOpacity>
            {hasAnyContracts ? (
              <TouchableOpacity style={styles.serviceButton} onPress={() => openPropertyService('/contracts')}>
                <Text style={styles.serviceIcon}>📑</Text>
                <Text style={styles.serviceText}>العقود</Text>
              </TouchableOpacity>
            ) : null}
            {hasUnitsWithoutContract ? (
              <TouchableOpacity style={[styles.serviceButton, styles.createContractService]} onPress={() => openCreateContractForUnit()}>
                <Text style={styles.serviceIcon}>📝</Text>
                <Text style={styles.serviceText}>إنشاء عقد</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.serviceButton} onPress={() => openPropertyService('/documents', 'entity_type=property')}>
              <Text style={styles.serviceIcon}>📁</Text>
              <Text style={styles.serviceText}>المستندات</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.serviceButton} onPress={() => openPropertyService('/files')}>
              <Text style={styles.serviceIcon}>📂</Text>
              <Text style={styles.serviceText}>الملفات والوسائط</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <View style={styles.finRow}>
          <StatCard label="إجمالي الإيجارات" value={money(totalRent)} color={colors.success} />
          <StatCard label="المصروفات" value={money(totalExpenses)} color={colors.danger} />
        </View>

        <SectionHeader title="تفاصيل العقار" />
        <Card>
          <InfoRow label="النوع" value={typeMap[data.property_type || ''] || data.property_type} />
          <InfoRow label="الاستخدام" value={usageMap[data.usage_type || ''] || data.usage_type} />
          <InfoRow label="الإدارة" value={mgmtMap[data.management_type || ''] || data.management_type} />
          <InfoRow label="رقم الصك" value={data.deed_number} />
          <InfoRow label="العنوان الوطني المختصر" value={data.national_short_address} />
          <InfoRow label="مساحة العقار" value={data.property_area ? `${data.property_area} م²` : undefined} />
          <InfoRow label="عدد الأدوار" value={data.floors_count} />
          <InfoRow label="المصاعد" value={data.elevators_count} />
          {data.address && <InfoRow label="العنوان" value={data.address} />}
          {data.notes && <InfoRow label="ملاحظات" value={data.notes} />}
        </Card>

        {units.length > 0 && (
          <>
            <SectionHeader title="الوحدات" />
            {units.map((unit) => {
              const contractsCount = unitContractsCount(unit);
              const hasContract = contractsCount > 0;

              return (
                <Card
                  key={unit.id}
                  style={styles.unitCard}
                  onPress={() => router.push(`/unit/${unit.id}` as any)}
                >
                  <View style={styles.unitRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.unitNumber}>{unit.unit_number}</Text>
                      <Text style={styles.unitInfo}>
                        {unit.type || 'شقة'} — الطابق {unit.floor || '-'}
                      </Text>
                      <Text style={hasContract ? styles.unitContractOk : styles.unitContractEmpty}>
                        {hasContract ? `يوجد ${contractsCount} عقد` : 'لا يوجد عقد'}
                      </Text>
                    </View>
                    <View style={styles.unitActionsColumn}>
                      <StatusBadge status={unit.status} size="sm" />
                      {!hasContract ? (
                        <TouchableOpacity
                          style={styles.unitCreateContractButton}
                          onPress={(event) => {
                            event.stopPropagation?.();
                            openCreateContractForUnit(unit);
                          }}
                        >
                          <Text style={styles.unitCreateContractIcon}>📝</Text>
                          <Text style={styles.unitCreateContractText}>إنشاء عقد</Text>
                        </TouchableOpacity>
                      ) : null}
                      <Text style={styles.unitRent}>{money(unit.rent_amount)}</Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.lg, paddingBottom: 40 },

  heroCard: { padding: spacing.xl, marginBottom: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heroName: { ...typography.h3, color: colors.text, textAlign: 'right', flex: 1 },
  heroLocation: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  heroOwner: { ...typography.small, color: colors.primary, textAlign: 'right', marginTop: 4 },

  actionsTitle: { ...typography.bodyBold, color: colors.text, textAlign: 'right', marginBottom: spacing.sm },
  servicesCard: { padding: spacing.md, marginBottom: spacing.lg },
  servicesHint: { ...typography.small, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.md },
  servicesGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  serviceButton: {
    width: '48%',
    minHeight: 78,
    borderRadius: radii.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  createContractService: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  serviceIcon: { fontSize: 24, marginBottom: 4 },
  serviceText: { ...typography.captionBold, color: colors.text, textAlign: 'center' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statNum: { ...typography.h2, color: colors.text },
  statLbl: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  finRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },

  unitCard: { marginBottom: spacing.sm },
  unitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  unitNumber: { ...typography.bodyBold, color: colors.text, textAlign: 'right' },
  unitInfo: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  unitContractOk: { ...typography.small, color: colors.success, textAlign: 'right', marginTop: 4, fontWeight: '800' },
  unitContractEmpty: { ...typography.small, color: colors.warning, textAlign: 'right', marginTop: 4, fontWeight: '800' },
  unitActionsColumn: { alignItems: 'flex-end', gap: 6 },
  unitCreateContractButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.full,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  unitCreateContractIcon: { fontSize: 13 },
  unitCreateContractText: { ...typography.small, color: colors.primary, fontWeight: '900' },
  unitRent: { ...typography.captionBold, color: colors.text, marginTop: 4 },
});
