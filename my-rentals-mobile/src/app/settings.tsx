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
  allowGuest?: boolean;
};

type Section = { title: string; items: MenuItem[] };

const sections: Section[] = [
  {
    title: 'إدارة العقارات',
    items: [
      {
        icon: '👤',
        label: 'الملاك',
        path: '/owners',
        description: 'إدارة بيانات الملاك وربطهم بالعقارات والحسابات.',
        adminOnly: true,
      },
      {
        icon: '🧑‍💼',
        label: 'المستأجرين',
        path: '/tenants',
        description: 'استعراض وإدارة بيانات المستأجرين.',
      },
      {
        icon: '🚪',
        label: 'الوحدات',
        path: '/units',
        description: 'إدارة الشقق والوحدات وحالات الإشغال.',
      },
      {
        icon: '🅿️',
        label: 'المواقف',
        path: '/parking',
        description: 'إدارة المواقف وربطها بالمستأجرين عند الحاجة.',
      },
    ],
  },
  {
    title: 'المالية التشغيلية',
    items: [
      {
        icon: '💰',
        label: 'الدفعات',
        path: '/payments',
        description: 'متابعة دفعات الإيجار والمدفوعات المالية.',
      },
    ],
  },
  {
    title: 'المتابعة والتنبيهات',
    items: [
      {
        icon: '🔔',
        label: 'التنبيهات',
        path: '/alerts',
        description: 'عرض التنبيهات المهمة والمتأخرات القريبة.',
        allowGuest: true,
      },
      {
        icon: '📋',
        label: 'المتابعات',
        path: '/follow-ups',
        description: 'متابعة المهام والملاحظات المرتبطة بالعقود والوحدات.',
      },
      {
        icon: '🔍',
        label: 'البحث',
        path: '/search',
        description: 'بحث سريع في سجلات النظام.',
      },
      {
        icon: '🏠',
        label: 'الإشغال',
        path: '/occupancy',
        description: 'متابعة نسب الإشغال والشواغر.',
      },
    ],
  },
  {
    title: 'الإدارة والإعدادات',
    items: [
      {
        icon: '👥',
        label: 'حسابات المستخدمين',
        path: '/user-accounts',
        description: 'إدارة المستخدمين والصلاحيات وربط حسابات الملاك.',
        adminOnly: true,
      },
      {
        icon: '🔧',
        label: 'مزودو الخدمات',
        path: '/service-providers',
        description: 'تعريف ومتابعة مزودي الصيانة والخدمات.',
        adminOnly: true,
      },
      {
        icon: '🗂️',
        label: 'سجل النشاط',
        path: '/activity-logs',
        description: 'مراجعة عمليات الإضافة والتعديل والحذف داخل النظام.',
        adminOnly: true,
      },
      {
        icon: '⚙️',
        label: 'إعدادات النظام',
        path: '/system-settings',
        description: 'ضبط بيانات النظام والتفضيلات العامة.',
        adminOnly: true,
      },
      {
        icon: '🗑️',
        label: 'المحذوفات',
        path: '/trash-center',
        description: 'استعراض السجلات المحذوفة واستعادتها عند الحاجة.',
        adminOnly: true,
      },
    ],
  },
];

export default function SettingsScreen() {
  const { user, loggedIn, isAdmin, logout } = useAuth();

  function openItem(item: MenuItem) {
    if (!loggedIn && !item.allowGuest) {
      Alert.alert('تسجيل الدخول مطلوب', 'سجّل دخولك للوصول لهذه الصفحة', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'دخول', onPress: () => router.push('/login' as any) },
      ]);
      return;
    }
    router.push(item.path as any);
  }

  function handleLogout() {
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/' as any);
        },
      },
    ]);
  }

  const userInitial = user?.name?.[0]?.toUpperCase() ?? '👤';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <Text style={styles.headerIcon}>⚙️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>الإعدادات</Text>
            <Text style={styles.subtitle}>
              جميع أدوات النظام في مكان واحد. أدوات الإدارة متاحة لمدير النظام فقط.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.userCard, !loggedIn && styles.userCardGuest]}
          onPress={() =>
            router.push((loggedIn ? '/my-account' : '/login') as any)
          }
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={loggedIn ? 'عرض حسابي' : 'تسجيل الدخول'}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {loggedIn ? userInitial : '🔐'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {loggedIn ? user?.name ?? 'مستخدم' : 'تسجيل الدخول'}
            </Text>
            <Text style={styles.userRole} numberOfLines={1}>
              {loggedIn
                ? isAdmin
                  ? 'مدير النظام'
                  : 'مالك'
                : 'اضغط للدخول وعرض كامل البيانات'}
            </Text>
          </View>
          <Text style={styles.userArrow}>←</Text>
        </TouchableOpacity>

        {sections.map((sec) => {
          const visibleItems = sec.items.filter(
            (item) => !item.adminOnly || isAdmin,
          );
          if (visibleItems.length === 0) return null;

          return (
            <View key={sec.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{sec.title}</Text>
              <View style={styles.sectionCard}>
                {visibleItems.map((item, i) => (
                  <TouchableOpacity
                    key={item.path}
                    style={[
                      styles.menuItem,
                      i < visibleItems.length - 1 && styles.menuItemBorder,
                    ]}
                    onPress={() => openItem(item)}
                    activeOpacity={0.65}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                  >
                    <View style={styles.menuIcon}>
                      <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuLabel}>{item.label}</Text>
                      <Text style={styles.menuDescription}>{item.description}</Text>
                    </View>
                    <Text style={styles.menuArrow}>←</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}

        {loggedIn && (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="تسجيل الخروج"
          >
            <Text style={styles.logoutText}>🚪 تسجيل الخروج</Text>
          </TouchableOpacity>
        )}

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
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: 18,
    marginBottom: spacing.md + 2,
    ...shadows.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
  },
  headerIcon: { fontSize: 34 },
  title: { fontSize: 24, fontWeight: '900', color: colors.textInverse, textAlign: 'right' },
  subtitle: {
    marginTop: 6,
    ...typography.caption,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 20,
    textAlign: 'right',
  },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.primary,
    borderRadius: radii.lg + 2,
    padding: 18,
    marginBottom: 18,
    ...shadows.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
  },
  userCardGuest: { backgroundColor: '#1A1917', shadowColor: '#1A1917' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, color: colors.textInverse, fontWeight: '700' },
  userName: { ...typography.h4, color: colors.textInverse, textAlign: 'right' },
  userRole: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'right',
    marginTop: 2,
  },
  userArrow: { fontSize: 18, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },

  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  menuDescription: {
    marginTop: 3,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 17,
    textAlign: 'right',
  },
  menuArrow: { fontSize: 16, color: colors.textTertiary },
  logoutBtn: { alignItems: 'center', paddingVertical: 18, marginTop: 4 },
  logoutText: { ...typography.bodyBold, color: colors.danger },
});
