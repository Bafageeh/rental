import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { apiPost } from '../lib/api';

export default function TenantMoreScreen() {
  const { user, logout } = useAuth();
  const [securityVisible, setSecurityVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  function resetPasswordForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  function openPasswordModal() {
    resetPasswordForm();
    setSecurityVisible(true);
  }

  function closePasswordModal() {
    if (saving) return;
    setSecurityVisible(false);
    resetPasswordForm();
  }

  async function savePassword() {
    if (!currentPassword.trim()) {
      Alert.alert('تنبيه', 'أدخل الرقم السري الحالي.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('تنبيه', 'الرقم السري الجديد يجب ألا يقل عن 6 خانات.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('تنبيه', 'تأكيد الرقم السري غير مطابق.');
      return;
    }

    try {
      setSaving(true);
      await apiPost('/auth/change-password', {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setSecurityVisible(false);
      resetPasswordForm();
      Alert.alert('تم', 'تم تغيير الرقم السري بنجاح.');
    } catch (e) {
      Alert.alert('تعذر تغيير الرقم السري', e instanceof Error ? e.message : 'حدث خطأ غير متوقع');
    } finally {
      setSaving(false);
    }
  }

  function confirmLogout() {
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: async () => { await logout(); router.replace('/login' as any); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}><Ionicons name="grid-outline" size={30} color={colors.primary} /></View>
          <Text style={styles.heroTitle}>مزيد</Text>
          <Text style={styles.heroSubtitle}>إعدادات حساب المستأجر والخروج من التطبيق.</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{String(user?.name || 'مستأجر').trim().slice(0, 1)}</Text></View>
          <View style={styles.profileText}>
            <Text numberOfLines={1} style={styles.profileName}>{user?.name || 'مستأجر'}</Text>
            <Text numberOfLines={1} style={styles.profileMeta}>{user?.phone || user?.national_id || user?.username || '-'}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.actionCard} activeOpacity={0.86} onPress={openPasswordModal}>
          <Ionicons name="chevron-back" size={20} color={colors.textTertiary} />
          <View style={styles.actionTextBox}><Text style={styles.actionTitle}>تغيير الرقم السري</Text><Text style={styles.actionSubtitle}>فتح شاشة عائمة لتغيير رقم الدخول.</Text></View>
          <View style={styles.actionIconBox}><Ionicons name="lock-closed-outline" size={24} color={colors.primary} /></View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionCard, styles.logoutCard]} activeOpacity={0.86} onPress={confirmLogout}>
          <Ionicons name="chevron-back" size={20} color="#B91C1C" />
          <View style={styles.actionTextBox}><Text style={[styles.actionTitle, styles.logoutText]}>خروج</Text><Text style={styles.actionSubtitle}>إنهاء الجلسة والعودة لتسجيل الدخول.</Text></View>
          <View style={[styles.actionIconBox, styles.logoutIconBox]}><Ionicons name="log-out-outline" size={24} color="#B91C1C" /></View>
        </TouchableOpacity>
      </View>

      <Modal visible={securityVisible} transparent animationType="fade" onRequestClose={closePasswordModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={closePasswordModal} />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.closeButton} onPress={closePasswordModal} disabled={saving}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.modalTitleBox}>
                <Text style={styles.modalTitle}>تغيير الرقم السري</Text>
                <Text style={styles.modalSubtitle}>أدخل الرقم الحالي ثم الرقم الجديد.</Text>
              </View>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalForm}>
              <Text style={styles.inputLabel}>الرقم السري الحالي</Text>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                style={styles.input}
                secureTextEntry
                textAlign="right"
                placeholder="اكتب الرقم الحالي"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.inputLabel}>الرقم السري الجديد</Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                style={styles.input}
                secureTextEntry
                textAlign="right"
                placeholder="لا يقل عن 6 خانات"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.inputLabel}>تأكيد الرقم السري الجديد</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                style={styles.input}
                secureTextEntry
                textAlign="right"
                placeholder="أعد كتابة الرقم الجديد"
                placeholderTextColor={colors.textTertiary}
              />

              <TouchableOpacity style={[styles.saveButton, saving ? styles.disabledButton : null]} activeOpacity={0.86} onPress={savePassword} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>حفظ الرقم السري</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg, paddingBottom: 110 },
  heroCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, alignItems: 'flex-end', borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing.md },
  heroIcon: { width: 62, height: 62, borderRadius: 22, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  heroTitle: { ...typography.h2, color: colors.text, textAlign: 'right' },
  heroSubtitle: { color: colors.textSecondary, textAlign: 'right', marginTop: spacing.xs, lineHeight: 22, fontWeight: '700' },
  profileCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.textInverse, fontSize: 22, fontWeight: '900' },
  profileText: { flex: 1, alignItems: 'flex-end' },
  profileName: { color: colors.text, fontWeight: '900', fontSize: 17, textAlign: 'right' },
  profileMeta: { color: colors.textSecondary, fontWeight: '800', marginTop: 3, textAlign: 'right' },
  actionCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  logoutCard: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  actionIconBox: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  logoutIconBox: { backgroundColor: '#FEE2E2' },
  actionTextBox: { flex: 1, alignItems: 'flex-end' },
  actionTitle: { color: colors.text, fontWeight: '900', fontSize: 16, textAlign: 'right' },
  logoutText: { color: '#B91C1C' },
  actionSubtitle: { color: colors.textSecondary, fontWeight: '700', marginTop: 4, textAlign: 'right', lineHeight: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalDismissArea: { flex: 1 },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: spacing.lg, maxHeight: '78%' },
  sheetHandle: { alignSelf: 'center', width: 48, height: 5, borderRadius: 999, backgroundColor: colors.borderLight, marginBottom: spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  modalTitleBox: { flex: 1, alignItems: 'flex-end' },
  modalTitle: { color: colors.text, fontSize: 21, fontWeight: '900', textAlign: 'right' },
  modalSubtitle: { color: colors.textSecondary, marginTop: 4, textAlign: 'right', fontWeight: '700' },
  modalForm: { paddingBottom: spacing.md },
  inputLabel: { color: colors.textSecondary, fontWeight: '900', textAlign: 'right', marginBottom: 6, marginTop: spacing.xs },
  input: { minHeight: 52, borderRadius: 16, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.borderLight, color: colors.text, paddingHorizontal: spacing.md, marginBottom: spacing.sm, textAlign: 'right' },
  saveButton: { minHeight: 52, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  saveButtonText: { color: colors.textInverse, fontWeight: '900', fontSize: 15 },
  disabledButton: { opacity: 0.65 },
});
