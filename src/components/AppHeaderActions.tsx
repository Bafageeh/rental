import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { apiPost } from "../lib/api";
import { resetNavigationHistory, smartBack } from "../lib/navigationHistory";

const mainRoutes = ["/", "/properties", "/payments", "/statistics", "/more", "/login"];

export function HeaderBackAction() {
  const { loggedIn } = useAuth();
  const pathname = usePathname();
  const showBack = loggedIn && !mainRoutes.includes(pathname);

  if (!showBack) return null;

  return (
    <TouchableOpacity
      style={styles.headerActionButton}
      onPress={() => smartBack()}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="رجوع"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="arrow-forward-outline" size={22} color={colors.text} />
    </TouchableOpacity>
  );
}

export function HeaderQuickActions() {
  const { loggedIn, logout } = useAuth();

  function performLogout() {
    apiPost("/auth/logout")
      .catch(() => undefined)
      .then(() => logout())
      .catch(() => undefined)
      .then(() => {
        resetNavigationHistory();
        router.replace("/login" as any);
      });
  }

  function confirmLogout() {
    Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج من التطبيق؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "خروج", style: "destructive", onPress: performLogout },
    ]);
  }

  if (!loggedIn) return null;

  return (
    <View style={styles.headerActionsLeft}>
      <TouchableOpacity
        style={[styles.headerActionButton, styles.logoutHeaderButton]}
        onPress={confirmLogout}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="تسجيل الخروج"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutHeaderText}>خروج</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.headerActionButton}
        onPress={() => router.push("/alerts" as any)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="التنبيهات"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="notifications-outline" size={22} color={colors.text} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.headerActionButton}
        onPress={() => router.push("/search" as any)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="البحث"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="search-outline" size={22} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActionsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActionButton: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 8,
  },
  logoutHeaderButton: {
    flexDirection: "row-reverse",
    gap: 4,
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
  },
  logoutHeaderText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "800",
  },
});
