import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { smartBack } from "../lib/navigationHistory";

const mainRoutes = ["/", "/properties", "/payments", "/statistics", "/more", "/login"];

const screenCodes: Record<string, string> = {
  "/": "S-001",
  "/properties": "S-002",
  "/owners": "S-003",
  "/more": "S-004",
  "/inquiry-center": "S-005",
  "/scheduled-messages": "S-006",
  "/profile": "S-007",
  "/profile-security": "S-008",
  "/profile-properties": "S-009",
  "/property/:id": "S-010",
  "/unit/:id": "S-011",
  "/owner/:id": "S-012",
  "/tenant/:id": "S-013",
  "/contract/:id": "S-014",
  "/payment/:id": "S-015",
  "/contracts": "S-016",
  "/tenants": "S-017",
  "/units": "S-018",
  "/payments": "S-019",
  "/expenses": "S-020",
  "/parking": "S-021",
  "/settings": "S-022",
  "/reports": "S-023",
  "/files": "S-025",
  "/alerts": "S-026",
  "/reminders": "S-027",
  "/follow-ups": "S-028",
  "/create-contract": "S-029",
  "/upload-contract": "S-030",
  "/property-form": "S-031",
  "/upload-property-deed": "S-032",
  "/edit-delete-center": "S-033",
  "/record-details": "S-034",
};

function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/index") return "/";
  return pathname
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    .replace(/\/[^/]*-[0-9a-f]{6,}(?=\/|$)/gi, "/:id");
}

function fallbackScreenCode(pathname: string) {
  const normalized = normalizePathname(pathname);
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) % 900;
  }
  return `S-${String(hash + 100).padStart(3, "0")}`;
}

function useScreenCode() {
  const pathname = usePathname();
  const normalized = normalizePathname(pathname);
  return screenCodes[normalized] || fallbackScreenCode(normalized);
}

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
  const screenCode = useScreenCode();

  if (!loggedIn) return null;

  return (
    <View style={styles.headerActionsLeft}>
      <View style={styles.screenCodeBadge} pointerEvents="none">
        <Text style={styles.screenCodeText}>#{screenCode}</Text>
      </View>
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
  screenCodeBadge: {
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  screenCodeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
});
