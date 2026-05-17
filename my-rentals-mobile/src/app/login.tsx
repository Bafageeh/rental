import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet, apiPost } from '../lib/api';
import {
  enableBiometricLogin,
  saveAuthSession,
  shouldRequireBiometricUnlock,
  unlockSavedSessionWithBiometrics,
} from '../lib/auth';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radii, shadows, typography } from '../constants/theme';

export default function LoginScreen() {
  const { refresh, locked } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showManualLogin, setShowManualLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    let active = true;

    async function runBiometricUnlock() {
      const requiresUnlock = await shouldRequireBiometricUnlock();
      if (!active || !requiresUnlock) return;

      setBiometricLoading(true);
      const ok = await unlockSavedSessionWithBiometrics();
      if (!active) return;
      setBiometricLoading(false);

      if (ok) {
        await refresh();
        router.replace('/' as any);
      } else {
        setShowManualLogin(true);
      }
    }

    void runBiometricUnlock();

    return () => {
      active = false;
    };
  }, [refresh]);

  function validate(): boolean {
    let valid = true;
    setUsernameError('');
    setPasswordError('');

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setUsernameError('رقم الهوية مطلوب');
      valid = false;
    }

    if (!password) {
      setPasswordError('الرقم السري مطلوب');
      valid = false;
    } else if (password.length < 4) {
      setPasswordError('الرقم السري قصير جداً');
      valid = false;
    }

    return valid;
  }

  async function login() {
    if (!validate()) return;

    try {
      setLoading(true);
      const result = await apiPost('/auth/login', {
        username: username.trim(),
        password,
      });
      const token = result?.data?.token ?? result?.token;
      const user = result?.data?.user ?? result?.user;

      if (!token) throw new Error('لم يتم استلام token من الخادم');

      await saveAuthSession(token, user);

      const verified = await apiGet('/auth/me');
      const verifiedUser = verified?.data ?? verified?.user ?? user;
      await saveAuthSession(token, verifiedUser);
      await enableBiometricLogin();
      await refresh();

      router.replace('/' as any);
    } catch (e) {
      Alert.alert('خطأ في الدخول', e instanceof Error ? e.message : 'رقم الهوية أو الرقم السري غير صحيح');
    } finally {
      setLoading(false);
    }
  }

  const biometricGate = locked && !showManualLogin;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.logoWrap}>
            <View style={styles.logoCircle}>
              <Text style={{ fontSize: 40 }}>🏢</Text>
            </View>
            <Text style={styles.appName}>إيجاراتي</Text>
            <Text style={styles.appSub}>نظام إدارة العقارات والإيجارات</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.formTitle}>تسجيل الدخول</Text>

            {biometricGate ? (
              <>
                <View style={styles.biometricIconWrap}>
                  <Text style={styles.biometricIcon}>🔐</Text>
                </View>
                <Text style={styles.biometricTitle}>الدخول الآمن مفعل</Text>
                <Text style={styles.biometricText}>استخدم البصمة أو بصمة الوجه للدخول مباشرة دون إدخال بيانات الدخول مرة أخرى.</Text>
                <TouchableOpacity style={[styles.btn, biometricLoading && { opacity: 0.7 }]} onPress={async () => {
                  try {
                    setBiometricLoading(true);
                    const ok = await unlockSavedSessionWithBiometrics();
                    if (ok) {
                      await refresh();
                      router.replace('/' as any);
                    } else {
                      setShowManualLogin(true);
                    }
                  } finally {
                    setBiometricLoading(false);
                  }
                }} disabled={biometricLoading} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="الدخول بالبصمة" accessibilityState={{ busy: biometricLoading }}>
                  {biometricLoading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.btnText}>الدخول بالبصمة</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowManualLogin(true)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="الدخول برقم الهوية">
                  <Text style={styles.secondaryBtnText}>الدخول برقم الهوية</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>رقم الهوية</Text>
                <TextInput
                  style={[styles.input, usernameError && styles.inputError]}
                  value={username}
                  onChangeText={(t) => {
                    setUsername(t);
                    if (usernameError) setUsernameError('');
                  }}
                  placeholder="مثال: 1002803441"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textAlign="right"
                  editable={!loading}
                  accessibilityLabel="رقم الهوية"
                />
                {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}

                <Text style={styles.label}>الرقم السري</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, passwordError && styles.inputError]}
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (passwordError) setPasswordError('');
                    }}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showPassword}
                    textAlign="right"
                    editable={!loading}
                    autoComplete="password"
                    accessibilityLabel="الرقم السري"
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={showPassword ? 'إخفاء الرقم السري' : 'إظهار الرقم السري'}>
                    <Text style={{ fontSize: 18 }}>{showPassword ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>
                {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

                <TouchableOpacity style={[styles.btn, loading && { opacity: 0.7 }]} onPress={login} disabled={loading} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="تسجيل الدخول" accessibilityState={{ busy: loading }}>
                  {loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.btnText}>دخول</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing['2xl'] },
  logoWrap: { alignItems: 'center', marginBottom: spacing['3xl'] },
  logoCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md + 2, ...shadows.md, shadowColor: colors.primary, shadowOpacity: 0.15 },
  appName: { fontSize: 26, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  appSub: { ...typography.caption, color: colors.textSecondary },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing['2xl'], borderWidth: 1, borderColor: colors.borderLight, ...shadows.md },
  formTitle: { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: spacing.xl },
  label: { ...typography.captionBold, color: colors.textSecondary, textAlign: 'right', marginBottom: 6, marginTop: spacing.xs },
  input: { height: 48, backgroundColor: colors.background, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md + 2, fontSize: 15, color: colors.text, marginBottom: 6 },
  inputError: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  errorText: { ...typography.small, color: colors.danger, textAlign: 'right', marginBottom: spacing.sm },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingLeft: 44 },
  eyeBtn: { position: 'absolute', left: 12, top: 12, height: 24, width: 24, alignItems: 'center', justifyContent: 'center' },
  btn: { height: 50, backgroundColor: colors.primary, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, ...shadows.md, shadowColor: colors.primary, shadowOpacity: 0.3 },
  btnText: { fontSize: 16, fontWeight: '700', color: colors.textInverse },
  biometricIconWrap: { width: 72, height: 72, borderRadius: 36, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight, marginBottom: spacing.md },
  biometricIcon: { fontSize: 34 },
  biometricTitle: { ...typography.bodyBold, color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
  biometricText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.md },
  secondaryBtn: { height: 46, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, backgroundColor: colors.background },
  secondaryBtnText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
});
