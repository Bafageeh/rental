import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../constants/theme';
import { apiPost } from '../lib/api';
import { resetNavigationHistory } from '../lib/navigationHistory';
import {
  ActionTile,
  MiniAction,
  PhaseSection,
  ScreenHero,
  SearchBar,
} from '../components/ui/phase3';

 type MenuItem = {
  icon: any;
  label: string;
  path: string;
  description: string;
  adminOnly?: boolean;
  keywords?: string;
  action?: 'logout';
};

type MenuSection = {
  title: string;
  subtitle: string;
  items: MenuItem[];
};

const sections: MenuSection[] = [
  {
    title: 'إدارة المحفظة',
    subtitle: 'الملاك، العقارات، الوحدات، المستأجرون، والعقود.',
    items: [
      { icon: 'business-outline', label: 'العقارات', path: '/properties', description: 'استعراض العقارات والوصول إلى تفاصيل الوحدات والدخل.' },
      { icon: 'home-outline', label: 'الوحدات', path: '/units', description: 'متابعة الوحدات المتاحة والمؤجرة وحالات الصيانة.' },
      { icon: 'people-outline', label: 'المستأجرون', path: '/tenants', description: 'ملفات المستأجرين، بيانات التواصل، وكشوف الحساب.' },
      { icon: 'document-text-outline', label: 'العقود', path: '/contracts', description: 'العقود النشطة والمنتهية وروابط التفاصيل.' },
      { icon: 'car-outline', label: 'المواقف', path: '/parking', description: 'إدارة المواقف والرسوم المرتبطة بها.' },
      { icon: 'person-circle-outline', label: 'الملاك', path: '/owners', description: 'إدارة الملاك وربطهم بالعقارات.', adminOnly: true },
    ],
  },
  {
    title: 'الماليات والتحصيل',
    subtitle: 'كل ما يتعلق بالدفعات والمصروفات والتقارير المالية.',
    items: [
      { icon: 'cash-outline', label: 'الدفعات', path: '/payments', description: 'المدفوع، المستحق، والمتأخر.' },
      { icon: 'receipt-outline', label: 'سندات القبض', path: '/payment-receipts', description: 'إصدار ومراجعة السندات.' },
      { icon: 'trending-down-outline', label: 'المصروفات', path: '/expenses', description: 'مصروفات الصيانة والخدمات والتشغيل.' },
      { icon: 'flash-outline', label: 'فواتير الخدمات', path: '/utility-bills', description: 'الكهرباء، المياه، الإنترنت، والخدمات المشتركة.' },
      { icon: 'wallet-outline', label: 'تسويات الملاك', path: '/owner-payouts', description: 'مستحقات الملاك والتحويلات.', adminOnly: true },
      { icon: 'swap-horizontal-outline', label: 'التسويات', path: '/owner-settlements', description: 'مطابقة الإيرادات والمصروفات مع الملاك.', adminOnly: true },
      { icon: 'calendar-outline', label: 'التقرير الشهري', path: '/monthly-financial', description: 'إيرادات، مصروفات، وصافي الدخل للشهر.' },
      { icon: 'list-outline', label: 'كشف الإيجار', path: '/rent-roll', description: 'جدول العقود والإيجارات وحالات التحصيل.' },
      { icon: 'reader-outline', label: 'كشوف المستأجرين', path: '/tenant-statements', description: 'كشف حساب مستأجر أو مجموعة مستأجرين.' },
    ],
  },
  {
    title: 'التشغيل والمتابعة',
    subtitle: 'إجراءات يومية تساعدك على متابعة الأعمال بسرعة.',
    items: [
      { icon: 'cloud-upload-outline', label: 'رفع عقد PDF', path: '/upload-contract', description: 'استخراج بيانات عقد إيجار وتحضيرها للحفظ.' },
      { icon: 'add-circle-outline', label: 'إنشاء عقد', path: '/create-contract', description: 'إضافة عقد جديد يدويًا.' },
      { icon: 'refresh-outline', label: 'تجديد العقود', path: '/contract-renewals', description: 'متابعة العقود القريبة من الانتهاء.' },
      { icon: 'alarm-outline', label: 'التذكيرات', path: '/reminders', description: 'مواعيد ومهام مرتبطة بالعقارات والعقود.' },
      { icon: 'checkmark-done-outline', label: 'المتابعات', path: '/follow-ups', description: 'مهام تحتاج إجراء أو تواصل.' },
      { icon: 'notifications-outline', label: 'التنبيهات', path: '/alerts', description: 'تنبيهات النظام المهمة.' },
      { icon: 'bulb-outline', label: 'تنبيهات ذكية', path: '/smart-alerts', description: 'اقتراحات مبنية على حالة المحفظة.' },
      { icon: 'megaphone-outline', label: 'تسويق الوحدات', path: '/unit-marketing', description: 'تجهيز الوحدة للمشاركة والتسويق.' },
      { icon: 'clipboard-outline', label: 'فحص الوحدات', path: '/unit-inspections', description: 'توثيق الفحص والملاحظات والصور.' },
      { icon: 'chatbubbles-outline', label: 'مركز التواصل', path: '/communication-center', description: 'متابعة رسائل وتواصل المستأجرين والملاك.' },
      { icon: 'construct-outline', label: 'مزودو الخدمات', path: '/service-providers', description: 'بيانات الفنيين وشركات الصيانة.' },
    ],
  },
  {
    title: 'المستندات والنظام',
    subtitle: 'ملفات، إعدادات، حسابات، وأدوات إدارية.',
    items: [
      { icon: 'person-circle-outline', label: 'بروفايل', path: '/profile', description: 'تغيير الرقم السري وعرض عقاراتي.', keywords: 'profile حسابي بروفايل عقاراتي كلمة المرور الرقم السري' },
      { icon: 'folder-open-outline', label: 'المستندات', path: '/documents', description: 'صكوك، عقود، ومرفقات العقارات.' },
      { icon: 'images-outline', label: 'الملفات والوسائط', path: '/files', description: 'صور وفيديوهات وملفات مرتبطة بالسجلات.' },
      { icon: 'download-outline', label: 'التصدير', path: '/export-center', description: 'تصدير التقارير والبيانات.', adminOnly: true },
      { icon: 'person-outline', label: 'حسابي', path: '/my-account', description: 'بيانات المستخدم الحالي.' },
      { icon: 'settings-outline', label: 'الإعدادات', path: '/settings', description: 'إعدادات التطبيق العامة.' },
      { icon: 'shield-checkmark-outline', label: 'إعدادات النظام', path: '/system-settings', description: 'إعدادات إدارية للنظام.', adminOnly: true },
      { icon: 'key-outline', label: 'حسابات المستخدمين', path: '/user-accounts', description: 'إدارة صلاحيات وحسابات المستخدمين.', adminOnly: true },
      { icon: 'business-outline', label: 'حسابات الملاك', path: '/owner-accounts', description: 'حسابات دخول الملاك وبواباتهم.', adminOnly: true },
      { icon: 'card-outline', label: 'الحسابات البنكية', path: '/owner-bank-accounts', description: 'الحسابات البنكية المرتبطة بالملاك.', adminOnly: true },
      { icon: 'pulse-outline', label: 'صحة البيانات', path: '/data-health', description: 'فحص العلاقات والبيانات الناقصة.', adminOnly: true },
      { icon: 'create-outline', label: 'مركز التعديل', path: '/edit-delete-center', description: 'تعديل وحذف سجلات النظام.', adminOnly: true },
      { icon: 'trash-outline', label: 'المحذوفات', path: '/trash-center', description: 'مراجعة واستعادة السجلات المحذوفة.', adminOnly: true },
      { icon: 'git-compare-outline', label: 'مدير العلاقات', path: '/relations-manager', description: 'أدوات ربط السجلات وتنظيف العلاقات.', adminOnly: true },
      { icon: 'time-outline', label: 'آخر النشاطات', path: '/activity-feed', description: 'آخر عمليات تمت على النظام.' },
      { icon: 'document-lock-outline', label: 'سجل النشاط', path: '/activity-logs', description: 'سجل تدقيق مفصل للعمليات.', adminOnly: true },
      { icon: 'log-out-outline', label: 'تسجيل الخروج', path: '#logout', description: 'الخروج من التطبيق والعودة لشاشة تسجيل الدخول.', action: 'logout' },
    ],
  },
];

function matchesQuery(item: MenuItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.label, item.description, item.path, item.keywords]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q);
}

export default function MoreScreen() {
  const { loggedIn, isAdmin, logout } = useAuth();
  const [query, setQuery] = useState('');

  const filteredSections = useMemo(() => {
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => (!item.adminOnly || isAdmin) && matchesQuery(item, query)),
      }))
      .filter((section) => section.items.length > 0);
  }, [isAdmin, query]);

  function performLogout() {
    apiPost('/auth/logout')
      .catch(() => undefined)
      .then(() => logout())
      .catch(() => undefined)
      .then(() => {
        resetNavigationHistory();
        router.replace('/login' as any);
      });
  }

  function confirmLogout() {
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج من التطبيق؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: performLogout },
    ]);
  }

  function openItem(item: MenuItem) {
    if (item.action === 'logout') {
      confirmLogout();
      return;
    }
    open(item.path);
  }

  function open(path: string) {
    if (!loggedIn) {
      Alert.alert('تسجيل الدخول مطلوب', 'سجّل دخولك للوصول إلى هذا القسم', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'دخول', onPress: () => router.push('/login' as any) },
      ]);
      return;
    }

    router.push(path as any);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHero
          eyebrow="مركز التحكم"
          title="كل أدوات الإدارة في مكان واحد"
          subtitle="تنقل أسرع بين المحفظة، التحصيل، التشغيل، التقارير، والإعدادات."
          icon="grid-outline"
          tone="primary"
        />

        <View style={styles.quickRow}>
          <MiniAction icon="cloud-upload-outline" label="رفع عقد" onPress={() => open('/upload-contract')} />
          <MiniAction icon="add-circle-outline" label="عقد جديد" onPress={() => open('/create-contract')} />
          <MiniAction icon="person-circle-outline" label="بروفايل" onPress={() => open('/profile')} />
          <MiniAction icon="search-outline" label="بحث" onPress={() => open('/search')} />
        </View>

        <SearchBar value={query} onChangeText={setQuery} placeholder="ابحث عن شاشة أو أداة..." />

        {filteredSections.map((section) => (
          <PhaseSection key={section.title} title={section.title} subtitle={section.subtitle}>
            {section.items.map((item) => (
              <ActionTile
                key={item.path}
                icon={item.icon}
                title={item.label}
                subtitle={item.description}
                adminOnly={item.adminOnly}
                onPress={() => openItem(item)}
              />
            ))}
          </PhaseSection>
        ))}

        {filteredSections.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>لا توجد نتائج</Text>
            <Text style={styles.emptyText}>جرّب كلمة بحث مختلفة أو امسح البحث.</Text>
          </View>
        ) : null}

        <View style={{ height: 36 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing['4xl'] },
  quickRow: { flexDirection: 'row-reverse', gap: spacing.sm, marginBottom: spacing.lg },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
  },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: colors.textSecondary, marginTop: 6, textAlign: 'center' },
});
