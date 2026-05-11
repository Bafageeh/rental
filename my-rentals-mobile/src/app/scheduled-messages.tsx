import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Notice, ScreenHero } from '../components/ui/phase3';
import { colors, radii, shadows, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { apiGet } from '../lib/api';

type ScheduledMessage = {
  id: string;
  title: string;
  description?: string;
  channel?: string;
  channel_label?: string;
  recipient?: string;
  command?: string;
  schedule?: {
    frequency?: string;
    frequency_label?: string;
    time?: string;
    timezone?: string;
    human?: string;
  };
  status?: string;
  status_label?: string;
};

function unwrapItems(response: any): ScheduledMessage[] {
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response)) return response;
  return [];
}

function statusStyle(status?: string) {
  const value = String(status || '').toLowerCase();
  if (value === 'active') return styles.activeBadge;
  if (value === 'paused' || value === 'disabled') return styles.pausedBadge;
  return styles.neutralBadge;
}

export default function ScheduledMessagesScreen() {
  const { loggedIn, isAdmin, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const response = await apiGet('/scheduled-messages');
      setItems(unwrapItems(response));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل الرسائل المجدولة');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (loggedIn && isAdmin) {
        void loadItems();
      } else {
        setLoading(false);
      }
    }, [isAdmin, loadItems, loggedIn]),
  );

  function onRefresh() {
    setRefreshing(true);
    void loadItems(true);
  }

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل الرسائل المجدولة...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!loggedIn || !isAdmin) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ScreenHero
            eyebrow="الإدارة"
            title="الرسائل المجدولة"
            subtitle="هذه الشاشة مخصصة لحساب المدير فقط."
            icon="lock-closed-outline"
            tone="primary"
          />
          <Notice tone="danger" title="غير مصرح" message="لا تملك صلاحية مشاهدة الرسائل المجدولة." />
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
          eyebrow="واتساب والتنبيهات"
          title="الرسائل المجدولة"
          subtitle="كل رسالة دورية يتم إرسالها تلقائيًا تظهر هنا، مثل تقرير المتأخرين اليومي وأي رسائل مستقبلية."
          icon="calendar-outline"
          tone="primary"
        />

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{items.length}</Text>
            <Text style={styles.summaryLabel}>كل الرسائل</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{items.filter((item) => item.status === 'active').length}</Text>
            <Text style={styles.summaryLabel}>نشطة</Text>
          </View>
        </View>

        {error ? <Notice tone="danger" title="تعذر التحميل" message={error} style={{ marginBottom: spacing.md }} /> : null}

        {items.length === 0 ? (
          <Notice tone="info" title="لا توجد رسائل" message="لا توجد رسائل مجدولة مسجلة حاليًا." />
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconCircle}>
                    <Ionicons name={item.channel === 'whatsapp' ? 'logo-whatsapp' : 'calendar-outline'} size={22} color={colors.primaryDark} />
                  </View>
                  <View style={styles.titleWrap}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardSubtitle}>{item.description || '-'}</Text>
                  </View>
                  <View style={[styles.badge, statusStyle(item.status)]}>
                    <Text style={styles.badgeText}>{item.status_label || item.status || '-'}</Text>
                  </View>
                </View>

                <View style={styles.detailsGrid}>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>القناة</Text>
                    <Text style={styles.detailValue}>{item.channel_label || item.channel || '-'}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>المستلم</Text>
                    <Text style={styles.detailValue}>{item.recipient || '-'}</Text>
                  </View>
                  <View style={styles.detailBoxWide}>
                    <Text style={styles.detailLabel}>الجدولة</Text>
                    <Text style={styles.detailValue}>{item.schedule?.human || '-'}</Text>
                  </View>
                  <View style={styles.detailBoxWide}>
                    <Text style={styles.detailLabel}>أمر التشغيل</Text>
                    <Text style={styles.commandText}>{item.command || '-'}</Text>
                  </View>
                </View>
              </View>
            ))}
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
  summaryRow: { flexDirection: 'row-reverse', gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  summaryValue: { ...typography.h3, color: colors.primaryDark, fontWeight: '900' },
  summaryLabel: { ...typography.small, color: colors.textSecondary, textAlign: 'center', marginTop: 2 },
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
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1 },
  cardTitle: { ...typography.bodyBold, color: colors.text, textAlign: 'right' },
  cardSubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 4, lineHeight: 20 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full },
  activeBadge: { backgroundColor: colors.successBg },
  pausedBadge: { backgroundColor: colors.warningBg },
  neutralBadge: { backgroundColor: colors.surfaceSubtle },
  badgeText: { ...typography.small, color: colors.text, fontWeight: '900' },
  detailsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  detailBox: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  detailBoxWide: {
    width: '100%',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  detailLabel: { ...typography.small, color: colors.textTertiary, textAlign: 'right', marginBottom: 4 },
  detailValue: { ...typography.caption, color: colors.text, fontWeight: '800', textAlign: 'right', lineHeight: 20 },
  commandText: { ...typography.small, color: colors.textSecondary, fontWeight: '800', textAlign: 'right' },
});
