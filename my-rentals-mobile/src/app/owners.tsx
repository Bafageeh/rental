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
  const [editingOwnerId, setEditingOwnerId] = useState<number | null>(null);
  const [openMenuOwnerId, setOpenMenuOwnerId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nationalId, setNationalId] = useState("");

  const canAccess = loggedIn && isAdmin;
  const visibleOwners = useMemo(() => items.filter((owner) => !isAdminLikeOwner(owner, user)), [items, user]);

  function resetForm() {
    setName("");
    setPhone("");
    setEmail("");
    setNationalId("");
    setEditingOwnerId(null);
  }

  function openAddOwnerForm() {
    setOpenMenuOwnerId(null);
    if (showForm && !editingOwnerId) {
      setShowForm(false);
      resetForm();
      return;
    }
    resetForm();
    setShowForm(true);
  }

  function openEditOwnerForm(owner: Owner) {
    setOpenMenuOwnerId(null);
    setEditingOwnerId(owner.id);
    setName(owner.name || "");
    setPhone(owner.phone || "");
    setEmail(owner.email || "");
    setNationalId(owner.national_id || "");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  function openOwnerDetails(owner: Owner) {
    setOpenMenuOwnerId(null);
    router.push(`/owner/${owner.id}` as never);
  }

  function openOwnerPayments(owner: Owner) {
    setOpenMenuOwnerId(null);
    const ownerName = encodeURIComponent(owner.name || "مالك");
    router.push(`/payments?owner_id=${owner.id}&owner_name=${ownerName}` as never);
  }

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
      const payload = { name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, national_id: nationalId.trim() || null };
      if (editingOwnerId) {
        await apiPost(`/edit-delete-center/owners/${editingOwnerId}/update`, payload);
      } else {
        await apiPost("/owners", payload);
      }
      closeForm();
      Alert.alert("تم", editingOwnerId ? "تم تعديل بيانات المالك بنجاح" : "تم إضافة المالك بنجاح");
      await load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ المالك");
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteOwner(owner: Owner) {
    setOpenMenuOwnerId(null);
    Alert.alert("حذف المالك", `هل تريد حذف ${owner.name || "هذا المالك"}؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await apiPost(`/edit-delete-center/owners/${owner.id}/delete`, {});
            Alert.alert("تم", "تم حذف المالك بنجاح");
            await load();
          } catch (e) {
            Alert.alert("تعذر الحذف", e instanceof Error ? e.message : "لا يمكن حذف المالك الآن");
          }
        },
      },
    ]);
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

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>تعذر تحميل الملاك</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.button} onPress={load} activeOpacity={0.85}><Text style={styles.buttonText}>إعادة المحاولة</Text></TouchableOpacity>
          </View>
        ) : null}

        {!error && visibleOwners.length === 0 ? <View style={styles.box}><Text style={styles.emptyText}>لا يوجد ملاك حاليًا</Text></View> : null}

        {visibleOwners.map((owner) => (
          <View key={owner.id} style={styles.card}>
            <TouchableOpacity style={styles.ownerMenuButton} activeOpacity={0.85} onPress={() => setOpenMenuOwnerId(openMenuOwnerId === owner.id ? null : owner.id)}>
              <Ionicons name="ellipsis-vertical" size={20} color="#0F172A" />
            </TouchableOpacity>
            {openMenuOwnerId === owner.id ? (
              <View style={styles.ownerMenu}>
                <TouchableOpacity style={styles.ownerMenuItem} activeOpacity={0.85} onPress={() => openEditOwnerForm(owner)}>
                  <Ionicons name="create-outline" size={18} color="#0F766E" />
                  <Text style={styles.ownerMenuText}>تعديل</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ownerMenuItem} activeOpacity={0.85} onPress={() => confirmDeleteOwner(owner)}>
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  <Text style={[styles.ownerMenuText, { color: "#DC2626" }]}>حذف</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ownerMenuItem} activeOpacity={0.85} onPress={() => openOwnerPayments(owner)}>
                  <Ionicons name="cash-outline" size={18} color="#0F766E" />
                  <Text style={styles.ownerMenuText}>الدفعات</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity activeOpacity={0.9} onPress={() => openOwnerDetails(owner)}>
              <View style={styles.cardTopRow}>
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
          </View>
        ))}
        <View style={{ height: 82 }} />
      </ScrollView>

      {showForm ? (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeForm} />
          <View style={styles.floatingFormCard}>
            <View style={styles.formHeader}>
              <TouchableOpacity style={styles.formCloseButton} activeOpacity={0.85} onPress={closeForm}>
                <Ionicons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
              <Text style={styles.formTitle}>{editingOwnerId ? "تعديل بيانات المالك" : "إضافة مالك جديد"}</Text>
            </View>
            <TextInput style={styles.input} placeholder="اسم المالك" value={name} onChangeText={setName} textAlign="right" />
            <TextInput style={styles.input} placeholder="رقم الجوال" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textAlign="right" />
            <TextInput style={styles.input} placeholder="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" textAlign="right" />
            <TextInput style={styles.input} placeholder="رقم الهوية / السجل" value={nationalId} onChangeText={setNationalId} keyboardType="number-pad" textAlign="right" />
            <TouchableOpacity style={styles.saveButton} onPress={saveOwner} disabled={saving} activeOpacity={0.85}>
              <Text style={styles.saveButtonText}>{saving ? "جاري الحفظ..." : editingOwnerId ? "حفظ التعديل" : "حفظ المالك"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <TouchableOpacity style={[styles.floatingAddButton, showForm ? styles.floatingCloseButton : null]} activeOpacity={0.88} onPress={showForm ? closeForm : openAddOwnerForm}>
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
  floatingAddButton: { position: "absolute", left: 18, bottom: 22, width: 58, height: 58, borderRadius: 29, backgroundColor: "#0F766E", alignItems: "center", justifyContent: "center", shadowColor: "#0F172A", shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 10, zIndex: 60 },
  floatingCloseButton: { backgroundColor: "#7f1d1d" },
  modalOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, justifyContent: "center", paddingHorizontal: 18 },
  modalBackdrop: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.32)" },
  floatingFormCard: { backgroundColor: "#ffffff", borderRadius: 26, padding: 16, borderWidth: 1, borderColor: "#EDECE9", shadowColor: "#0F172A", shadowOpacity: 0.22, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 16 },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  formCloseButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  formTitle: { fontSize: 18, fontWeight: "900", color: "#111827", textAlign: "right" },
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
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#EDECE9", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 1, position: "relative" },
  ownerMenuButton: { position: "absolute", left: 12, top: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center", zIndex: 12 },
  ownerMenu: { position: "absolute", left: 12, top: 52, width: 132, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", paddingVertical: 5, zIndex: 20, shadowColor: "#0F172A", shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  ownerMenuItem: { minHeight: 39, flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 8, paddingHorizontal: 12 },
  ownerMenuText: { color: "#0F172A", fontWeight: "900", fontSize: 12, textAlign: "right" },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, paddingLeft: 38 },
  titleWrap: { flex: 1, alignItems: "flex-end" },
  cardTitle: { fontSize: 19, fontWeight: "900", color: "#111827", textAlign: "right" },
  cardSub: { color: "#64748B", fontWeight: "800", fontSize: 12, marginTop: 4, textAlign: "right" },
  metricsRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 10 },
  metricPill: { flex: 1, backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#EDECE9", borderRadius: 18, paddingVertical: 10, alignItems: "center" },
  metricValue: { color: "#111827", fontWeight: "900", fontSize: 19 },
  metricLabel: { color: "#6B7280", fontWeight: "800", fontSize: 12, marginTop: 2 },
  infoBox: { backgroundColor: "#FAFAF9", borderRadius: 16, padding: 10, gap: 4 },
  detail: { color: "#5E5B55", textAlign: "right", fontWeight: "700", lineHeight: 21 },
});