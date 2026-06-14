import { router } from 'expo-router';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../constants/theme';
import {
  ActionTile,
  ScreenHero,
} from '../components/ui/phase3';

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

  function requireAdmin(path: string, title: string) {
    if (!loggedIn) {
      Alert.alert('تسجيل الدخول مطلوب', `سجّل دخولك للوصول إلى ${title}`, [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'دخول', onPress: () => router.push('/login' as any) },
      ]);
      return;
    }

    if (!showAdminOnly) {
      Alert.alert('غير مصرح', 'هذه الشاشة مخصصة للإدارة فقط.');
      return;
    }

    router.push(path as any);
  }

  function requireManager(path: string, title: string) {
    if (!loggedIn) {
      Alert.alert('تسجيل الدخول مطلوب', `سجّل دخولك للوصول إلى ${title}`, [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'دخول', onPress: () => router.push('/login' as any) },
      ]);
      return;
    }

    if (!showManagerOnly) {
      Alert.alert('غير مصرح', 'هذه الشاشة مخصصة لمدير العقارات فقط.');
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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHero
          eyebrow="الحساب والخدمات"
          title="المزيد"
          subtitle="البروفايل والتقارير والخدمات الإضافية في مكان واحد."
          icon="grid-outline"
          tone="primary"
        />

        <View style={styles.card}>
          <ActionTile
            icon="person-circle-outline"
            title="بروفايل"
            subtitle="تغيير الرقم السري، عقاراتي، وروابط الحساب حسب الصلاحية."
            onPress={() => requireLogin('/profile', 'البروفايل')}
          />
        </View>

        <View style={styles.card}>
          <ActionTile
            icon="chatbubbles-outline"
            title="تذاكر المستأجرين"
            subtitle="تذاكر داخلية بين الإدارة والمستأجرين حسب النوع والأولوية."
            onPress={() => requireLogin('/chat-threads', 'تذاكر المستأجرين')}
          />
        </View>

        {showManagerOnly ? (
          <View style={styles.card}>
            <ActionTile
              icon="construct-outline"
              title="مقدمو الخدمة"
              subtitle="دليل مقاولي الصيانة والخدمات وربطهم بطلبات الصيانة المفتوحة."
              onPress={() => requireManager('/service-providers', 'مقدمو الخدمة')}
            />
          </View>
        ) : null}

        {showAdminOnly ? (
          <>
            <View style={styles.card}>
              <ActionTile
                icon="people-circle-outline"
                title="إدارة المستخدمين"
                subtitle="إنشاء وتعديل المستخدمين، ربط الملاك، تفعيل وتعطيل الحسابات، وإعادة تعيين الرقم السري."
                onPress={() => requireAdmin('/user-accounts', 'إدارة المستخدمين')}
                adminOnly
              />
            </View>

            <View style={styles.card}>
              <ActionTile
                icon="chatbubbles-outline"
                title="مركز الاستفسارات"
                subtitle="مشاهدة رسائل واتساب الواردة والردود الآلية المرتبطة بعقود المستأجرين."
                onPress={() => requireAdmin('/inquiry-center', 'مركز الاستفسارات')}
                adminOnly
              />
            </View>
          </>
        ) : null}

        <View style={styles.card}>
          <ActionTile
            icon="stats-chart-outline"
            title="التقارير"
            subtitle="التقرير الشهري، كشف الإيجار، وتقارير أداء المحفظة العقارية."
            onPress={() => requireLogin('/statistics', 'التقارير')}
          />
        </View>

        <View style={styles.card}>
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
  card: { marginTop: spacing.md },
});
