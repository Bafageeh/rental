// Force mobile deploy after rebuilding bottom tabs
import { Tabs, router, useGlobalSearchParams, usePathname } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { colors } from "../constants/theme";
import { HeaderBackAction as HeaderBackRight, HeaderQuickActions as HeaderActionsLeft } from "../components/AppHeaderActions";
import { trackNavigationRoute } from "../lib/navigationHistory";

function TabIcon({
  name,
  color,
  size,
  lib = "ion",
}: {
  name: string;
  color: string;
  size: number;
  lib?: "ion" | "mci";
}) {
  const s = Math.max(22, size);
  if (lib === "mci") {
    return <MaterialCommunityIcons name={name as any} size={s} color={color} />;
  }
  return <Ionicons name={name as any} size={s} color={color} />;
}

function AppTabs() {
  const { loading, loggedIn, locked, isAdmin } = useAuth();
  const pathname = usePathname();
  const routeParams = useGlobalSearchParams();
  const routeParamsKey = JSON.stringify(routeParams);
  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    if (loading) return;

    if ((!loggedIn || locked) && !isLoginRoute) {
      router.replace("/login" as any);
      return;
    }

    if (loggedIn && !locked && isLoginRoute) {
      router.replace("/" as any);
    }
  }, [isLoginRoute, loading, loggedIn, locked]);

  useEffect(() => {
    if (loading || !loggedIn || locked || isLoginRoute) return;
    trackNavigationRoute(pathname, routeParams as Record<string, unknown>);
  }, [isLoginRoute, loading, loggedIn, locked, pathname, routeParamsKey]);

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
        headerStyle: {
          backgroundColor: colors.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderLight,
        },
        headerTitleStyle: {
          fontWeight: "800",
          color: colors.text,
          fontSize: 17,
        },
        headerTitleAlign: "center",
        headerLeft: () => <HeaderActionsLeft />,
        headerLeftContainerStyle: { paddingLeft: 12 },
        headerRight: () => <HeaderBackRight />,
        headerRightContainerStyle: { paddingRight: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "إحصائيات", tabBarIcon: ({ color, size }) => <TabIcon name="stats-chart" color={color} size={size} />, tabBarAccessibilityLabel: "إحصائيات" }} />
      <Tabs.Screen name="properties" options={{ title: "عقاراتي", tabBarIcon: ({ color, size }) => <TabIcon name="business" color={color} size={size} />, tabBarAccessibilityLabel: "عقاراتي" }} />
      <Tabs.Screen name="payments" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "الدفعات" }} />
      <Tabs.Screen name="owners" options={{ href: isAdmin ? "/owners" : null, title: "الملاك", tabBarIcon: ({ color, size }) => <TabIcon name="people" color={color} size={size} />, tabBarAccessibilityLabel: "الملاك" }} />
      <Tabs.Screen name="more" options={{ title: "مزيد", tabBarIcon: ({ color, size }) => <TabIcon name="grid" color={color} size={size} />, tabBarAccessibilityLabel: "مزيد" }} />

      <Tabs.Screen name="statistics" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "التقارير" }} />
      <Tabs.Screen name="settings" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "الإعدادات" }} />
      <Tabs.Screen name="contracts" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "العقود" }} />
      <Tabs.Screen name="tenants" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "المستأجرين" }} />
      <Tabs.Screen name="units" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "الوحدات" }} />
      <Tabs.Screen name="parking" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "المواقف" }} />
      <Tabs.Screen name="expenses" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "المصروفات" }} />
      <Tabs.Screen name="owner-payouts" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "تسويات الملاك" }} />
      <Tabs.Screen name="owner-settlements" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "التسويات" }} />
      <Tabs.Screen name="owner-statement" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "كشف المالك" }} />
      <Tabs.Screen name="payment-receipts" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "الإيصالات" }} />
      <Tabs.Screen name="monthly-financial" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "التقرير الشهري" }} />
      <Tabs.Screen name="rent-roll" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "كشف الإيجار" }} />
      <Tabs.Screen name="tenant-statement" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "كشف المستأجر" }} />
      <Tabs.Screen name="tenant-statements" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "كشوف المستأجرين" }} />
      <Tabs.Screen name="create-contract" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "عقد جديد" }} />
      <Tabs.Screen name="upload-contract" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "رفع عقد" }} />
      <Tabs.Screen name="upload-property-deed" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "رفع صك" }} />
      <Tabs.Screen name="contract-renewals" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "تجديد العقود" }} />
      <Tabs.Screen name="alerts" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "التنبيهات" }} />
      <Tabs.Screen name="smart-alerts" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "تنبيهات ذكية" }} />
      <Tabs.Screen name="reminders" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "التذكيرات" }} />
      <Tabs.Screen name="follow-ups" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "المتابعات" }} />
      <Tabs.Screen name="reports" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "التقارير" }} />
      <Tabs.Screen name="occupancy" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "الإشغال" }} />
      <Tabs.Screen name="property-performance" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "أداء العقارات" }} />
      <Tabs.Screen name="documents" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "المستندات" }} />
      <Tabs.Screen name="files" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "الملفات والوسائط" }} />
      <Tabs.Screen name="export-center" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "التصدير" }} />
      <Tabs.Screen name="owner-accounts" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "حسابات الملاك" }} />
      <Tabs.Screen name="owner-bank-accounts" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "الحسابات البنكية" }} />
      <Tabs.Screen name="owner-portal" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "بوابة الملاك" }} />
      <Tabs.Screen name="user-accounts" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "المستخدمون" }} />
      <Tabs.Screen name="service-providers" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "مزودو الخدمات" }} />
      <Tabs.Screen name="unit-inspections" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "فحص الوحدات" }} />
      <Tabs.Screen name="unit-marketing" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "تسويق الوحدات" }} />
      <Tabs.Screen name="utility-bills" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "الفواتير" }} />
      <Tabs.Screen name="login" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "تسجيل الدخول", headerLeft: () => null, headerRight: () => null }} />
      <Tabs.Screen name="profile" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "بروفايل" }} />
      <Tabs.Screen name="profile-security" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "تغيير الرقم السري" }} />
      <Tabs.Screen name="profile-properties" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "عقاراتي" }} />
      <Tabs.Screen name="my-account" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "حسابي" }} />
      <Tabs.Screen name="system-settings" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "إعدادات النظام" }} />
      <Tabs.Screen name="search" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "البحث" }} />
      <Tabs.Screen name="activity-logs" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "سجل النشاط" }} />
      <Tabs.Screen name="activity-feed" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "آخر النشاطات" }} />
      <Tabs.Screen name="data-health" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "صحة البيانات" }} />
      <Tabs.Screen name="edit-delete-center" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "مركز التعديل" }} />
      <Tabs.Screen name="trash-center" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "المحذوفات" }} />
      <Tabs.Screen name="relations-manager" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "إدارة" }} />
      <Tabs.Screen name="record-details" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "تفاصيل" }} />
      <Tabs.Screen name="inquiry-center" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "مركز الاستفسارات" }} />
      <Tabs.Screen name="communication-center" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "التواصل" }} />
      <Tabs.Screen name="owner-properties" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "عقارات المالك" }} />
      <Tabs.Screen name="edit-record" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "تعديل" }} />
      <Tabs.Screen name="owner/[id]" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "تفاصيل الأملاك" }} />
      <Tabs.Screen name="property/[id]" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "تفاصيل العقار" }} />
      <Tabs.Screen name="unit/[id]" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "تفاصيل الوحدة" }} />
      <Tabs.Screen name="tenant/[id]" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "تفاصيل المستأجر" }} />
      <Tabs.Screen name="contract/[id]" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "تفاصيل العقد" }} />
      <Tabs.Screen name="payment/[id]" options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" }, title: "الدفعات" }} />
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
