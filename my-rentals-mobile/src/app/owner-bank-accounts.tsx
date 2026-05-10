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
import { apiGetScoped, apiPost } from "../lib/api";
import InlineEditDeleteActions from "../components/InlineEditDeleteActions";
import { SafeAreaView } from "react-native-safe-area-context";

type Owner = {
  id: number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

type OwnerBankAccount = {
  id: number;
  owner_id?: number;
  owner_name?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  iban?: string | null;
  account_number?: string | null;
  is_default?: boolean;
  is_active?: boolean;
  notes?: string | null;
};

function maskIban(value?: string | null) {
  if (!value) return "-";

  const clean = value.replace(/\s+/g, "");
  if (clean.length <= 8) return clean;

  return `${clean.slice(0, 4)} **** **** ${clean.slice(-4)}`;
}

export default function OwnerBankAccountsScreen() {
  const [accounts, setAccounts] = useState<OwnerBankAccount[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<OwnerBankAccount | null>(null);

  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [iban, setIban] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [notes, setNotes] = useState("");

  async function load() {
    try {
      setLoading(true);

      const [accountsResult, ownersResult] = await Promise.all([
        apiGetScoped("/owner-bank-accounts", "/my/owner-bank-accounts"),
        apiGetScoped("/owners", "/my/owners"),
      ]);

      const ownerList = Array.isArray(ownersResult) ? ownersResult : [];

      setAccounts(Array.isArray(accountsResult) ? accountsResult : []);
      setOwners(ownerList);

      if (!ownerId && ownerList.length > 0) {
        setOwnerId(ownerList[0].id);
      }
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل حسابات الملاك البنكية");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingAccount(null);
    setOwnerId(owners.length > 0 ? owners[0].id : null);
    setBankName("");
    setAccountName("");
    setIban("");
    setAccountNumber("");
    setIsDefault(false);
    setNotes("");
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(account: OwnerBankAccount) {
    setEditingAccount(account);
    setOwnerId(account.owner_id || null);
    setBankName(account.bank_name || "");
    setAccountName(account.account_name || "");
    setIban(account.iban || "");
    setAccountNumber(account.account_number || "");
    setIsDefault(Boolean(account.is_default));
    setNotes(account.notes || "");
    setShowForm(true);
  }

  async function saveAccount() {
    if (!ownerId) {
      Alert.alert("تنبيه", "اختر المالك");
      return;
    }

    if (!bankName.trim()) {
      Alert.alert("تنبيه", "اكتب اسم البنك");
      return;
    }

    if (!iban.trim() && !accountNumber.trim()) {
      Alert.alert("تنبيه", "اكتب رقم الآيبان أو رقم الحساب");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        owner_id: ownerId,
        bank_name: bankName.trim(),
        account_name: accountName.trim() || null,
        iban: iban.trim() || null,
        account_number: accountNumber.trim() || null,
        is_default: isDefault,
        is_active: true,
        notes: notes.trim() || null,
      };

      if (editingAccount) {
        await apiPost(`/owner-bank-accounts/${editingAccount.id}/update`, payload);
      } else {
        await apiPost("/owner-bank-accounts", payload);
      }

      Alert.alert("تم", editingAccount ? "تم تحديث الحساب البنكي" : "تم إضافة الحساب البنكي");
      resetForm();
      setShowForm(false);
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ الحساب البنكي");
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(account: OwnerBankAccount) {
    try {
      await apiPost(`/owner-bank-accounts/${account.id}/set-default`);
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحديد الحساب الافتراضي");
    }
  }

  async function toggleActive(account: OwnerBankAccount) {
    try {
      await apiPost(`/owner-bank-accounts/${account.id}/toggle-active`);
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تغيير حالة الحساب");
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

  const activeAccounts = accounts.filter((account) => account.is_active);
  const defaultAccounts = accounts.filter((account) => account.is_default);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>حسابات الملاك البنكية</Text>
        <Text style={styles.subtitle}>
          حفظ بيانات التحويل البنكي والآيبان لكل مالك لاستخدامها عند حوالات الملاك
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>إجمالي الحسابات: {accounts.length}</Text>
          <Text style={styles.summaryText}>الحسابات النشطة: {activeAccounts.length}</Text>
          <Text style={styles.summaryText}>الحسابات الافتراضية: {defaultAccounts.length}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={startCreate}>
          <Text style={styles.primaryButtonText}>إضافة حساب بنكي</Text>
        </TouchableOpacity>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingAccount ? "تعديل حساب بنكي" : "حساب بنكي جديد"}
            </Text>

            <Text style={styles.label}>المالك</Text>
            <View style={styles.chips}>
              {owners.map((owner) => (
                <TouchableOpacity
                  key={owner.id}
                  style={[styles.chip, ownerId === owner.id ? styles.chipActive : null]}
                  onPress={() => setOwnerId(owner.id)}
                >
                  <Text style={[styles.chipText, ownerId === owner.id ? styles.chipTextActive : null]}>
                    {owner.name || `مالك #${owner.id}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="اسم البنك"
              value={bankName}
              onChangeText={setBankName}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="اسم صاحب الحساب"
              value={accountName}
              onChangeText={setAccountName}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="IBAN / الآيبان"
              value={iban}
              onChangeText={setIban}
              autoCapitalize="characters"
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="رقم الحساب"
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
              textAlign="right"
            />

            <TouchableOpacity
              style={[styles.defaultToggle, isDefault ? styles.defaultToggleActive : null]}
              onPress={() => setIsDefault(!isDefault)}
            >
              <Text style={[styles.defaultToggleText, isDefault ? styles.defaultToggleTextActive : null]}>
                {isDefault ? "الحساب الافتراضي لهذا المالك" : "اجعله الحساب الافتراضي"}
              </Text>
            </TouchableOpacity>

            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="ملاحظات"
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlign="right"
            />

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                <Text style={styles.actionText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={saveAccount}
                disabled={saving}
              >
                <Text style={styles.actionText}>
                  {saving ? "جاري الحفظ..." : "حفظ"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل الحسابات البنكية...</Text>
          </View>
        ) : null}

        {!loading && accounts.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد حسابات بنكية مسجلة حاليًا</Text>
          </View>
        ) : null}

        {accounts.map((account) => (
          <View key={account.id} style={styles.card}>
            <InlineEditDeleteActions resource="owner_bank_accounts" id={account.id} onChanged={load} />
            <View style={styles.rowBetween}>
              <Text style={[styles.statusBadge, account.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                {account.is_active ? "نشط" : "معطل"}
              </Text>
              <Text style={styles.cardTitle}>{account.bank_name || "بنك"}</Text>
            </View>

            {account.is_default ? (
              <Text style={styles.defaultLabel}>الحساب الافتراضي</Text>
            ) : null}

            <Text style={styles.detail}>المالك: {account.owner_name || "-"}</Text>
            <Text style={styles.detail}>اسم الحساب: {account.account_name || "-"}</Text>
            <Text style={styles.detail}>الآيبان: {maskIban(account.iban)}</Text>
            <Text style={styles.detail}>رقم الحساب: {account.account_number || "-"}</Text>
            {account.notes ? <Text style={styles.notes}>ملاحظات: {account.notes}</Text> : null}

            <View style={styles.itemActionsRow}>
              <TouchableOpacity style={[styles.itemButton, styles.editButton]} onPress={() => startEdit(account)}>
                <Text style={styles.itemButtonText}>تعديل</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.itemButton, styles.defaultButton]} onPress={() => setDefault(account)}>
                <Text style={styles.itemButtonText}>افتراضي</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.itemButton, account.is_active ? styles.disableButton : styles.enableButton]}
                onPress={() => toggleActive(account)}
              >
                <Text style={styles.itemButtonText}>
                  {account.is_active ? "تعطيل" : "تفعيل"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.helpBox}>
          <Text style={styles.helpTitle}>تنبيه</Text>
          <Text style={styles.helpText}>
            تحفظ هذه الشاشة بيانات الحساب البنكي للرجوع لها عند التحويل للمالك. عند وجود أكثر من حساب لنفس المالك، اختر حسابًا افتراضيًا.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 12, paddingBottom: 50 },
  title: { fontSize: 30, fontWeight: "900", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", fontSize: 15, textAlign: "right", lineHeight: 22 },
  summaryBox: { backgroundColor: "#111827", borderRadius: 14, padding: 12, marginBottom: 9 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  primaryButton: { backgroundColor: "#0F9B6F", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 9 },
  primaryButtonText: { color: "#fff", fontWeight: "900" },
  formCard: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 9 },
  formTitle: { fontSize: 16, fontWeight: "900", color: "#111827", textAlign: "right", marginBottom: 8 },
  label: { color: "#374151", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 8 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "800" },
  chipTextActive: { color: "#fff" },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  multilineInput: { minHeight: 70, textAlignVertical: "top" },
  defaultToggle: { backgroundColor: "#eff6ff", borderRadius: 12, padding: 12, alignItems: "center", marginBottom: 10 },
  defaultToggleActive: { backgroundColor: "#16a34a" },
  defaultToggleText: { color: "#065F44", fontWeight: "900" },
  defaultToggleTextActive: { color: "#fff" },
  actionsRow: { flexDirection: "row-reverse", marginTop: 8 },
  actionButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  cancelButton: { backgroundColor: "#7A766F" },
  saveButton: { backgroundColor: "#16a34a" },
  actionText: { color: "#fff", fontWeight: "900" },
  box: { backgroundColor: "#fff", padding: 12, borderRadius: 14, alignItems: "center", marginBottom: 8 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  activeBadge: { backgroundColor: "#dcfce7", color: "#166534" },
  inactiveBadge: { backgroundColor: "#fee2e2", color: "#991b1b" },
  cardTitle: { fontSize: 16, fontWeight: "900", color: "#111827", textAlign: "right", flex: 1 },
  defaultLabel: { marginTop: 10, color: "#166534", fontWeight: "900", textAlign: "right" },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  notes: { marginTop: 10, color: "#92400e", fontWeight: "700", textAlign: "right" },
  itemActionsRow: { flexDirection: "row-reverse", marginTop: 14 },
  itemButton: { flex: 1, padding: 11, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  editButton: { backgroundColor: "#0F9B6F" },
  defaultButton: { backgroundColor: "#111827" },
  disableButton: { backgroundColor: "#dc2626" },
  enableButton: { backgroundColor: "#16a34a" },
  itemButtonText: { color: "#fff", fontWeight: "900" },
  helpBox: { backgroundColor: "#fffbeb", borderRadius: 14, padding: 10, marginTop: 4 },
  helpTitle: { color: "#92400e", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  helpText: { color: "#92400e", fontWeight: "700", textAlign: "right", lineHeight: 22 },
});
