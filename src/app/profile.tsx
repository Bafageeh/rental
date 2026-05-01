import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiPost } from "../lib/api";
import { colors, radii, spacing, typography } from "../constants/theme";

type PropertyItem = {
  id: number;
  name?: string | null;
  city?: string | null;
  district?: string | null;
  property_type?: string | null;
  units_count?: number;
  owner?: { id?: number; name?: string | null } | null;
};

type MePayload = {
  id?: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  owner_id?: number | null;
  owner?: { id?: number; name?: string | null } | null;
  is_admin?: boolean;
};

const propertyTypeLabels: Record<string, string> = {
  building: "عمارة",
  apartment: "شقة مستقلة",
  villa: "فيلا",
  land: "أرض",
  commercial: "تجاري",
  shop: "محل",
  office: "مكتب",
  mixed: "مختلط",
};

function propertyTypeText(value?: string | null) {
  if (!value) return "عقار";
  return propertyTypeLabels[value] || value;
}

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

export default function ProfileScreen() {
  const auth = useAuth();
  const [user, setUser] = useState<MePayload | null>(auth.user || null);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const displayUser = user || auth.user;
  const initials = useMemo(() => {
    const name = String(displayUser?.name || displayUser?.email || "م").trim();
    return name.slice(0, 1).toUpperCase();
  }, [displayUser?.name, displayUser?.email]);

  async function load(isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [meResult, propertiesResult] = await Promise.all([
        apiGet("/auth/me").catch(() => null),
        apiGet("/my/properties").catch(() => []),
      ]);

      const me = (meResult?.data ?? meResult?.user ?? meResult) as MePayload | null;
      const propertyList = Array.isArray(propertiesResult?.data)
        ? propertiesResult.data
        : Array.isArray(propertiesResult)
          ? propertiesResult
          : [];

      if (me) setUser(me);
      setProperties(propertyList as PropertyItem[]);
    } catch (e) {
      Alert.alert("تعذر التحميل", e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(false);
  }, []);

  async function changePassword() {
    if (!currentPassword.trim()) {
      Alert.alert("تنبيه", "أدخل الرقم السري الحالي.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("تنبيه", "الرقم السري الجديد يجب ألا يقل عن 6 أحرف.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("تنبيه", "تأكيد الرقم السري غير مطابق.");
      return;
    }

    try {
      setSaving(true);
      await apiPost("/auth/change-password", {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("تم", "تم تغيير الرقم السري بنجاح.");
    } catch (e) {
      Alert.alert("تعذر تغيير الرقم السري", e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>{displayUser?.name || "بروفايل الحساب"}</Text>
            <Text style={styles.heroSubtitle}>{valueOrDash(displayUser?.email)}</Text>
            <Text style={styles.roleBadge}>{roleText(displayUser?.role, Boolean(displayUser?.is_admin))}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>جاري تحميل البروفايل...</Text>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🔐</Text>
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionTitle}>تغيير الرقم السري</Text>
              <Text style={styles.sectionSubtitle}>يفضل استخدام رقم سري قوي وغير مستخدم سابقًا.</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>الرقم السري الحالي</Text>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            style={styles.input}
            placeholder="أدخل الرقم السري الحالي"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            textAlign="right"
          />

          <Text style={styles.fieldLabel}>الرقم السري الجديد</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            style={styles.input}
            placeholder="6 أحرف على الأقل"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            textAlign="right"
          />

          <Text style={styles.fieldLabel}>تأكيد الرقم السري الجديد</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={styles.input}
            placeholder="أعد كتابة الرقم السري الجديد"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            textAlign="right"
          />

          <TouchableOpacity style={[styles.saveButton, saving ? styles.disabled : null]} onPress={changePassword} disabled={saving} activeOpacity={0.88}>
            <Text style={styles.saveButtonText}>{saving ? "جاري الحفظ..." : "حفظ الرقم السري"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderCompact}>
            <Text style={styles.propertiesCount}>{properties.length.toLocaleString("ar-SA")}</Text>
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionTitle}>عقاراتي</Text>
              <Text style={styles.sectionSubtitle}>العقارات المتاحة لهذا الحساب حسب الصلاحية.</Text>
            </View>
          </View>

          {properties.length ? properties.map((property) => (
            <TouchableOpacity
              key={property.id}
              style={styles.propertyCard}
              activeOpacity={0.88}
              onPress={() => router.push(`/property/${property.id}` as any)}
            >
              <View style={styles.propertyTopRow}>
                <Text style={styles.propertyType}>{propertyTypeText(property.property_type)}</Text>
                <View style={styles.propertyTitleWrap}>
                  <Text style={styles.propertyName}>{property.name || `عقار #${property.id}`}</Text>
                  <Text style={styles.propertyMeta}>{[property.district, property.city].filter(Boolean).join("، ") || "لا يوجد موقع مسجل"}</Text>
                </View>
              </View>
              <View style={styles.propertyFooter}>
                <Text style={styles.propertyFooterText}>الوحدات: {valueOrDash(property.units_count)}</Text>
                <Text style={styles.propertyFooterText}>المالك: {property.owner?.name || displayUser?.name || "-"}</Text>
              </View>
            </TouchableOpacity>
          )) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>لا توجد عقارات</Text>
              <Text style={styles.emptyText}>لا توجد عقارات مرتبطة بهذا الحساب حاليًا.</Text>
            </View>
          )}
        </View>
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
  loadingBox: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  loadingText: { color: colors.textSecondary, marginTop: 8, fontWeight: "800" },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  sectionHeaderCompact: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  sectionIcon: { fontSize: 28 },
  sectionTitleWrap: { flex: 1, alignItems: "flex-end" },
  sectionTitle: { ...typography.bodyBold, color: colors.text, fontSize: 20, textAlign: "right" },
  sectionSubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: "right", marginTop: 4, lineHeight: 20 },
  fieldLabel: { color: colors.text, fontWeight: "900", textAlign: "right", marginBottom: 8, marginTop: 8 },
  input: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontWeight: "800",
    marginBottom: 6,
  },
  saveButton: {
    marginTop: spacing.md,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: { color: colors.textInverse, fontWeight: "900", fontSize: 16 },
  disabled: { opacity: 0.65 },
  propertiesCount: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    color: colors.primary,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 17,
    fontWeight: "900",
    overflow: "hidden",
    paddingTop: 10,
  },
  propertyCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  propertyTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  propertyType: {
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontWeight: "900",
    fontSize: 12,
  },
  propertyTitleWrap: { flex: 1, alignItems: "flex-end" },
  propertyName: { color: colors.text, fontSize: 17, fontWeight: "900", textAlign: "right" },
  propertyMeta: { color: colors.textSecondary, fontWeight: "800", textAlign: "right", marginTop: 4 },
  propertyFooter: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 12, gap: spacing.sm },
  propertyFooterText: { color: colors.textSecondary, fontWeight: "800", fontSize: 12 },
  emptyBox: { backgroundColor: colors.surfaceSubtle, borderRadius: 18, padding: spacing.lg, alignItems: "center" },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  emptyText: { color: colors.textSecondary, textAlign: "center", marginTop: 6, fontWeight: "800" },
});
