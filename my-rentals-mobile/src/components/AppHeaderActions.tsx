import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { smartBack } from "../lib/navigationHistory";

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
  const { loggedIn } = useAuth();

  if (!loggedIn) return null;

  return (
    <View style={styles.headerActionsLeft}>
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
});
