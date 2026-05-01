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
  const { loggedIn } = useAuth();

  function openProfile() {
    if (!loggedIn) {
      Alert.alert('تسجيل الدخول مطلوب', 'سجّل دخولك للوصول إلى البروفايل', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'دخول', onPress: () => router.push('/login' as any) },
      ]);
      return;
    }

    router.push('/profile' as any);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHero
          eyebrow="الحساب"
          title="بروفايل الحساب"
          subtitle="كل الروابط والأزرار الخاصة بالحساب الحالي داخل شاشة بروفايل واحدة."
          icon="person-circle-outline"
          tone="primary"
        />

        <View style={styles.card}>
          <ActionTile
            icon="person-circle-outline"
            title="بروفايل"
            subtitle="تغيير الرقم السري، عقاراتي، وروابط الحساب حسب الصلاحية."
            onPress={openProfile}
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
