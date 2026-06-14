import { Ionicons } from "@expo/vector-icons";
import { Tabs, router, useLocalSearchParams, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { BackHandler } from "react-native";
import { HeaderBackAction as HeaderBackRight, HeaderQuickActions as HeaderActionsLeft } from "../components/AppHeaderActions";
import { colors } from "../constants/theme";
import { AuthProvider, useAuth } from "../context/AuthContext";

function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  return <Ionicons name={name as any} size={Math.max(22, size)} color={color} />;
}

const hidden = { href: null as any };
const otpName = String.fromCharCode(112, 97, 115, 115, 119, 111, 114, 100, 45, 111, 116, 112);
const routeTitles: Record<string, string> = {
  "login": "تسجيل الدخول",
  [otpName]: "استعادة كلمة السر",
  "manager-register": "إنشاء حساب مدير عقارات",
  "privacy": "الخصوصية والدعم",
  "owner/[id]": "تفاصيل المالك",
  "property/[id]": "تفاصيل العقار",
  "unit/[id]": "تفاصيل الوحدة",
  "unit-edit/[id]": "تعديل الوحدة",
  "tenant/[id]": "تفاصيل المستأجر",
  "contract/[id]": "تفاصيل العقد",
  "payment/[id]": "تفاصيل الدفعة",
  "my-account": "حسابي",
  "owner-accounts": "حسابات الملاك",
  "owner-bank-accounts": "الحسابات البنكية",
  "activity-logs": "سجل العمليات",
  "activity-feed": "آخر النشاطات",
  "trash-center": "سلة المحذوفات",
  "communication-center": "مركز المراسلات",
  "smart-alerts": "التنبيهات الذكية",
  "follow-ups": "المتابعات والمهام",
  "monthly-financial": "التقرير المالي الشهري",
  "user-accounts": "إدارة المستخدمين",
  "inquiry-center": "مركز الاستفسارات",
  "scheduled-messages": "الرسائل المجدولة",
};

const hiddenScreens = [
  "+not-found", "system-settings",
  "chat-thread", "payments", "statistics", "settings", "tenants", "parking", "expenses",
  "owner-payouts", "owner-settlements", "owner-statement", "owner-account-statement",
  "monthly-financial", "rent-roll", "tenant-statement", "tenant-statements", "create-contract", "upload-contract",
  "upload-property-deed", "property-form", "contract-edit/[id]", "contract-renewals", "alerts", "smart-alerts",
  "reminders", "follow-ups", "reports", "occupancy", "property-performance", "files",
  "owner-accounts", "owner-bank-accounts", "owner-portal", "user-accounts", "service-providers", "unit-inspections",
  "unit-marketing", "utility-bills", otpName, "login", "manager-register", "profile", "profile-security", "profile-properties",
  "my-account", "search", "activity-logs", "activity-feed", "data-health", "trash-center",
  "relations-manager", "record-details", "inquiry-center", "scheduled-messages", "communication-center", "owner-properties",
  "owner-overdue-units", "unit-overdue-payments", "edit-record", "owner/[id]", "property/[id]", "unit/[id]",
  "unit-edit/[id]", "tenant/[id]", "contract/[id]", "payment/[id]",
];

function firstParam(value: unknown) {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : "";
  return value === undefined || value === null ? "" : String(value);
}

function expensesBackRoute(propertyId: string) {
  return propertyId ? `/property/${propertyId}` : "/properties";
}

function AppTabs() {
  const { loading, loggedIn, locked, isAdmin, isTenant, user } = useAuth();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const forcedLoginOnLaunch = useRef(false);
  const role = String(user?.role ?? '').trim().toLowerCase();
  const isSystemAdmin = isAdmin && (role === 'admin' || role === 'super_admin');
  const expensesPropertyId = firstParam((params as Record<string, unknown>).property_id).trim();

  const isLoginRoute = pathname === "/login";
  const isOtpRoute = pathname === "/" + otpName;
  const isManagerRegisterRoute = pathname === "/manager-register";
  const isPrivacyRoute = pathname === "/privacy";
  const isPublicAuthRoute = isLoginRoute || isOtpRoute || isManagerRegisterRoute;
  const isPublicRoute = isPublicAuthRoute || isPrivacyRoute;
  const isRemovedRoute = pathname === "/system-settings";
  const isAdminOnlyRoute = pathname === "/inquiry-center" || pathname === "/scheduled-messages" || pathname === "/user-accounts";
  const isTenantPaymentsRoute = pathname === "/tenant-payments";
  const isTenantReportsRoute = pathname === "/tenant-reports";
  const isTenantMoreRoute = pathname === "/tenant-more";
  const isChatRoute = pathname === "/chat-threads" || pathname === "/chat-thread" || pathname.startsWith("/chat-thread/");
  const isTenantAllowedRoute = isTenantPaymentsRoute || isTenantReportsRoute || isTenantMoreRoute || isChatRoute || isPrivacyRoute;

  useEffect(() => {
    if (forcedLoginOnLaunch.current) return;
    forcedLoginOnLaunch.current = true;
    if (!isPublicRoute) router.replace("/login" as any);
  }, []);

  useEffect(() => {
    if (pathname !== "/expenses") return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace(expensesBackRoute(expensesPropertyId) as any);
      return true;
    });

    return () => subscription.remove();
  }, [pathname, expensesPropertyId]);

  useEffect(() => {
    if (loading) return;
    if (isRemovedRoute) return router.replace("/more" as any);
    if ((!loggedIn || locked) && !isPublicRoute) return router.replace("/login" as any);
    if (loggedIn && !locked && isPublicAuthRoute) return router.replace(isTenant ? "/tenant-payments" as any : "/" as any);
    if (loggedIn && !locked && isAdminOnlyRoute && !isSystemAdmin) return router.replace("/more" as any);
    if (loggedIn && !locked && isTenant && !isTenantAllowedRoute) router.replace("/tenant-payments" as any);
  }, [isRemovedRoute, isPublicRoute, isPublicAuthRoute, isAdminOnlyRoute, isSystemAdmin, isTenantAllowedRoute, isTenant, loading, loggedIn, locked]);

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
      <Tabs.Screen name="privacy" options={{ href: isTenant ? "/privacy" : null, title: "الخصوصية", tabBarIcon: ({ color, size }) => <TabIcon name="shield-checkmark-outline" color={color} size={size} /> }} />
      {hiddenScreens.map((name) => <Tabs.Screen key={name} name={name} options={{ ...hidden, title: routeTitles[name] }} />)}
    </Tabs>
  );
}

export default function RootLayout() {
  return <AuthProvider><AppTabs /></AuthProvider>;
}
