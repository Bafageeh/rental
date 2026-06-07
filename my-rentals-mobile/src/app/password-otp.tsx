import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiPost } from '../lib/api';
import { colors, radii, shadows, spacing, typography } from '../constants/theme';

type Step = 'request' | 'verify' | 'reset';

export default function PasswordOtpScreen() {
  const params = useLocalSearchParams();
  const [identifier, setIdentifier] = useState(String(params.identifier || ''));
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [step, setStep] = useState<Step>('request');
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    const id = identifier.trim();
    if (!id) {
      Alert.alert('تنبيه', 'أدخل رقم الهوية أو رقم الجوال.');
      return;
    }
    try {
      setLoading(true);
      const r = await apiPost('/auth/password/otp/request', { identifier: id, purpose: 'password_reset' });
      setStep('verify');
      Alert.alert('تم الإرسال', r?.data?.phone_masked ? `تم إرسال رمز التحقق إلى ${r.data.phone_masked}` : 'تم إرسال رمز التحقق عبر واتساب');
    } catch (e) {
      Alert.alert('تعذر الإرسال', e instanceof Error ? e.message : 'حدث خطأ أثناء إرسال الرمز');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    try {
      setLoading(true);
      const r = await apiPost('/auth/password/otp/verify', { identifier: identifier.trim(), otp: code.trim() });
      const t = r?.data?.reset_token;
      if (!t) throw new Error('لم يتم استلام صلاحية تغيير كلمة السر');
      setResetToken(t);
      setStep('reset');
    } catch (e) {
      Alert.alert('رمز غير صحيح', e instanceof Error ? e.message : 'تعذر التحقق من الرمز');
    } finally {
      setLoading(false);
    }
  }

  async function savePassword() {
    if (newPass.length < 6) {
      Alert.alert('تنبيه', 'كلمة السر يجب أن تكون 6 أحرف/أرقام على الأقل.');
      return;
    }
    if (newPass !== newPass2) {
      Alert.alert('تنبيه', 'تأكيد كلمة السر غير مطابق.');
      return;
    }
    try {
      setLoading(true);
      await apiPost('/auth/password/reset', { reset_token: resetToken, password: newPass, password_confirmation: newPass2 });
      Alert.alert('تم', 'تم تعيين كلمة السر الجديدة. سجل الدخول الآن.');
      router.replace('/login' as any);
    } catch (e) {
      Alert.alert('تعذر الحفظ', e instanceof Error ? e.message : 'حدث خطأ أثناء حفظ كلمة السر');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>{step === 'request' ? 'نسيت كلمة السر / أول دخول' : step === 'verify' ? 'رمز التحقق' : 'كلمة سر جديدة'}</Text>

            {step === 'request' ? (
              <>
                <Text style={styles.label}>رقم الهوية أو رقم الجوال</Text>
                <TextInput style={styles.input} value={identifier} onChangeText={setIdentifier} placeholder="رقم الهوية أو الجوال" placeholderTextColor={colors.textTertiary} textAlign="right" />
                <TouchableOpacity style={styles.btn} onPress={sendCode} disabled={loading}>{loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.btnText}>إرسال رمز واتساب</Text>}</TouchableOpacity>
              </>
            ) : step === 'verify' ? (
              <>
                <Text style={styles.help}>أدخل رمز التحقق المرسل عبر واتساب.</Text>
                <TextInput style={[styles.input, styles.code]} value={code} onChangeText={setCode} placeholder="123456" placeholderTextColor={colors.textTertiary} keyboardType="number-pad" textAlign="center" maxLength={8} />
                <TouchableOpacity style={styles.btn} onPress={verifyCode} disabled={loading}>{loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.btnText}>تحقق</Text>}</TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={sendCode} disabled={loading}><Text style={styles.secondaryText}>إعادة إرسال الرمز</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>كلمة السر الجديدة</Text>
                <TextInput style={styles.input} value={newPass} onChangeText={setNewPass} placeholder="كلمة السر الجديدة" placeholderTextColor={colors.textTertiary} secureTextEntry textAlign="right" />
                <Text style={styles.label}>تأكيد كلمة السر</Text>
                <TextInput style={styles.input} value={newPass2} onChangeText={setNewPass2} placeholder="تأكيد كلمة السر" placeholderTextColor={colors.textTertiary} secureTextEntry textAlign="right" />
                <TouchableOpacity style={styles.btn} onPress={savePassword} disabled={loading}>{loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.btnText}>حفظ كلمة السر</Text>}</TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace('/login' as any)} disabled={loading}><Text style={styles.linkText}>العودة لتسجيل الدخول</Text></TouchableOpacity>
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
  title: { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: spacing.xl },
  label: { ...typography.captionBold, color: colors.textSecondary, textAlign: 'right', marginBottom: 6 },
  help: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.md },
  input: { height: 48, backgroundColor: colors.background, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md + 2, fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  code: { fontSize: 22, fontWeight: '900' },
  btn: { height: 50, backgroundColor: colors.primary, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  btnText: { fontSize: 16, fontWeight: '800', color: colors.textInverse },
  secondaryBtn: { height: 46, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, backgroundColor: colors.background },
  secondaryText: { fontSize: 15, fontWeight: '800', color: colors.textSecondary },
  linkBtn: { alignItems: 'center', marginTop: spacing.lg },
  linkText: { color: colors.primary, fontWeight: '900' },
});
