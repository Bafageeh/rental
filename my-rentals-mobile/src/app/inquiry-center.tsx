import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Notice, ScreenHero, SearchBar } from '../components/ui/phase3';
import { colors, radii, shadows, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { apiGet } from '../lib/api';

type TenantSummary = {
  id?: number;
  name?: string | null;
  phone?: string | null;
};

type WebhookEvent = {
  id: number;
  provider?: string | null;
  event_type?: string | null;
  direction?: string | null;
  external_id?: string | null;
  tenant_id?: number | null;
  tenant?: TenantSummary | null;
  source?: string | null;
  destination?: string | null;
  status?: string | null;
  payload?: any;
  processed_at?: string | null;
  created_at?: string | null;
};

function unwrapEvents(response: any): WebhookEvent[] {
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response)) return response;
  return [];
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ar-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getIncomingText(event: WebhookEvent) {
  return String(
    event.payload?.message?.text?.body ||
      event.payload?.message?.button?.text ||
      event.payload?.message?.interactive?.button_reply?.title ||
      event.payload?.message?.interactive?.list_reply?.title ||
      '',
  ).trim();
}

function getReplyText(event: WebhookEvent) {
  return String(event.payload?.inquiry_reply || '').trim();
}

function eventTypeLabel(event: WebhookEvent) {
  if (event.event_type === 'message') return 'رسالة واردة';
  if (String(event.event_type || '').startsWith('status_')) return 'حالة رسالة';
  return event.event_type || 'حدث';
}

function statusTone(status?: string | null) {
  const s = String(status || '').toLowerCase();
  if (['read', 'delivered', 'sent'].includes(s)) return styles.statusSuccess;
  if (['failed', 'error'].includes(s)) return styles.statusDanger;
  if (s.includes('text') || s.includes('message')) return styles.statusInfo;
  return styles.statusNeutral;
}

export default function InquiryCenterScreen() {
  const { loggedIn, isAdmin, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadEvents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setWarning(null);

    try {
      const response = await apiGet('/webhook-events?provider=whatsapp&per_page=60');
      setEvents(unwrapEvents(response));
    } catch (e) {
      setEvents([]);
      setWarning('تعذر تحميل رسائل واتساب من الخادم، وتم إبقاء مركز الاستفسارات مفتوحًا بدون تعطيل.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (loggedIn && isAdmin) {
        void loadEvents();
      } else {
        setLoading(false);
      }
    }, [isAdmin, loadEvents, loggedIn]),
  );

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;

    return events.filter((event) => {
      const haystack = [
        event.tenant?.name,
        event.tenant?.phone,
        event.source,
        event.destination,
        event.status,
        event.event_type,
        getIncomingText(event),
        getReplyText(event),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [events, query]);

  function onRefresh() {
    setRefreshing(true);
    void loadEvents(true);
  }

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل مركز الاستفسارات...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!loggedIn) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ScreenHero
            eyebrow="واتساب"
            title="مركز الاستفسارات"
            subtitle="يلزم تسجيل الدخول لمتابعة محادثات المستأجرين."
            icon="chatbubbles-outline"
            tone="primary"
          />
          <Notice tone="warning" title="تسجيل الدخول مطلوب" message="سجّل دخولك أولًا للوصول إلى مركز الاستفسارات." />
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/login' as any)}>
            <Text style={styles.primaryButtonText}>تسجيل الدخول</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ScreenHero
            eyebrow="واتساب"
            title="مركز الاستفسارات"
            subtitle="هذه الشاشة مخصصة للإدارة فقط."
            icon="lock-closed-outline"
            tone="primary"
          />
          <Notice tone="danger" title="غير مصرح" message="لا تملك صلاحية مشاهدة محادثات مركز الاستفسارات." />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ScreenHero
          eyebrow="واتساب"
          title="مركز الاستفسارات"
          subtitle="متابعة رسائل المستأجرين والردود الآلية المرتبطة بعقودهم."
          icon="chatbubbles-outline"
          tone="primary"
        />

        <TouchableOpacity
          style={styles.scheduledMessagesCard}
          activeOpacity={0.88}
          onPress={() => router.push('/scheduled-messages' as any)}
        >
          <View style={styles.scheduledIconCircle}>
            <Ionicons name="calendar-outline" size={24} color={colors.primaryDark} />
          </View>
          <View style={styles.scheduledTextWrap}>
            <Text style={styles.scheduledTitle}>الرسائل المجدولة</Text>
            <Text style={styles.scheduledSubtitle}>تقرير المتأخرين اليومي وأي رسائل واتساب دورية مستقبلًا</Text>
          </View>
          <Ionicons name="chevron-back" size={22} color={colors.textTertiary} />
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{events.length}</Text>
            <Text style={styles.statLabel}>كل الأحداث</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{events.filter((e) => e.event_type === 'message').length}</Text>
            <Text style={styles.statLabel}>رسائل واردة</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{events.filter((e) => getReplyText(e)).length}</Text>
            <Text style={styles.statLabel}>ردود مجهزة</Text>
          </View>
        </View>

        <SearchBar value={query} onChangeText={setQuery} placeholder="بحث باسم المستأجر أو الرقم أو نص الرسالة..." />

        {warning ? (
          <Notice tone="warning" title="تنبيه مؤقت" message={warning} style={{ marginBottom: spacing.md }} />
        ) : null}

        {filteredEvents.length === 0 ? (
          <Notice
            tone="info"
            title="لا توجد نتائج"
            message="لم تصل رسائل أو لا توجد نتيجة مطابقة للبحث الحالي."
          />
        ) : (
          <View style={styles.list}>
            {filteredEvents.map((event) => {
              const incomingText = getIncomingText(event);
              const replyText = getReplyText(event);
              const isIncoming = event.direction === 'incoming' || event.event_type === 'message';

              return (
                <View key={`${event.id}-${event.external_id || ''}`} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.statusPill, statusTone(event.status)]}>
                      <Text style={styles.statusText}>{event.status || eventTypeLabel(event)}</Text>
                    </View>
                    <View style={styles.titleWrap}>
                      <Text style={styles.cardTitle}>{event.tenant?.name || 'رقم غير مرتبط بمستأجر'}</Text>
                      <Text style={styles.cardSubtitle}>{event.source || event.destination || '-'}</Text>
                    </View>
                    <View style={styles.iconCircle}>
                      <Ionicons name={isIncoming ? 'arrow-down-outline' : 'checkmark-done-outline'} size={18} color={colors.primaryDark} />
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>{eventTypeLabel(event)}</Text>
                    <Text style={styles.metaText}>{formatDate(event.created_at || event.processed_at)}</Text>
                  </View>

                  {incomingText ? (
                    <View style={styles.messageBox}>
                      <Text style={styles.boxLabel}>رسالة المستأجر</Text>
                      <Text style={styles.messageText}>{incomingText}</Text>
                    </View>
                  ) : null}

                  {replyText ? (
                    <View style={[styles.messageBox, styles.replyBox]}>
                      <Text style={styles.boxLabel}>الرد الآلي</Text>
                      <Text style={styles.messageText}>{replyText}</Text>
                    </View>
                  ) : null}

                  {!incomingText && !replyText ? (
                    <Text style={styles.mutedText}>لا توجد رسالة نصية محفوظة لهذا الحدث.</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 36 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing['4xl'] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  loadingText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  primaryButton: {
    marginTop: spacing.lg,
    minHeight: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { ...typography.bodyBold, color: colors.textInverse },
  scheduledMessagesCard: {
    minHeight: 82,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  scheduledIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduledTextWrap: { flex: 1, alignItems: 'flex-end' },
  scheduledTitle: { ...typography.bodyBold, color: colors.text, fontSize: 17, textAlign: 'right' },
  scheduledSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 4, textAlign: 'right', lineHeight: 19 },
  statsRow: { flexDirection: 'row-reverse', gap: spacing.sm, marginBottom: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: { ...typography.h3, color: colors.primaryDark, fontWeight: '900' },
  statLabel: { ...typography.small, color: colors.textSecondary, textAlign: 'center', marginTop: 2 },
  list: { gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1 },
  cardTitle: { ...typography.bodyBold, color: colors.text, textAlign: 'right' },
  cardSubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.full },
  statusText: { ...typography.small, color: colors.text, fontWeight: '800' },
  statusSuccess: { backgroundColor: colors.successBg },
  statusDanger: { backgroundColor: colors.dangerBg },
  statusInfo: { backgroundColor: colors.infoBg },
  statusNeutral: { backgroundColor: colors.surfaceSubtle },
  metaRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  metaText: { ...typography.small, color: colors.textTertiary, textAlign: 'right' },
  messageBox: {
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
  },
  replyBox: { backgroundColor: colors.primaryLight },
  boxLabel: { ...typography.small, color: colors.primaryDark, fontWeight: '900', textAlign: 'right', marginBottom: 5 },
  messageText: { ...typography.caption, color: colors.text, textAlign: 'right', lineHeight: 20 },
  mutedText: { ...typography.caption, color: colors.textTertiary, textAlign: 'right', marginTop: spacing.sm },
});
