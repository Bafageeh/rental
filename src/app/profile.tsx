import { router } from "expo-router";
import { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, typography } from "../constants/theme";

function valueOrDash(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function roleText(role?: string | null, isAdmin?: boolean) {
  if (isAdmin) return "مدير";
  if (role === "owner") return "مالك";
  if (role === "manager") return "مدير تشغيل";
  if (role === "super_admin") return "مدير عام";
  return role || "مستخدم";
}

function ProfileButton({ icon, title, subtitle, onPress }: { icon: string; title: string; subtitle: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionButton} activeOpacity={0.88} onPress={onPress}>
      <View style={styles.actionIconBox}>
        <Text style={styles.actionIcon}>{icon}</Text>
      </View>
      <View style={styles.actionTextWrap}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.actionArrow}>‹</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const auth = useAuth();
  const displayUser = auth.user;

  const initials = useMemo(() => {
    const name = String(displayUser?.name || displayUser?.email || "م").trim();
    return name.slice(0, 1).toUpperCase();
  }, [displayUser?.name, displayUser?.email]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>{displayUser?.name || "بروفايل الحساب"}</Text>
            <Text style={styles.heroSubtitle}>{valueOrDash(displayUser?.email)}</Text>
            <Text style={styles.roleBadge}>{roleText(displayUser?.role, Boolean(displayUser?.is_admin))}</Text>
          </View>
        </View>

        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>خيارات الحساب</Text>
          <Text style={styles.sectionSubtitle}>اضغط على الزر للدخول إلى الشاشة الخاصة به.</Text>

          <ProfileButton
            icon="🔐"
            title="تغيير الرقم السري"
            subtitle="تحديث الرقم السري للحساب الحالي"
            onPress={() => router.push("/profile-change-password" as any)}
          />

          <ProfileButton
            icon="🏢"
            title="عقاراتي"
            subtitle="عرض العقارات المرتبطة بهذا الحساب"
            onPress={() => router.push("/profile-properties" as any)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 110 },
  heroCard: {
    backgroundColor: "#111827",
    borderRadius: 26,
    padding: spacing.lg,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#065F46", fontSize: 30, fontWeight: "900" },
  heroTextWrap: { flex: 1, alignItems: "flex-end" },
  heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", textAlign: "right" },
  heroSubtitle: { color: "rgba(255,255,255,0.75)", marginTop: 5, fontWeight: "800", textAlign: "right" },
  roleBadge: {
    marginTop: 10,
    color: "#064E3B",
    backgroundColor: "#D1FAE5",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 5,
    fontWeight: "900",
  },
  actionsCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sectionTitle: { ...typography.bodyBold, color: colors.text, fontSize: 21, textAlign: "right" },
  sectionSubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: "right", marginTop: 5, marginBottom: spacing.md, lineHeight: 20 },
  actionButton: {
    minHeight: 82,
    borderRadius: 20,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  actionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIcon: { fontSize: 25 },
  actionTextWrap: { flex: 1, alignItems: "flex-end" },
  actionTitle: { color: colors.text, fontSize: 18, fontWeight: "900", textAlign: "right" },
  actionSubtitle: { color: colors.textSecondary, fontWeight: "800", textAlign: "right", marginTop: 5, lineHeight: 20 },
  actionArrow: { color: colors.textTertiary, fontSize: 28, fontWeight: "900" },
});
