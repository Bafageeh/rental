import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionTile, ScreenHero } from '../components/ui/phase3';
import { colors, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

type MoreAction = {
  icon: string;
  title: string;
  subtitle: string;
  path: string;
  adminOnly?: boolean;
  managerOnly?: boolean;
};

type MoreSection = {
  title: string;
  subtitle: string;
  items: MoreAction[];
};

const movedSections: MoreSection[] = [
  {
    title: 'محفظتي',
    subtitle: 'روابط المستأجرين والخدمات حسب صلاحية الحساب.',
    items: [
      { icon: 'people-outline', title: 'المستأجرون', subtitle: 'بيانات المستأجرين وكشوفهم', path: '/tenants' },
      { icon: 'car-outline', title: 'المواقف', subtitle: 'إدارة المواقف والرسوم', path: '/parking' },
      { icon: 'people-circle-outline', title: 'الملاك', subtitle: 'إدارة الملاك وربطهم بالعقارات', path: '/owners', adminOnly: true },
    ],
  },
  {
    title: 'المالية والتقارير',
    subtitle: 'التحصيل، المصروفات، والتقارير المالية.',
    items: [
      { icon: 'cash-outline', title: 'الدفعات', subtitle: 'المدفوع والمستحق والمتأخر', path: '/payments' },
      { icon: 'trending-down-outline', title: 'المصروفات', subtitle: 'مصروفات التشغيل والصيانة', path: '/expenses' },
      { icon: 'flash-outline', title: 'فواتير الخدمات', subtitle: 'الكهرباء والمياه والخدمات', path: '/utility-bills' },
      { icon: 'calendar-outline', title: 'التقرير الشهري', subtitle: 'إيرادات ومصروفات الشهر', path: '/monthly-financial' },
      { icon: 'list-outline', title: 'كشف الإيجار', subtitle: 'جدول الإيجارات والتحصيل', path: '/rent-roll' },
      { icon: 'document-text-outline', title: 'كشوف المستأجرين', subtitle: 'كشف حساب المستأجرين', path: '/tenant-statements' },
      { icon: 'card-outline', title: 'تسويات الملاك', subtitle: 'مستحقات وتحويلات الملاك', path: '/owner-payouts', adminOnly: true },
      { icon: 'swap-horizontal-outline', title: 'التسويات', subtitle: 'مطابقة الإيرادات والمصروفات', path: '/owner-settlements', adminOnly: true },
    ],
  },
  {
    title: 'التشغيل والمتابعة',
    subtitle: 'الإجراءات اليومية والملفات والتنبيهات.',
    items: [
      { icon: 'add-circle-outline', title: 'إنشاء عقد', subtitle: 'إضافة عقد جديد يدويًا', path: '/create-contract' },
      { icon: 'refresh-outline', title: 'تجديد العقود', subtitle: 'العقود القريبة من الانتهاء', path: '/contract-renewals' },
      { icon: 'alarm-outline', title: 'التذكيرات', subtitle: 'المواعيد والمهام', path: '/reminders' },
      { icon: 'checkbox-outline', title: 'المتابعات', subtitle: 'مهام تحتاج إجراء', path: '/follow-ups' },
      { icon: 'notifications-outline', title: 'التنبيهات', subtitle: 'تنبيهات النظام', path: '/alerts' },
      { icon: 'bulb-outline', title: 'تنبيهات ذكية', subtitle: 'اقتراحات وملاحظات ذكية', path: '/smart-alerts' },
      { icon: 'megaphone-outline', title: 'تسويق الوحدات', subtitle: 'تجهيز الوحدة للتسويق', path: '/unit-marketing' },
      { icon: 'clipboard-outline', title: 'فحص الوحدات', subtitle: 'توثيق الفحص والملاحظات', path: '/unit-inspections' },
      { icon: 'chatbubbles-outline', title: 'مركز التواصل', subtitle: 'رسائل وتواصل المستأجرين والملاك', path: '/communication-center' },
      { icon: 'construct-outline', title: 'مقدمو الخدمة', subtitle: 'الفنيون وشركات الصيانة', path: '/service-providers', managerOnly: true },
    ],
  },
  {
    title: 'روابط المدير',
    subtitle: 'تظهر فقط لحساب المدير.',
    items: [
      { icon: 'images-outline', title: 'الملفات والوسائط', subtitle: 'صور وفيديوهات وملفات', path: '/files', adminOnly: true },
      { icon: 'settings-outline', title: 'الإعدادات', subtitle: 'إعدادات التطبيق العامة', path: '/settings', adminOnly: true },
      { icon: 'key-outline', title: 'حسابات المستخدمين', subtitle: 'إدارة الصلاحيات والحسابات', path: '/user-accounts', adminOnly: true },
      { icon: 'business-outline', title: 'حسابات الملاك', subtitle: 'حسابات دخول الملاك', path: '/owner-accounts', adminOnly: true },
      { icon: 'card-outline', title: 'الحسابات البنكية', subtitle: 'حسابات الملاك البنكية', path: '/owner-bank-accounts', adminOnly: true },
      { icon: 'medkit-outline', title: 'صحة البيانات', subtitle: 'فحص العلاقات والبيانات', path: '/data-health', adminOnly: true },
      { icon: 'trash-outline', title: 'المحذوفات', subtitle: 'مراجعة واستعادة المحذوفات', path: '/trash-center', adminOnly: true },
      { icon: 'git-network-outline', title: 'مدير العلاقات', subtitle: 'ربط وتنظيف العلاقات', path: '/relations-manager', adminOnly: true },
      { icon: 'time-outline', title: 'آخر النشاطات', subtitle: 'آخر العمليات على النظام', path: '/activity-feed', adminOnly: true },
      { icon: 'reader-outline', title: 'سجل النشاط', subtitle: 'سجل تدقيق مفصل', path: '/activity-logs', adminOnly: true },
    ],
  },
];

export default function MoreScreen() {
  const { loggedIn, isAdmin, user, logout } = useAuth();
  const role = String(user?.role ?? '').trim().toLowerCase();
  const showAdminOnly = isAdmin && (role === 'admin' || role === 'super_admin');
  const showManagerOnly = loggedIn && role === 'manager';

  function requireLogin(path: string, title: string) {
    if (!loggedIn) {
      Alert.alert('تسجيل الدخول مطلوب', `سجّل دخولك للوصول إلى ${title}`, [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'دخول', onPress: () => router.push('/login' as any) },
      ]);
      return;
    }

    router.push(path as any);
  }

  function confirmLogout() {
    if (!loggedIn) {
      router.push('/login' as any);
      return;
    }

    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج من الحساب الحالي؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login' as any);
        },
      },
    ]);
  }

  const visibleSections = movedSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.adminOnly && !showAdminOnly) return false;
        if (item.managerOnly && !showManagerOnly) return false;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHero
          eyebrow="الحساب والخدمات"
          title="المزيد"
          subtitle="جميع روابط التشغيل والمالية والإدارة في مكان واحد."
          icon="grid-outline"
          tone="primary"
        />

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>البروفايل</Text>
          <Text style={styles.sectionSubtitle}>مجموعة الحساب فقط بقيت داخل البروفايل.</Text>
          <ActionTile
            icon="person-circle-outline"
            title="بروفايل الحساب"
            subtitle="تغيير الرقم السري، حسابي، وتسجيل الخروج."
            onPress={() => requireLogin('/profile', 'البروفايل')}
          />
        </View>

        {visibleSections.map((section) => (
          <View key={section.title} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
            {section.items.map((item) => (
              <View key={`${section.title}-${item.title}`} style={styles.tileWrap}>
                <ActionTile
                  icon={item.icon}
                  title={item.title}
                  subtitle={item.subtitle}
                  onPress={() => requireLogin(item.path, item.title)}
                  adminOnly={item.adminOnly}
                />
              </View>
            ))}
          </View>
        ))}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>الدعم</Text>
          <Text style={styles.sectionSubtitle}>الخصوصية والدعم الفني.</Text>
          <ActionTile
            icon="shield-checkmark-outline"
            title="الخصوصية والدعم"
            subtitle="سياسة الخصوصية، الدعم الفني، وطلب حذف الحساب والبيانات."
            onPress={() => router.push('/privacy' as any)}
          />
        </View>

        <View style={styles.sectionCard}>
          <ActionTile
            icon="log-out-outline"
            title="خروج"
            subtitle="تسجيل الخروج من الحساب الحالي والعودة لشاشة الدخول."
            onPress={confirmLogout}
          />
        </View>

        <View style={{ height: 36 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing['4xl'] },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: spacing.md,
  },
  sectionTitle: { ...typography.bodyBold, color: colors.text, fontSize: 20, textAlign: 'right' },
  sectionSubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 4, marginBottom: spacing.sm, lineHeight: 20 },
  tileWrap: { marginTop: spacing.sm },
});
