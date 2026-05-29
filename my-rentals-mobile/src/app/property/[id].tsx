import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDetail } from '../../hooks/useCrud';
import { apiGet, apiPost } from '../../lib/api';
import { smartBack } from '@/lib/navigationHistory';

type PropertyTabKey = 'stats' | 'details' | 'units';

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

type PaymentItem = {
  id?: number | string | null;
  amount?: number | string | null;
  remaining_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_date?: string | null;
  status?: string | null;
};

type ContractItem = {
  id: number;
  unit_id?: number | string | null;
  status?: string | null;
  payments?: PaymentItem[];
  unit?: { id?: number | string | null; unit_number?: string | null; property?: { name?: string | null } | null } | null;
};

type UnitOverdueInfo = { count: number; amount: number };

const propertyTabs: Array<{ key: PropertyTabKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'stats', label: 'إحصائيات', icon: 'stats-chart-outline' },
  { key: 'details', label: 'تفاصيل', icon: 'list-outline' },
  { key: 'units', label: 'الوحدات', icon: 'home-outline' },
];

const typeMap: Record<string, string> = { building: 'عمارة', apartment: 'شقة', villa: 'فيلا', land: 'أرض', commercial: 'تجاري', mixed: 'مختلط', other: 'أخرى' };
const detailTitleMap: Record<string, string> = { building: 'تفاصيل العمارة', apartment: 'تفاصيل الشقة', villa: 'تفاصيل الفيلا', land: 'تفاصيل الأرض', commercial: 'تفاصيل العقار التجاري', mixed: 'تفاصيل العقار المختلط', other: 'تفاصيل العقار' };
const usageMap: Record<string, string> = { residential: 'سكني', commercial: 'تجاري', mixed: 'مختلط' };
const mgmtMap: Record<string, string> = { owned: 'ملك خاص', managed: 'إدارة للغير' };
const unitStatusMap: Record<string, string> = { rented: 'مؤجرة', available: 'شاغرة', maintenance: 'صيانة' };

function detailTitleForType(propertyType?: string | null) { return detailTitleMap[String(propertyType || '')] || 'تفاصيل العقار'; }
function hasValue(value: unknown) { return value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '-'; }
function display(value: unknown) { return hasValue(value) ? String(value) : '-'; }
function numberValue(value: unknown) { const n = Number(String(value ?? 0).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; }
function money(value: unknown) { return `${Math.round(numberValue(value)).toLocaleString('ar-SA')} ر.س`; }
function unitContractsCount(unit: PropertyUnit) { if (typeof unit.contracts_count === 'number') return unit.contracts_count; return Array.isArray(unit.contracts) ? unit.contracts.length : 0; }
function queryValue(value: unknown) { return encodeURIComponent(String(value ?? '')); }
function responseList(payload: any): ContractItem[] { return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []; }
function normalizedStatus(value?: string | null) { return String(value || '').trim().toLowerCase(); }
function isActiveContract(contract: ContractItem) { const status = normalizedStatus(contract.status); return ['active', 'نشط', 'open', 'current'].includes(status); }
function dateOnly(value?: string | null) { const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/); return match ? match[1] : ''; }
function todayYmd() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function isOverduePayment(payment: PaymentItem, today: string) { const status = normalizedStatus(payment.status); if (['paid', 'مدفوع', 'cancelled', 'canceled', 'ملغي'].includes(status)) return false; if (['overdue', 'متأخر', 'متأخرة'].includes(status)) return true; const dueDate = dateOnly(payment.due_date); return /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && dueDate < today; }
function paymentRemainingAmount(payment: PaymentItem) { if (hasValue(payment.remaining_amount)) return numberValue(payment.remaining_amount); const amount = numberValue(payment.amount); const paid = numberValue(payment.paid_amount); return Math.max(0, amount - paid); }
function contractUnitId(contract: ContractItem) { return String(contract.unit_id ?? contract.unit?.id ?? ''); }
function unitSortLabel(unit: PropertyUnit) { return String(unit.unit_number || `وحدة #${unit.id}`).trim(); }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.sectionCard}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Row({ label, value }: { label: string; value: unknown }) {
  if (!hasValue(value)) return null;
  return <View style={styles.infoRow}><Text style={styles.infoValue}>{display(value)}</Text><Text style={styles.infoLabel}>{label}</Text></View>;
}

function StatTile({ icon, value, label, danger = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; value: unknown; label: string; danger?: boolean }) {
  return <View style={[styles.statTile, danger ? styles.statTileDanger : null]}><View style={[styles.statIconBox, danger ? styles.statIconDanger : null]}><MaterialCommunityIcons name={icon} size={23} color={danger ? '#DC2626' : '#0F766E'} /></View><Text style={[styles.statValue, danger ? styles.statValueDanger : null]} numberOfLines={1}>{display(value)}</Text><Text style={[styles.statLabel, danger ? styles.statLabelDanger : null]}>{label}</Text></View>;
}

function UnitCard({ unit, overdueInfo }: { unit: PropertyUnit; overdueInfo?: UnitOverdueInfo }) {
  const hasContract = unitContractsCount(unit) > 0;
  const status = unitStatusMap[String(unit.status || '')] || unit.status || '-';
  const hasOverdue = !!overdueInfo && overdueInfo.count > 0;
  return (
    <TouchableOpacity key={unit.id} style={[styles.unitCard, hasOverdue ? styles.unitCardDanger : null]} activeOpacity={0.9} onPress={() => router.push(`/unit/${unit.id}` as never)}>
      <View style={[styles.unitIconBox, hasOverdue ? styles.unitIconBoxDanger : null]}>
        <MaterialCommunityIcons name="door" size={23} color={hasOverdue ? '#DC2626' : '#0F766E'} />
      </View>
      <View style={styles.unitInfoBox}>
        <Text style={[styles.unitTitle, hasOverdue ? styles.unitTitleDanger : null]}>{unit.unit_number || `وحدة #${unit.id}`}</Text>
        <Text style={styles.unitMeta}>{unit.type || 'وحدة'} — الدور {display(unit.floor)}</Text>
        {hasOverdue ? <Text style={styles.unitOverdueText}>متأخرات {overdueInfo.count.toLocaleString('ar-SA')} / {money(overdueInfo.amount)}</Text> : <Text style={hasContract ? styles.unitContractOk : styles.unitContractEmpty}>{hasContract ? `يوجد ${unitContractsCount(unit)} عقد` : 'لا يوجد عقد'}</Text>}
      </View>
      <View style={styles.unitSideBox}>
        <Text style={[styles.unitStatus, hasOverdue ? styles.unitStatusDanger : null]}>{status}</Text>
        <Text style={[styles.unitRent, hasOverdue ? styles.unitRentDanger : null]}>{money(unit.rent_amount)}</Text>
        <Ionicons name="chevron-back" size={16} color={hasOverdue ? '#DC2626' : '#64748B'} />
      </View>
    </TouchableOpacity>
  );
}

function FloatingMenuAction({ icon, label, color = '#0F172A', onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; color?: string; onPress: () => void }) {
  return <TouchableOpacity style={styles.floatingMenuAction} activeOpacity={0.86} onPress={onPress}><MaterialCommunityIcons name={icon} size={21} color={color} /><Text style={[styles.floatingMenuText, { color }]}>{label}</Text></TouchableOpacity>;
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { data, loading, error, reload } = useDetail<PropertyDetail>({ endpoint: `/properties/${id}` });
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PropertyTabKey>('stats');
  const [propertyContracts, setPropertyContracts] = useState<ContractItem[]>([]);
  const [contractsReloadKey, setContractsReloadKey] = useState(0);

  const shouldReturnAfterDelete = !!error && /No query results|not found|غير موجود/i.test(String(error));
  const isApartmentProperty = String(data?.property_type || '') === 'apartment';
  const units = data?.units || [];
  const sortedUnits = useMemo(() => [...units].sort((a, b) => unitSortLabel(a).localeCompare(unitSortLabel(b), 'ar', { numeric: true, sensitivity: 'base' })), [units]);
  const rented = units.filter((unit) => unit.status === 'rented').length;
  const available = units.filter((unit) => unit.status === 'available').length;
  const totalRent = data && hasValue(data.total_rent_amount) ? numberValue(data.total_rent_amount) : units.reduce((sum, unit) => sum + numberValue(unit.rent_amount), 0);
  const totalExpenses = (data?.expenses || []).reduce((sum, expense) => sum + numberValue(expense.amount), 0);
  const propertyId = data?.id || Number(id || 0);
  const encodedPropertyName = queryValue(data?.name || `عقار #${propertyId}`);
  const ownerQuery = data?.owner?.id ? `&owner_id=${data.owner.id}&owner_name=${queryValue(data.owner.name || '')}` : '';
  const unitContracts = units.reduce((sum, unit) => sum + unitContractsCount(unit), 0);
  const totalContracts = Number(data?.property_contracts_count || 0) + Number(data?.unit_contracts_count ?? unitContracts);
  const propertyTypeLabel = typeMap[String(data?.property_type || '')] || data?.property_type || 'عقار';
  const canCreateContract = data ? (typeof data.can_create_contract === 'boolean' ? data.can_create_contract : totalContracts === 0) : false;
  const activeContracts = useMemo(() => propertyContracts.filter(isActiveContract), [propertyContracts]);
  const activeContractsCount = propertyContracts.length > 0 ? activeContracts.length : totalContracts;

  const overduePaymentStats = useMemo(() => {
    const today = todayYmd();
    const overduePayments = activeContracts.flatMap((contract) => contract.payments || []).filter((payment) => isOverduePayment(payment, today));
    return { count: overduePayments.length, amount: overduePayments.reduce((sum, payment) => sum + paymentRemainingAmount(payment), 0) };
  }, [activeContracts]);

  const overdueByUnit = useMemo(() => {
    const today = todayYmd();
    const map: Record<string, UnitOverdueInfo> = {};
    activeContracts.forEach((contract) => {
      const unitKey = contractUnitId(contract);
      if (!unitKey) return;
      const overduePayments = (contract.payments || []).filter((payment) => isOverduePayment(payment, today));
      if (!overduePayments.length) return;
      if (!map[unitKey]) map[unitKey] = { count: 0, amount: 0 };
      map[unitKey].count += overduePayments.length;
      map[unitKey].amount += overduePayments.reduce((sum, payment) => sum + paymentRemainingAmount(payment), 0);
    });
    return map;
  }, [activeContracts]);

  const detailsRows = useMemo(() => {
    if (!data) return [] as Array<[string, unknown]>;
    return [
      ['النوع', propertyTypeLabel], ['الاستخدام', usageMap[String(data.usage_type || '')] || data.usage_type], ['الإدارة', mgmtMap[String(data.management_type || '')] || data.management_type], ['رقم الصك', data.deed_number || data.document_number], ['العنوان الوطني المختصر', data.national_short_address], ['المساحة', hasValue(data.property_area) ? `${data.property_area} م²` : null], ['عدد الأدوار', data.floors_count], ['المواقف', data.parking_spots_count], ['المصاعد', data.elevators_count], ['العنوان', data.address], ['ملاحظات', data.notes],
    ] as Array<[string, unknown]>;
  }, [data, propertyTypeLabel]);

  useEffect(() => { if (!shouldReturnAfterDelete) return; const timer = setTimeout(() => smartBack(), 250); return () => clearTimeout(timer); }, [shouldReturnAfterDelete]);
  useEffect(() => { if (!data) return; navigation.setOptions({ title: detailTitleForType(data.property_type) }); }, [data?.property_type, navigation]);
  useEffect(() => { if (!id) return; let cancelled = false; apiGet(`/contracts?property_id=${encodeURIComponent(String(id))}`).then((result) => { if (!cancelled) setPropertyContracts(responseList(result)); }).catch(() => { if (!cancelled) setPropertyContracts([]); }); return () => { cancelled = true; }; }, [id, data?.id, contractsReloadKey]);

  function handleRefresh() { reload(); setContractsReloadKey((value) => value + 1); }
  function closeMenu() { setMenuOpen(false); }
  function openEditProperty() { closeMenu(); router.push(`/property-form?id=${propertyId}` as never); }
  function openRepository() { closeMenu(); router.push(`/files?property_id=${propertyId}&property_name=${encodedPropertyName}${ownerQuery}` as never); }
  function openAddUnit() { closeMenu(); const query = new URLSearchParams(); if (data?.owner?.id) query.set('owner_id', String(data.owner.id)); query.set('property_type', 'apartment'); query.set('lock_property_type', '1'); query.set('source_property_id', String(propertyId)); query.set('source_property_name', data?.name || `عقار #${propertyId}`); router.push(`/property-form?${query.toString()}` as never); }
  function openPropertyService(path: string) { closeMenu(); router.push(`${path}?property_id=${propertyId}&property_name=${encodedPropertyName}${ownerQuery}` as never); }
  function openCreateContract() { closeMenu(); Alert.alert('إضافة عقد', 'اختر طريقة إضافة العقد:', [{ text: 'رفع عقد PDF', onPress: () => router.push(`/upload-contract?property_id=${propertyId}&property_name=${encodedPropertyName}&contract_scope=property&target_type=property${ownerQuery}` as never) }, { text: 'إنشاء عقد يدوي', onPress: () => router.push(`/create-contract?property_id=${propertyId}&property_name=${encodedPropertyName}&contract_scope=property&target_type=property${ownerQuery}` as never) }, { text: 'إلغاء', style: 'cancel' }]); }
  function confirmDeleteProperty() { closeMenu(); Alert.alert('حذف العقار', `هل تريد حذف ${data?.name || `عقار #${propertyId}`}؟`, [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: async () => { try { await apiPost(`/edit-delete-center/properties/${propertyId}/delete`, {}); Alert.alert('تم', 'تم حذف العقار.', [{ text: 'حسنًا', onPress: () => smartBack() }]); } catch (e) { Alert.alert('تعذر الحذف', e instanceof Error ? e.message : 'حدث خطأ غير متوقع'); } } }]); }

  if (loading || shouldReturnAfterDelete) return <SafeAreaView style={styles.safe}><View style={styles.loadingBox}><ActivityIndicator /><Text style={styles.loadingText}>جاري تحميل العقار...</Text></View></SafeAreaView>;
  if (error || !data) return <SafeAreaView style={styles.safe}><View style={styles.errorBox}><Text style={styles.errorTitle}>تعذر عرض العقار</Text><Text style={styles.errorText}>{String(error || 'غير موجود')}</Text><TouchableOpacity style={styles.retryButton} onPress={handleRefresh}><Text style={styles.retryText}>إعادة المحاولة</Text></TouchableOpacity></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor="#0F766E" />}>
        <View style={styles.heroCard}><View style={styles.heroTop}><View style={styles.heroIcon}><Text style={styles.heroEmoji}>{data.property_type === 'villa' ? '🏡' : data.property_type === 'apartment' ? '🏠' : data.property_type === 'land' ? '🧭' : '🏢'}</Text></View><View style={styles.heroTextBox}><Text style={styles.heroType}>{propertyTypeLabel}</Text><Text style={styles.heroTitle}>{data.name || `عقار #${propertyId}`}</Text><View style={styles.heroLocationLine}><Ionicons name="location-outline" size={13} color="#CBD5E1" /><Text style={styles.heroSubtitle}>{[data.district, data.city].filter(Boolean).join('، ') || 'لا يوجد موقع مسجل'}</Text></View>{data.owner?.name ? <Text style={styles.ownerText}>المالك: {data.owner.name}</Text> : null}</View></View></View>
        <View style={styles.tabsWrap}>{propertyTabs.map((tab) => { const isActive = activeTab === tab.key; return <TouchableOpacity key={tab.key} style={[styles.tabButton, isActive ? styles.tabButtonActive : null]} activeOpacity={0.88} onPress={() => setActiveTab(tab.key)}><Ionicons name={tab.icon} size={17} color={isActive ? '#0F172A' : '#64748B'} /><Text style={[styles.tabText, isActive ? styles.tabTextActive : null]}>{tab.label}</Text></TouchableOpacity>; })}</View>
        {activeTab === 'stats' ? <View style={styles.sectionCard}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>الملخص</Text><Text style={styles.sectionSubtitle}>ملخص سريع عن هذا العقار فقط، والدفعات المتأخرة محسوبة من العقود النشطة فقط</Text></View><View style={styles.statsGrid}><StatTile icon="alert-circle-outline" value={money(overduePaymentStats.amount)} label={`دفعات متأخرة (${overduePaymentStats.count.toLocaleString('ar-SA')})`} danger={overduePaymentStats.count > 0} /><StatTile icon="file-document-check-outline" value={activeContractsCount.toLocaleString('ar-SA')} label="العقود النشطة" /><StatTile icon="cash-multiple" value={money(totalRent)} label="إجمالي الإيجارات" /><StatTile icon="cash-minus" value={money(totalExpenses)} label="المصروفات" danger={totalExpenses > 0} /><StatTile icon="office-building" value={units.length.toLocaleString('ar-SA')} label="عدد الوحدات" /><StatTile icon="key-variant" value={rented.toLocaleString('ar-SA')} label="مؤجرة" /><StatTile icon="door-open" value={available.toLocaleString('ar-SA')} label="شاغرة" /></View></View> : null}
        {activeTab === 'details' ? <><Section title="تفاصيل العقار">{detailsRows.map(([label, value]) => <Row key={label} label={label} value={value} />)}</Section><Section title="بيانات الوثيقة والصك"><Row label="تاريخ الوثيقة" value={data.document_date_hijri} /><Row label="التاريخ الميلادي" value={data.document_date_gregorian} /><Row label="الحالة" value={data.document_status} /><Row label="القيود" value={data.document_restrictions} /><Row label="تاريخ الوثيقة السابقة" value={data.previous_document_date_hijri} /><Row label="رقم الوثيقة السابقة" value={data.previous_document_number} /><Row label="نوع العملية" value={data.operation_type} /><Row label="رقم الهوية العقارية" value={data.real_estate_identity_number} /><Row label="نوع العقار في الصك" value={data.deed_property_type_text} /><Row label="نوع الاستخدام" value={data.deed_usage_text} /><Row label="رقم القطعة" value={data.plot_number} /><Row label="رقم المخطط" value={data.plan_number} /><Row label="البلك" value={data.block_number} /><Row label="المجاورة / الجزء" value={data.deed_neighboring_part} /><Row label="الموقع" value={data.deed_location_text} /><Row label="نموذج العقار" value={data.deed_property_model} /><Row label="وصف الحدود" value={data.deed_boundaries_description} /></Section>{(hasValue(data.deed_mortgage_status) || hasValue(data.deed_mortgagee_name) || hasValue(data.deed_mortgage_amount)) ? <Section title="بيانات الرهن / القيود المالية"><Row label="حالة الرهن" value={data.deed_mortgage_status} /><Row label="الجهة المرتهنة" value={data.deed_mortgagee_name} /><Row label="قيمة الرهن" value={hasValue(data.deed_mortgage_amount) ? money(data.deed_mortgage_amount) : null} /><Row label="تاريخ الاستحقاق" value={data.deed_mortgage_due_date} /></Section> : null}</> : null}
        {activeTab === 'units' ? <View style={styles.sectionCard}><View style={styles.sectionHeaderRow}>{!isApartmentProperty ? <TouchableOpacity style={styles.smallAddButton} activeOpacity={0.88} onPress={openAddUnit}><Ionicons name="add" size={22} color="#fff" /></TouchableOpacity> : <View />}<View style={styles.sectionHeaderText}><Text style={styles.sectionTitle}>الوحدات</Text><Text style={styles.sectionSubtitle}>{units.length.toLocaleString('ar-SA')} وحدة مرتبطة بهذا العقار</Text></View></View>{!isApartmentProperty && sortedUnits.length > 0 ? sortedUnits.map((unit) => <UnitCard key={unit.id} unit={unit} overdueInfo={overdueByUnit[String(unit.id)]} />) : null}{!isApartmentProperty && units.length === 0 ? <Text style={styles.emptyText}>لا توجد وحدات مضافة لهذا العقار.</Text> : null}{isApartmentProperty ? <Text style={styles.emptyText}>هذا العقار مسجل كشقة مستقلة ولا يحتوي على وحدات داخلية.</Text> : null}</View> : null}
        <View style={{ height: 78 }} />
      </ScrollView>
      {menuOpen ? <TouchableOpacity style={styles.floatingBackdrop} activeOpacity={1} onPress={closeMenu} /> : null}
      {menuOpen ? <View style={styles.floatingMenu}><FloatingMenuAction icon="pencil-outline" label="تعديل" color="#0F766E" onPress={openEditProperty} /><FloatingMenuAction icon="trash-can-outline" label="حذف" color="#DC2626" onPress={confirmDeleteProperty} />{!isApartmentProperty ? <FloatingMenuAction icon="plus-circle-outline" label="إضافة وحدة" color="#0F766E" onPress={openAddUnit} /> : null}<FloatingMenuAction icon="cash-minus" label="المصروفات" color="#0F766E" onPress={() => openPropertyService('/expenses')} />{canCreateContract ? <FloatingMenuAction icon="file-sign" label="إنشاء / رفع عقد" color="#0F766E" onPress={openCreateContract} /> : null}<FloatingMenuAction icon="image-multiple-outline" label="الملفات والوسائط" color="#0F766E" onPress={openRepository} /></View> : null}
      <TouchableOpacity style={styles.floatingButton} activeOpacity={0.88} onPress={() => setMenuOpen((value) => !value)}><Ionicons name={menuOpen ? 'close' : 'ellipsis-vertical'} size={24} color="#fff" /></TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8F6' }, content: { padding: 10, paddingBottom: 36 }, loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }, loadingText: { marginTop: 8, color: '#64748B', fontWeight: '800', fontSize: 12 }, errorBox: { margin: 14, backgroundColor: '#FEE2E2', borderRadius: 18, padding: 15, alignItems: 'center' }, errorTitle: { color: '#991B1B', fontSize: 16, fontWeight: '900' }, errorText: { color: '#7F1D1D', marginTop: 8, textAlign: 'center', fontSize: 12 }, retryButton: { marginTop: 10, backgroundColor: '#991B1B', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 9 }, retryText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  heroCard: { backgroundColor: '#0B1220', borderRadius: 24, padding: 12, marginBottom: 9, overflow: 'visible', borderWidth: 1, borderColor: '#132237' }, heroTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingTop: 8 }, heroIcon: { width: 64, height: 64, borderRadius: 21, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }, heroEmoji: { fontSize: 32 }, heroTextBox: { flex: 1, alignItems: 'flex-end', paddingLeft: 28 }, heroType: { color: '#5EEAD4', fontWeight: '900', marginBottom: 3, textAlign: 'right', fontSize: 12 }, heroTitle: { color: '#fff', fontSize: 19, fontWeight: '900', textAlign: 'right', lineHeight: 28 }, heroLocationLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 4 }, heroSubtitle: { color: '#CBD5E1', fontWeight: '800', textAlign: 'right', fontSize: 12 }, ownerText: { color: '#5EEAD4', fontWeight: '900', marginTop: 6, textAlign: 'right', fontSize: 12 },
  tabsWrap: { flexDirection: 'row-reverse', backgroundColor: '#E7E5E0', borderRadius: 19, padding: 5, marginBottom: 10, gap: 4 }, tabButton: { flex: 1, minHeight: 47, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 3 }, tabButtonActive: { backgroundColor: '#fff', shadowColor: '#0F172A', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, tabText: { color: '#64748B', fontWeight: '900', fontSize: 12 }, tabTextActive: { color: '#111827' },
  sectionCard: { backgroundColor: '#fff', borderRadius: 18, padding: 11, marginBottom: 9, borderWidth: 1, borderColor: '#E8EEF0', shadowColor: '#0F172A', shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 1 }, sectionHeader: { alignItems: 'flex-end', marginBottom: 10 }, sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 }, sectionHeaderText: { flex: 1, alignItems: 'flex-end' }, sectionTitle: { color: '#111827', fontSize: 17, fontWeight: '900', textAlign: 'right' }, sectionSubtitle: { color: '#64748B', fontWeight: '800', fontSize: 11, marginTop: 3, textAlign: 'right' },
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }, statTile: { width: '48.6%', minHeight: 104, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EEF2F7', borderRadius: 18, alignItems: 'center', justifyContent: 'center', padding: 8 }, statTileDanger: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }, statIconBox: { width: 40, height: 40, borderRadius: 15, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }, statIconDanger: { backgroundColor: '#FEE2E2' }, statValue: { color: '#0F172A', fontSize: 15, fontWeight: '900', textAlign: 'center' }, statValueDanger: { color: '#DC2626' }, statLabel: { color: '#64748B', fontWeight: '800', marginTop: 3, fontSize: 11, textAlign: 'center' }, statLabelDanger: { color: '#991B1B' },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }, infoLabel: { color: '#64748B', fontWeight: '900', textAlign: 'right', minWidth: 96, fontSize: 11.5 }, infoValue: { color: '#111827', fontWeight: '900', flex: 1, textAlign: 'left', fontSize: 11.5 }, smallAddButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center' },
  unitCard: { backgroundColor: '#F8FAFC', borderRadius: 17, padding: 11, marginBottom: 8, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E2E8F0', gap: 9 }, unitCardDanger: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }, unitIconBox: { width: 43, height: 43, borderRadius: 16, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }, unitIconBoxDanger: { backgroundColor: '#FEE2E2' }, unitInfoBox: { flex: 1, alignItems: 'flex-end' }, unitTitle: { color: '#111827', fontWeight: '900', fontSize: 15, textAlign: 'right' }, unitTitleDanger: { color: '#991B1B' }, unitMeta: { color: '#64748B', fontWeight: '800', marginTop: 2, textAlign: 'right', fontSize: 11 }, unitContractOk: { color: '#16A34A', fontWeight: '900', marginTop: 3, textAlign: 'right', fontSize: 11 }, unitContractEmpty: { color: '#D97706', fontWeight: '900', marginTop: 3, textAlign: 'right', fontSize: 11 }, unitOverdueText: { color: '#DC2626', fontWeight: '900', marginTop: 3, textAlign: 'right', fontSize: 11 }, unitSideBox: { alignItems: 'flex-start', gap: 5 }, unitStatus: { backgroundColor: '#E0F2FE', color: '#0369A1', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontWeight: '900', fontSize: 10 }, unitStatusDanger: { backgroundColor: '#FEE2E2', color: '#B91C1C' }, unitRent: { color: '#111827', fontWeight: '900', fontSize: 11 }, unitRentDanger: { color: '#B91C1C' },
  emptyText: { color: '#64748B', fontWeight: '900', textAlign: 'center', paddingVertical: 18 }, floatingButton: { position: 'absolute', left: 18, top: 14, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center', shadowColor: '#0F172A', shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 10, zIndex: 60 }, floatingBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'transparent', zIndex: 40 }, floatingMenu: { position: 'absolute', left: 18, top: 78, width: 210, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 6, shadowColor: '#0F172A', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 12, zIndex: 70 }, floatingMenuAction: { minHeight: 42, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start', gap: 10, paddingHorizontal: 14 }, floatingMenuText: { fontWeight: '900', fontSize: 13, textAlign: 'right' },
});
