import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGetScoped, apiPost } from "../lib/api";

type Owner = { id: number; name?: string | null; phone?: string | null; email?: string | null };
type UserAccount = {
  id: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
  is_active?: boolean;
  last_login_at?: string | null;
  notes?: string | null;
};

function roleLabel(value?: string | null) {
  if (value === "admin" || value === "super_admin") return "أدمن عام";
  if (value === "manager") return "مدير عقارات";
  if (value === "owner") return "مالك";
  return value || "-";
}

function roleDescription(value?: string | null) {
  if (value === "admin" || value === "super_admin") return "يرى كل البيانات ويدير النظام بالكامل";
  if (value === "manager") return "يدير ملاكه وعقاراته ومستأجريه فقط";
  if (value === "owner") return "يرى عقارات المالك المرتبط فقط";
  return "";
}

export default function UserAccountsScreen() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("12345678");
  const [role, setRole] = useState("owner");
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  async function load() {
    try {
      setLoading(true);
      const [usersResult, ownersResult] = await Promise.all([
        apiGetScoped("/user-accounts", "/my/user-accounts"),
        apiGetScoped("/owners", "/my/owners"),
      ]);
      const ownerList = Array.isArray(ownersResult) ? ownersResult : [];
      setUsers(Array.isArray(usersResult) ? usersResult : []);
      setOwners(ownerList);
      if (!ownerId && ownerList.length > 0) setOwnerId(ownerList[0].id);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل حسابات المستخدمين");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("12345678");
    setRole("owner");
    setOwnerId(owners.length > 0 ? owners[0].id : null);
    setNotes("");
  }

  function closeForm() {
    if (saving) return;
    resetForm();
    setShowForm(false);
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(user: UserAccount) {
    setEditingUser(user);
    setName(user.name || "");
    setEmail(user.email || "");
    setPassword("");
    setRole(user.role || "owner");
    setOwnerId(user.owner_id || null);
    setNotes(user.notes || "");
    setShowForm(true);
  }

  async function saveUser() {
    if (!name.trim()) return Alert.alert("تنبيه", "اكتب اسم المستخدم");
    if (!email.trim()) return Alert.alert("تنبيه", "اكتب البريد الإلكتروني");
    if (!editingUser && !password.trim()) return Alert.alert("تنبيه", "اكتب كلمة المرور");
    if (role === "owner" && !ownerId) return Alert.alert("تنبيه", "حساب المالك يجب ربطه بمالك");

    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        role,
        owner_id: role === "owner" ? ownerId : ownerId || null,
        is_active: true,
        notes: notes.trim() || null,
      };
      if (password.trim()) payload.password = password.trim();
      if (editingUser) await apiPost(`/user-accounts/${editingUser.id}/update`, payload);
      else await apiPost("/user-accounts", payload);
      Alert.alert("تم", editingUser ? "تم تحديث الحساب" : "تم إنشاء الحساب");
      resetForm();
      setShowForm(false);
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ حساب المستخدم");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: UserAccount) {
    try {
      await apiPost(`/user-accounts/${user.id}/toggle-active`);
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تغيير حالة الحساب");
    }
  }

  async function resetPassword(user: UserAccount) {
    Alert.alert("تأكيد", `سيتم تغيير كلمة مرور ${user.name || user.email} إلى 12345678`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تغيير",
        style: "destructive",
        onPress: async () => {
          try {
            await apiPost(`/user-accounts/${user.id}/reset-password`, { password: "12345678" });
            Alert.alert("تم", "تم تغيير كلمة المرور إلى 12345678");
          } catch (e) {
            Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تغيير كلمة المرور");
          }
        },
      },
    ]);
  }

  async function refreshScreen() {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const admins = users.filter((user) => ["admin", "super_admin", "manager"].includes(String(user.role || "")));
  const ownerUsers = users.filter((user) => user.role === "owner");
  const inactive = users.filter((user) => !user.is_active);
  const roleOptions = [
    { value: "owner", label: "مالك" },
    { value: "manager", label: "مدير عقارات" },
    { value: "admin", label: "أدمن عام" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}>
        <Text style={styles.title}>إدارة المستخدمين</Text>
        <Text style={styles.subtitle}>إنشاء الحسابات وربطها بالصلاحيات المناسبة</Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>إجمالي الحسابات: {users.length}</Text>
          <Text style={styles.summaryText}>حسابات الملاك: {ownerUsers.length}</Text>
          <Text style={styles.summaryText}>حسابات الإدارة: {admins.length}</Text>
          <Text style={styles.summaryText}>معطلة: {inactive.length}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={startCreate} activeOpacity={0.88}>
          <Text style={styles.primaryButtonText}>إضافة حساب مستخدم</Text>
        </TouchableOpacity>

        {loading ? <View style={styles.box}><ActivityIndicator /><Text style={styles.boxText}>جاري تحميل الحسابات...</Text></View> : null}
        {!loading && users.length === 0 ? <View style={styles.box}><Text style={styles.emptyText}>لا توجد حسابات مستخدمين حاليًا</Text></View> : null}

        {users.map((user) => (
          <View key={user.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[styles.statusBadge, user.is_active ? styles.activeBadge : styles.inactiveBadge]}>{user.is_active ? "مفعل" : "معطل"}</Text>
              <Text style={styles.cardTitle}>{user.name || "مستخدم"}</Text>
            </View>
            <Text style={styles.detail}>البريد: {user.email || "-"}</Text>
            <Text style={styles.detail}>الصلاحية: {roleLabel(user.role)}</Text>
            <Text style={styles.detail}>المالك المرتبط: {user.owner_name || "-"}</Text>
            <Text style={styles.detail}>آخر دخول: {user.last_login_at || "-"}</Text>
            {user.notes ? <Text style={styles.notes}>ملاحظات: {user.notes}</Text> : null}
            <View style={styles.itemActionsRow}>
              <TouchableOpacity style={[styles.itemButton, styles.editButton]} onPress={() => startEdit(user)} activeOpacity={0.85}><Text style={styles.itemButtonText}>تعديل</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.itemButton, styles.passwordButton]} onPress={() => resetPassword(user)} activeOpacity={0.85}><Text style={styles.itemButtonText}>كلمة</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.itemButton, user.is_active ? styles.disableButton : styles.enableButton]} onPress={() => toggleActive(user)} activeOpacity={0.85}><Text style={styles.itemButtonText}>{user.is_active ? "تعطيل" : "تفعيل"}</Text></TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.helpBox}>
          <Text style={styles.helpTitle}>ملاحظة مهمة</Text>
          <Text style={styles.helpText}>حساب مدير العقارات يدير بياناته الخاصة فقط، والأدمن العام يطلع على كل شيء.</Text>
        </View>
      </ScrollView>

      <Modal visible={showForm} transparent animationType="fade" onRequestClose={closeForm} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalRoot}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeForm} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.closeCircle} onPress={closeForm} activeOpacity={0.85}><Text style={styles.closeText}>×</Text></TouchableOpacity>
              <Text style={styles.formTitle}>{editingUser ? "تعديل حساب" : "حساب جديد"}</Text>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput style={styles.input} placeholder="اسم المستخدم" value={name} onChangeText={setName} textAlign="right" />
              <TextInput style={styles.input} placeholder="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" textAlign="right" />
              <TextInput style={styles.input} placeholder={editingUser ? "كلمة مرور جديدة اختياري" : "كلمة المرور"} value={password} onChangeText={setPassword} secureTextEntry textAlign="right" />
              <Text style={styles.label}>الدور / الصلاحية</Text>
              <View style={styles.chips}>{roleOptions.map((option) => <TouchableOpacity key={option.value} style={[styles.chip, role === option.value ? styles.chipActive : null]} onPress={() => setRole(option.value)}><Text style={[styles.chipText, role === option.value ? styles.chipTextActive : null]}>{option.label}</Text></TouchableOpacity>)}</View>
              <Text style={styles.roleHint}>{roleDescription(role)}</Text>
              <Text style={styles.label}>ربط الحساب بمالك</Text>
              <View style={styles.chips}>
                <TouchableOpacity style={[styles.chip, ownerId === null ? styles.chipActive : null]} onPress={() => setOwnerId(null)}><Text style={[styles.chipText, ownerId === null ? styles.chipTextActive : null]}>بدون مالك</Text></TouchableOpacity>
                {owners.map((owner) => <TouchableOpacity key={owner.id} style={[styles.chip, ownerId === owner.id ? styles.chipActive : null]} onPress={() => setOwnerId(owner.id)}><Text style={[styles.chipText, ownerId === owner.id ? styles.chipTextActive : null]}>{owner.name || `مالك #${owner.id}`}</Text></TouchableOpacity>)}
              </View>
              <TextInput style={[styles.input, styles.multilineInput]} placeholder="ملاحظات" value={notes} onChangeText={setNotes} multiline textAlign="right" />
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={closeForm} disabled={saving}><Text style={styles.actionText}>إلغاء</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.saveButton, saving ? styles.disabledButton : null]} onPress={saveUser} disabled={saving}><Text style={styles.actionText}>{saving ? "جاري الحفظ..." : "حفظ"}</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 18, paddingBottom: 50 },
  title: { fontSize: 30, fontWeight: "900", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", fontSize: 15, textAlign: "right", lineHeight: 22 },
  summaryBox: { backgroundColor: "#111827", borderRadius: 18, padding: 16, marginBottom: 14 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  primaryButton: { backgroundColor: "#0F9B6F", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  primaryButtonText: { color: "#fff", fontWeight: "900" },
  modalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 18, paddingVertical: 28 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.5)" },
  modalCard: { maxHeight: "88%", backgroundColor: "#fff", borderRadius: 24, padding: 16, shadowColor: "#0F172A", shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  closeCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#111827", fontSize: 28, lineHeight: 30, fontWeight: "900" },
  modalContent: { paddingBottom: 8 },
  formTitle: { fontSize: 23, fontWeight: "900", color: "#111827", textAlign: "right", flex: 1 },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  multilineInput: { minHeight: 70, textAlignVertical: "top" },
  label: { color: "#374151", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 10 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "800" },
  chipTextActive: { color: "#fff" },
  roleHint: { color: "#7A766F", textAlign: "right", marginBottom: 12 },
  actionsRow: { flexDirection: "row-reverse", marginTop: 8, gap: 8 },
  actionButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: "center" },
  cancelButton: { backgroundColor: "#7A766F" },
  saveButton: { backgroundColor: "#16a34a" },
  disabledButton: { opacity: 0.65 },
  actionText: { color: "#fff", fontWeight: "900" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  activeBadge: { backgroundColor: "#dcfce7", color: "#166534" },
  inactiveBadge: { backgroundColor: "#fee2e2", color: "#991b1b" },
  cardTitle: { fontSize: 20, fontWeight: "900", color: "#111827", textAlign: "right", flex: 1 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  notes: { marginTop: 10, color: "#92400e", fontWeight: "700", textAlign: "right" },
  itemActionsRow: { flexDirection: "row-reverse", marginTop: 14, gap: 8 },
  itemButton: { flex: 1, padding: 11, borderRadius: 12, alignItems: "center" },
  editButton: { backgroundColor: "#0F9B6F" },
  passwordButton: { backgroundColor: "#111827" },
  disableButton: { backgroundColor: "#dc2626" },
  enableButton: { backgroundColor: "#16a34a" },
  itemButtonText: { color: "#fff", fontWeight: "900" },
  helpBox: { backgroundColor: "#fffbeb", borderRadius: 18, padding: 14, marginTop: 4 },
  helpTitle: { color: "#92400e", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  helpText: { color: "#92400e", fontWeight: "700", textAlign: "right", lineHeight: 22 },
});
