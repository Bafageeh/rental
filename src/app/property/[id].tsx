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
  }>;
  parking_spots?: Array<{ id: number; spot_number?: string; status?: string }>;
  expenses?: Array<{ id: number; amount?: number; title?: string }>;
};

const typeMap: Record<string, string> = {
  building: 'عمارة', apartment: 'شقة', villa: 'فيلا',
  land: 'أرض', commercial: 'تجاري', other: 'أخرى',
};
const usageMap: Record<string, string> = {
  residential: 'سكني', commercial: 'تجاري', mixed: 'مختلط',
};
const mgmtMap: Record<string, string> = {
  owned: 'ملك خاص', managed: 'مُدار',
};

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

  const rented = (data.units || []).filter((u) => u.status === 'rented').length;
  const available = (data.units || []).filter((u) => u.status === 'available').length;
  const totalRent = (data.units || []).reduce((s, u) => s + (u.rent_amount || 0), 0);
  const totalExpenses = (data.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const propertyId = data.id;
  const encodedPropertyName = encodeURIComponent(data.name || `عقار #${propertyId}`);

  function openPropertyService(path: string, extraQuery = '') {
    const separator = extraQuery ? '&' : '';
    router.push(`${path}?property_id=${propertyId}&property_name=${encodedPropertyName}${separator}${extraQuery}` as any);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* رجوع فقط؛ اسم العقار يظهر داخل البطاقة لتوفير المساحة */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => smartBack()} style={styles.backPill}>
          <Text style={styles.backBtn}>→ رجوع</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.primary} />}
      >
        {/* Hero card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Text style={{ fontSize: 32 }}>
                {data.property_type === 'villa' ? '🏡' : '🏢'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{data.name}</Text>
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
              <Text style={styles.statNum}>{(data.units || []).length}</Text>
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

        <Card style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>إجراءات العقار</Text>
          <InlineEditDeleteActions resource="properties" id={data.id} hideDetails onChanged={reload} />
        </Card>

        <Card style={styles.servicesCard}>
          <Text style={styles.actionsTitle}>خدمات العقار</Text>
          <Text style={styles.servicesHint}>كل خدمة هنا خاصة بهذا العقار فقط.</Text>
          <View style={styles.servicesGrid}>
            <TouchableOpacity style={styles.serviceButton} onPress={() => openPropertyService('/expenses')}>
              <Text style={styles.serviceIcon}>📉</Text>
              <Text style={styles.serviceText}>المصروفات</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.serviceButton} onPress={() => openPropertyService('/contracts')}>
              <Text style={styles.serviceIcon}>📑</Text>
              <Text style={styles.serviceText}>العقود</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.serviceButton} onPress={() => openPropertyService('/create-contract')}>
              <Text style={styles.serviceIcon}>📝</Text>
              <Text style={styles.serviceText}>إنشاء عقد</Text>
            </TouchableOpacity>
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

        {/* Financial summary */}
        <View style={styles.finRow}>
          <StatCard label="إجمالي الإيجارات" value={money(totalRent)} color={colors.success} />
          <StatCard label="المصروفات" value={money(totalExpenses)} color={colors.danger} />
        </View>

        {/* Details */}
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

        {/* Units list */}
        {(data.units || []).length > 0 && (
          <>
            <SectionHeader title="الوحدات" />
            {data.units!.map((unit) => (
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
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <StatusBadge status={unit.status} size="sm" />
                    <Text style={styles.unitRent}>{money(unit.rent_amount)}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  backPill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  backBtn: { ...typography.captionBold, color: colors.primary },

  content: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 40 },

  heroCard: { padding: spacing.xl, marginBottom: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  heroName: { ...typography.h3, color: colors.text, textAlign: 'right' },
  heroLocation: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  heroOwner: { ...typography.small, color: colors.primary, textAlign: 'right', marginTop: 4 },

  actionsCard: { padding: spacing.md, marginBottom: spacing.lg },
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
  serviceIcon: { fontSize: 24, marginBottom: 4 },
  serviceText: { ...typography.captionBold, color: colors.text, textAlign: 'center' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statNum: { ...typography.h2, color: colors.text },
  statLbl: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  finRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },

  unitCard: { marginBottom: spacing.sm },
  unitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  unitNumber: { ...typography.bodyBold, color: colors.text, textAlign: 'right' },
  unitInfo: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  unitRent: { ...typography.captionBold, color: colors.text, marginTop: 4 },
});
