import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DropdownSelect, { DropdownOption } from '../components/DropdownSelect';
import { useList } from '../hooks/useCrud';
import {
  Card,
  ErrorState,
  EmptyState,
  SkeletonList,
} from '../components/ui/shared';
import { colors, typography, spacing, radii } from '../constants/theme';
import { apiGetScoped, apiPostAny } from '../lib/api';

import { smartBack } from "@/lib/navigationHistory";
type Property = {
  id: number;
  name?: string;
  city?: string;
  district?: string;
  property_type?: string;
  management_type?: string;
  units_count?: number;
  parking_spots_count?: number;
  owner?: { id: number; name?: string; type?: string };
};

type OptionRecord = {
  id: number | string;
  label: string;
};

const propertyTypeOptions: DropdownOption[] = [
  { id: 'building', label: 'عمارة' },
  { id: 'apartment', label: 'شقة مستقلة' },
  { id: 'villa', label: 'فيلا' },
  { id: 'commercial', label: 'تجاري' },
  { id: 'other', label: 'أخرى' },
];

const managementTypeOptions: DropdownOption[] = [
  { id: 'owned', label: 'ملك خاص' },
  { id: 'managed', label: 'إدارة للغير' },
];

const typeLabels: Record<string, string> = {
  building: 'عمارة',
  apartment: 'شقة',
  villa: 'فيلا',
  land: 'أرض',
  commercial: 'تجاري',
  other: 'أخرى',
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function PropertyCard({ item }: { item: Property }) {
  return (
    <Card
      style={styles.propertyCard}
      onPress={() => router.push(`/property/${item.id}` as any)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>
            {item.property_type === 'villa' ? '🏡' : item.property_type === 'land' ? '🌍' : '🏢'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.propertyName}>{item.name || 'بدون اسم'}</Text>
          <Text style={styles.propertyLocation}>
            {[item.district, item.city].filter(Boolean).join('، ') || 'بدون موقع'}
          </Text>
        </View>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>
            {typeLabels[item.property_type || ''] || item.property_type || 'عقار'}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerStat}>
          <Text style={styles.footerNum}>{item.units_count ?? 0}</Text>
          <Text style={styles.footerLabel}>وحدة</Text>
        </View>
        <View style={styles.footerDivider} />
        <View style={styles.footerStat}>
          <Text style={styles.footerNum}>{item.parking_spots_count ?? 0}</Text>
          <Text style={styles.footerLabel}>موقف</Text>
        </View>
        <View style={styles.footerDivider} />
        <View style={styles.footerStat}>
          <Text style={styles.footerOwner} numberOfLines={1}>
            {item.owner?.name || '-'}
          </Text>
          <Text style={styles.footerLabel}>المالك</Text>
        </View>
      </View>
    </Card>
  );
}

export default function PropertiesScreen() {
  const params = useLocalSearchParams();
  const ownerIdParam = firstParam(params.owner_id as string | string[] | undefined);
  const ownerNameParam = firstParam(params.owner_name as string | string[] | undefined);
  const createParam = firstParam(params.create as string | string[] | undefined);
  const scopedOwnerName = ownerNameParam ? decodeURIComponent(ownerNameParam) : '';
  const endpoint = ownerIdParam ? `/properties?owner_id=${encodeURIComponent(ownerIdParam)}` : '/properties';

  const {
    items,
    loading,
    refreshing,
    error,
    total,
    refresh,
    loadMore,
    search,
  } = useList<Property>({ endpoint });

  const [searchText, setSearchText] = useState('');
  const [owners, setOwners] = useState<OptionRecord[]>([]);
  const [showCreate, setShowCreate] = useState(createParam === '1');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    owner_id: ownerIdParam,
    name: '',
    property_type: 'building',
    management_type: 'managed',
    city: '',
    district: '',
    deed_number: '',
    floors_count: '',
    parking_spots_count: '',
  });

  useEffect(() => {
    async function loadOwners() {
      try {
        const data = await apiGetScoped('/relation-manager/options', '/my/relation-manager/options');
        setOwners(Array.isArray(data?.owners) ? data.owners : []);
      } catch {
        setOwners([]);
      }
    }

    loadOwners();
  }, []);

  useEffect(() => {
    if (ownerIdParam) {
      setForm((previous) => ({ ...previous, owner_id: ownerIdParam }));
    }
  }, [ownerIdParam]);

  const ownerOptions = useMemo(() => {
    const options = owners.map((owner) => ({ id: owner.id, label: owner.label }));

    if (ownerIdParam && !options.some((owner) => String(owner.id) === String(ownerIdParam))) {
      options.unshift({ id: ownerIdParam, label: scopedOwnerName || `مالك #${ownerIdParam}` });
    }

    return options;
  }, [owners, ownerIdParam, scopedOwnerName]);

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    if (text.length === 0 || text.length >= 2) {
      search(text);
    }
  }, [search]);

  function setField(key: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function createProperty() {
    if (!form.owner_id) {
      Alert.alert('تنبيه', 'اختر اسم المالك قبل حفظ العقار.');
      return;
    }

    if (!form.name.trim()) {
      Alert.alert('تنبيه', 'اكتب اسم العقار.');
      return;
    }

    try {
      setSaving(true);
      await apiPostAny(['/properties', '/relation-manager/create-property', '/my/relation-manager/create-property'], {
        ...form,
        title: form.name.trim(),
        name: form.name.trim(),
        floors_count: form.floors_count.trim() || null,
        parking_spots_count: form.parking_spots_count.trim() || null,
      });

      Alert.alert('تم', 'تم إضافة العقار وربطه بالمالك.');
      setForm((previous) => ({
        ...previous,
        owner_id: ownerIdParam || previous.owner_id,
        name: '',
        city: '',
        district: '',
        deed_number: '',
        floors_count: '',
        parking_spots_count: '',
      }));
      setShowCreate(false);
      refresh();
    } catch (e) {
      Alert.alert('تعذر حفظ العقار', e instanceof Error ? e.message : 'حدث خطأ غير متوقع');
    } finally {
      setSaving(false);
    }
  }

  if (error && items.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  const showSkeleton = loading && items.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => smartBack()}>
            <Text style={styles.backBtn}>→</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{ownerIdParam ? 'عقارات المالك' : 'العقارات'}</Text>
          <Text style={styles.headerCount}>{total}</Text>
        </View>

        {ownerIdParam ? (
          <Text style={styles.scopedOwnerText}>المالك: {scopedOwnerName || `#${ownerIdParam}`}</Text>
        ) : null}

        <TouchableOpacity style={styles.createToggleButton} onPress={() => setShowCreate(!showCreate)}>
          <Text style={styles.createToggleText}>{showCreate ? 'إغلاق نموذج إضافة العقار' : 'إضافة عقار جديد'}</Text>
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="بحث بالاسم، المدينة، رقم الصك..."
            placeholderTextColor={colors.textTertiary}
            value={searchText}
            onChangeText={handleSearch}
            textAlign="right"
          />
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <PropertyCard item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={showCreate ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>إضافة عقار جديد</Text>

            <DropdownSelect
              label="اسم المالك"
              value={form.owner_id}
              options={ownerOptions}
              placeholder="اختر المالك"
              required
              disabled={Boolean(ownerIdParam)}
              onChange={(value) => setField('owner_id', value)}
            />

            <TextInput style={styles.input} value={form.name} onChangeText={(value) => setField('name', value)} placeholder="اسم العقار" textAlign="right" />
            <DropdownSelect label="نوع العقار" value={form.property_type} options={propertyTypeOptions} onChange={(value) => setField('property_type', value)} />
            <DropdownSelect label="نوع الإدارة" value={form.management_type} options={managementTypeOptions} onChange={(value) => setField('management_type', value)} />
            <TextInput style={styles.input} value={form.city} onChangeText={(value) => setField('city', value)} placeholder="المدينة" textAlign="right" />
            <TextInput style={styles.input} value={form.district} onChangeText={(value) => setField('district', value)} placeholder="الحي" textAlign="right" />
            <TextInput style={styles.input} value={form.deed_number} onChangeText={(value) => setField('deed_number', value)} placeholder="رقم الصك" textAlign="right" />
            <TextInput style={styles.input} value={form.floors_count} onChangeText={(value) => setField('floors_count', value)} placeholder="عدد الأدوار" keyboardType="number-pad" textAlign="right" />
            <TextInput style={styles.input} value={form.parking_spots_count} onChangeText={(value) => setField('parking_spots_count', value)} placeholder="عدد المواقف" keyboardType="number-pad" textAlign="right" />

            <TouchableOpacity style={styles.saveButton} onPress={createProperty} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'جاري الحفظ...' : 'حفظ العقار'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        ListEmptyComponent={
          showSkeleton ? (
            <SkeletonList count={4} />
          ) : (
            <EmptyState
              title="لا توجد عقارات"
              message="أضف أول عقار لبدء إدارة إيجاراتك"
              actionLabel="إضافة عقار"
              icon="🏢"
              onAction={() => setShowCreate(true)}
            />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  backBtn: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  headerCount: {
    ...typography.captionBold,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  scopedOwnerText: {
    ...typography.captionBold,
    color: colors.primary,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  createToggleButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  createToggleText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  searchContainer: {
    marginTop: spacing.sm,
  },
  searchInput: {
    height: 42,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.text,
  },

  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  formTitle: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'right',
    marginBottom: spacing.md,
  },
  input: {
    minHeight: 44,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    color: '#111827',
  },
  saveButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  saveButtonText: { color: '#ffffff', fontWeight: '900' },

  propertyCard: {
    padding: 0,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 20 },
  propertyName: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'right',
  },
  propertyLocation: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: 2,
  },
  typeBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  typeBadgeText: {
    ...typography.small,
    color: colors.textSecondary,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  footerStat: {
    flex: 1,
    alignItems: 'center',
  },
  footerNum: {
    ...typography.bodyBold,
    color: colors.text,
  },
  footerOwner: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  footerLabel: {
    ...typography.small,
    color: colors.textTertiary,
    marginTop: 2,
  },
  footerDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
});
