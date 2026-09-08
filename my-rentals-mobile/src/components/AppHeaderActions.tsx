import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, usePathname } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { apiGet } from "../lib/api";
import { smartBack } from "../lib/navigationHistory";

const mainRoutes = ["/", "/properties", "/payments", "/statistics", "/more", "/login", "/tenant-payments", "/chat-threads"];

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
  "/property/:id": "S-011",
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
  "/tenant-payments": "S-035",
  "/chat-threads": "S-036",
  "/chat-thread": "S-037",
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

function firstParam(value: unknown) {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : "";
  return value === undefined || value === null ? "" : String(value);
}

function expensesBackTarget(params: Record<string, unknown>) {
  const propertyId = firstParam(params.property_id).trim();
  if (propertyId) return `/property/${propertyId}`;
  return "/properties";
}

function isOwnerDetailsPath(pathname: string) {
  return /^\/owner\/[^/]+$/.test(pathname || "");
}

function useScreenCode() {
  const pathname = usePathname();
  const normalized = normalizePathname(pathname);
  return screenCodes[normalized] || fallbackScreenCode(normalized);
}

export function HeaderBackAction() {
  const { loggedIn } = useAuth();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const showBack = loggedIn && !mainRoutes.includes(pathname);

  if (!showBack) return null;

  function handleBack() {
    if (isOwnerDetailsPath(pathname)) {
      router.replace("/owners" as never);
      return;
    }

    if (pathname === "/expenses") {
      router.replace(expensesBackTarget(params as Record<string, unknown>) as never);
      return;
    }

    smartBack();
  }

  return (
    <TouchableOpacity
      style={styles.headerActionButton}
      onPress={handleBack}
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
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const screenCode = useScreenCode();
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const normalizedPathname = normalizePathname(pathname);
  const routeContractId = String(pathname || "").match(/^\/contract\/([^/]+)\/?$/)?.[1] || "";
  const isContractDetails = screenCode === "S-014" || normalizedPathname === "/contract/:id" || /^\/contract\/(?:[^/]+|\[id\])\/?$/.test(pathname || "");
  const contractId = firstParam((params as Record<string, unknown>).id).trim() || routeContractId;

  function contractReturnTo() {
    const unitId = firstParam((params as Record<string, unknown>).from_unit_id).trim()
      || firstParam((params as Record<string, unknown>).unit_id).trim();
    if (unitId) return `/unit/${unitId}`;
    const forcedRoute = String((globalThis as any).__RENTAL_FORCED_BACK_ROUTE__?.route || "").trim();
    return forcedRoute || (contractId ? `/contract/${contractId}` : "/contracts");
  }

  const loadChatUnreadCount = useCallback(async () => {
    if (!loggedIn) {
      setChatUnreadCount(0);
      return;
    }

    try {
      const response = await apiGet("/chat/threads");
      const data = response?.data ?? response;
      const threads = Array.isArray(data?.threads) ? data.threads : [];
      const total = threads.reduce((sum: number, item: any) => sum + Number(item?.unread_count || 0), 0);
      setChatUnreadCount(Number.isFinite(total) ? total : 0);
    } catch {
      setChatUnreadCount(0);
    }
  }, [loggedIn]);

  useEffect(() => {
    void loadChatUnreadCount();
    const timer = setInterval(() => { void loadChatUnreadCount(); }, 12000);
    return () => clearInterval(timer);
  }, [loadChatUnreadCount, pathname]);

  if (!loggedIn) return null;

  return (
    <View style={styles.headerActionsLeft}>
      <TouchableOpacity
        style={styles.headerActionButton}
        onPress={() => router.push("/chat-threads" as any)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="المراسلات"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="notifications-outline" size={22} color={colors.text} />
        {chatUnreadCount > 0 ? (
          <View style={styles.notificationBadge} pointerEvents="none">
            <Text style={styles.notificationBadgeText}>{chatUnreadCount > 99 ? "99+" : chatUnreadCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {isContractDetails && contractId ? (
        <>
          <TouchableOpacity
            style={[styles.headerActionButton, styles.contractDeleteButton]}
            onPress={() => router.push(`/edit-delete-center?resource=contracts&id=${contractId}&return_to=${encodeURIComponent(contractReturnTo())}` as never)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="حذف العقد"
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Ionicons name="trash-outline" size={19} color="#B91C1C" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionButton, styles.contractEditButton]}
            onPress={() => router.push({ pathname: "/contract-edit/[id]", params: { id: contractId, return_to: contractReturnTo() } } as never)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="تعديل العقد"
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Ionicons name="create-outline" size={20} color="#047857" />
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.screenCodeBadge} pointerEvents="none">
          <Text style={styles.screenCodeText}>#{screenCode}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerActionsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  contractEditButton: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  contractDeleteButton: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    borderWidth: 1,
    borderColor: "#fff",
  },
  notificationBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 12,
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