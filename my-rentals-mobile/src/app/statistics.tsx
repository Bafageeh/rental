import { router } from 'expo-router';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { colors, spacing, radii, shadows, typography } from '../constants/theme';

type MenuItem = {
  icon: string;
  label: string;
  path: string;
  description: string;
  adminOnly?: boolean;
};

type Section = { title: string; items: MenuItem[] };

const sections: Section[] = [
  {
    title: 'إحصائيات وتقارير مالية',
    items: [
      {
        icon: '📈',
        label: 'التقرير الشهري',
        path: '/monthly-financial',
        description: 'ملخص شهري للإيرادات والمصروفات والتحصيل.',
      },
      {
        icon: '📋',
        label: 'كشف الإيجار',
        path: '/rent-roll',
        description: 'عرض الإيجارات والعقود وحالة التحصيل.',
      },
      {
        icon: '📊',
        label: 'التقارير',
        path: '/reports',
        description: 'تقارير عامة وتحليل أداء المحفظة العقارية.',
      },
      {
        icon: '🏦',
        label: 'تسويات الملاك',
        path: '/owner-payouts',
        description: 'متابعة مستحقات وتسويات الملاك.',
        adminOnly: true,
      },
    ],
  },
];

export default function StatisticsScreen() {
  const { loggedIn, isAdmin } = useAuth();

  function openItem(item: MenuItem) {
    if (!loggedIn) {
      Alert.alert(
        'تسجيل الدخول مطلوب',
        'سجّل دخولك للوصول إلى الإحصائيات والتقارير',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'دخول', onPress: () => router.push('/login' as any) },
        ],
      );
      return;
    }
    router.push(item.path as any);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <Text style={styles.headerIcon}>📊</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>الإحصائيات</Text>
            <Text style={styles.subtitle}>
              التقارير الشهرية، كشف الإيجار، والتقارير المالية في مكان واحد.
            </Text>
          </View>
        </View>

        {sections.map((sec) => {
          const visibleItems = sec.items.filter(
            (item) => !item.adminOnly || isAdmin,
          );
          if (visibleItems.length === 0) return null;

          return (
            <View key={sec.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{sec.title}</Text>
              <View style={styles.grid}>
                {visibleItems.map((item) => (
                  <TouchableOpacity
                    key={item.path}
                    style={styles.card}
                    activeOpacity={0.72}
                    onPress={() => openItem(item)}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={styles.iconBox}>
                        <Text style={styles.iconText}>{item.icon}</Text>
                      </View>
                      <Text style={styles.cardArrow}>←</Text>
                    </View>
                    <Text style={styles.cardTitle}>{item.label}</Text>
                    <Text style={styles.cardDescription}>{item.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}

        <View style={{ height: 36 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 10 },

  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#111827',
    borderRadius: radii.xl,
    padding: 18,
    marginBottom: 20,
    ...shadows.md,
    shadowColor: '#111827',
    shadowOpacity: 0.18,
  },
  headerIcon: { fontSize: 34 },
  title: { fontSize: 24, fontWeight: '900', color: colors.textInverse, textAlign: 'right' },
  subtitle: {
    marginTop: 6,
    ...typography.caption,
    color: 'rgba(255,255,255,0.76)',
    lineHeight: 20,
    textAlign: 'right',
  },

  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  grid: { gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg + 2,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    ...shadows.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 23 },
  cardArrow: { fontSize: 18, color: colors.textTertiary, fontWeight: '800' },
  cardTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  cardDescription: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 19,
    textAlign: 'right',
  },
});
