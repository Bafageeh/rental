import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
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

function normalizeRole(value?: string | null) {
  const role = String(value || "").trim().toLowerCase();
  return role === "super_admin" ? "admin" : role;
}

function roleLabel(value?: string | null) {
  const role = normalizeRole(value);
  if (role === "admin") return "أدمن عام";
  if (role === "manager") return "مدير عقارات";
  if (role === "owner") return "مالك";
  return value || "-";
}

function roleDescription(value?: string | null) {
  const role = normalizeRole(value);
  if (role === "admin") return "يرى كل البيانات ويدير النظام بالكامل";
  if (role === "manager") return "يدير ملاكه وعقاراته ومستأجريه فقط";
  if (role === "owner") return "يرى عقارات المالك المرتبط فقط";
  return "";
}

function contains(value: unknown, term: string) {
  return String(value || "").toLowerCase().includes(term);
}

export default function UserAccountsScreen() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "manager" | "owner" | "inactive">("all");
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
  const filterOptions = [
    { value: "all", label: "الكل", icon: "apps-outline" },
    { value: "admin", label: "أدمن", icon: "shield-checkmark-outline" },
    { value: "manager", label: "مدير عقارات", icon: "business-outline" },
    { value: "owner", label: "مالك", icon: "person-outline" },
    { value: "inactive", label: "معطل", icon: "ban-outline" },
  ] as const;

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const userRole = normalizeRole(user.role);
      if (roleFilter === "inactive" && user.is_active) return false;
      if (roleFilter !== "all" && roleFilter !== "inactive" && userRole !== roleFilter) return false;
      if (!term) return true;
      return contains(user.name, term) || contains(user.email, term) || contains(user.owner_name, term) || contains(user.notes, term) || contains(roleLabel(user.role), term);
    });
  }, [users, roleFilter, searchTerm]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconTopButton} onPress={() => setSearchOpen((value) => !value)} activeOpacity={0.85}>
            <Ionicons name={searchOpen ? "close-outline" : "search-outline"} size={23} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>إدارة المستخدمين</Text>
            <Text style={styles.subtitle}>إنشاء الحسابات وربطها بالصلاحيات المناسبة</Text>
          </View>
          <TouchableOpacity style={[styles.iconTopButton, styles.addTopButton]} onPress={startCreate} activeOpacity={0.85}>
            <Ionicons name="add" size={25} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}><Text style={styles.summaryValue}>{users.length}</Text><Text style={styles.summaryLabel}>كل الحسابات</Text></View>
          <View style={styles.summaryItem}><Text style={styles.summaryValue}>{admins.length}</Text><Text style={styles.summaryLabel}>إدارة</Text></View>
          <View style={styles.summaryItem}><Text style={styles.summaryValue}>{ownerUsers.length}</Text><Text style={styles.summaryLabel}>ملاك</Text></View>
          <View style={styles.summaryItem}><Text style={styles.summaryValue}>{inactive.length}</Text><Text style={styles.summaryLabel}>معطلة</Text></View>
        </View>

        {searchOpen ? (
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث بالاسم أو البريد أو المالك أو الصلاحية"
              value={searchTerm}
              onChangeText={setSearchTerm}
              textAlign="right"
              autoFocus
            />
            {searchTerm ? <TouchableOpacity onPress={() => setSearchTerm("")}><Ionicons name="close-circle" size={20} color="#9CA3AF" /></TouchableOpacity> : null}
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
          {filterOptions.map((option) => {
            const active = roleFilter === option.value;
            return (
              <TouchableOpacity key={option.value} style={[styles.filterChip, active ? styles.filterChipActive : null]} onPress={() => setRoleFilter(option.value)} activeOpacity={0.85}>
                <Ionicons name={option.icon as any} size={17} color={active ? "#fff" : "#475569"} />
                <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.resultRow}>
          <Text style={styles.resultText}>المعروض: {filteredUsers.length}</Text>
          <Text style={styles.resultHint}>استخدم الفلتر أو البحث لتضييق النتائج</Text>
        </View>

        {loading ? <View style={styles.box}><ActivityIndicator /><Text style={styles.boxText}>جاري تحميل الحسابات...</Text></View> : null}
        {!loading && filteredUsers.length === 0 ? <View style={styles.box}><Text style={styles.emptyText}>لا توجد حسابات مطابقة</Text></View> : null}

        {filteredUsers.map((user) => (
          <View key={user.id} style={styles.card}>
            <View style={styles.cardTopRow}>
              <View style={styles.iconActionsRow}>
                <IconAction icon="create-outline" color="#0F9B6F" onPress={() => startEdit(user)} />
                <IconAction icon="key-outline" color="#111827" onPress={() => resetPassword(user)} />
                <IconAction icon={user.is_active ? "pause-circle-outline" : "play-circle-outline"} color={user.is_active ? "#DC2626" : "#16A34A"} onPress={() => toggleActive(user)} />
              </View>
              <View style={styles.userMainInfo}>
                <View style={styles.userNameRow}>
                  <Text style={[styles.statusBadge, user.is_active ? styles.activeBadge : styles.inactiveBadge]}>{user.is_active ? "مفعل" : "معطل"}</Text>
                  <Text style={styles.cardTitle}>{user.name || "مستخدم"}</Text>
                </View>
                <Text style={styles.roleBadge}>{roleLabel(user.role)}</Text>
              </View>
            </View>
            <View style={styles.infoGrid}>
              <InfoLine icon="mail-outline" text={user.email || "-"} />
              <InfoLine icon="person-outline" text={`المالك: ${user.owner_name || "-"}`} />
              <InfoLine icon="time-outline" text={`آخر دخول: ${user.last_login_at || "-"}`} />
            </View>
            {user.notes ? <Text style={styles.notes}>ملاحظات: {user.notes}</Text> : null}
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
              <TouchableOpacity style={styles.closeCircle} onPress={closeForm} activeOpacity={0.85}><Ionicons name="close" size={22} color="#111827" /></TouchableOpacity>
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
                <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={closeForm} disabled={saving}><Ionicons name="close-outline" size={20} color="#fff" /></TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.saveButton, saving ? styles.disabledButton : null]} onPress={saveUser} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-outline" size={22} color="#fff" />}</TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function IconAction({ icon, color, onPress }: { icon: string; color: string; onPress: () => void }) {
  return <TouchableOpacity style={[styles.iconAction, { borderColor: `${color}22`, backgroundColor: `${color}10` }]} onPress={onPress} activeOpacity={0.82}><Ionicons name={icon as any} size={21} color={color} /></TouchableOpacity>;
}

function InfoLine({ icon, text }: { icon: string; text: string }) {
  return <View style={styles.infoLine}><Text numberOfLines={1} style={styles.infoText}>{text}</Text><Ionicons name={icon as any} size={16} color="#94A3B8" /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 18, paddingBottom: 50 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  headerTextWrap: { flex: 1, alignItems: "flex-end" },
  title: { fontSize: 30, fontWeight: "900", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 6, color: "#7A766F", fontSize: 14, textAlign: "right", lineHeight: 21 },
  iconTopButton: { width: 48, height: 48, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  addTopButton: { backgroundColor: "#0F9B6F", borderColor: "#0F9B6F" },
  summaryBox: { flexDirection: "row-reverse", backgroundColor: "#111827", borderRadius: 22, padding: 14, marginBottom: 12, gap: 8 },
  summaryItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  summaryValue: { color: "#fff", fontWeight: "900", fontSize: 20 },
  summaryLabel: { color: "#CBD5E1", fontWeight: "800", fontSize: 11, marginTop: 4 },
  searchBox: { minHeight: 50, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, color: "#111827", fontWeight: "800" },
  filterBar: { flexDirection: "row-reverse", gap: 8, paddingVertical: 6, paddingLeft: 4 },
  filterChip: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  filterChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  filterChipText: { color: "#475569", fontWeight: "900", fontSize: 12 },
  filterChipTextActive: { color: "#fff" },
  resultRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 3, marginBottom: 10 },
  resultText: { color: "#111827", fontWeight: "900" },
  resultHint: { color: "#94A3B8", fontWeight: "800", fontSize: 11 },
  modalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 18, paddingVertical: 28 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.5)" },
  modalCard: { maxHeight: "88%", backgroundColor: "#fff", borderRadius: 24, padding: 16, shadowColor: "#0F172A", shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  closeCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
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
  actionButton: { flex: 1, minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cancelButton: { backgroundColor: "#7A766F" },
  saveButton: { backgroundColor: "#16a34a" },
  disabledButton: { opacity: 0.65 },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F", fontWeight: "800" },
  card: { backgroundColor: "#fff", borderRadius: 22, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#ECEAE5" },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  iconActionsRow: { flexDirection: "row", gap: 7 },
  iconAction: { width: 42, height: 42, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  userMainInfo: { flex: 1, alignItems: "flex-end" },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "flex-end" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "900", fontSize: 12 },
  activeBadge: { backgroundColor: "#dcfce7", color: "#166534" },
  inactiveBadge: { backgroundColor: "#fee2e2", color: "#991b1b" },
  cardTitle: { fontSize: 19, fontWeight: "900", color: "#111827", textAlign: "right", flexShrink: 1 },
  roleBadge: { marginTop: 7, backgroundColor: "#F8FAFC", color: "#0F172A", borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5, fontWeight: "900", fontSize: 12 },
  infoGrid: { marginTop: 12, gap: 8 },
  infoLine: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "#F8FAFC", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 9 },
  infoText: { flex: 1, color: "#475569", fontWeight: "800", textAlign: "right" },
  notes: { marginTop: 10, color: "#92400e", fontWeight: "800", textAlign: "right" },
  helpBox: { backgroundColor: "#fffbeb", borderRadius: 18, padding: 14, marginTop: 4 },
  helpTitle: { color: "#92400e", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  helpText: { color: "#92400e", fontWeight: "700", textAlign: "right", lineHeight: 22 },
});
