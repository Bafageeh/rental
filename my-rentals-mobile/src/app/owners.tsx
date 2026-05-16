import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiPost } from "../lib/api";

type Owner = {
  id: number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  national_id?: string | null;
  type?: string | null;
  properties_count?: number;
  units_count?: number;
  contracts_count?: number;
};

function valueOrDash(value?: string | null) {
  return value && String(value).trim() ? value : "-";
}

function normalize(value?: string | number | null) {
  return String(value ?? "").trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي");
}

function isAdminLikeOwner(owner: Owner, user: any) {
  const type = normalize(owner.type);
  const ownerName = normalize(owner.name);
  const ownerEmail = normalize(owner.email);
  const userEmail = normalize(user?.email);
  const userOwnerId = Number(user?.owner_id ?? 0);

  return (
    type === "self" ||
    type === "admin" ||
    type === "manager" ||
    (userOwnerId > 0 && owner.id === userOwnerId) ||
    (ownerEmail && userEmail && ownerEmail === userEmail) ||
    ownerName.includes("احمد") ||
    ownerName.includes("ahmed") ||
    ownerName.includes("الادمن") ||
    ownerName.includes("admin")
  );
}

export default function OwnersScreen() {
  const { loading: authLoading, loggedIn, isAdmin, user } = useAuth();
  const [items, setItems] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nationalId, setNationalId] = useState("");

  const canAccess = loggedIn && isAdmin;
  const visibleOwners = useMemo(() => items.filter((owner) => !isAdminLikeOwner(owner, user)), [items, user]);

  async function load() {
    if (!canAccess) return;
    try {
      setLoading(true);
      setError("");
      const result = await apiGet("/owners");
      const list = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
      setItems(list as Owner[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير معروف");
    } finally {
      setLoading(false);
    }
  }

  async function refreshScreen() {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function saveOwner() {
    if (!canAccess) return;
    if (!name.trim()) {
      Alert.alert("تنبيه", "اكتب اسم المالك");
      return;
    }
    try {
      setSaving(true);
      await apiPost("/owners", { name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, national_id: nationalId.trim() || null });
      setName(""); setPhone(""); setEmail(""); setNationalId(""); setShowForm(false);
      Alert.alert("تم", "تم إضافة المالك بنجاح");
      await load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ المالك");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!canAccess) {
      setLoading(false);
      router.replace("/more" as any);
      return;
    }
    void load();
  }, [authLoading, canAccess]);

  if (authLoading || loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.centerBox}><ActivityIndicator /><Text style={styles.boxText}>جاري تحميل الملاك...</Text></View></SafeAreaView>;
  }

  if (!canAccess) {
    return <SafeAreaView style={styles.safe}><View style={styles.centerBox}><Text style={styles.errorTitle}>غير مصرح</Text><Text style={styles.boxText}>تبويب الملاك متاح للمدير فقط.</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>الملاك</Text>
          <Text style={styles.heroSubtitle}>قائمة ملاك العملاء فقط. لا يظهر حساب المدير هنا كمالك.</Text>
          <Text style={styles.heroBadge}>{visibleOwners.length.toLocaleString("ar-SA")} مالك</Text>
        </View>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>بيانات المالك</Text>
            <TextInput style={styles.input} placeholder="اسم المالك" value={name} onChangeText={setName} textAlign="right" />
            <TextInput style={styles.input} placeholder="رقم الجوال" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textAlign="right" />
            <TextInput style={styles.input} placeholder="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" textAlign="right" />
            <TextInput style={styles.input} placeholder="رقم الهوية / السجل" value={nationalId} onChangeText={setNationalId} keyboardType="number-pad" textAlign="right" />
            <TouchableOpacity style={styles.saveButton} onPress={saveOwner} disabled={saving} activeOpacity={0.85}><Text style={styles.saveButtonText}>{saving ? "جاري الحفظ..." : "حفظ المالك"}</Text></TouchableOpacity>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>تعذر تحميل الملاك</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.button} onPress={load} activeOpacity={0.85}><Text style={styles.buttonText}>إعادة المحاولة</Text></TouchableOpacity>
          </View>
        ) : null}

        {!error && visibleOwners.length === 0 ? <View style={styles.box}><Text style={styles.emptyText}>لا يوجد ملاك حاليًا</Text></View> : null}

        {visibleOwners.map((owner) => (
          <TouchableOpacity key={owner.id} style={styles.card} activeOpacity={0.9} onPress={() => router.push(`/owner/${owner.id}` as never)}>
            <View style={styles.cardTopRow}>
              <Text style={styles.badge}>مالك</Text>
              <View style={styles.titleWrap}>
                <Text numberOfLines={2} style={styles.cardTitle}>{owner.name || "مالك بدون اسم"}</Text>
                <Text style={styles.cardSub}>اضغط لفتح عقارات ووحدات هذا المالك</Text>
              </View>
            </View>
            <View style={styles.metricsRow}>
              <View style={styles.metricPill}><Text style={styles.metricValue}>{owner.properties_count ?? 0}</Text><Text style={styles.metricLabel}>عقار</Text></View>
              <View style={styles.metricPill}><Text style={styles.metricValue}>{owner.units_count ?? 0}</Text><Text style={styles.metricLabel}>وحدة</Text></View>
              <View style={styles.metricPill}><Text style={styles.metricValue}>{owner.contracts_count ?? 0}</Text><Text style={styles.metricLabel}>عقد</Text></View>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.detail}>الجوال: {valueOrDash(owner.phone)}</Text>
              <Text style={styles.detail}>البريد: {valueOrDash(owner.email)}</Text>
              <Text style={styles.detail}>رقم الهوية: {valueOrDash(owner.national_id)}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 82 }} />
      </ScrollView>
      <TouchableOpacity style={[styles.floatingAddButton, showForm ? styles.floatingCloseButton : null]} activeOpacity={0.88} onPress={() => setShowForm(!showForm)}>
        <Ionicons name={showForm ? "close" : "add"} size={30} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 14, paddingBottom: 44 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  boxText: { marginTop: 8, color: "#5E5B55", fontWeight: "700", textAlign: "center" },
  hero: { backgroundColor: "#111827", borderRadius: 28, padding: 18, marginBottom: 12, alignItems: "flex-end" },
  heroTitle: { color: "#fff", fontSize: 30, fontWeight: "900", textAlign: "right" },
  heroSubtitle: { color: "#CBD5E1", marginTop: 8, fontWeight: "800", textAlign: "right", lineHeight: 22 },
  heroBadge: { marginTop: 12, backgroundColor: "#D1FAE5", color: "#064E3B", borderRadius: 999, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 6, fontWeight: "900" },
  floatingAddButton: { position: "absolute", left: 18, bottom: 82, width: 58, height: 58, borderRadius: 29, backgroundColor: "#0F766E", alignItems: "center", justifyContent: "center", shadowColor: "#0F172A", shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 10, zIndex: 30 },
  floatingCloseButton: { backgroundColor: "#7f1d1d" },
  formCard: { backgroundColor: "#ffffff", borderRadius: 22, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#EDECE9" },
  formTitle: { fontSize: 17, fontWeight: "900", color: "#111827", textAlign: "right", marginBottom: 10 },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 14, padding: 12, marginBottom: 10, color: "#111827" },
  saveButton: { backgroundColor: "#16a34a", padding: 13, borderRadius: 14, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "900" },
  box: { backgroundColor: "#fff", padding: 16, borderRadius: 20, alignItems: "center", marginBottom: 8 },
  emptyText: { color: "#7A766F", fontWeight: "800" },
  errorBox: { backgroundColor: "#fee2e2", padding: 14, borderRadius: 20, marginBottom: 10 },
  errorTitle: { color: "#991b1b", fontSize: 16, fontWeight: "900", textAlign: "right" },
  errorText: { color: "#7f1d1d", marginTop: 8, textAlign: "right" },
  button: { marginTop: 14, backgroundColor: "#111827", padding: 12, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "900" },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#EDECE9", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  titleWrap: { flex: 1, alignItems: "flex-end" },
  badge: { backgroundColor: "#E0F2FE", color: "#075985", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: "hidden", fontWeight: "900", fontSize: 12 },
  cardTitle: { fontSize: 19, fontWeight: "900", color: "#111827", textAlign: "right" },
  cardSub: { color: "#64748B", fontWeight: "800", fontSize: 12, marginTop: 4, textAlign: "right" },
  metricsRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 10 },
  metricPill: { flex: 1, backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#EDECE9", borderRadius: 18, paddingVertical: 10, alignItems: "center" },
  metricValue: { color: "#111827", fontWeight: "900", fontSize: 19 },
  metricLabel: { color: "#6B7280", fontWeight: "800", fontSize: 12, marginTop: 2 },
  infoBox: { backgroundColor: "#FAFAF9", borderRadius: 16, padding: 10, gap: 4 },
  detail: { color: "#5E5B55", textAlign: "right", fontWeight: "700", lineHeight: 21 },
});