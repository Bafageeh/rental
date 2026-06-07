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
};

type FilterKey = 'all' | 'unread';

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
  const [filter, setFilter] = useState<FilterKey>('all');

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

  const unreadTotal = useMemo(() => threads.reduce((sum, item) => sum + Number(item.unread_count || 0), 0), [threads]);

  const visibleThreads = useMemo(() => {
    const text = term.trim().toLowerCase();
    return threads.filter((item) => {
      const unread = Number(item.unread_count || 0) > 0;
      if (filter === 'unread' && !unread) return false;
      if (!text) return true;
      return [item.tenant_name, item.tenant_phone, item.contract_number, item.property_name, item.unit_number, item.owner_name, item.last_message]
        .some((part) => String(part ?? '').toLowerCase().includes(text));
    });
  }, [filter, term, threads]);

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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Ionicons name="chatbubbles-outline" size={28} color="#0F766E" /></View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{isTenant ? 'مراسلاتي' : 'محادثات المستأجرين'}</Text>
          <Text style={styles.subtitle}>{isTenant ? 'تواصل مع إدارة العقار حول عقدك ووحدتك.' : 'متابعة رسائل المستأجرين والرد عليها.'}</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => setFilter('all')} style={[styles.summaryCard, filter === 'all' ? styles.summaryActive : null]}><Text style={styles.summaryValue}>{threads.length}</Text><Text style={styles.summaryLabel}>كل المحادثات</Text></TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} onPress={() => setFilter('unread')} style={[styles.summaryCard, unreadTotal > 0 ? styles.summaryDanger : null, filter === 'unread' ? styles.summaryActive : null]}><Text style={[styles.summaryValue, unreadTotal > 0 ? styles.summaryValueDanger : null]}>{unreadTotal}</Text><Text style={styles.summaryLabel}>غير مقروء</Text></TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
        <TextInput style={styles.searchInput} value={term} onChangeText={setTerm} placeholder="بحث باسم المستأجر أو العقار أو العقد" placeholderTextColor={colors.textTertiary} textAlign="right" />
        {term ? <TouchableOpacity onPress={() => setTerm('')}><Ionicons name="close-circle" size={18} color={colors.textTertiary} /></TouchableOpacity> : null}
      </View>

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
              <Text style={styles.emptyTitle}>{term || filter === 'unread' ? 'لا توجد نتائج' : 'لا توجد محادثات حالياً'}</Text>
              <Text style={styles.emptyText}>{term || filter === 'unread' ? 'غيّر البحث أو ارجع إلى كل المحادثات.' : isTenant ? 'ابدأ محادثة مرتبطة بعقدك النشط مع إدارة العقار.' : 'ستظهر هنا المحادثات عندما يبدأ المستأجرون بالتواصل.'}</Text>
              {isTenant && !term && filter === 'all' ? <TouchableOpacity style={styles.startBtn} onPress={startTenantThread}><Text style={styles.startBtnText}>بدء محادثة</Text></TouchableOpacity> : null}
            </View>
          )}
          renderItem={({ item }) => {
            const unread = Number(item.unread_count || 0);
            return (
              <TouchableOpacity style={[styles.threadCard, unread > 0 ? styles.threadCardUnread : null]} activeOpacity={0.88} onPress={() => openThread(item.id)}>
                <View style={styles.threadTop}>
                  <View style={[styles.threadAvatar, unread > 0 ? styles.threadAvatarUnread : null]}><Text style={styles.threadAvatarText}>{value(item.tenant_name)[0]}</Text></View>
                  <View style={styles.threadMain}>
                    <Text numberOfLines={1} style={styles.threadTitle}>{value(item.tenant_name)}</Text>
                    <Text numberOfLines={1} style={styles.threadMeta}>العقد: {value(item.contract_number)} | الوحدة: {value(item.unit_number)}</Text>
                  </View>
                  {unread > 0 ? <View style={styles.unreadBadge}><Text style={styles.unreadText}>{unread}</Text></View> : null}
                </View>
                <Text numberOfLines={2} style={[styles.lastMessage, unread > 0 ? styles.lastMessageUnread : null]}>{item.last_message || 'لا توجد رسائل بعد'}</Text>
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
  summaryRow: { flexDirection: 'row-reverse', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  summaryCard: { flex: 1, minHeight: 54, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  summaryActive: { borderColor: colors.primary, borderWidth: 2 },
  summaryDanger: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  summaryValue: { color: colors.text, fontWeight: '900', fontSize: 17 },
  summaryValueDanger: { color: '#B91C1C' },
  summaryLabel: { color: colors.textSecondary, fontWeight: '800', fontSize: 12, marginTop: 2 },
  searchBox: { marginHorizontal: spacing.xl, marginBottom: spacing.md, height: 48, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: spacing.md, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
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
  unreadBadge: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  unreadText: { color: '#fff', fontWeight: '900' },
  lastMessage: { color: colors.textSecondary, textAlign: 'right', lineHeight: 22, marginTop: spacing.md },
  lastMessageUnread: { color: colors.text, fontWeight: '900' },
  footerRow: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  footerText: { color: '#0F766E', fontWeight: '900', flex: 1, textAlign: 'right' },
  timeText: { color: colors.textTertiary, fontWeight: '800', fontSize: 11 },
  floatingBtn: { position: 'absolute', left: 20, bottom: 28, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
