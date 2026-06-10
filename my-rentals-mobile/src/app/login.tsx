import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet, apiPost } from '../lib/api';
import { enableBiometricLogin, saveAuthSession } from '../lib/auth';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radii, shadows, typography } from '../constants/theme';

export default function LoginScreen() {
  const { refresh } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function scrollToInput(y = 260) {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    }, 120);
  }

  function goToOtp() {
    router.push({ pathname: '/password-otp' as any, params: { identifier: username.trim() } });
  }

  function goToManagerRegister() {
    router.push('/manager-register' as any);
  }

  async function login() {
    const name = username.trim();
    if (!name) {
      Alert.alert('تنبيه', 'اسم المستخدم مطلوب');
      return;
    }
    if (!password) {
      Alert.alert('تنبيه', 'الرقم السري مطلوب أو اضغط نسيت كلمة السر / أول دخول');
      return;
    }

    try {
      setLoading(true);
      const result = await apiPost('/auth/login', { username: name, password });
      const token = result?.data?.token ?? result?.token;
      const user = result?.data?.user ?? result?.user;
      if (!token) throw new Error('لم يتم استلام token من الخادم');

      await saveAuthSession(token, user);
      const verified = await apiGet('/auth/me');
      const verifiedUser = verified?.data ?? verified?.user ?? user;
      await saveAuthSession(token, verifiedUser);
      await enableBiometricLogin();
      await refresh();

      const role = String(verifiedUser?.role ?? user?.role ?? '').toLowerCase();
      router.replace(role === 'tenant' || verifiedUser?.is_tenant ? '/tenant-payments' as any : '/' as any);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'اسم المستخدم أو الرقم السري غير صحيح';
      if (message.includes('لا توجد كلمة سر')) {
        Alert.alert('أول دخول', 'هذا الحساب لا يملك كلمة سر. أرسل رمز واتساب لتعيين كلمة السر.', [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'إرسال الرمز', onPress: goToOtp },
        ]);
      } else {
        Alert.alert('خطأ في الدخول', message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <View style={styles.logoCircle}><Text style={{ fontSize: 40 }}>🏢</Text></View>
            <Text style={styles.appName}>إيجاراتي</Text>
            <Text style={styles.appSub}>نظام إدارة العقارات والإيجارات</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.formTitle}>تسجيل الدخول</Text>

            <View style={styles.tenantHint}>
              <Text style={styles.tenantHintText}>المستأجر يدخل مباشرة برقم الهوية أو رقم الجوال، ولا يحتاج إلى إنشاء حساب جديد.</Text>
            </View>

            <Text style={styles.label}>اسم المستخدم</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              onFocus={() => scrollToInput(230)}
              placeholder="رقم الهوية أو رقم الجوال أو اسم المستخدم"
              placeholderTextColor={colors.textTertiary}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textAlign="right"
              editable={!loading}
              returnKeyType="next"
            />

            <Text style={styles.label}>الرقم السري</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                onFocus={() => scrollToInput(300)}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry={!showPassword}
                textAlign="right"
                editable={!loading}
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={login}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 18 }}>{showPassword ? 'إخفاء' : 'إظهار'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.btn, loading && { opacity: 0.7 }]} onPress={login} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.btnText}>دخول</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={goToOtp} disabled={loading} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>نسيت كلمة السر / أول دخول</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.managerBtn} onPress={goToManagerRegister} disabled={loading} activeOpacity={0.85}>
              <Text style={styles.managerBtnText}>إنشاء مستخدم جديد كمدير عقارات</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'flex-start', paddingHorizontal: spacing['2xl'], paddingTop: spacing['2xl'], paddingBottom: 420 },
  logoWrap: { alignItems: 'center', marginBottom: spacing.xl, paddingTop: spacing.lg },
  logoCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md + 2, ...shadows.md, shadowColor: colors.primary, shadowOpacity: 0.15 },
  appName: { fontSize: 26, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  appSub: { ...typography.caption, color: colors.textSecondary },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing['2xl'], borderWidth: 1, borderColor: colors.borderLight, ...shadows.md },
  formTitle: { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  tenantHint: { backgroundColor: colors.primaryLight, borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, marginBottom: spacing.md },
  tenantHintText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, fontWeight: '700' },
  label: { ...typography.captionBold, color: colors.textSecondary, textAlign: 'right', marginBottom: 6, marginTop: spacing.xs },
  input: { height: 48, backgroundColor: colors.background, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md + 2, fontSize: 15, color: colors.text, marginBottom: 6 },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingLeft: 64 },
  eyeBtn: { position: 'absolute', left: 12, top: 12, height: 24, alignItems: 'center', justifyContent: 'center' },
  btn: { height: 50, backgroundColor: colors.primary, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, ...shadows.md, shadowColor: colors.primary, shadowOpacity: 0.3 },
  btnText: { fontSize: 16, fontWeight: '700', color: colors.textInverse },
  secondaryBtn: { height: 46, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, backgroundColor: colors.background },
  secondaryBtnText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  managerBtn: { height: 46, borderRadius: radii.md, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, backgroundColor: colors.surface },
  managerBtnText: { fontSize: 15, fontWeight: '800', color: colors.primary },
});
