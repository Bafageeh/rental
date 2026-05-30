// Fixed tabs: hidden screens use href null only. Do not combine href with tabBarButton.
import { Tabs, router, useGlobalSearchParams, usePathname } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { colors } from "../constants/theme";
import { HeaderBackAction as HeaderBackRight, HeaderQuickActions as HeaderActionsLeft } from "../components/AppHeaderActions";
import { trackNavigationRoute } from "../lib/navigationHistory";

function TabIcon({ name, color, size, lib = "ion" }: { name: string; color: string; size: number; lib?: "ion" | "mci" }) {
  const s = Math.max(22, size);
  if (lib === "mci") return <MaterialCommunityIcons name={name as any} size={s} color={color} />;
  return <Ionicons name={name as any} size={s} color={color} />;
}

const hidden = { href: null as any };

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
    if (loggedIn && !locked && isLoginRoute) router.replace("/" as any);
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
        headerTitleStyle: { fontWeight: "800", color: colors.text, fontSize: 17 },
        headerTitleAlign: "center",
        headerLeft: () => <HeaderActionsLeft />,
        headerLeftContainerStyle: { paddingLeft: 12 },
        headerRight: () => <HeaderBackRight />,
        headerRightContainerStyle: { paddingRight: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "إحصائيات", tabBarIcon: ({ color, size }) => <TabIcon name="stats-chart" color={color} size={size} />, tabBarAccessibilityLabel: "إحصائيات" }} />
      <Tabs.Screen name="properties" options={{ title: "عقاراتي", tabBarIcon: ({ color, size }) => <TabIcon name="business" color={color} size={size} />, tabBarAccessibilityLabel: "عقاراتي" }} />
      <Tabs.Screen name="owners" options={{ href: isAdmin ? "/owners" : null, title: "الملاك", tabBarIcon: ({ color, size }) => <TabIcon name="people" color={color} size={size} />, tabBarAccessibilityLabel: "الملاك" }} />
      <Tabs.Screen name="more" options={{ title: "مزيد", tabBarIcon: ({ color, size }) => <TabIcon name="grid" color={color} size={size} />, tabBarAccessibilityLabel: "مزيد" }} />

      <Tabs.Screen name="payments" options={{ ...hidden, title: "الدفعات" }} />
      <Tabs.Screen name="statistics" options={{ ...hidden, title: "التقارير" }} />
      <Tabs.Screen name="settings" options={{ ...hidden, title: "الإعدادات" }} />
      <Tabs.Screen name="tenants" options={{ ...hidden, title: "المستأجرين" }} />
      <Tabs.Screen name="units" options={{ ...hidden, title: "الوحدات" }} />
      <Tabs.Screen name="parking" options={{ ...hidden, title: "المواقف" }} />
      <Tabs.Screen name="expenses" options={{ ...hidden, title: "المصروفات" }} />
      <Tabs.Screen name="owner-payouts" options={{ ...hidden, title: "تسويات الملاك" }} />
      <Tabs.Screen name="owner-settlements" options={{ ...hidden, title: "التسويات" }} />
      <Tabs.Screen name="owner-statement" options={{ ...hidden, title: "كشف المالك" }} />
      <Tabs.Screen name="payment-receipts" options={{ ...hidden, title: "الإيصالات" }} />
      <Tabs.Screen name="monthly-financial" options={{ ...hidden, title: "التقرير الشهري" }} />
      <Tabs.Screen name="rent-roll" options={{ ...hidden, title: "كشف الإيجار" }} />
      <Tabs.Screen name="tenant-statement" options={{ ...hidden, title: "كشف المستأجر" }} />
      <Tabs.Screen name="tenant-statements" options={{ ...hidden, title: "كشوف المستأجرين" }} />
      <Tabs.Screen name="create-contract" options={{ ...hidden, title: "عقد جديد" }} />
      <Tabs.Screen name="upload-contract" options={{ ...hidden, title: "رفع عقد" }} />
      <Tabs.Screen name="upload-property-deed" options={{ ...hidden, title: "رفع صك" }} />
      <Tabs.Screen name="property-form" options={{ ...hidden, title: "بيانات العقار" }} />
      <Tabs.Screen name="contract-edit/[id]" options={{ ...hidden, title: "تعديل العقد" }} />
      <Tabs.Screen name="contract-renewals" options={{ ...hidden, title: "تجديد العقود" }} />
      <Tabs.Screen name="alerts" options={{ ...hidden, title: "التنبيهات" }} />
      <Tabs.Screen name="smart-alerts" options={{ ...hidden, title: "تنبيهات ذكية" }} />
      <Tabs.Screen name="reminders" options={{ ...hidden, title: "التذكيرات" }} />
      <Tabs.Screen name="follow-ups" options={{ ...hidden, title: "المتابعات" }} />
      <Tabs.Screen name="reports" options={{ ...hidden, title: "التقارير" }} />
      <Tabs.Screen name="occupancy" options={{ ...hidden, title: "الإشغال" }} />
      <Tabs.Screen name="property-performance" options={{ ...hidden, title: "أداء العقارات" }} />
      <Tabs.Screen name="files" options={{ ...hidden, title: "الملفات والوسائط" }} />
      <Tabs.Screen name="export-center" options={{ ...hidden, title: "التصدير" }} />
      <Tabs.Screen name="owner-accounts" options={{ ...hidden, title: "حسابات الملاك" }} />
      <Tabs.Screen name="owner-bank-accounts" options={{ ...hidden, title: "الحسابات البنكية" }} />
      <Tabs.Screen name="owner-portal" options={{ ...hidden, title: "بوابة الملاك" }} />
      <Tabs.Screen name="user-accounts" options={{ ...hidden, title: "المستخدمون" }} />
      <Tabs.Screen name="service-providers" options={{ ...hidden, title: "مزودو الخدمات" }} />
      <Tabs.Screen name="unit-inspections" options={{ ...hidden, title: "فحص الوحدات" }} />
      <Tabs.Screen name="unit-marketing" options={{ ...hidden, title: "تسويق الوحدات" }} />
      <Tabs.Screen name="utility-bills" options={{ ...hidden, title: "الفواتير" }} />
      <Tabs.Screen name="login" options={{ ...hidden, title: "تسجيل الدخول", headerLeft: () => null, headerRight: () => null }} />
      <Tabs.Screen name="profile" options={{ ...hidden, title: "بروفايل" }} />
      <Tabs.Screen name="profile-security" options={{ ...hidden, title: "تغيير الرقم السري" }} />
      <Tabs.Screen name="profile-properties" options={{ ...hidden, title: "عقاراتي" }} />
      <Tabs.Screen name="my-account" options={{ ...hidden, title: "حسابي" }} />
      <Tabs.Screen name="system-settings" options={{ ...hidden, title: "إعدادات النظام" }} />
      <Tabs.Screen name="search" options={{ ...hidden, title: "البحث" }} />
      <Tabs.Screen name="activity-logs" options={{ ...hidden, title: "سجل النشاط" }} />
      <Tabs.Screen name="activity-feed" options={{ ...hidden, title: "آخر النشاطات" }} />
      <Tabs.Screen name="data-health" options={{ ...hidden, title: "صحة البيانات" }} />
      <Tabs.Screen name="trash-center" options={{ ...hidden, title: "المحذوفات" }} />
      <Tabs.Screen name="relations-manager" options={{ ...hidden, title: "إدارة" }} />
      <Tabs.Screen name="record-details" options={{ ...hidden, title: "تفاصيل" }} />
      <Tabs.Screen name="inquiry-center" options={{ ...hidden, title: "مركز الاستفسارات" }} />
      <Tabs.Screen name="scheduled-messages" options={{ ...hidden, title: "الرسائل المجدولة" }} />
      <Tabs.Screen name="communication-center" options={{ ...hidden, title: "التواصل" }} />
      <Tabs.Screen name="owner-properties" options={{ ...hidden, title: "عقارات المالك" }} />
      <Tabs.Screen name="owner-overdue-units" options={{ ...hidden, title: "الوحدات المتأخرة" }} />
      <Tabs.Screen name="unit-overdue-payments" options={{ ...hidden, title: "دفعات الوحدة المتأخرة" }} />
      <Tabs.Screen name="edit-record" options={{ ...hidden, title: "تعديل" }} />
      <Tabs.Screen name="owner/[id]" options={{ ...hidden, title: "تفاصيل الأملاك" }} />
      <Tabs.Screen name="property/[id]" options={{ ...hidden, title: "تفاصيل العقار" }} />
      <Tabs.Screen name="unit/[id]" options={{ ...hidden, title: "تفاصيل الوحدة" }} />
      <Tabs.Screen name="unit-edit/[id]" options={{ ...hidden, title: "تعديل الوحدة" }} />
      <Tabs.Screen name="tenant/[id]" options={{ ...hidden, title: "تفاصيل المستأجر" }} />
      <Tabs.Screen name="contract/[id]" options={{ ...hidden, title: "تفاصيل العقد" }} />
      <Tabs.Screen name="payment/[id]" options={{ ...hidden, title: "الدفعات" }} />
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