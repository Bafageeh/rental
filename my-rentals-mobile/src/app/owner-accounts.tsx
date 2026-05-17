import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGet, apiPost } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type Owner = {
  id: number;
  name?: string | null;
  type?: string | null;
  national_id?: string | null;
};

type OwnerAccount = {
  id: number;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
  status?: string | null;
};

function normalizeNationalId(value?: string | null) {
  return String(value || "")
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[^0-9A-Za-z]/g, "")
    .trim();
}

export default function OwnerAccountsScreen() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [users, setUsers] = useState<OwnerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const result = await apiGet("/owner-accounts");
      const ownersResult = await apiGet("/owners").catch(() => null);
      const ownerList = Array.isArray(ownersResult) ? ownersResult : Array.isArray(result?.owners) ? result.owners : [];

      setOwners(ownerList);
      setUsers(Array.isArray(result?.users) ? result.users : []);

      if (!ownerId && ownerList.length > 0) {
        const firstExternal = ownerList.find((owner: Owner) => owner.type !== "self");
        setOwnerId(firstExternal?.id || ownerList[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير معروف");
    } finally {
      setLoading(false);
    }
  }

  async function saveAccount() {
    if (!ownerId) {
      Alert.alert("تنبيه", "اختر المالك");
      return;
    }

    const selectedOwner = owners.find((owner) => owner.id === ownerId) || null;
    const loginId = normalizeNationalId(selectedOwner?.national_id);

    if (!loginId) {
      Alert.alert("تنبيه", "لا يمكن إنشاء الحساب قبل تسجيل رقم الهوية في بطاقة المالك.");
      return;
    }

    if (!password.trim() || password.trim().length < 6) {
      Alert.alert("تنبيه", "الرقم السري لا يقل عن 6 أحرف");
      return;
    }

    try {
      setSaving(true);

      await apiPost("/owner-accounts", {
        owner_id: ownerId,
        name: name.trim() || selectedOwner?.name || "مالك",
        email: email.trim() || `owner-${ownerId}@my-rentals.local`,
        username: loginId,
        password: password.trim(),
      });

      setName("");
      setEmail("");
      setPassword("");
      setShowForm(false);

      Alert.alert("تم", "تم إنشاء حساب المالك. الدخول يكون برقم الهوية والرقم السري.");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر إنشاء الحساب");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(userId: number) {
    try {
      setUpdatingId(userId);
      const result = await apiPost(`/owner-accounts/${userId}/toggle-status`);
      Alert.alert("تم", result.message || "تم تحديث الحساب");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحديث الحساب");
    } finally {
      setUpdatingId(null);
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

  useEffect(() => {
    load();
  }, []);

  const selectedOwner = owners.find((owner) => owner.id === ownerId) || null;
  const selectedLoginId = normalizeNationalId(selectedOwner?.national_id);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>حسابات الملاك</Text>
        <Text style={styles.subtitle}>إنشاء حساب خاص لكل مالك، ويكون دخوله برقم الهوية والرقم السري.</Text>

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>حساب المالك يعرض له أملاكه وحساباته فقط. رقم الهوية يؤخذ من بيانات المالك، لذلك يجب تعبئته قبل إنشاء الحساب.</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setShowForm(!showForm)}>
          <Text style={styles.primaryButtonText}>{showForm ? "إغلاق نموذج الإضافة" : "إضافة حساب مالك"}</Text>
        </TouchableOpacity>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>بيانات حساب المالك</Text>

            <Text style={styles.label}>اختر المالك</Text>
            <View style={styles.chips}>
              {owners.map((owner) => (
                <TouchableOpacity key={owner.id} style={[styles.chip, ownerId === owner.id ? styles.chipActive : null]} onPress={() => setOwnerId(owner.id)}>
                  <Text style={[styles.chipText, ownerId === owner.id ? styles.chipTextActive : null]}>{owner.name || "مالك"}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.loginBox, !selectedLoginId ? styles.loginBoxDanger : null]}>
              <Text style={styles.loginLabel}>رقم الهوية للدخول</Text>
              <Text style={styles.loginValue}>{selectedLoginId || "غير مسجل في بيانات المالك"}</Text>
            </View>

            <TextInput style={styles.input} placeholder="اسم الحساب اختياري" value={name} onChangeText={setName} textAlign="right" />

            <TextInput style={styles.input} placeholder="البريد الإلكتروني اختياري" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" textAlign="right" />

            <TextInput style={styles.input} placeholder="الرقم السري" value={password} onChangeText={setPassword} secureTextEntry textAlign="right" />

            <TouchableOpacity style={styles.saveButton} onPress={saveAccount} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? "جاري الحفظ..." : "حفظ الحساب"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.box}><ActivityIndicator /><Text style={styles.boxText}>جاري تحميل الحسابات...</Text></View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>تعذر تحميل الحسابات</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.button} onPress={load}><Text style={styles.buttonText}>إعادة المحاولة</Text></TouchableOpacity>
          </View>
        ) : null}

        {!loading && !error && users.length === 0 ? (
          <View style={styles.box}><Text style={styles.emptyText}>لا توجد حسابات حاليًا</Text></View>
        ) : null}

        {users.map((user) => (
          <View key={user.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.badge}>{user.role === "owner" ? "مالك" : "مدير"}</Text>
              <Text style={styles.cardTitle}>{user.name || "مستخدم"}</Text>
            </View>

            <Text style={styles.detail}>رقم الدخول: {user.username || "-"}</Text>
            <Text style={styles.detail}>البريد: {user.email?.includes("@my-rentals.local") ? "-" : user.email || "-"}</Text>
            <Text style={styles.detail}>المالك المرتبط: {user.owner_name || "-"}</Text>
            <Text style={styles.detail}>الحالة: {user.status === "disabled" ? "معطل" : "نشط"}</Text>

            <TouchableOpacity style={[styles.statusButton, user.status === "disabled" ? styles.activateButton : styles.disableButton]} onPress={() => toggleStatus(user.id)} disabled={updatingId === user.id}>
              <Text style={styles.statusButtonText}>{updatingId === user.id ? "..." : user.status === "disabled" ? "تفعيل الحساب" : "تعطيل الحساب"}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 18, paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: "800", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 14, fontSize: 15, color: "#7A766F", textAlign: "right" },
  warningBox: { backgroundColor: "#fffbeb", borderRadius: 14, padding: 12, marginBottom: 14 },
  warningText: { color: "#92400e", lineHeight: 22, textAlign: "right", fontWeight: "700" },
  primaryButton: { backgroundColor: "#111827", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  formCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14 },
  formTitle: { fontSize: 19, fontWeight: "800", color: "#111827", textAlign: "right", marginBottom: 12 },
  label: { color: "#374151", fontWeight: "800", textAlign: "right", marginBottom: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 12 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  loginBox: { backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0", borderRadius: 14, padding: 12, marginBottom: 10, alignItems: "flex-end" },
  loginBoxDanger: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  loginLabel: { color: "#64748B", fontWeight: "800", fontSize: 12 },
  loginValue: { color: "#111827", fontWeight: "900", fontSize: 18, marginTop: 4 },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  saveButton: { backgroundColor: "#16a34a", padding: 13, borderRadius: 12, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "800" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  errorBox: { backgroundColor: "#fee2e2", padding: 16, borderRadius: 18, marginBottom: 14 },
  errorTitle: { color: "#991b1b", fontSize: 18, fontWeight: "800", textAlign: "right" },
  errorText: { color: "#7f1d1d", marginTop: 8, textAlign: "right" },
  button: { marginTop: 14, backgroundColor: "#111827", padding: 12, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "800" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  badge: { backgroundColor: "#e0f2fe", color: "#075985", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  cardTitle: { fontSize: 19, fontWeight: "800", color: "#111827", textAlign: "right", flex: 1 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  statusButton: { marginTop: 14, padding: 12, borderRadius: 12, alignItems: "center" },
  activateButton: { backgroundColor: "#16a34a" },
  disableButton: { backgroundColor: "#dc2626" },
  statusButtonText: { color: "#fff", fontWeight: "800" },
});
