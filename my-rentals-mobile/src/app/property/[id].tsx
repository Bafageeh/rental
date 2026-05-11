import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Alert,
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
  document_number?: string;
  document_date_hijri?: string;
  document_date_gregorian?: string;
  document_status?: string;
  document_restrictions?: string;
  previous_document_date_hijri?: string;
  previous_document_number?: string;
  operation_type?: string;
  real_estate_identity_number?: string;
  plan_number?: string;
  plot_number?: string;
  block_number?: string;
  deed_owner_identifier?: string;
  deed_owner_name?: string;
  deed_owner_nationality?: string;
  deed_ownership_percentage?: string | number;
  deed_property_type_text?: string;
  deed_usage_text?: string;
  deed_neighboring_part?: string;
  deed_location_text?: string;
  deed_property_model?: string;
  deed_mortgage_status?: string;
  deed_mortgagee_name?: string;
  deed_mortgagee_entity_number?: string;
  deed_mortgage_amount?: string | number;
  deed_mortgage_due_date?: string;
  deed_mortgage_notes?: string;
  deed_north_boundary_type?: string;
  deed_north_boundary_description?: string;
  deed_north_boundary_length?: string | number;
  deed_south_boundary_type?: string;
  deed_south_boundary_description?: string;
  deed_south_boundary_length?: string | number;
  deed_east_boundary_type?: string;
  deed_east_boundary_description?: string;
  deed_east_boundary_length?: string | number;
  deed_west_boundary_type?: string;
  deed_west_boundary_description?: string;
  deed_west_boundary_length?: string | number;
  deed_boundaries_description?: string;
  national_short_address?: string;
  property_area?: number | string;
  property_type?: string;
  usage_type?: string;
  management_type?: string;
  floors_count?: number;
  elevators_count?: number;
  notes?: string;
  units_count?: number;
  property_contracts_count?: number;
  unit_contracts_count?: number;
  whole_property_contract_exists?: boolean;
  can_create_whole_property_contract?: boolean;
  can_create_unit_contract?: boolean;
  can_create_contract?: boolean;
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

type ContractScope = 'property' | 'unit';
type ContractMethod = 'manual' | 'upload';
type PropertyUnit = NonNullable<PropertyDetail['units']>[number];

const typeMap: Record<string, string> = {
  building: 'عمارة', apartment: 'وحدة', villa: 'فيلا', land: 'أرض', commercial: 'تجاري', other: 'أخرى',
};
const usageMap: Record<string, string> = { residential: 'سكني', commercial: 'تجاري', mixed: 'مختلط' };
const mgmtMap: Record<string, string> = { owned: 'ملك خاص', managed: 'مُدار' };

function unitContractsCount(unit: PropertyUnit) {
  if (typeof unit.contracts_count === 'number') return unit.contracts_count;
  return Array.isArray(unit.contracts) ? unit.contracts.length : 0;
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '-';
}

function moneyValue(value: unknown) {
  if (!hasValue(value)) return undefined;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? money(n) : String(value);
}

function DeedSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <SectionHeader title={title} />
      <Card>{children}</Card>
    </>
  );
}

function BoundaryRows({ data }: { data: PropertyDetail }) {
  const rows = [
    ['الشمال', data.deed_north_boundary_type, data.deed_north_boundary_description, data.deed_north_boundary_length],
    ['الجنوب', data.deed_south_boundary_type, data.deed_south_boundary_description, data.deed_south_boundary_length],
    ['الشرق', data.deed_east_boundary_type, data.deed_east_boundary_description, data.deed_east_boundary_length],
    ['الغرب', data.deed_west_boundary_type, data.deed_west_boundary_description, data.deed_west_boundary_length],
  ].filter((row) => row.slice(1).some(hasValue));

  if (rows.length === 0 && !hasValue(data.deed_boundaries_description)) return null;

  return (
    <DeedSection title="حدود العقار">
      {rows.map(([label, type, desc, len]) => (
        <InfoRow
          key={String(label)}
          label={String(label)}
          value={[type, desc, hasValue(len) ? `الطول ${len} م` : null].filter(hasValue).join(' - ')}
        />
      ))}
      {hasValue(data.deed_boundaries_description) ? <InfoRow label="وصف الحدود" value={data.deed_boundaries_description} /> : null}
    </DeedSection>
  );
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useDetail<PropertyDetail>({ endpoint: `/properties/${id}` });

  const shouldReturnAfterDelete = !!error && /No query results|not found|غير موجود/i.test(String(error));

  useEffect(() => {
    if (!shouldReturnAfterDelete) return;
    const timer = setTimeout(() => { smartBack(); }, 250);
    return () => clearTimeout(timer);
  }, [shouldReturnAfterDelete]);

  useEffect(() => {
    globalThis.__RENTAL_EDIT_CONTEXT__ = { resource: 'properties', id: id || '', owner_id: data?.owner?.id || '' };
    return () => {
      if (globalThis.__RENTAL_EDIT_CONTEXT__?.resource === 'properties' && String(globalThis.__RENTAL_EDIT_CONTEXT__?.id || '') === String(id || '')) {
        globalThis.__RENTAL_EDIT_CONTEXT__ = undefined;
      }
    };
  }, [id, data?.owner?.id]);

  if (loading || shouldReturnAfterDelete) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'غير موجود'} onRetry={reload} />;

  const units = data.units || [];
  const rented = units.filter((u) => u.status === 'rented').length;
  const available = units.filter((u) => u.status === 'available').length;
  const totalRent = units.reduce((s, u) => s + (u.rent_amount || 0), 0);
  const totalExpenses = (data.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const unitContracts = units.reduce((sum, unit) => sum + unitContractsCount(unit), 0);
  const propertyContracts = Number(data.property_contracts_count || 0);
  const totalContracts = propertyContracts + Number(data.unit_contracts_count ?? unitContracts);
  const hasAnyContracts = totalContracts > 0;
  const unitsWithoutContract = units.filter((unit) => unitContractsCount(unit) === 0);
  const hasUnitsWithoutContract = unitsWithoutContract.length > 0;
  const canCreateWholePropertyContract = typeof data.can_create_whole_property_contract === 'boolean'
    ? data.can_create_whole_property_contract
    : propertyContracts === 0;
  const canCreateUnitContract = typeof data.can_create_unit_contract === 'boolean'
    ? data.can_create_unit_contract
    : units.length > 0 && propertyContracts === 0 && hasUnitsWithoutContract;
  const shouldShowCreateContract = typeof data.can_create_contract === 'boolean'
    ? data.can_create_contract
    : canCreateWholePropertyContract || canCreateUnitContract;
  const propertyId = data.id;
  const encodedPropertyName = encodeURIComponent(data.name || `عقار #${propertyId}`);

  function openPropertyService(path: string, extraQuery = '') {
    const separator = extraQuery ? '&' : '';
    router.push(`${path}?property_id=${propertyId}&property_name=${encodedPropertyName}${separator}${extraQuery}` as any);
  }

  function openAddUnit() {
    const query = [
      `property_id=${propertyId}`,
      `property_name=${encodedPropertyName}`,
      'unit_scope=property',
      'create=1',
    ];

    if (data.owner?.id) query.push(`owner_id=${data.owner.id}`);
    if (data.owner?.name) query.push(`owner_name=${encodeURIComponent(data.owner.name)}`);

    router.push(`/units?${query.join('&')}` as any);
  }

  function contractQuery(scope: ContractScope, unit?: PropertyUnit) {
    const parts = [
      `property_id=${propertyId}`,
      `property_name=${encodedPropertyName}`,
      `contract_scope=${scope}`,
      `target_type=${scope}`,
      'source=property-details',
    ];

    if (data.owner?.id) parts.push(`owner_id=${data.owner.id}`);
    if (data.owner?.name) parts.push(`owner_name=${encodeURIComponent(data.owner.name)}`);
    if (scope === 'unit' && unit?.id) parts.push(`unit_id=${unit.id}`);
    if (scope === 'unit' && unit?.unit_number) parts.push(`unit_name=${encodeURIComponent(unit.unit_number)}`);
    if (scope === 'property') parts.push('unit_name=%D8%A7%D9%84%D8%B9%D9%82%D8%A7%D8%B1%20%D9%83%D8%A7%D9%85%D9%84');

    return parts.join('&');
  }

  function openContractFlow(method: ContractMethod, scope: ContractScope, unit?: PropertyUnit) {
    const query = contractQuery(scope, unit);
    const target = method === 'upload' ? '/upload-contract' : '/create-contract';
    router.push(`${target}?${query}` as any);
  }

  function askContractMethod(scope: ContractScope, unit?: PropertyUnit) {
    const targetName = scope === 'unit'
      ? `الوحدة ${unit?.unit_number || unit?.id || ''}`.trim()
      : 'العقار بالكامل';

    Alert.alert('إضافة عقد', `اختر طريقة إضافة العقد على ${targetName}:`, [
      { text: 'رفع عقد PDF', onPress: () => openContractFlow('upload', scope, unit) },
      { text: 'إنشاء عقد يدوي', onPress: () => openContractFlow('manual', scope, unit) },
      { text: 'إلغاء', style: 'cancel' },
    ]);
  }

  function askUnitTarget() {
    const selectableUnits = unitsWithoutContract.length > 0 ? unitsWithoutContract : units;

    if (selectableUnits.length === 0) {
      Alert.alert('تنبيه', 'لا توجد وحدات تحت هذا العقار.');
      return;
    }

    Alert.alert(
      'اختر الوحدة',
      'اختر الوحدة التي تريد إنشاء أو رفع العقد عليها:',
      [
        ...selectableUnits.map((unit) => ({
          text: unit.unit_number || `وحدة #${unit.id}`,
          onPress: () => askContractMethod('unit', unit),
        })),
        { text: 'إلغاء', style: 'cancel' as const },
      ],
    );
  }

  function chooseContractTarget() {
    if (!shouldShowCreateContract) {
      Alert.alert('تنبيه', 'لا يمكن إنشاء عقد جديد؛ يوجد عقد مسجل على هذا العقار أو وحداته.');
      return;
    }

    if (units.length > 0) {
      Alert.alert('إنشاء عقد', 'هل تريد العقد على العقار كامل أم على إحدى الوحدات؟', [
        {
          text: 'العقار كامل',
          onPress: () => {
            if (!canCreateWholePropertyContract) {
              Alert.alert('تنبيه', 'لا يمكن إنشاء عقد على العقار بالكامل؛ توجد عقود أو قيود مرتبطة بوحدات هذا العقار.');
              return;
            }
            askContractMethod('property');
          },
        },
        {
          text: 'إحدى الوحدات',
          onPress: () => {
            if (!canCreateUnitContract) {
              Alert.alert('تنبيه', 'لا توجد وحدة متاحة بدون عقد داخل هذا العقار.');
              return;
            }
            askUnitTarget();
          },
        },
        { text: 'إلغاء', style: 'cancel' },
      ]);
      return;
    }

    askContractMethod('property');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.primary} />}>
        <Card style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Text style={{ fontSize: 32 }}>{data.property_type === 'villa' ? '🏡' : data.property_type === 'apartment' ? '🏠' : data.property_type === 'land' ? '🧭' : '🏢'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <InlineEditDeleteActions resource="properties" id={data.id} hideDetails compact iconOnly onChanged={reload} />
                <Text style={styles.heroName}>{data.name}</Text>
              </View>
              <Text style={styles.heroLocation}>{[data.district, data.city].filter(Boolean).join('، ')}</Text>
              {data.owner && <Text style={styles.heroOwner}>المالك: {data.owner.name}</Text>}
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}><Text style={styles.statNum}>{units.length}</Text><Text style={styles.statLbl}>وحدة</Text></View>
            <View style={styles.statItem}><Text style={[styles.statNum, { color: colors.success }]}>{rented}</Text><Text style={styles.statLbl}>مؤجرة</Text></View>
            <View style={styles.statItem}><Text style={[styles.statNum, { color: colors.warning }]}>{available}</Text><Text style={styles.statLbl}>شاغرة</Text></View>
          </View>
        </Card>

        <Card style={styles.servicesCard}>
          <Text style={styles.actionsTitle}>خدمات العقار</Text>
          <Text style={styles.servicesHint}>كل خدمة هنا خاصة بهذا العقار فقط.</Text>
          <View style={styles.servicesGrid}>
            <TouchableOpacity style={[styles.serviceButton, styles.addUnitService]} onPress={openAddUnit}><Text style={styles.serviceIcon}>＋</Text><Text style={styles.serviceText}>إضافة وحدة</Text></TouchableOpacity>
            <TouchableOpacity style={styles.serviceButton} onPress={() => openPropertyService('/expenses')}><Text style={styles.serviceIcon}>📉</Text><Text style={styles.serviceText}>المصروفات</Text></TouchableOpacity>
            {hasAnyContracts ? <TouchableOpacity style={styles.serviceButton} onPress={() => openPropertyService('/contracts')}><Text style={styles.serviceIcon}>📑</Text><Text style={styles.serviceText}>العقود</Text></TouchableOpacity> : null}
            {shouldShowCreateContract ? <TouchableOpacity style={[styles.serviceButton, styles.createContractService]} onPress={chooseContractTarget}><Text style={styles.serviceIcon}>📝</Text><Text style={styles.serviceText}>إنشاء / رفع عقد</Text></TouchableOpacity> : null}
            <TouchableOpacity style={styles.serviceButton} onPress={() => openPropertyService('/documents', 'entity_type=property')}><Text style={styles.serviceIcon}>📁</Text><Text style={styles.serviceText}>المستندات</Text></TouchableOpacity>
            <TouchableOpacity style={styles.serviceButton} onPress={() => openPropertyService('/files')}><Text style={styles.serviceIcon}>📂</Text><Text style={styles.serviceText}>الملفات والوسائط</Text></TouchableOpacity>
          </View>
        </Card>

        <View style={styles.finRow}>
          <StatCard label="إجمالي الإيجارات" value={money(totalRent)} color={colors.success} />
          <StatCard label="المصروفات" value={money(totalExpenses)} color={colors.danger} />
        </View>

        <DeedSection title="تفاصيل العقار">
          <InfoRow label="النوع" value={typeMap[data.property_type || ''] || data.property_type} />
          <InfoRow label="الاستخدام" value={usageMap[data.usage_type || ''] || data.usage_type} />
          <InfoRow label="الإدارة" value={mgmtMap[data.management_type || ''] || data.management_type} />
          <InfoRow label="رقم الصك" value={data.deed_number || data.document_number} />
          <InfoRow label="العنوان الوطني المختصر" value={data.national_short_address} />
          <InfoRow label="مساحة العقار" value={data.property_area ? `${data.property_area} م²` : undefined} />
          <InfoRow label="عدد الأدوار" value={data.floors_count} />
          <InfoRow label="المصاعد" value={data.elevators_count} />
          {data.address && <InfoRow label="العنوان" value={data.address} />}
          {data.notes && <InfoRow label="ملاحظات" value={data.notes} />}
        </DeedSection>

        <DeedSection title="بيانات الوثيقة">
          <InfoRow label="تاريخ الوثيقة" value={data.document_date_hijri} />
          <InfoRow label="التاريخ الميلادي" value={data.document_date_gregorian} />
          <InfoRow label="الحالة" value={data.document_status} />
          <InfoRow label="القيود" value={data.document_restrictions} />
          <InfoRow label="تاريخ الوثيقة السابقة" value={data.previous_document_date_hijri} />
          <InfoRow label="رقم الوثيقة السابقة" value={data.previous_document_number} />
          <InfoRow label="نوع العملية" value={data.operation_type} />
        </DeedSection>

        <DeedSection title="بيانات المالك في الصك">
          <InfoRow label="رقم الهوية" value={data.deed_owner_identifier} />
          <InfoRow label="الاسم" value={data.deed_owner_name} />
          <InfoRow label="الجنسية" value={data.deed_owner_nationality} />
          <InfoRow label="نسبة التملك" value={hasValue(data.deed_ownership_percentage) ? `${data.deed_ownership_percentage}%` : undefined} />
        </DeedSection>

        <DeedSection title="بيانات الصك العقارية">
          <InfoRow label="رقم الهوية العقارية" value={data.real_estate_identity_number} />
          <InfoRow label="نوع العقار في الصك" value={data.deed_property_type_text} />
          <InfoRow label="نوع الاستخدام" value={data.deed_usage_text} />
          <InfoRow label="رقم القطعة" value={data.plot_number} />
          <InfoRow label="رقم المخطط" value={data.plan_number} />
          <InfoRow label="البلك" value={data.block_number} />
          <InfoRow label="المجاورة / الجزء" value={data.deed_neighboring_part} />
          <InfoRow label="الموقع" value={data.deed_location_text} />
          <InfoRow label="نموذج العقار" value={data.deed_property_model} />
        </DeedSection>

        {(hasValue(data.deed_mortgage_status) || hasValue(data.deed_mortgagee_name) || hasValue(data.deed_mortgage_amount)) ? (
          <DeedSection title="بيانات الرهن / القيود المالية">
            <InfoRow label="حالة الرهن" value={data.deed_mortgage_status} />
            <InfoRow label="الجهة المرتهنة" value={data.deed_mortgagee_name} />
            <InfoRow label="رقم المنشأة" value={data.deed_mortgagee_entity_number} />
            <InfoRow label="قيمة الرهن" value={moneyValue(data.deed_mortgage_amount)} />
            <InfoRow label="تاريخ الاستحقاق" value={data.deed_mortgage_due_date} />
            <InfoRow label="ملاحظات" value={data.deed_mortgage_notes} />
          </DeedSection>
        ) : null}

        <BoundaryRows data={data} />

        {units.length > 0 && (
          <>
            <SectionHeader title="الوحدات" />
            {units.map((unit) => {
              const contractsCount = unitContractsCount(unit);
              const hasContract = contractsCount > 0;
              return (
                <Card key={unit.id} style={styles.unitCard} onPress={() => router.push(`/unit/${unit.id}` as any)}>
                  <View style={styles.unitRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.unitNumber}>{unit.unit_number}</Text>
                      <Text style={styles.unitInfo}>{unit.type || 'شقة'} — الطابق {unit.floor || '-'}</Text>
                      <Text style={hasContract ? styles.unitContractOk : styles.unitContractEmpty}>{hasContract ? `يوجد ${contractsCount} عقد` : 'لا يوجد عقد'}</Text>
                    </View>
                    <View style={styles.unitActionsColumn}>
                      <StatusBadge status={unit.status} size="sm" />
                      {!hasContract && canCreateUnitContract ? <TouchableOpacity style={styles.unitCreateContractButton} onPress={(event) => { event.stopPropagation?.(); askContractMethod('unit', unit); }}><Text style={styles.unitCreateContractIcon}>📝</Text><Text style={styles.unitCreateContractText}>إنشاء / رفع عقد</Text></TouchableOpacity> : null}
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
  heroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heroName: { ...typography.h3, color: colors.text, textAlign: 'right', flex: 1 },
  heroLocation: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  heroOwner: { ...typography.small, color: colors.primary, textAlign: 'right', marginTop: 4 },
  actionsTitle: { ...typography.bodyBold, color: colors.text, textAlign: 'right', marginBottom: spacing.sm },
  servicesCard: { padding: spacing.md, marginBottom: spacing.lg },
  servicesHint: { ...typography.small, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.md },
  servicesGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  serviceButton: { width: '48%', minHeight: 78, borderRadius: radii.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  addUnitService: { borderColor: colors.primary, backgroundColor: colors.primary },
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
  unitCreateContractButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, borderRadius: radii.full, backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.primary },
  unitCreateContractIcon: { fontSize: 13 },
  unitCreateContractText: { ...typography.small, color: colors.primary, fontWeight: '900' },
  unitRent: { ...typography.captionBold, color: colors.text, marginTop: 4 },
});
