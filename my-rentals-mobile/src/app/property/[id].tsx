import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
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
import { useDetail } from '../../hooks/useCrud';
import { apiPost } from '../../lib/api';
import { smartBack } from '@/lib/navigationHistory';

type PropertyUnit = {
  id: number;
  unit_number?: string | null;
  floor?: string | number | null;
  type?: string | null;
  status?: string | null;
  rent_amount?: number | string | null;
  contracts_count?: number;
  contracts?: Array<{ id: number }>;
};

type PropertyDetail = {
  id: number;
  name?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  deed_number?: string | null;
  document_number?: string | null;
  document_date_hijri?: string | null;
  document_date_gregorian?: string | null;
  document_status?: string | null;
  document_restrictions?: string | null;
  previous_document_date_hijri?: string | null;
  previous_document_number?: string | null;
  operation_type?: string | null;
  real_estate_identity_number?: string | null;
  plan_number?: string | null;
  plot_number?: string | null;
  block_number?: string | null;
  deed_property_type_text?: string | null;
  deed_usage_text?: string | null;
  deed_neighboring_part?: string | null;
  deed_location_text?: string | null;
  deed_property_model?: string | null;
  deed_mortgage_status?: string | null;
  deed_mortgagee_name?: string | null;
  deed_mortgage_amount?: string | number | null;
  deed_mortgage_due_date?: string | null;
  deed_boundaries_description?: string | null;
  national_short_address?: string | null;
  property_area?: number | string | null;
  property_type?: string | null;
  usage_type?: string | null;
  management_type?: string | null;
  floors_count?: number | string | null;
  elevators_count?: number | string | null;
  parking_spots_count?: number | string | null;
  notes?: string | null;
  total_rent_amount?: number | string | null;
  property_contracts_count?: number;
  unit_contracts_count?: number;
  can_create_contract?: boolean;
  owner?: { id: number; name?: string | null; type?: string | null } | null;
  units?: PropertyUnit[];
  expenses?: Array<{ id: number; amount?: number | string | null; title?: string | null }>;
};

const typeMap: Record<string, string> = {
  building: 'عمارة',
  apartment: 'شقة',
  villa: 'فيلا',
  land: 'أرض',
  commercial: 'تجاري',
  mixed: 'مختلط',
  other: 'أخرى',
};
const detailTitleMap: Record<string, string> = {
  building: 'تفاصيل العمارة',
  apartment: 'تفاصيل الشقة',
  villa: 'تفاصيل الفيلا',
  land: 'تفاصيل الأرض',
  commercial: 'تفاصيل العقار التجاري',
  mixed: 'تفاصيل العقار المختلط',
  other: 'تفاصيل العقار',
};
const usageMap: Record<string, string> = { residential: 'سكني', commercial: 'تجاري', mixed: 'مختلط' };
const mgmtMap: Record<string, string> = { owned: 'ملك خاص', managed: 'إدارة للغير' };

function detailTitleForType(propertyType?: string | null) {
  return detailTitleMap[String(propertyType || '')] || 'تفاصيل العقار';
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '-';
}

function display(value: unknown) {
  return hasValue(value) ? String(value) : '-';
}

function numberValue(value: unknown) {
  const n = Number(String(value ?? 0).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown) {
  return `${numberValue(value).toLocaleString('ar-SA')} ر.س`;
}

function unitContractsCount(unit: PropertyUnit) {
  if (typeof unit.contracts_count === 'number') return unit.contracts_count;
  return Array.isArray(unit.contracts) ? unit.contracts.length : 0;
}

function queryValue(value: unknown) {
  return encodeURIComponent(String(value ?? ''));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function CollapsibleSection({ title, icon, subtitle, children, defaultOpen = false }: { title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.sectionCardCompact}>
      <TouchableOpacity style={styles.collapsibleHeader} activeOpacity={0.84} onPress={() => setOpen((value) => !value)}>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={21} color="#0B3B3C" />
        <View style={styles.collapsibleTitleBox}>
          <Text style={styles.sectionTitleCompact}>{title}</Text>
          {subtitle ? <Text style={styles.collapsibleHint}>{subtitle}</Text> : null}
        </View>
        <View style={styles.sectionIconBox}>
          <MaterialCommunityIcons name={icon} size={24} color="#0F766E" />
        </View>
      </TouchableOpacity>
      {open ? <View style={styles.collapsibleBody}>{children}</View> : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: unknown }) {
  if (!hasValue(value)) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoValue}>{display(value)}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

function StatCard({ icon, value, label }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; value: unknown; label: string }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconBox}><MaterialCommunityIcons name={icon} size={24} color="#0F766E" /></View>
      <Text style={styles.statValue}>{display(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ServiceButton({ icon, label, onPress, full = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; full?: boolean }) {
  return (
    <TouchableOpacity style={[styles.serviceButton, full && styles.serviceButtonFull]} activeOpacity={0.86} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={27} color="#0F766E" />
      <Text style={styles.serviceText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { data, loading, error, reload } = useDetail<PropertyDetail>({ endpoint: `/properties/${id}` });
  const shouldReturnAfterDelete = !!error && /No query results|not found|غير موجود/i.test(String(error));

  useEffect(() => {
    if (!shouldReturnAfterDelete) return;
    const timer = setTimeout(() => smartBack(), 250);
    return () => clearTimeout(timer);
  }, [shouldReturnAfterDelete]);

  useEffect(() => {
    if (!data) return;
    navigation.setOptions({ title: detailTitleForType(data.property_type) });
  }, [data?.property_type, navigation]);

  if (loading || shouldReturnAfterDelete) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingBox}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>جاري تحميل العقار...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>تعذر عرض العقار</Text>
          <Text style={styles.errorText}>{String(error || 'غير موجود')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={reload}>
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isApartmentProperty = String(data.property_type || '') === 'apartment';
  const units = data.units || [];
  const rented = units.filter((unit) => unit.status === 'rented').length;
  const available = units.filter((unit) => unit.status === 'available').length;
  const totalRent = hasValue(data.total_rent_amount)
    ? numberValue(data.total_rent_amount)
    : units.reduce((sum, unit) => sum + numberValue(unit.rent_amount), 0);
  const totalExpenses = (data.expenses || []).reduce((sum, expense) => sum + numberValue(expense.amount), 0);
  const propertyId = data.id;
  const encodedPropertyName = queryValue(data.name || `عقار #${propertyId}`);
  const ownerQuery = data.owner?.id ? `&owner_id=${data.owner.id}&owner_name=${queryValue(data.owner.name || '')}` : '';
  const unitContracts = units.reduce((sum, unit) => sum + unitContractsCount(unit), 0);
  const totalContracts = Number(data.property_contracts_count || 0) + Number(data.unit_contracts_count ?? unitContracts);
  const canCreateContract = typeof data.can_create_contract === 'boolean' ? data.can_create_contract : totalContracts === 0;

  function openEditProperty() {
    router.push(`/property-form?id=${propertyId}` as never);
  }

  function openRepository() {
    router.push(`/files?property_id=${propertyId}&property_name=${encodedPropertyName}${ownerQuery}` as never);
  }

  function openAddUnit() {
    const query = new URLSearchParams();
    if (data.owner?.id) query.set('owner_id', String(data.owner.id));
    query.set('property_type', 'apartment');
    query.set('lock_property_type', '1');
    query.set('source_property_id', String(propertyId));
    query.set('source_property_name', data.name || `عقار #${propertyId}`);
    router.push(`/property-form?${query.toString()}` as never);
  }

  function openPropertyService(path: string) {
    router.push(`${path}?property_id=${propertyId}&property_name=${encodedPropertyName}${ownerQuery}` as never);
  }

  function openCreateContract() {
    Alert.alert('إضافة عقد', 'اختر طريقة إضافة العقد:', [
      {
        text: 'رفع عقد PDF',
        onPress: () => router.push(`/upload-contract?property_id=${propertyId}&property_name=${encodedPropertyName}&contract_scope=property&target_type=property${ownerQuery}` as never),
      },
      {
        text: 'إنشاء عقد يدوي',
        onPress: () => router.push(`/create-contract?property_id=${propertyId}&property_name=${encodedPropertyName}&contract_scope=property&target_type=property${ownerQuery}` as never),
      },
      { text: 'إلغاء', style: 'cancel' },
    ]);
  }

  function confirmDeleteProperty() {
    Alert.alert('حذف العقار', `هل تريد حذف ${data.name || `عقار #${propertyId}`}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiPost(`/edit-delete-center/properties/${propertyId}/delete`, {});
            Alert.alert('تم', 'تم حذف العقار.', [{ text: 'حسنًا', onPress: () => smartBack() }]);
          } catch (e) {
            Alert.alert('تعذر الحذف', e instanceof Error ? e.message : 'حدث خطأ غير متوقع');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor="#0F766E" />}>
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroMenuDot}><Ionicons name="ellipsis-vertical" size={19} color="#E0F2F1" /></View>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Text style={styles.heroEmoji}>{data.property_type === 'villa' ? '🏡' : data.property_type === 'apartment' ? '🏠' : data.property_type === 'land' ? '🧭' : '🏢'}</Text>
            </View>
            <View style={styles.heroTextBox}>
              <Text style={styles.heroTitle}>{data.name || `عقار #${propertyId}`}</Text>
              <View style={styles.heroLocationLine}>
                <Ionicons name="location-outline" size={15} color="#CBD5E1" />
                <Text style={styles.heroSubtitle}>{[data.district, data.city].filter(Boolean).join('، ') || 'لا يوجد موقع مسجل'}</Text>
              </View>
              {data.owner?.name ? <Text style={styles.ownerText}>المالك: {data.owner.name}</Text> : null}
            </View>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.heroActionButton} activeOpacity={0.86} onPress={openEditProperty}>
              <Ionicons name="create-outline" size={19} color="#fff" />
              <Text style={styles.heroActionText}>تعديل</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.heroActionButton, styles.deleteButton]} activeOpacity={0.86} onPress={confirmDeleteProperty}>
              <Ionicons name="trash-outline" size={19} color="#991B1B" />
              <Text style={[styles.heroActionText, styles.deleteButtonText]}>حذف</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!isApartmentProperty ? (
          <View style={styles.statsRow}>
            <StatCard icon="door-open" value={available.toLocaleString('ar-SA')} label="شاغرة" />
            <StatCard icon="key-variant" value={rented.toLocaleString('ar-SA')} label="مؤجرة" />
            <StatCard icon="office-building" value={units.length.toLocaleString('ar-SA')} label="وحدة" />
          </View>
        ) : null}

        <View style={styles.financeRow}>
          <View style={styles.financeCard}><Text style={styles.financeValue}>{money(totalRent)}</Text><Text style={styles.financeLabel}>إجمالي الإيجارات</Text></View>
          <View style={styles.financeCard}><Text style={styles.financeValue}>{money(totalExpenses)}</Text><Text style={styles.financeLabel}>المصروفات</Text></View>
        </View>

        <CollapsibleSection title="تفاصيل العقار" icon="office-building-outline" subtitle="معلومات أساسية عن العقار وموقعه وحدوده">
          <Row label="النوع" value={typeMap[String(data.property_type || '')] || data.property_type} />
          <Row label="الاستخدام" value={usageMap[String(data.usage_type || '')] || data.usage_type} />
          <Row label="الإدارة" value={mgmtMap[String(data.management_type || '')] || data.management_type} />
          <Row label="رقم الصك" value={data.deed_number || data.document_number} />
          <Row label="العنوان الوطني المختصر" value={data.national_short_address} />
          <Row label="المساحة" value={hasValue(data.property_area) ? `${data.property_area} م²` : null} />
          <Row label="عدد الأدوار" value={data.floors_count} />
          <Row label="المواقف" value={data.parking_spots_count} />
          <Row label="المصاعد" value={data.elevators_count} />
          <Row label="العنوان" value={data.address} />
          <Row label="ملاحظات" value={data.notes} />
        </CollapsibleSection>

        <CollapsibleSection title="بيانات الوثيقة والصك" icon="file-document-outline" subtitle="الوثائق الرسمية وتفاصيل الصك">
          <Row label="تاريخ الوثيقة" value={data.document_date_hijri} />
          <Row label="التاريخ الميلادي" value={data.document_date_gregorian} />
          <Row label="الحالة" value={data.document_status} />
          <Row label="القيود" value={data.document_restrictions} />
          <Row label="تاريخ الوثيقة السابقة" value={data.previous_document_date_hijri} />
          <Row label="رقم الوثيقة السابقة" value={data.previous_document_number} />
          <Row label="نوع العملية" value={data.operation_type} />
          <Row label="رقم الهوية العقارية" value={data.real_estate_identity_number} />
          <Row label="نوع العقار في الصك" value={data.deed_property_type_text} />
          <Row label="نوع الاستخدام" value={data.deed_usage_text} />
          <Row label="رقم القطعة" value={data.plot_number} />
          <Row label="رقم المخطط" value={data.plan_number} />
          <Row label="البلك" value={data.block_number} />
          <Row label="المجاورة / الجزء" value={data.deed_neighboring_part} />
          <Row label="الموقع" value={data.deed_location_text} />
          <Row label="نموذج العقار" value={data.deed_property_model} />
          <Row label="وصف الحدود" value={data.deed_boundaries_description} />
        </CollapsibleSection>

        {(hasValue(data.deed_mortgage_status) || hasValue(data.deed_mortgagee_name) || hasValue(data.deed_mortgage_amount)) ? (
          <Section title="بيانات الرهن / القيود المالية">
            <Row label="حالة الرهن" value={data.deed_mortgage_status} />
            <Row label="الجهة المرتهنة" value={data.deed_mortgagee_name} />
            <Row label="قيمة الرهن" value={hasValue(data.deed_mortgage_amount) ? money(data.deed_mortgage_amount) : null} />
            <Row label="تاريخ الاستحقاق" value={data.deed_mortgage_due_date} />
          </Section>
        ) : null}

        {!isApartmentProperty && units.length > 0 ? (
          <CollapsibleSection title="الوحدات" icon="home-city-outline" subtitle="تفاصيل الوحدات المرتبطة بالعقار">
            {units.map((unit) => {
              const hasContract = unitContractsCount(unit) > 0;
              return (
                <TouchableOpacity key={unit.id} style={styles.unitCard} activeOpacity={0.9} onPress={() => router.push(`/unit/${unit.id}` as never)}>
                  <View style={styles.unitInfoBox}>
                    <Text style={styles.unitTitle}>{unit.unit_number || `وحدة #${unit.id}`}</Text>
                    <Text style={styles.unitMeta}>{unit.type || 'وحدة'} — الدور {display(unit.floor)}</Text>
                    <Text style={hasContract ? styles.unitContractOk : styles.unitContractEmpty}>{hasContract ? `يوجد ${unitContractsCount(unit)} عقد` : 'لا يوجد عقد'}</Text>
                  </View>
                  <View style={styles.unitSideBox}>
                    <Text style={styles.unitStatus}>{unit.status || '-'}</Text>
                    <Text style={styles.unitRent}>{money(unit.rent_amount)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </CollapsibleSection>
        ) : null}

        <Section title="خدمات العقار">
          <View style={styles.servicesGrid}>
            {!isApartmentProperty ? <ServiceButton icon="plus-circle-outline" label="إضافة وحدة" onPress={openAddUnit} /> : null}
            <ServiceButton icon="file-document-outline" label="العقود" onPress={() => openPropertyService('/contracts')} />
            <ServiceButton icon="cash-minus" label="المصروفات" onPress={() => openPropertyService('/expenses')} />
            {canCreateContract ? <ServiceButton icon="file-sign" label="إنشاء / رفع عقد" onPress={openCreateContract} /> : null}
            <ServiceButton icon="image-multiple-outline" label="الملفات والوسائط" onPress={openRepository} full />
          </View>
        </Section>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8F6' },
  content: { padding: 13, paddingBottom: 44 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: 8, color: '#64748B', fontWeight: '800' },
  errorBox: { margin: 16, backgroundColor: '#FEE2E2', borderRadius: 20, padding: 18, alignItems: 'center' },
  errorTitle: { color: '#991B1B', fontSize: 18, fontWeight: '900' },
  errorText: { color: '#7F1D1D', marginTop: 8, textAlign: 'center' },
  retryButton: { marginTop: 12, backgroundColor: '#991B1B', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '900' },
  heroCard: { backgroundColor: '#0B1220', borderRadius: 30, padding: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#132237' },
  heroGlow: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: '#0F766E', opacity: 0.22, right: -72, top: -90 },
  heroMenuDot: { position: 'absolute', left: 16, top: 16, width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  heroTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 13, paddingTop: 9 },
  heroIcon: { width: 78, height: 78, borderRadius: 25, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 39 },
  heroTextBox: { flex: 1, alignItems: 'flex-end', paddingLeft: 24 },
  heroTitle: { color: '#fff', fontSize: 23, fontWeight: '900', textAlign: 'right', lineHeight: 34 },
  heroLocationLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 6 },
  heroSubtitle: { color: '#CBD5E1', fontWeight: '800', textAlign: 'right' },
  ownerText: { color: '#5EEAD4', fontWeight: '900', marginTop: 8, textAlign: 'right' },
  heroActions: { flexDirection: 'row-reverse', gap: 10, marginTop: 17 },
  heroActionButton: { flex: 1, minHeight: 50, borderRadius: 17, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 7 },
  heroActionText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  deleteButton: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  deleteButtonText: { color: '#991B1B' },
  statsRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', borderWidth: 1, borderColor: '#E8EEF0', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  statIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF7F5', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { color: '#0F172A', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#64748B', fontWeight: '800', marginTop: 2 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 22, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E8EEF0', shadowColor: '#0F172A', shadowOpacity: 0.035, shadowRadius: 13, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  sectionCardCompact: { backgroundColor: '#fff', borderRadius: 21, padding: 12, marginBottom: 11, borderWidth: 1, borderColor: '#E8EEF0', shadowColor: '#0F172A', shadowOpacity: 0.035, shadowRadius: 13, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  sectionTitle: { color: '#111827', fontSize: 20, fontWeight: '900', textAlign: 'right', marginBottom: 12 },
  sectionTitleCompact: { color: '#111827', fontSize: 19, fontWeight: '900', textAlign: 'right' },
  collapsibleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 62 },
  collapsibleTitleBox: { flex: 1, alignItems: 'flex-end' },
  collapsibleHint: { color: '#6B7280', fontWeight: '800', fontSize: 12, marginTop: 5, textAlign: 'right' },
  collapsibleBody: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 6 },
  sectionIconBox: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#EEF7F5', alignItems: 'center', justifyContent: 'center' },
  servicesGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 9 },
  serviceButton: { width: '48.5%', minHeight: 72, borderRadius: 18, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#DDE5EA', alignItems: 'center', justifyContent: 'center', padding: 8, flexDirection: 'row-reverse', gap: 9 },
  serviceButtonFull: { width: '100%' },
  serviceText: { color: '#111827', fontWeight: '900', textAlign: 'center', fontSize: 13 },
  financeRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12 },
  financeCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: '#E8EEF0' },
  financeValue: { color: '#0F766E', fontWeight: '900', fontSize: 16 },
  financeLabel: { color: '#64748B', fontWeight: '800', marginTop: 5, textAlign: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoLabel: { color: '#64748B', fontWeight: '900', textAlign: 'right', minWidth: 110 },
  infoValue: { color: '#111827', fontWeight: '900', flex: 1, textAlign: 'left' },
  unitCard: { backgroundColor: '#F8FAFC', borderRadius: 18, padding: 12, marginBottom: 8, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E2E8F0' },
  unitInfoBox: { flex: 1, alignItems: 'flex-end' },
  unitTitle: { color: '#111827', fontWeight: '900', fontSize: 16, textAlign: 'right' },
  unitMeta: { color: '#64748B', fontWeight: '800', marginTop: 3, textAlign: 'right' },
  unitContractOk: { color: '#16A34A', fontWeight: '900', marginTop: 4, textAlign: 'right' },
  unitContractEmpty: { color: '#D97706', fontWeight: '900', marginTop: 4, textAlign: 'right' },
  unitSideBox: { alignItems: 'flex-start', gap: 7 },
  unitStatus: { backgroundColor: '#E0F2FE', color: '#0369A1', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, overflow: 'hidden', fontWeight: '900', fontSize: 11 },
  unitRent: { color: '#111827', fontWeight: '900' },
});