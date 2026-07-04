import { router } from 'expo-router';
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
  EmptyState,
  ErrorState,
  SkeletonList,
} from '../components/ui/shared';
import { colors, typography, spacing, radii } from '../constants/theme';

type TenantItem = {
  id: number;
  name?: string;
  phone?: string;
  national_id?: string;
  nationality?: string;
  contracts_count?: number;
};

function TenantCard({ item }: { item: TenantItem }) {
  const initial = (item.name || '?').trim()[0]?.toUpperCase() || '?';
  return (
    <Card onPress={() => router.push(`/tenant/${item.id}` as any)}>
      <View style={styles.cardRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name || '-'}
          </Text>
          <Text style={styles.phone} numberOfLines={1}>
            {item.phone || 'بدون رقم'}
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countNum}>{item.contracts_count ?? 0}</Text>
          <Text style={styles.countLabel}>عقد</Text>
        </View>
      </View>
    </Card>
  );
}

export default function TenantsScreen() {
  const { items, loading, refreshing, error, refresh, loadMore, search } =
    useList<TenantItem>({ endpoint: '/tenants' });

  const [searchText, setSearchText] = useState('');

  const handleSearch = useCallback(
    (text: string) => {
      setSearchText(text);
      if (text.length === 0 || text.length >= 2) search(text);
    },
    [search],
  );

  const clearSearch = useCallback(() => {
    setSearchText('');
    search('');
  }, [search]);

  if (error && items.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ErrorState message={error} onRetry={refresh} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="بحث بالاسم أو الهوية أو الهاتف..."
            placeholderTextColor={colors.textTertiary}
            value={searchText}
            onChangeText={handleSearch}
            textAlign="right"
            returnKeyType="search"
            accessibilityLabel="بحث"
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={clearSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="مسح البحث"
            >
              <Text style={styles.clearBtnText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && items.length === 0 ? (
        <SkeletonList count={6} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <TenantCard item={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <EmptyState
              title={searchText ? 'لا توجد نتائج' : 'لا يوجد مستأجرين'}
              message={searchText ? `لم نجد نتائج لـ "${searchText}"` : 'سيظهر المستأجرون هنا عند إضافتهم.'}
              icon="🧑‍💼"
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
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
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchWrap: { position: 'relative', justifyContent: 'center' },
  searchInput: {
    height: 42,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.text,
  },
  clearBtn: {
    position: 'absolute',
    left: 10,
    top: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearBtnText: { fontSize: 16, fontWeight: '700', color: colors.textSecondary, lineHeight: 18 },
  listContent: { padding: spacing.lg, paddingBottom: 100, flexGrow: 1 },

  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.bodyBold, color: colors.primary },
  name: { ...typography.bodyBold, color: colors.text, textAlign: 'right' },
  phone: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  countBadge: { alignItems: 'center' },
  countNum: { ...typography.h4, color: colors.primary },
  countLabel: { ...typography.small, color: colors.textTertiary },
});
