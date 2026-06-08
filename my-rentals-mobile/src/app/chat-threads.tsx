import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  closed_at?: string | null;
};

type StatusFilter = 'all' | 'open' | 'closed';

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

  const load = useCallback(async (refresh = false, silent = false) => {
    try {
      if (refresh) setRefreshing(true);
      else if (!silent) setLoading(true);
      const response = await apiGet('/chat/threads');
      const data = response?.data ?? response;
      setThreads(Array.isArray(data?.threads) ? data.threads : []);
    } catch (e) {
      if (!silent) Alert.alert('تعذر تحميل التذاكر', e instanceof Error ? e.message : 'حدث خطأ أثناء تحميل تذاكر المراسلات');
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

  const counters = useMemo(() => {
    const closed = threads.filter((item) => item.status === 'closed').length;
    const open = threads.length - closed;
    return { all: threads.length, open, closed };
  }, [threads]);

  const visibleThreads = useMemo(() => {
    const text = term.trim().toLowerCase();
    return threads.filter((item) => {
      const closed = item.status === 'closed';
      if (statusFilter === 'open' && closed) return false;
      if (statusFilter === 'closed' && !closed) return false;
      if (!text) return true;
      return [
        item.id,
        item.tenant_name,
        item.tenant_phone,
        item.contract_number,
        item.property_name,
        item.unit_number,
        item.owner_name,
        item.last_message,
        item.status_label,
        item.request_type_label,
        item.priority_label,
      ].some((part) => String(part ?? '').toLowerCase().includes(text));
    });
  }, [statusFilter, term, threads]);

  async function startTenantThread() {
    try {
      setLoading(true);
      const response = await apiPost('/chat/threads', { request_type: 'general', priority: 'normal', force_new: true });
      const data = response?.data ?? response;
      const thread = data?.thread;
      if (thread?.id) openThread(Number(thread.id));
      else await load(false);
    } catch (e) {
      Alert.alert('تعذر فتح تذكرة جديدة', e instanceof Error ? e.message : 'لا يوجد عقد نشط لإنشاء تذكرة مراسلة');
    } finally {
      setLoading(false);
    }
  }

  const filterButtons: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'كل التذاكر', count: counters.all },
    { key: 'open', label: 'المفتوحة', count: counters.open },
    { key: 'closed', label: 'المغلقة', count: counters.closed },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Ionicons name="chatbubbles-outline" size={28} color="#0F766E" /></View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{isTenant ? 'مراسلاتي' : 'تذاكر المستأجرين'}</Text>
          <Text style={styles.subtitle}>{isTenant ? 'كل بطاقة تذكرة مستقلة يمكنك الرجوع لها حتى بعد إغلاقها.' : 'كل بطاقة تذكرة مستقلة محددة بالنوع والأولوية.'}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
        <TextInput style={styles.searchInput} value={term} onChangeText={setTerm} placeholder="بحث في التذاكر باسم المستأجر أو العقار أو العقد" placeholderTextColor={colors.textTertiary} textAlign="right" />
        {term ? <TouchableOpacity onPress={() => setTerm('')}><Ionicons name="close-circle" size={18} color={colors.textTertiary} /></TouchableOpacity> : null}
      </View>

      <View style={styles.filterRow}>
        {filterButtons.map((item) => {
          const selected = statusFilter === item.key;
          return (
            <TouchableOpacity key={item.key} style={[styles.filterChip, selected ? styles.filterChipActive : null]} activeOpacity={0.85} onPress={() => setStatusFilter(item.key)}>
              <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{item.label}</Text>
              <View style={[styles.filterCount, selected ? styles.filterCountActive : null]}>
                <Text style={[styles.filterCountText, selected ? styles.filterCountTextActive : null]}>{item.count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>جاري تحميل تذاكر المراسلات...</Text></View>
      ) : (
        <FlatList
          data={visibleThreads}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
          ListEmptyComponent={(
            <View style={styles.emptyCard}>
              <Ionicons name="chatbox-ellipses-outline" size={38} color="#94A3B8" />
              <Text style={styles.emptyTitle}>{term ? 'لا توجد نتائج' : statusFilter === 'closed' ? 'لا توجد تذاكر مغلقة' : statusFilter === 'open' ? 'لا توجد تذاكر مفتوحة' : 'لا توجد تذاكر حالياً'}</Text>
              <Text style={styles.emptyText}>{term ? 'غيّر عبارة البحث أو امسحها.' : isTenant ? 'افتح تذكرة جديدة مرتبطة بعقدك النشط مع إدارة العقار.' : 'ستظهر هنا تذاكر المستأجرين عند فتحها.'}</Text>
              {isTenant && !term && statusFilter !== 'closed' ? <TouchableOpacity style={styles.startBtn} onPress={startTenantThread}><Text style={styles.startBtnText}>فتح تذكرة جديدة</Text></TouchableOpacity> : null}
            </View>
          )}
          renderItem={({ item }) => {
            const unread = Number(item.unread_count || 0) > 0;
            const closed = item.status === 'closed';
            return (
              <TouchableOpacity style={[styles.threadCard, unread ? styles.threadCardUnread : null, closed ? styles.threadCardClosed : null]} activeOpacity={0.88} onPress={() => openThread(item.id)}>
                <View style={styles.threadTop}>
                  <View style={[styles.threadAvatar, unread ? styles.threadAvatarUnread : null, closed ? styles.threadAvatarClosed : null]}><Text style={styles.threadAvatarText}>{value(item.tenant_name)[0]}</Text></View>
                  <View style={styles.threadMain}>
                    <Text numberOfLines={1} style={styles.ticketNumber}>تذكرة #{item.id}</Text>
                    <Text numberOfLines={1} style={styles.threadTitle}>{value(item.tenant_name)}</Text>
                    <Text numberOfLines={1} style={styles.threadMeta}>العقد: {value(item.contract_number)} | الوحدة: {value(item.unit_number)}</Text>
                  </View>
                </View>
                <View style={styles.badgeRow}>
                  <View style={[styles.statusBadge, closed ? styles.statusClosed : item.status === 'in_progress' ? styles.statusProgress : styles.statusOpen]}><Text style={styles.statusBadgeText}>{item.status_label || 'مفتوحة'}</Text></View>
                  <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{item.request_type_label || 'استفسار عام'}</Text></View>
                  <View style={[styles.typeBadge, item.priority === 'urgent' ? styles.priorityUrgent : item.priority === 'important' ? styles.priorityImportant : null]}><Text style={styles.typeBadgeText}>{item.priority_label || 'عادي'}</Text></View>
                </View>
                <Text numberOfLines={2} style={[styles.lastMessage, unread ? styles.lastMessageUnread : null]}>{item.last_message || 'لا توجد رسائل بعد'}</Text>
                <View style={styles.footerRow}>
                  <Text numberOfLines={1} style={styles.footerText}>{value(item.property_name)}</Text>
                  <Text style={styles.timeText}>{shortTime(closed ? item.closed_at : item.last_message_at)}</Text>
                  <Ionicons name="chevron-back" size={18} color="#0F766E" />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {isTenant ? (
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
  filterRow: { flexDirection: 'row-reverse', gap: spacing.xs, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  filterChip: { flex: 1, minHeight: 40, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12, textAlign: 'center' },
  filterChipTextActive: { color: colors.textInverse },
  filterCount: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  filterCountText: { color: colors.textSecondary, fontWeight: '900', fontSize: 11 },
  filterCountTextActive: { color: colors.textInverse },
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
  threadCardClosed: { opacity: 0.82 },
  threadTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  threadAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center' },
  threadAvatarUnread: { backgroundColor: '#DC2626' },
  threadAvatarClosed: { backgroundColor: '#64748B' },
  threadAvatarText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  threadMain: { flex: 1, alignItems: 'flex-end' },
  ticketNumber: { color: colors.textTertiary, fontWeight: '900', fontSize: 12, textAlign: 'right', marginBottom: 2 },
  threadTitle: { color: colors.text, fontWeight: '900', fontSize: 17, textAlign: 'right' },
  threadMeta: { color: colors.textSecondary, fontWeight: '700', marginTop: 3, textAlign: 'right' },
  badgeRow: { flexDirection: 'row-reverse', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusOpen: { backgroundColor: '#DCFCE7' },
  statusProgress: { backgroundColor: '#FEF3C7' },
  statusClosed: { backgroundColor: '#E2E8F0' },
  statusBadgeText: { color: colors.text, fontWeight: '900', fontSize: 11 },
  typeBadge: { borderRadius: 999, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 10, paddingVertical: 5 },
  typeBadgeText: { color: colors.textSecondary, fontWeight: '900', fontSize: 11 },
  priorityUrgent: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  priorityImportant: { backgroundColor: '#FEF3C7', borderColor: '#FBBF24' },
  lastMessage: { color: colors.textSecondary, textAlign: 'right', lineHeight: 22, marginTop: spacing.md },
  lastMessageUnread: { color: colors.text, fontWeight: '900' },
  footerRow: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  footerText: { color: '#0F766E', fontWeight: '900', flex: 1, textAlign: 'right' },
  timeText: { color: colors.textTertiary, fontWeight: '800', fontSize: 11 },
  floatingBtn: { position: 'absolute', left: 20, bottom: 28, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
