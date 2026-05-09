import { router } from 'expo-router';
import { useState } from 'react';
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
import { saveAuthSession } from '../lib/auth';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radii, shadows, typography } from '../constants/theme';

export default function LoginScreen() {
  const { refresh } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  function validate(): boolean {
    let valid = true;
    setUsernameError('');
    setPasswordError('');

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setUsernameError('اسم المستخدم مطلوب');
      valid = false;
    } else if (trimmedUsername.includes('@')) {
      setUsernameError('استخدم اسم المستخدم فقط وليس البريد الإلكتروني');
      valid = false;
    }

    if (!password) {
      setPasswordError('كلمة المرور مطلوبة');
      valid = false;
    } else if (password.length < 4) {
      setPasswordError('كلمة المرور قصيرة جداً');
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

      // تحقق مباشر أن الخادم قبل الجلسة؛ إذا كانت Authorization لا تصل سيتم كشف المشكلة هنا.
      const verified = await apiGet('/auth/me');
      const verifiedUser = verified?.data ?? verified?.user ?? user;
      await saveAuthSession(token, verifiedUser);
      await refresh();

      router.replace('/' as any);
    } catch (e) {
      Alert.alert('خطأ في الدخول', e instanceof Error ? e.message : 'اسم المستخدم أو كلمة المرور غير صحيحة');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoCircle}>
              <Text style={{ fontSize: 40 }}>🏢</Text>
            </View>
            <Text style={styles.appName}>إيجاراتي</Text>
            <Text style={styles.appSub}>نظام إدارة العقارات والإيجارات</Text>
          </View>

          {/* Form */}
          <View style={styles.card}>
            <Text style={styles.formTitle}>تسجيل الدخول</Text>

            <Text style={styles.label}>اسم المستخدم</Text>
            <TextInput
              style={[styles.input, usernameError && styles.inputError]}
              value={username}
              onChangeText={(t) => {
                setUsername(t);
                if (usernameError) setUsernameError('');
              }}
              placeholder="مثال: admin"
              placeholderTextColor={colors.textTertiary}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textAlign="right"
              editable={!loading}
              accessibilityLabel="اسم المستخدم"
            />
            {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}

            <Text style={styles.label}>كلمة المرور</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  passwordError && styles.inputError,
                ]}
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
                accessibilityLabel="كلمة المرور"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                <Text style={{ fontSize: 18 }}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.7 }]}
              onPress={login}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="تسجيل الدخول"
              accessibilityState={{ busy: loading }}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.btnText}>دخول</Text>
              )}
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

  logoWrap: { alignItems: 'center', marginBottom: spacing['3xl'] },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md + 2,
    ...shadows.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
  },
  appName: { fontSize: 26, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  appSub: { ...typography.caption, color: colors.textSecondary },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.md,
  },
  formTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },

  label: {
    ...typography.captionBold,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: 6,
    marginTop: spacing.xs,
  },
  input: {
    height: 48,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md + 2,
    fontSize: 15,
    color: colors.text,
    marginBottom: 6,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  errorText: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },

  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingLeft: 44 },
  eyeBtn: {
    position: 'absolute',
    left: 12,
    top: 12,
    height: 24,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btn: {
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    ...shadows.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: colors.textInverse },

});
