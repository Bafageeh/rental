import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet, apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { colors, radii, spacing, typography } from '../constants/theme';

type ChatThread = {
  id: number;
  tenant_name?: string | null;
  tenant_phone?: string | null;
  contract_number?: string | null;
  property_name?: string | null;
  unit_number?: string | null;
  owner_name?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
  status?: string | null;
  status_label?: string | null;
  request_type?: string | null;
  request_type_label?: string | null;
  priority?: string | null;
  priority_label?: string | null;
};

type StatusFilter = 'all' | 'open' | 'in_progress' | 'closed';
type RequestTypeFilter = 'all' | 'general' | 'maintenance' | 'payment' | 'contract';

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'open', label: 'مفتوحة' },
  { key: 'in_progress', label: 'قيد المتابعة' },
  { key: 'closed', label: 'مغلقة' },
];

const REQUEST_TYPE_FILTERS: Array<{ key: RequestTypeFilter; label: string }> = [
  { key: 'all', label: 'كل الأنواع' },
  { key: 'general', label: 'استفسار عام' },
  { key: 'maintenance', label: 'صيانة' },
  { key: 'payment', label: 'دفعات' },
  { key: 'contract', label: 'عقد' },
];

function value(v: unknown) {
  const text = String(v ?? '').trim();
  return text || '-';
}

function shortTime(v: unknown) {
  const raw = String(v ?? '').replace('T', ' ').trim();
  return raw ? raw.slice(0, 16) : '';
}

function openThread(id: number) {
  router.push({ pathname: '/chat-thread' as any, params: { id: String(id) } });
}

export default function ChatThreadsScreen() {
  const { isTenant } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [term, setTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [requestTypeFilter, setRequestTypeFilter] = useState<RequestTypeFilter>('all');

  const load = useCallback(async (refresh = false, silent = false) => {
    try {
      if (refresh) setRefreshing(true);
      else if (!silent) setLoading(true);
      const response = await apiGet('/chat/threads');
      const data = response?.data ?? response;
      setThreads(Array.isArray(data?.threads) ? data.threads : []);
    } catch (e) {
      if (!silent) Alert.alert('تعذر تحميل المحادثات', e instanceof Error ? e.message : 'حدث خطأ أثناء تحميل المحادثات');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  useEffect(() => {
    const timer = setInterval(() => { void load(false, true); }, 12000);
    return () => clearInterval(timer);
  }, [load]);

  const visibleThreads = useMemo(() => {
    const text = term.trim().toLowerCase();
    return threads.filter((item) => {
      if (statusFilter !== 'all' && String(item.status || 'open') !== statusFilter) return false;
      if (requestTypeFilter !== 'all' && String(item.request_type || 'general') !== requestTypeFilter) return false;
      if (!text) return true;
      return [item.tenant_name, item.tenant_phone, item.contract_number, item.property_name, item.unit_number, item.owner_name, item.last_message, item.status_label, item.request_type_label, item.priority_label]
        .some((part) => String(part ?? '').toLowerCase().includes(text));
    });
  }, [requestTypeFilter, statusFilter, term, threads]);

  async function startTenantThread() {
    try {
      setLoading(true);
      const response = await apiPost('/chat/threads', {});
      const data = response?.data ?? response;
      const thread = data?.thread;
      if (thread?.id) openThread(Number(thread.id));
      else await load(false);
    } catch (e) {
      Alert.alert('تعذر فتح المحادثة', e instanceof Error ? e.message : 'لا يوجد عقد نشط لإنشاء المحادثة');
    } finally {
      setLoading(false);
    }
  }

  const hasActiveFilter = Boolean(term || statusFilter !== 'all' || requestTypeFilter !== 'all');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Ionicons name="chatbubbles-outline" size={28} color="#0F766E" /></View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{isTenant ? 'مراسلاتي' : 'محادثات المستأجرين'}</Text>
          <Text style={styles.subtitle}>{isTenant ? 'تواصل مع إدارة العقار حول عقدك ووحدتك.' : 'متابعة رسائل المستأجرين والرد عليها.'}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
        <TextInput style={styles.searchInput} value={term} onChangeText={setTerm} placeholder="بحث باسم المستأجر أو العقار أو العقد" placeholderTextColor={colors.textTertiary} textAlign="right" />
        {term ? <TouchableOpacity onPress={() => setTerm('')}><Ionicons name="close-circle" size={18} color={colors.textTertiary} /></TouchableOpacity> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {STATUS_FILTERS.map((item) => {
          const selected = statusFilter === item.key;
          return (
            <TouchableOpacity key={item.key} style={[styles.filterChip, selected ? styles.filterChipActive : null]} onPress={() => setStatusFilter(item.key)} activeOpacity={0.85}>
              <Text style={[styles.filterText, selected ? styles.filterTextActive : null]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowSecondary}>
        {REQUEST_TYPE_FILTERS.map((item) => {
          const selected = requestTypeFilter === item.key;
          return (
            <TouchableOpacity key={item.key} style={[styles.filterChip, selected ? styles.filterChipActive : null]} onPress={() => setRequestTypeFilter(item.key)} activeOpacity={0.85}>
              <Text style={[styles.filterText, selected ? styles.filterTextActive : null]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {hasActiveFilter ? (
        <TouchableOpacity style={styles.clearFilters} activeOpacity={0.85} onPress={() => { setTerm(''); setStatusFilter('all'); setRequestTypeFilter('all'); }}>
          <Ionicons name="close-circle-outline" size={17} color={colors.textSecondary} />
          <Text style={styles.clearFiltersText}>مسح البحث والفلاتر</Text>
        </TouchableOpacity>
      ) : null}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>جاري تحميل المحادثات...</Text></View>
      ) : (
        <FlatList
          data={visibleThreads}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
          ListEmptyComponent={(
            <View style={styles.emptyCard}>
              <Ionicons name="chatbox-ellipses-outline" size={38} color="#94A3B8" />
              <Text style={styles.emptyTitle}>{hasActiveFilter ? 'لا توجد نتائج' : 'لا توجد محادثات حالياً'}</Text>
              <Text style={styles.emptyText}>{hasActiveFilter ? 'غيّر البحث أو الفلاتر.' : isTenant ? 'ابدأ محادثة مرتبطة بعقدك النشط مع إدارة العقار.' : 'ستظهر هنا المحادثات عندما يبدأ المستأجرون بالتواصل.'}</Text>
              {isTenant && !hasActiveFilter ? <TouchableOpacity style={styles.startBtn} onPress={startTenantThread}><Text style={styles.startBtnText}>بدء محادثة</Text></TouchableOpacity> : null}
            </View>
          )}
          renderItem={({ item }) => {
            const unread = Number(item.unread_count || 0) > 0;
            return (
              <TouchableOpacity style={[styles.threadCard, unread ? styles.threadCardUnread : null]} activeOpacity={0.88} onPress={() => openThread(item.id)}>
                <View style={styles.threadTop}>
                  <View style={[styles.threadAvatar, unread ? styles.threadAvatarUnread : null]}><Text style={styles.threadAvatarText}>{value(item.tenant_name)[0]}</Text></View>
                  <View style={styles.threadMain}>
                    <Text numberOfLines={1} style={styles.threadTitle}>{value(item.tenant_name)}</Text>
                    <Text numberOfLines={1} style={styles.threadMeta}>العقد: {value(item.contract_number)} | الوحدة: {value(item.unit_number)}</Text>
                  </View>
                </View>
                <View style={styles.badgeRow}>
                  <View style={[styles.statusBadge, item.status === 'closed' ? styles.statusClosed : item.status === 'in_progress' ? styles.statusProgress : styles.statusOpen]}><Text style={styles.statusBadgeText}>{item.status_label || 'مفتوحة'}</Text></View>
                  <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{item.request_type_label || 'استفسار عام'}</Text></View>
                  <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{item.priority_label || 'عادي'}</Text></View>
                </View>
                <Text numberOfLines={2} style={[styles.lastMessage, unread ? styles.lastMessageUnread : null]}>{item.last_message || 'لا توجد رسائل بعد'}</Text>
                <View style={styles.footerRow}>
                  <Text numberOfLines={1} style={styles.footerText}>{value(item.property_name)}</Text>
                  <Text style={styles.timeText}>{shortTime(item.last_message_at)}</Text>
                  <Ionicons name="chevron-back" size={18} color="#0F766E" />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {isTenant && threads.length > 0 ? (
        <TouchableOpacity style={styles.floatingBtn} activeOpacity={0.88} onPress={startTenantThread}>
          <Ionicons name="create-outline" size={24} color="#fff" />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, padding: spacing.xl, paddingBottom: spacing.md },
  headerIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'flex-end' },
  title: { ...typography.h2, color: colors.text, textAlign: 'right' },
  subtitle: { color: colors.textSecondary, textAlign: 'right', marginTop: 4, lineHeight: 21 },
  searchBox: { marginHorizontal: spacing.xl, marginBottom: spacing.sm, height: 48, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: spacing.md, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  filterRow: { flexDirection: 'row-reverse', gap: spacing.xs, paddingHorizontal: spacing.xl, paddingBottom: spacing.xs },
  filterRowSecondary: { flexDirection: 'row-reverse', gap: spacing.xs, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  filterChip: { borderRadius: 999, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 8 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
  filterTextActive: { color: colors.textInverse },
  clearFilters: { marginHorizontal: spacing.xl, marginBottom: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, paddingVertical: 8, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 },
  clearFiltersText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.textSecondary, marginTop: spacing.sm },
  list: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing['4xl'] },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing['2xl'], alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight },
  emptyTitle: { color: colors.text, fontWeight: '900', fontSize: 18, marginTop: spacing.md },
  emptyText: { color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: spacing.xs },
  startBtn: { marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.xl, height: 46, alignItems: 'center', justifyContent: 'center' },
  startBtnText: { color: colors.textInverse, fontWeight: '900' },
  threadCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  threadCardUnread: { borderColor: '#FCA5A5', backgroundColor: '#FFF7F7' },
  threadTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  threadAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center' },
  threadAvatarUnread: { backgroundColor: '#DC2626' },
  threadAvatarText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  threadMain: { flex: 1, alignItems: 'flex-end' },
  threadTitle: { color: colors.text, fontWeight: '900', fontSize: 17, textAlign: 'right' },
  threadMeta: { color: colors.textSecondary, fontWeight: '700', marginTop: 3, textAlign: 'right' },
  badgeRow: { flexDirection: 'row-reverse', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusOpen: { backgroundColor: '#DCFCE7' },
  statusProgress: { backgroundColor: '#FEF3C7' },
  statusClosed: { backgroundColor: '#FEE2E2' },
  statusBadgeText: { color: colors.text, fontWeight: '900', fontSize: 11 },
  typeBadge: { borderRadius: 999, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 10, paddingVertical: 5 },
  typeBadgeText: { color: colors.textSecondary, fontWeight: '900', fontSize: 11 },
  lastMessage: { color: colors.textSecondary, textAlign: 'right', lineHeight: 22, marginTop: spacing.md },
  lastMessageUnread: { color: colors.text, fontWeight: '900' },
  footerRow: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  footerText: { color: '#0F766E', fontWeight: '900', flex: 1, textAlign: 'right' },
  timeText: { color: colors.textTertiary, fontWeight: '800', fontSize: 11 },
  floatingBtn: { position: 'absolute', left: 20, bottom: 28, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
