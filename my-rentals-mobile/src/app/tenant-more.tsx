import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import ProfileSecurityScreen from './profile-security';

export default function TenantMoreScreen() {
  const { user, logout } = useAuth();
  const [securityVisible, setSecurityVisible] = useState(false);

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

        <TouchableOpacity style={styles.actionCard} activeOpacity={0.86} onPress={() => setSecurityVisible(true)}>
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

      <Modal visible={securityVisible} transparent animationType="slide" onRequestClose={() => setSecurityVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSecurityVisible(false)}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <ProfileSecurityScreen />
          </View>
        </View>
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxHeight: '82%', backgroundColor: colors.surface, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderLight },
  closeButton: { position: 'absolute', left: spacing.md, top: spacing.md, width: 42, height: 42, borderRadius: 21, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
});
