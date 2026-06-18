import { router } from 'expo-router';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing, typography } from '../constants/theme';

const supportEmail = 'support@pm.sa';

export default function ManagerRegisterScreen() {
  function openSupport() {
    const url = `mailto:${supportEmail}?subject=${encodeURIComponent('طلب إنشاء حساب مدير عقارات')}&body=${encodeURIComponent('السلام عليكم،\nأرغب في إنشاء حساب مدير عقارات جديد في تطبيق إيجاراتي.\n')}`;
    Linking.openURL(url).catch(() => Alert.alert('الدعم الفني', `راسلنا على البريد: ${supportEmail}`));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.iconWrap}><Text style={styles.icon}>🏢</Text></View>
          <Text style={styles.title}>إنشاء حساب مدير عقارات</Text>
          <Text style={styles.subtitle}>إنشاء حسابات مديري العقارات يتم بعد التحقق من بيانات المنشأة أو المسؤول، ولا يتطلب تثبيت أي تطبيق خارجي.</Text>

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>طريقة الإنشاء</Text>
            <Text style={styles.noticeText}>يراجع فريق الدعم طلبات إنشاء الحسابات الجديدة، ثم يتم تفعيل الحساب وإرسال بيانات الدخول من داخل النظام أو عبر قنوات الدعم الرسمية.</Text>
          </View>

          <TouchableOpacity style={styles.btn} onPress={openSupport} activeOpacity={0.85}>
            <Text style={styles.btnText}>التواصل مع الدعم لإنشاء حساب</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/login' as any)} activeOpacity={0.85}>
            <Text style={styles.secondaryText}>العودة لتسجيل الدخول</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing['2xl'] },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing['2xl'], borderWidth: 1, borderColor: colors.borderLight, ...shadows.md },
  iconWrap: { width: 86, height: 86, borderRadius: 32, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight, marginBottom: spacing.md },
  icon: { fontSize: 38 },
  title: { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg, fontWeight: '700' },
  notice: { backgroundColor: colors.primaryLight, borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing.lg },
  noticeTitle: { color: colors.primaryDark, fontSize: 15, fontWeight: '900', textAlign: 'right', marginBottom: 6 },
  noticeText: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', lineHeight: 22, fontWeight: '700' },
  btn: { minHeight: 50, backgroundColor: colors.primary, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, ...shadows.md, shadowColor: colors.primary, shadowOpacity: 0.25 },
  btnText: { fontSize: 16, fontWeight: '800', color: colors.textInverse, textAlign: 'center' },
  secondaryBtn: { minHeight: 46, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, backgroundColor: colors.background },
  secondaryText: { fontSize: 15, fontWeight: '800', color: colors.textSecondary },
});
