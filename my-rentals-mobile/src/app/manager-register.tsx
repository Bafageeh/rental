import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiPost } from '../lib/api';
import { colors, radii, shadows, spacing, typography } from '../constants/theme';

type Step = 'phone' | 'otp' | 'password';

export default function ManagerRegisterScreen() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      Alert.alert('تنبيه', 'أدخل رقم الجوال.');
      return;
    }

    try {
      setLoading(true);
      const result = await apiPost('/auth/manager/register/request', {
        phone: cleanPhone,
        name: name.trim() || undefined,
      });
      setStep('otp');
      Alert.alert('تم الإرسال', result?.data?.phone_masked ? `تم إرسال رمز التحقق إلى ${result.data.phone_masked}` : 'تم إرسال رمز التحقق عبر واتساب.');
    } catch (e) {
      Alert.alert('تعذر الإرسال', e instanceof Error ? e.message : 'حدث خطأ أثناء إرسال الرمز.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!otp.trim()) {
      Alert.alert('تنبيه', 'أدخل رمز التحقق.');
      return;
    }

    try {
      setLoading(true);
      const result = await apiPost('/auth/manager/register/verify', {
        phone: phone.trim(),
        otp: otp.trim(),
      });
      const token = result?.data?.reset_token;
      if (!token) throw new Error('لم يتم استلام صلاحية إنشاء كلمة السر.');
      setResetToken(token);
      setStep('password');
    } catch (e) {
      Alert.alert('رمز غير صحيح', e instanceof Error ? e.message : 'تعذر التحقق من الرمز.');
    } finally {
      setLoading(false);
    }
  }

  async function completeRegister() {
    if (password.length < 6) {
      Alert.alert('تنبيه', 'الرقم السري يجب أن يكون 6 أحرف أو أرقام على الأقل.');
      return;
    }
    if (password !== password2) {
      Alert.alert('تنبيه', 'تأكيد الرقم السري غير مطابق.');
      return;
    }

    try {
      setLoading(true);
      await apiPost('/auth/manager/register/complete', {
        phone: phone.trim(),
        name: name.trim() || undefined,
        reset_token: resetToken,
        password,
        password_confirmation: password2,
      });
      Alert.alert('تم', 'تم إنشاء حساب مدير العقارات. سجل الدخول الآن برقم الجوال والرقم السري.', [
        { text: 'تسجيل الدخول', onPress: () => router.replace('/login' as any) },
      ]);
    } catch (e) {
      Alert.alert('تعذر إنشاء الحساب', e instanceof Error ? e.message : 'حدث خطأ أثناء إنشاء الحساب.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.title}>إنشاء حساب مدير عقارات</Text>
            <Text style={styles.subtitle}>هذا الخيار مخصص لمدير العقارات الجديد. سيتم التحقق من رقم الجوال عبر رمز واتساب ثم تعيين رقم سري للدخول مستقبلًا.</Text>

            {step === 'phone' ? (
              <>
                <Text style={styles.label}>الاسم</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="اسم مدير العقارات" placeholderTextColor={colors.textTertiary} textAlign="right" editable={!loading} />

                <Text style={styles.label}>رقم الجوال</Text>
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="05xxxxxxxx" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" textAlign="right" editable={!loading} />

                <TouchableOpacity style={styles.btn} onPress={requestOtp} disabled={loading} activeOpacity={0.85}>
                  {loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.btnText}>إرسال رمز واتساب</Text>}
                </TouchableOpacity>
              </>
            ) : step === 'otp' ? (
              <>
                <Text style={styles.help}>أدخل رمز التحقق المرسل إلى رقم الجوال.</Text>
                <TextInput style={[styles.input, styles.code]} value={otp} onChangeText={setOtp} placeholder="123456" placeholderTextColor={colors.textTertiary} keyboardType="number-pad" textAlign="center" maxLength={8} editable={!loading} />

                <TouchableOpacity style={styles.btn} onPress={verifyOtp} disabled={loading} activeOpacity={0.85}>
                  {loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.btnText}>تحقق</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={requestOtp} disabled={loading} activeOpacity={0.85}>
                  <Text style={styles.secondaryText}>إعادة إرسال الرمز</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>الرقم السري</Text>
                <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="رقم سري جديد" placeholderTextColor={colors.textTertiary} secureTextEntry textAlign="right" editable={!loading} />
                <Text style={styles.label}>تأكيد الرقم السري</Text>
                <TextInput style={styles.input} value={password2} onChangeText={setPassword2} placeholder="تأكيد الرقم السري" placeholderTextColor={colors.textTertiary} secureTextEntry textAlign="right" editable={!loading} />

                <TouchableOpacity style={styles.btn} onPress={completeRegister} disabled={loading} activeOpacity={0.85}>
                  {loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.btnText}>إنشاء الحساب</Text>}
                </TouchableOpacity>
              </>
            )}

            <View style={styles.tenantNote}>
              <Text style={styles.tenantNoteText}>تنبيه: المستأجر لا يحتاج إلى إنشاء حساب. يدخل مباشرة من شاشة تسجيل الدخول برقم الهوية أو رقم الجوال.</Text>
            </View>

            <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace('/login' as any)} disabled={loading} activeOpacity={0.85}>
              <Text style={styles.linkText}>العودة لتسجيل الدخول</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing['2xl'] },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing['2xl'], borderWidth: 1, borderColor: colors.borderLight, ...shadows.md },
  title: { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg },
  label: { ...typography.captionBold, color: colors.textSecondary, textAlign: 'right', marginBottom: 6, marginTop: spacing.xs },
  help: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.md },
  input: { height: 48, backgroundColor: colors.background, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md + 2, fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  code: { fontSize: 22, fontWeight: '900' },
  btn: { height: 50, backgroundColor: colors.primary, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, ...shadows.md, shadowColor: colors.primary, shadowOpacity: 0.25 },
  btnText: { fontSize: 16, fontWeight: '800', color: colors.textInverse },
  secondaryBtn: { height: 46, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, backgroundColor: colors.background },
  secondaryText: { fontSize: 15, fontWeight: '800', color: colors.textSecondary },
  tenantNote: { backgroundColor: colors.primaryLight, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.borderLight },
  tenantNoteText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, fontWeight: '700' },
  linkBtn: { alignItems: 'center', marginTop: spacing.lg },
  linkText: { color: colors.primary, fontWeight: '900' },
});
