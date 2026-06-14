import { router } from "expo-router";
import { useMemo } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { apiPost } from "../lib/api";
import { resetNavigationHistory } from "../lib/navigationHistory";
import { colors, spacing, typography } from "../constants/theme";

function valueOrDash(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function roleText(role?: string | null, isAdmin?: boolean) {
  if (isAdmin) return "مدير";
  if (role === "owner") return "مالك";
  if (role === "manager") return "مدير تشغيل";
  if (role === "super_admin") return "مدير عام";
  return role || "مستخدم";
}

type ProfileAction = {
  icon: string;
  title: string;
  subtitle: string;
  path?: string;
  adminOnly?: boolean;
  managerOnly?: boolean;
  danger?: boolean;
  action?: "logout";
};

type ProfileSection = {
  title: string;
  subtitle: string;
  items: ProfileAction[];
};

const sections: ProfileSection[] = [
  {
    title: "الحساب",
    subtitle: "الخيارات الأساسية للحساب الحالي.",
    items: [
      { icon: "🔐", title: "تغيير الرقم السري", subtitle: "تحديث الرقم السري للحساب الحالي", path: "/profile-security" },
      { icon: "📊", title: "حسابي", subtitle: "ملخص بيانات وصلاحيات المستخدم", path: "/my-account" },
      { icon: "🏢", title: "عقاراتي", subtitle: "الشاشة الرسمية لعقارات الحساب الحالي", path: "/properties" },
      { icon: "🚪", title: "تسجيل الخروج", subtitle: "الخروج من الحساب الحالي", danger: true, action: "logout" },
    ],
  },
  {
    title: "محفظتي",
    subtitle: "روابط الوحدات والعقود حسب صلاحية الحساب.",
    items: [
      { icon: "🏠", title: "الوحدات", subtitle: "الوحدات المتاحة والمؤجرة", path: "/units" },
      { icon: "📄", title: "العقود", subtitle: "العقود النشطة والمنتهية", path: "/contracts" },
      { icon: "👥", title: "المستأجرون", subtitle: "بيانات المستأجرين وكشوفهم", path: "/tenants" },
      { icon: "🅿️", title: "المواقف", subtitle: "إدارة المواقف والرسوم", path: "/parking" },
      { icon: "👤", title: "الملاك", subtitle: "إدارة الملاك وربطهم بالعقارات", path: "/owners", adminOnly: true },
    ],
  },
  {
    title: "المالية والتقارير",
    subtitle: "التحصيل، المصروفات، والتقارير المالية.",
    items: [
      { icon: "💵", title: "الدفعات", subtitle: "المدفوع والمستحق والمتأخر", path: "/payments" },
      { icon: "🧾", title: "سندات القبض", subtitle: "إصدار ومراجعة السندات", path: "/payment-receipts" },
      { icon: "📉", title: "المصروفات", subtitle: "مصروفات التشغيل والصيانة", path: "/expenses" },
      { icon: "⚡", title: "فواتير الخدمات", subtitle: "الكهرباء والمياه والخدمات", path: "/utility-bills" },
      { icon: "📅", title: "التقرير الشهري", subtitle: "إيرادات ومصروفات الشهر", path: "/monthly-financial" },
      { icon: "📋", title: "كشف الإيجار", subtitle: "جدول الإيجارات والتحصيل", path: "/rent-roll" },
      { icon: "📖", title: "كشوف المستأجرين", subtitle: "كشف حساب المستأجرين", path: "/tenant-statements" },
      { icon: "💳", title: "تسويات الملاك", subtitle: "مستحقات وتحويلات الملاك", path: "/owner-payouts", adminOnly: true },
      { icon: "🔁", title: "التسويات", subtitle: "مطابقة الإيرادات والمصروفات", path: "/owner-settlements", adminOnly: true },
    ],
  },
  {
    title: "التشغيل والمتابعة",
    subtitle: "الإجراءات اليومية والملفات والتنبيهات.",
    items: [
      { icon: "➕", title: "إنشاء عقد", subtitle: "إضافة عقد جديد يدويًا", path: "/create-contract" },
      { icon: "🔄", title: "تجديد العقود", subtitle: "العقود القريبة من الانتهاء", path: "/contract-renewals" },
      { icon: "⏰", title: "التذكيرات", subtitle: "المواعيد والمهام", path: "/reminders" },
      { icon: "✅", title: "المتابعات", subtitle: "مهام تحتاج إجراء", path: "/follow-ups" },
      { icon: "🔔", title: "التنبيهات", subtitle: "تنبيهات النظام", path: "/alerts" },
      { icon: "💡", title: "تنبيهات ذكية", subtitle: "اقتراحات وملاحظات ذكية", path: "/smart-alerts" },
      { icon: "📣", title: "تسويق الوحدات", subtitle: "تجهيز الوحدة للتسويق", path: "/unit-marketing" },
      { icon: "🧰", title: "فحص الوحدات", subtitle: "توثيق الفحص والملاحظات", path: "/unit-inspections" },
      { icon: "💬", title: "مركز التواصل", subtitle: "رسائل وتواصل المستأجرين والملاك", path: "/communication-center" },
      { icon: "🛠️", title: "مقدمو الخدمة", subtitle: "الفنيون وشركات الصيانة", path: "/service-providers", managerOnly: true },
    ],
  },
  {
    title: "روابط المدير",
    subtitle: "تظهر فقط لحساب المدير.",
    items: [
      { icon: "🖼️", title: "الملفات والوسائط", subtitle: "صور وفيديوهات وملفات", path: "/files", adminOnly: true },
      { icon: "⚙️", title: "الإعدادات", subtitle: "إعدادات التطبيق العامة", path: "/settings", adminOnly: true },
      { icon: "🛡️", title: "إعدادات النظام", subtitle: "إعدادات إدارية للنظام", path: "/system-settings", adminOnly: true },
      { icon: "🔑", title: "حسابات المستخدمين", subtitle: "إدارة الصلاحيات والحسابات", path: "/user-accounts", adminOnly: true },
      { icon: "🏦", title: "حسابات الملاك", subtitle: "حسابات دخول الملاك", path: "/owner-accounts", adminOnly: true },
      { icon: "💳", title: "الحسابات البنكية", subtitle: "حسابات الملاك البنكية", path: "/owner-bank-accounts", adminOnly: true },
      { icon: "🩺", title: "صحة البيانات", subtitle: "فحص العلاقات والبيانات", path: "/data-health", adminOnly: true },
      { icon: "✏️", title: "مركز التعديل", subtitle: "تعديل وحذف سجلات النظام", path: "/edit-delete-center", adminOnly: true },
      { icon: "🗑️", title: "المحذوفات", subtitle: "مراجعة واستعادة المحذوفات", path: "/trash-center", adminOnly: true },
      { icon: "🔗", title: "مدير العلاقات", subtitle: "ربط وتنظيف العلاقات", path: "/relations-manager", adminOnly: true },
      { icon: "🕘", title: "آخر النشاطات", subtitle: "آخر العمليات على النظام", path: "/activity-feed", adminOnly: true },
      { icon: "📜", title: "سجل النشاط", subtitle: "سجل تدقيق مفصل", path: "/activity-logs", adminOnly: true },
    ],
  },
];

function ProfileButton({ item, onPress }: { item: ProfileAction; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.actionButton, item.danger ? styles.dangerButton : null]} activeOpacity={0.88} onPress={onPress}>
      <View style={[styles.actionIconBox, item.danger ? styles.dangerIconBox : null]}>
        <Text style={styles.actionIcon}>{item.icon}</Text>
      </View>
      <View style={styles.actionTextWrap}>
        <Text style={[styles.actionTitle, item.danger ? styles.dangerTitle : null]}>{item.title}</Text>
        <Text style={styles.actionSubtitle}>{item.subtitle}</Text>
      </View>
      <Text style={styles.actionArrow}>‹</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const auth = useAuth();
  const displayUser = auth.user;
  const role = String(displayUser?.role ?? "").trim().toLowerCase();

  const initials = useMemo(() => {
    const name = String(displayUser?.name || displayUser?.email || "م").trim();
    return name.slice(0, 1).toUpperCase();
  }, [displayUser?.name, displayUser?.email]);

  function openAction(item: ProfileAction) {
    if (item.action === "logout") {
      Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج من التطبيق؟", [
        { text: "إلغاء", style: "cancel" },
        {
          text: "خروج",
          style: "destructive",
          onPress: () => {
            apiPost("/auth/logout")
              .catch(() => undefined)
              .then(() => auth.logout())
              .then(() => {
                resetNavigationHistory();
                router.replace("/login" as any);
              });
          },
        },
      ]);
      return;
    }

    if (item.path) router.push(item.path as any);
  }

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.adminOnly && !auth.isAdmin) return false;
        if (item.managerOnly && role !== "manager") return false;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>{displayUser?.name || "بروفايل الحساب"}</Text>
            <Text style={styles.heroSubtitle}>{valueOrDash(displayUser?.email)}</Text>
            <Text style={styles.roleBadge}>{roleText(displayUser?.role, Boolean(displayUser?.is_admin || auth.isAdmin))}</Text>
          </View>
        </View>

        {visibleSections.map((section) => (
          <View key={section.title} style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
            {section.items.map((item) => (
              <ProfileButton key={`${section.title}-${item.title}`} item={item} onPress={() => openAction(item)} />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 110 },
  heroCard: {
    backgroundColor: "#111827",
    borderRadius: 26,
    padding: spacing.lg,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#065F46", fontSize: 30, fontWeight: "900" },
  heroTextWrap: { flex: 1, alignItems: "flex-end" },
  heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", textAlign: "right" },
  heroSubtitle: { color: "rgba(255,255,255,0.75)", marginTop: 5, fontWeight: "800", textAlign: "right" },
  roleBadge: {
    marginTop: 10,
    color: "#064E3B",
    backgroundColor: "#D1FAE5",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 5,
    fontWeight: "900",
  },
  actionsCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.bodyBold, color: colors.text, fontSize: 21, textAlign: "right" },
  sectionSubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: "right", marginTop: 5, marginBottom: spacing.md, lineHeight: 20 },
  actionButton: {
    minHeight: 78,
    borderRadius: 20,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  dangerButton: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  actionIconBox: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerIconBox: { backgroundColor: "#FEE2E2" },
  actionIcon: { fontSize: 24 },
  actionTextWrap: { flex: 1, alignItems: "flex-end" },
  actionTitle: { color: colors.text, fontSize: 17, fontWeight: "900", textAlign: "right" },
  dangerTitle: { color: "#B91C1C" },
  actionSubtitle: { color: colors.textSecondary, fontWeight: "800", textAlign: "right", marginTop: 5, lineHeight: 20 },
  actionArrow: { color: colors.textTertiary, fontSize: 28, fontWeight: "900" },
});
