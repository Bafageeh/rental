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
  const { loading, loggedIn } = useAuth();
  const pathname = usePathname();
  const routeParams = useGlobalSearchParams();
  const routeParamsKey = JSON.stringify(routeParams);
  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    if (loading) return;

    if (!loggedIn && !isLoginRoute) {
      router.replace("/login" as any);
      return;
    }

    if (loggedIn && isLoginRoute) {
      router.replace("/" as any);
    }
  }, [isLoginRoute, loading, loggedIn]);

  useEffect(() => {
    if (loading || !loggedIn || isLoginRoute) return;
    trackNavigationRoute(pathname, routeParams as Record<string, unknown>);
  }, [isLoginRoute, loading, loggedIn, pathname, routeParamsKey]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800", paddingBottom: 2 },
        tabBarStyle: {
          display: loggedIn ? "flex" : "none",
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
      <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: ({ color, size }) => <TabIcon name="home" color={color} size={size} />, tabBarAccessibilityLabel: "الرئيسية" }} />
      <Tabs.Screen name="properties" options={{ title: "العقارات", tabBarIcon: ({ color, size }) => <TabIcon name="business" color={color} size={size} />, tabBarAccessibilityLabel: "العقارات" }} />
      <Tabs.Screen name="payments" options={{ title: "الدفعات", tabBarIcon: ({ color, size }) => <TabIcon name="cash" color={color} size={size} lib="mci" />, tabBarAccessibilityLabel: "الدفعات" }} />
      <Tabs.Screen name="statistics" options={{ title: "التقارير", tabBarIcon: ({ color, size }) => <TabIcon name="stats-chart" color={color} size={size} />, tabBarAccessibilityLabel: "التقارير" }} />
      <Tabs.Screen name="more" options={{ title: "المزيد", tabBarIcon: ({ color, size }) => <TabIcon name="grid" color={color} size={size} />, tabBarAccessibilityLabel: "المزيد" }} />

      <Tabs.Screen name="owners" options={{ href: null, title: "الملاك" }} />
      <Tabs.Screen name="settings" options={{ href: null, title: "الإعدادات" }} />
      <Tabs.Screen name="contracts" options={{ href: null, title: "العقود" }} />
      <Tabs.Screen name="tenants" options={{ href: null, title: "المستأجرين" }} />
      <Tabs.Screen name="units" options={{ href: null, title: "الوحدات" }} />
      <Tabs.Screen name="parking" options={{ href: null, title: "المواقف" }} />
      <Tabs.Screen name="expenses" options={{ href: null, title: "المصروفات" }} />
      <Tabs.Screen name="owner-payouts" options={{ href: null, title: "تسويات الملاك" }} />
      <Tabs.Screen name="owner-settlements" options={{ href: null, title: "التسويات" }} />
      <Tabs.Screen name="owner-statement" options={{ href: null, title: "كشف المالك" }} />
      <Tabs.Screen name="payment-receipts" options={{ href: null, title: "الإيصالات" }} />
      <Tabs.Screen name="monthly-financial" options={{ href: null, title: "التقرير الشهري" }} />
      <Tabs.Screen name="rent-roll" options={{ href: null, title: "كشف الإيجار" }} />
      <Tabs.Screen name="tenant-statement" options={{ href: null, title: "كشف المستأجر" }} />
      <Tabs.Screen name="tenant-statements" options={{ href: null, title: "كشوف المستأجرين" }} />
      <Tabs.Screen name="create-contract" options={{ href: null, title: "عقد جديد" }} />
      <Tabs.Screen name="upload-contract" options={{ href: null, title: "رفع عقد" }} />
      <Tabs.Screen name="upload-property-deed" options={{ href: null, title: "رفع صك" }} />
      <Tabs.Screen name="contract-renewals" options={{ href: null, title: "تجديد العقود" }} />
      <Tabs.Screen name="alerts" options={{ href: null, title: "التنبيهات" }} />
      <Tabs.Screen name="smart-alerts" options={{ href: null, title: "تنبيهات ذكية" }} />
      <Tabs.Screen name="reminders" options={{ href: null, title: "التذكيرات" }} />
      <Tabs.Screen name="follow-ups" options={{ href: null, title: "المتابعات" }} />
      <Tabs.Screen name="reports" options={{ href: null, title: "التقارير" }} />
      <Tabs.Screen name="occupancy" options={{ href: null, title: "الإشغال" }} />
      <Tabs.Screen name="property-performance" options={{ href: null, title: "أداء العقارات" }} />
      <Tabs.Screen name="documents" options={{ href: null, title: "المستندات" }} />
      <Tabs.Screen name="files" options={{ href: null, title: "الملفات والوسائط" }} />
      <Tabs.Screen name="export-center" options={{ href: null, title: "التصدير" }} />
      <Tabs.Screen name="owner-accounts" options={{ href: null, title: "حسابات الملاك" }} />
      <Tabs.Screen name="owner-bank-accounts" options={{ href: null, title: "الحسابات البنكية" }} />
      <Tabs.Screen name="owner-portal" options={{ href: null, title: "بوابة الملاك" }} />
      <Tabs.Screen name="user-accounts" options={{ href: null, title: "المستخدمون" }} />
      <Tabs.Screen name="service-providers" options={{ href: null, title: "مزودو الخدمات" }} />
      <Tabs.Screen name="unit-inspections" options={{ href: null, title: "فحص الوحدات" }} />
      <Tabs.Screen name="unit-marketing" options={{ href: null, title: "تسويق الوحدات" }} />
      <Tabs.Screen name="utility-bills" options={{ href: null, title: "الفواتير" }} />
      <Tabs.Screen name="login" options={{ href: null, title: "تسجيل الدخول", headerLeft: () => null, headerRight: () => null }} />
      <Tabs.Screen name="profile" options={{ href: null, title: "بروفايل" }} />
      <Tabs.Screen name="profile-security" options={{ href: null, title: "تغيير الرقم السري" }} />
      <Tabs.Screen name="profile-properties" options={{ href: null, title: "عقاراتي" }} />
      <Tabs.Screen name="my-account" options={{ href: null, title: "حسابي" }} />
      <Tabs.Screen name="system-settings" options={{ href: null, title: "إعدادات النظام" }} />
      <Tabs.Screen name="search" options={{ href: null, title: "البحث" }} />
      <Tabs.Screen name="activity-logs" options={{ href: null, title: "سجل النشاط" }} />
      <Tabs.Screen name="activity-feed" options={{ href: null, title: "آخر النشاطات" }} />
      <Tabs.Screen name="data-health" options={{ href: null, title: "صحة البيانات" }} />
      <Tabs.Screen name="edit-delete-center" options={{ href: null, title: "مركز التعديل" }} />
      <Tabs.Screen name="trash-center" options={{ href: null, title: "المحذوفات" }} />
      <Tabs.Screen name="relations-manager" options={{ href: null, title: "إدارة" }} />
      <Tabs.Screen name="record-details" options={{ href: null, title: "تفاصيل" }} />
      <Tabs.Screen name="communication-center" options={{ href: null, title: "التواصل" }} />
      <Tabs.Screen name="owner/[id]" options={{ href: null, title: "تفاصيل الأملاك" }} />
      <Tabs.Screen name="property/[id]" options={{ href: null, title: "تفاصيل العقار" }} />
      <Tabs.Screen name="unit/[id]" options={{ href: null, title: "تفاصيل الوحدة" }} />
      <Tabs.Screen name="tenant/[id]" options={{ href: null, title: "تفاصيل المستأجر" }} />
      <Tabs.Screen name="contract/[id]" options={{ href: null, title: "تفاصيل العقد" }} />
      <Tabs.Screen name="payment/[id]" options={{ href: null, title: "الدفعات" }} />
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
