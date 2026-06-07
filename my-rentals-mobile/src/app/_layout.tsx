import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, router, useGlobalSearchParams, usePathname } from "expo-router";
import { useEffect } from "react";
import { HeaderBackAction as HeaderBackRight, HeaderQuickActions as HeaderActionsLeft } from "../components/AppHeaderActions";
import { colors } from "../constants/theme";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { trackNavigationRoute } from "../lib/navigationHistory";

function TabIcon({ name, color, size, lib = "ion" }: { name: string; color: string; size: number; lib?: "ion" | "mci" }) {
  const s = Math.max(22, size);
  if (lib === "mci") return <MaterialCommunityIcons name={name as any} size={s} color={color} />;
  return <Ionicons name={name as any} size={s} color={color} />;
}

const hidden = { href: null as any };

const hiddenScreens: Array<[string, string, Record<string, unknown>?]> = [
  ["chat-thread", "المحادثة", { headerShown: false }],
  ["payments", "الدفعات"], ["statistics", "التقارير"], ["settings", "الإعدادات"], ["tenants", "المستأجرين"], ["units", "الوحدات"],
  ["parking", "المواقف"], ["expenses", "المصروفات"], ["owner-payouts", "تسويات الملاك"], ["owner-settlements", "التسويات"],
  ["owner-statement", "كشف المالك"], ["owner-account-statement", "حساب المالك"], ["payment-receipts", "الإيصالات"],
  ["monthly-financial", "التقرير الشهري"], ["rent-roll", "كشف الإيجار"], ["tenant-statement", "كشف المستأجر"],
  ["tenant-statements", "كشوف المستأجرين"], ["create-contract", "عقد جديد"], ["upload-contract", "رفع عقد"],
  ["upload-property-deed", "رفع صك"], ["property-form", "بيانات العقار"], ["contract-edit/[id]", "تعديل العقد"],
  ["contract-renewals", "تجديد العقود"], ["alerts", "التنبيهات"], ["smart-alerts", "تنبيهات ذكية"], ["reminders", "التذكيرات"],
  ["follow-ups", "المتابعات"], ["reports", "التقارير"], ["occupancy", "الإشغال"], ["property-performance", "أداء العقارات"],
  ["files", "الملفات والوسائط"], ["export-center", "التصدير"], ["owner-accounts", "حسابات الملاك"],
  ["owner-bank-accounts", "الحسابات البنكية"], ["owner-portal", "بوابة الملاك"], ["user-accounts", "المستخدمون"],
  ["service-providers", "مزودو الخدمات"], ["unit-inspections", "فحص الوحدات"], ["unit-marketing", "تسويق الوحدات"],
  ["utility-bills", "الفواتير"], ["password-otp", "استعادة كلمة السر", { headerLeft: () => null, headerRight: () => null }],
  ["login", "تسجيل الدخول", { headerLeft: () => null, headerRight: () => null }], ["profile", "بروفايل"],
  ["profile-security", "تغيير الرقم السري"], ["profile-properties", "عقاراتي"], ["my-account", "حسابي"],
  ["system-settings", "إعدادات النظام"], ["search", "البحث"], ["activity-logs", "سجل النشاط"], ["activity-feed", "آخر النشاطات"],
  ["data-health", "صحة البيانات"], ["trash-center", "المحذوفات"], ["relations-manager", "إدارة"], ["record-details", "تفاصيل"],
  ["inquiry-center", "مركز الاستفسارات"], ["scheduled-messages", "الرسائل المجدولة"], ["communication-center", "التواصل"],
  ["owner-properties", "عقارات المالك"], ["owner-overdue-units", "الوحدات المتأخرة"], ["unit-overdue-payments", "دفعات الوحدة المتأخرة"],
  ["edit-record", "تعديل"], ["owner/[id]", "تفاصيل الأملاك"], ["property/[id]", "تفاصيل العقار"], ["unit/[id]", "تفاصيل الوحدة"],
  ["unit-edit/[id]", "تعديل الوحدة"], ["tenant/[id]", "تفاصيل المستأجر"], ["contract/[id]", "تفاصيل العقد"], ["payment/[id]", "الدفعات"],
];

function AppTabs() {
  const { loading, loggedIn, locked, isAdmin, isTenant } = useAuth();
  const pathname = usePathname();
  const routeParams = useGlobalSearchParams();
  const routeParamsKey = JSON.stringify(routeParams);
  const isLoginRoute = pathname === "/login";
  const isPasswordOtpRoute = pathname === "/password-otp";
  const isTenantPaymentsRoute = pathname === "/tenant-payments";
  const isChatRoute = pathname === "/chat-threads" || pathname === "/chat-thread" || pathname.startsWith("/chat-thread/");
  const isTenantAllowedRoute = isTenantPaymentsRoute || isChatRoute;
  const isPublicAuthRoute = isLoginRoute || isPasswordOtpRoute;

  useEffect(() => {
    if (loading) return;
    if ((!loggedIn || locked) && !isPublicAuthRoute) return router.replace("/login" as any);
    if (loggedIn && !locked && isPublicAuthRoute) return router.replace(isTenant ? "/tenant-payments" as any : "/" as any);
    if (loggedIn && !locked && isTenant && !isTenantAllowedRoute) router.replace("/tenant-payments" as any);
  }, [isPublicAuthRoute, isTenantAllowedRoute, isTenant, loading, loggedIn, locked]);

  useEffect(() => {
    if (loading || !loggedIn || locked || isPublicAuthRoute) return;
    trackNavigationRoute(pathname, routeParams as Record<string, unknown>);
  }, [isPublicAuthRoute, loading, loggedIn, locked, pathname, routeParamsKey]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800", paddingBottom: 2 },
        tabBarStyle: {
          display: loggedIn && !locked ? "flex" : "none",
          height: 62,
          paddingTop: 5,
          paddingBottom: 7,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.borderLight,
          elevation: 0,
          shadowOpacity: 0,
        },
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
      <Tabs.Screen name="chat-threads" options={{ href: isTenant ? "/chat-threads" : null, title: "مراسلاتي", tabBarIcon: ({ color, size }) => <TabIcon name="chatbubbles-outline" color={color} size={size} /> }} />

      {hiddenScreens.map(([name, title, extra]) => <Tabs.Screen key={name} name={name} options={{ ...hidden, title, ...(extra || {}) }} />)}
    </Tabs>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppTabs />
    </AuthProvider>
  );
}
