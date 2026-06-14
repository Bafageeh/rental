import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { apiPost } from '../lib/api';

const supportEmail = 'support@pm.sa';

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.iconBox}><Ionicons name={icon as any} size={22} color={colors.primary} /></View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const { loggedIn, user } = useAuth();
  const [requestingDeletion, setRequestingDeletion] = useState(false);

  function openSupportEmail(subject = 'دعم تطبيق إيجاراتي') {
    const userLine = user ? `\n\nبيانات الحساب:\nالاسم: ${user?.name ?? '-'}\nالمستخدم: ${user?.username ?? user?.phone ?? user?.email ?? '-'}` : '';
    const url = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`السلام عليكم،\nأحتاج مساعدة بخصوص تطبيق إيجاراتي.${userLine}`)}`;
    Linking.openURL(url).catch(() => Alert.alert('الدعم الفني', `راسلنا على البريد: ${supportEmail}`));
  }

  async function requestAccountDeletion() {
    if (!loggedIn) {
      Alert.alert('تسجيل الدخول مطلوب', 'لطلب حذف الحساب والبيانات، سجل الدخول أولاً ثم افتح هذه الشاشة مرة أخرى.', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'تسجيل الدخول', onPress: () => router.push('/login' as any) },
      ]);
      return;
    }

    Alert.alert('طلب حذف الحساب', 'سيتم إرسال طلب حذف الحساب والبيانات المرتبطة به للمراجعة والتنفيذ حسب الأنظمة والالتزامات التعاقدية. هل تريد المتابعة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إرسال الطلب',
        style: 'destructive',
        onPress: async () => {
          try {
            setRequestingDeletion(true);
            await apiPost('/privacy/account-deletion-request', { source: 'mobile_app' });
            Alert.alert('تم استلام الطلب', 'تم تسجيل طلب حذف الحساب. سيتواصل معك الدعم الفني عند الحاجة لإكمال الإجراء.');
          } catch (e) {
            Alert.alert('تعذر إرسال الطلب', e instanceof Error ? e.message : `يمكنك إرسال الطلب مباشرة إلى ${supportEmail}`);
          } finally {
            setRequestingDeletion(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}><Ionicons name="shield-checkmark-outline" size={34} color={colors.primary} /></View>
          <Text style={styles.heroTitle}>الخصوصية والدعم</Text>
          <Text style={styles.heroSubtitle}>نوضح هنا البيانات المستخدمة داخل التطبيق، سبب استخدامها، وطريقة طلب الدعم أو حذف الحساب.</Text>
        </View>

        <Section icon="lock-closed-outline" title="البيانات التي يستخدمها التطبيق">
          الاسم، رقم الجوال، رقم الهوية أو الإقامة، بيانات العقارات والوحدات، العقود، الدفعات، التذاكر، المرفقات والصور أو الملفات التي يرفعها المستخدم، ورمز الإشعارات عند تفعيل التنبيهات.
        </Section>

        <Section icon="analytics-outline" title="سبب جمع البيانات">
          تُستخدم البيانات لتشغيل خدمات إدارة العقارات، عرض العقود والدفعات، إرسال التنبيهات، إدارة تذاكر المستأجرين، وتمكين الملاك والمديرين والمستأجرين من الوصول للبيانات الخاصة بهم حسب الصلاحيات.
        </Section>

        <Section icon="server-outline" title="الحفظ والمشاركة">
          يتم حفظ البيانات على خوادم التطبيق ولا يتم بيعها للمعلنين. لا تظهر بيانات أي مالك أو مستأجر إلا للمستخدمين المصرح لهم داخل نفس النطاق الإداري أو التعاقدي.
        </Section>

        <Section icon="trash-outline" title="حذف الحساب والبيانات">
          يمكن للمستخدم بدء طلب حذف الحساب من داخل التطبيق. قد نحتاج للاحتفاظ ببعض السجلات المطلوبة نظاميًا أو محاسبيًا لفترة محددة، ثم يتم حذف أو تعطيل البيانات غير المطلوبة.
        </Section>

        <TouchableOpacity style={[styles.primaryButton, requestingDeletion ? styles.disabledButton : null]} activeOpacity={0.86} onPress={requestAccountDeletion} disabled={requestingDeletion}>
          {requestingDeletion ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.primaryButtonText}>طلب حذف الحساب والبيانات</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.86} onPress={() => openSupportEmail()}>
          <Ionicons name="mail-outline" size={20} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>الدعم الفني: {supportEmail}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} activeOpacity={0.86} onPress={() => router.back()}>
          <Text style={styles.linkText}>رجوع</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 110 },
  heroCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing['2xl'], alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing.md, ...shadows.md },
  heroIcon: { width: 72, height: 72, borderRadius: 28, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  heroTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  heroSubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: spacing.sm, fontWeight: '700' },
  sectionCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  iconBox: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'right' },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'right', lineHeight: 24, fontWeight: '600' },
  primaryButton: { minHeight: 54, borderRadius: radii.lg, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, ...shadows.md },
  primaryButtonText: { color: colors.textInverse, fontSize: 15, fontWeight: '900' },
  secondaryButton: { minHeight: 54, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: spacing.sm, marginTop: spacing.md },
  secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  linkButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg },
  linkText: { color: colors.textSecondary, fontWeight: '900' },
  disabledButton: { opacity: 0.65 },
});
