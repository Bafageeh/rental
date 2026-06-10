import { Ionicons } from "@expo/vector-icons";
import { Tabs, router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { HeaderBackAction as HeaderBackRight, HeaderQuickActions as HeaderActionsLeft } from "../components/AppHeaderActions";
import { colors } from "../constants/theme";
import { AuthProvider, useAuth } from "../context/AuthContext";

function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  return <Ionicons name={name as any} size={Math.max(22, size)} color={color} />;
}

const hidden = { href: null as any };
const otpName = String.fromCharCode(112, 97, 115, 115, 119, 111, 114, 100, 45, 111, 116, 112);

const hiddenScreens = [
  "chat-thread", "payments", "statistics", "settings", "tenants", "units", "parking", "expenses",
  "owner-payouts", "owner-settlements", "owner-statement", "owner-account-statement", "payment-receipts",
  "monthly-financial", "rent-roll", "tenant-statement", "tenant-statements", "create-contract", "upload-contract",
  "upload-property-deed", "property-form", "contract-edit/[id]", "contract-renewals", "alerts", "smart-alerts",
  "reminders", "follow-ups", "reports", "occupancy", "property-performance", "files", "export-center",
  "owner-accounts", "owner-bank-accounts", "owner-portal", "user-accounts", "service-providers", "unit-inspections",
  "unit-marketing", "utility-bills", otpName, "login", "profile", "profile-security", "profile-properties",
  "my-account", "system-settings", "search", "activity-logs", "activity-feed", "data-health", "trash-center",
  "relations-manager", "record-details", "inquiry-center", "scheduled-messages", "communication-center", "owner-properties",
  "owner-overdue-units", "unit-overdue-payments", "edit-record", "owner/[id]", "property/[id]", "unit/[id]",
  "unit-edit/[id]", "tenant/[id]", "contract/[id]", "payment/[id]",
];

function AppTabs() {
  const { loading, loggedIn, locked, isAdmin, isTenant } = useAuth();
  const pathname = usePathname();
  const forcedLoginOnLaunch = useRef(false);

  const isLoginRoute = pathname === "/login";
  const isOtpRoute = pathname === "/" + otpName;
  const isManagerRegisterRoute = pathname === "/manager-register";
  const isPublicAuthRoute = isLoginRoute || isOtpRoute || isManagerRegisterRoute;
  const isTenantPaymentsRoute = pathname === "/tenant-payments";
  const isTenantReportsRoute = pathname === "/tenant-reports";
  const isTenantMoreRoute = pathname === "/tenant-more";
  const isChatRoute = pathname === "/chat-threads" || pathname === "/chat-thread" || pathname.startsWith("/chat-thread/");
  const isTenantAllowedRoute = isTenantPaymentsRoute || isTenantReportsRoute || isTenantMoreRoute || isChatRoute;

  useEffect(() => {
    if (forcedLoginOnLaunch.current) return;
    forcedLoginOnLaunch.current = true;
    if (!isPublicAuthRoute) router.replace("/login" as any);
  }, []);

  useEffect(() => {
    if (loading) return;
    if ((!loggedIn || locked) && !isPublicAuthRoute) return router.replace("/login" as any);
    if (loggedIn && !locked && isPublicAuthRoute) return router.replace(isTenant ? "/tenant-payments" as any : "/" as any);
    if (loggedIn && !locked && isTenant && !isTenantAllowedRoute) router.replace("/tenant-payments" as any);
  }, [isPublicAuthRoute, isTenantAllowedRoute, isTenant, loading, loggedIn, locked]);

  return (
    <Tabs
      initialRouteName="login"
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800", paddingBottom: 2 },
        tabBarStyle: { display: loggedIn && !locked ? "flex" : "none", height: 62, paddingTop: 5, paddingBottom: 7, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight, elevation: 0, shadowOpacity: 0 },
        tabBarHideOnKeyboard: true,
        headerStyle: { backgroundColor: colors.surface, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
        headerTitleStyle: { fontWeight: "800", color: colors.text, fontSize: 17 },
        headerTitleAlign: "center",
        headerLeft: () => <HeaderActionsLeft />,
        headerLeftContainerStyle: { paddingLeft: 12 },
        headerRight: () => <HeaderBackRight />,
        headerRightContainerStyle: { paddingRight: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ href: isTenant ? null : "/", title: "إحصائيات", tabBarIcon: ({ color, size }) => <TabIcon name="stats-chart" color={color} size={size} /> }} />
      <Tabs.Screen name="properties" options={{ href: isTenant ? null : "/properties", title: "عقاراتي", tabBarIcon: ({ color, size }) => <TabIcon name="business" color={color} size={size} /> }} />
      <Tabs.Screen name="owners" options={{ href: !isTenant && isAdmin ? "/owners" : null, title: "الملاك", tabBarIcon: ({ color, size }) => <TabIcon name="people" color={color} size={size} /> }} />
      <Tabs.Screen name="more" options={{ href: isTenant ? null : "/more", title: "مزيد", tabBarIcon: ({ color, size }) => <TabIcon name="grid" color={color} size={size} /> }} />
      <Tabs.Screen name="tenant-payments" options={{ href: isTenant ? "/tenant-payments" : null, title: "دفعاتي", tabBarIcon: ({ color, size }) => <TabIcon name="receipt-outline" color={color} size={size} />, headerRight: () => null }} />
      <Tabs.Screen name="tenant-reports" options={{ href: isTenant ? "/tenant-reports" : null, title: "تقاريري", tabBarIcon: ({ color, size }) => <TabIcon name="analytics-outline" color={color} size={size} />, headerRight: () => null }} />
      <Tabs.Screen name="chat-threads" options={{ href: isTenant ? "/chat-threads" : null, title: "مراسلاتي", tabBarIcon: ({ color, size }) => <TabIcon name="chatbubbles-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="tenant-more" options={{ href: isTenant ? "/tenant-more" : null, title: "مزيد", tabBarIcon: ({ color, size }) => <TabIcon name="grid-outline" color={color} size={size} />, headerRight: () => null }} />
      {hiddenScreens.map((name) => <Tabs.Screen key={name} name={name} options={hidden} />)}
    </Tabs>
  );
}

export default function RootLayout() {
  return <AuthProvider><AppTabs /></AuthProvider>;
}
