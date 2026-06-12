import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGet, apiGetScoped, apiPost } from "../lib/api";
import InlineEditDeleteActions from "../components/InlineEditDeleteActions";
import { SafeAreaView } from "react-native-safe-area-context";

type Property = {
  id: number;
  name?: string | null;
  owner?: { name?: string | null } | null;
};

type Unit = {
  id: number;
  unit_number?: string | null;
  property?: Property | null;
};

type ExpenseCategory = {
  id: number;
  name?: string | null;
  code?: string | null;
};

type Expense = {
  id: number;
  amount?: number;
  expense_date?: string | null;
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  property?: Property | null;
  unit?: Unit | null;
  category?: ExpenseCategory | null;
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString("ar-SA")} ريال`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function decodeParam(value: string) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return value || "";
  }
}

function dateOnly(value?: string | null) {
  const text = String(value || "");
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = text.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return text || "-";
}

function expenseTitle(expense: Expense) {
  return expense.title || expense.category?.name || "مصروف";
}

function expenseUnitLabel(expense: Expense, fallbackProperty = "") {
  if (expense.unit?.unit_number) return `شقة ${expense.unit.unit_number}`;
  return expense.property?.name || fallbackProperty || "عقار";
}

export default function ExpensesScreen() {
  const params = useLocalSearchParams();
  const propertyIdParam = firstParam(params.property_id as string | string[] | undefined);
  const propertyNameParam = firstParam(params.property_name as string | string[] | undefined);
  const unitIdParam = firstParam(params.unit_id as string | string[] | undefined);
  const unitNameParam = firstParam(params.unit_name as string | string[] | undefined);
  const ownerIdParam = firstParam(params.owner_id as string | string[] | undefined);
  const ownerNameParam = firstParam(params.owner_name as string | string[] | undefined);
  const scopedPropertyId = propertyIdParam ? Number(propertyIdParam) : null;
  const scopedPropertyName = decodeParam(propertyNameParam);
  const scopedUnitId = unitIdParam ? Number(unitIdParam) : null;
  const scopedUnitName = decodeParam(unitNameParam);
  const scopedOwnerId = ownerIdParam ? Number(ownerIdParam) : null;
  const scopedOwnerName = decodeParam(ownerNameParam);
  const isUnitScoped = !!scopedUnitId;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [propertyId, setPropertyId] = useState<number | null>(scopedPropertyId);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayDate());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const expenseFilter = isUnitScoped
        ? `?unit_id=${scopedUnitId}`
        : scopedPropertyId
          ? `?property_id=${scopedPropertyId}`
          : scopedOwnerId
            ? `?owner_id=${scopedOwnerId}`
            : "";
      const propertyFilter = scopedPropertyId
        ? `?property_id=${scopedPropertyId}`
        : scopedOwnerId
          ? `?owner_id=${scopedOwnerId}`
          : "";

      const [expensesResult, propertiesResult, categoriesResult] = await Promise.all([
        apiGetScoped(`/expenses${expenseFilter}`, `/my/expenses${expenseFilter}`),
        isUnitScoped ? Promise.resolve([]) : apiGetScoped(`/properties${propertyFilter}`, `/my/properties${propertyFilter}`),
        apiGet("/expense-categories"),
      ]);

      let propertiesList = Array.isArray(propertiesResult) ? propertiesResult : [];
      const categoriesList = Array.isArray(categoriesResult) ? categoriesResult : [];

      if (scopedPropertyId && propertiesList.length === 0) {
        propertiesList = [{ id: scopedPropertyId, name: scopedPropertyName || `عقار #${scopedPropertyId}` }];
      }

      setExpenses(Array.isArray(expensesResult) ? expensesResult : []);
      setProperties(propertiesList);
      setCategories(categoriesList);

      if (scopedPropertyId) {
        setPropertyId(scopedPropertyId);
      } else if (!isUnitScoped && !propertyId && propertiesList.length > 0) {
        setPropertyId(propertiesList[0].id);
      }

      if (!categoryId && categoriesList.length > 0) {
        setCategoryId(categoriesList[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير معروف");
    } finally {
      setLoading(false);
    }
  }

  async function saveExpense() {
    if (!isUnitScoped && !propertyId) {
      Alert.alert("تنبيه", "اختر العقار");
      return;
    }

    if (!amount.trim()) {
      Alert.alert("تنبيه", "اكتب مبلغ المصروف");
      return;
    }

    if (!expenseDate.trim()) {
      Alert.alert("تنبيه", "اكتب تاريخ المصروف");
      return;
    }

    try {
      setSaving(true);

      await apiPost("/expenses", {
        property_id: isUnitScoped ? null : propertyId,
        unit_id: scopedUnitId,
        expense_category_id: categoryId,
        amount: Number(amount || 0),
        expense_date: expenseDate.trim(),
        title: title.trim() || null,
        description: description.trim() || null,
      });

      setAmount("");
      setTitle("");
      setDescription("");
      setExpenseDate(todayDate());
      setShowForm(false);

      Alert.alert("تم", "تم إضافة المصروف بنجاح");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ المصروف");
    } finally {
      setSaving(false);
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
  }, [propertyIdParam, unitIdParam, ownerIdParam]);

  const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const selectedPropertyLabel = scopedPropertyName || properties.find((property) => property.id === propertyId)?.name || (scopedPropertyId ? `عقار #${scopedPropertyId}` : "");
  const subtitle = isUnitScoped
    ? `مصروفات الوحدة: ${scopedUnitName || `#${scopedUnitId}`}`
    : scopedPropertyId
      ? `مصروفات العقار المباشرة فقط: ${selectedPropertyLabel}`
      : scopedOwnerId
        ? `مصروفات المالك: ${scopedOwnerName || `#${scopedOwnerId}`}`
        : "مصروفات الخدمات والصيانة لكل عقار";

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "المصاريف" }} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.summaryBox}>
          <View style={styles.summaryIcon}><Text style={styles.summaryIconText}>💳</Text></View>
          <View style={styles.summaryTextBox}>
            <Text style={styles.summaryTitle}>إجمالي المصاريف</Text>
            <Text style={styles.summaryValue}>{money(total)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setShowForm(true)} activeOpacity={0.9}>
          <Text style={styles.primaryButtonPlus}>＋</Text>
          <Text style={styles.primaryButtonText}>{isUnitScoped ? "إضافة مصروف للوحدة" : "إضافة مصروف"}</Text>
        </TouchableOpacity>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>المصاريف ({expenses.length.toLocaleString("ar-SA")})</Text>
        </View>

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل المصاريف...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>تعذر تحميل المصاريف</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.button} onPress={load}>
              <Text style={styles.buttonText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && !error && expenses.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد مصاريف حاليًا</Text>
          </View>
        ) : null}

        {expenses.map((expense) => (
          <View key={expense.id} style={styles.card}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardActions}>
                <TouchableOpacity style={[styles.miniIconButton, styles.detailsMiniButton]} onPress={() => setSelectedExpense(expense)} activeOpacity={0.88}>
                  <Text style={styles.miniIconText}>👁️</Text>
                </TouchableOpacity>
                <InlineEditDeleteActions resource="property_expenses" id={expense.id} onChanged={load} hideDetails compact iconOnly />
              </View>
              <View style={styles.cardTitleBox}>
                <Text style={styles.cardTitle}>{expenseTitle(expense)}</Text>
                {expense.description ? <Text style={styles.notes} numberOfLines={1}>{expense.description}</Text> : null}
              </View>
              <Text style={styles.amount}>{money(expense.amount)}</Text>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaChip}><Text style={styles.metaText}>📅 {dateOnly(expense.expense_date)}</Text></View>
              <View style={styles.metaChip}><Text style={styles.metaText}>🏢 {expenseUnitLabel(expense, selectedPropertyLabel)}</Text></View>
              <View style={styles.metaChip}><Text style={styles.metaText}>🏷️ {expense.category?.name || "مصروف"}</Text></View>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showForm} transparent animationType="fade" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowForm(false)} />
          <View style={styles.formSheet}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowForm(false)}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
              <Text style={styles.formTitle}>إضافة مصروف</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {isUnitScoped ? (
                <>
                  <Text style={styles.label}>الوحدة</Text>
                  <View style={styles.scopedPropertyBox}>
                    <Text style={styles.scopedPropertyText}>{scopedUnitName || `وحدة #${scopedUnitId}`}</Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.label}>العقار</Text>
                  {scopedPropertyId ? (
                    <View style={styles.scopedPropertyBox}>
                      <Text style={styles.scopedPropertyText}>{selectedPropertyLabel}</Text>
                    </View>
                  ) : (
                    <View style={styles.chips}>
                      {properties.map((property) => (
                        <TouchableOpacity key={property.id} style={[styles.chip, propertyId === property.id ? styles.chipActive : null]} onPress={() => setPropertyId(property.id)}>
                          <Text style={[styles.chipText, propertyId === property.id ? styles.chipTextActive : null]}>{property.name || "عقار"}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}

              <Text style={styles.label}>نوع المصروف</Text>
              <View style={styles.chips}>
                {categories.map((category) => (
                  <TouchableOpacity key={category.id} style={[styles.chip, categoryId === category.id ? styles.chipActive : null]} onPress={() => setCategoryId(category.id)}>
                    <Text style={[styles.chipText, categoryId === category.id ? styles.chipTextActive : null]}>{category.name || "تصنيف"}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput style={styles.input} placeholder="المبلغ" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" textAlign="right" />
              <TextInput style={styles.input} placeholder="تاريخ المصروف YYYY-MM-DD" value={expenseDate} onChangeText={setExpenseDate} textAlign="right" />
              <TextInput style={styles.input} placeholder="عنوان المصروف" value={title} onChangeText={setTitle} textAlign="right" />
              <TextInput style={[styles.input, styles.multilineInput]} placeholder="وصف أو ملاحظات" value={description} onChangeText={setDescription} multiline textAlign="right" />

              <TouchableOpacity style={styles.saveButton} onPress={saveExpense} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? "جاري الحفظ..." : "حفظ المصروف"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedExpense} transparent animationType="fade" onRequestClose={() => setSelectedExpense(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedExpense(null)} />
          <View style={styles.detailsSheet}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedExpense(null)}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
              <View style={styles.detailTitleBox}>
                <Text style={styles.detailTitle}>{selectedExpense ? expenseTitle(selectedExpense) : "تفاصيل المصروف"}</Text>
                <Text style={styles.detailSubtitle}>تفاصيل مختصرة للمصروف</Text>
              </View>
            </View>

            {selectedExpense ? (
              <View>
                <View style={styles.detailAmountCard}>
                  <Text style={styles.detailAmountLabel}>المبلغ</Text>
                  <Text style={styles.detailAmount}>{money(selectedExpense.amount)}</Text>
                </View>
                <View style={styles.detailGrid}>
                  <View style={styles.detailInfoCard}><Text style={styles.detailInfoLabel}>التاريخ</Text><Text style={styles.detailInfoValue}>{dateOnly(selectedExpense.expense_date)}</Text></View>
                  <View style={styles.detailInfoCard}><Text style={styles.detailInfoLabel}>الموقع</Text><Text style={styles.detailInfoValue}>{expenseUnitLabel(selectedExpense, selectedPropertyLabel)}</Text></View>
                  <View style={styles.detailInfoCard}><Text style={styles.detailInfoLabel}>النوع</Text><Text style={styles.detailInfoValue}>{selectedExpense.category?.name || "مصروف"}</Text></View>
                </View>
                {selectedExpense.description || selectedExpense.notes ? (
                  <View style={styles.detailNotesCard}>
                    <Text style={styles.detailInfoLabel}>ملاحظات</Text>
                    <Text style={styles.detailNotes}>{selectedExpense.description || selectedExpense.notes}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAF8" },
  container: { padding: 14, paddingBottom: 40 },
  subtitle: { marginBottom: 14, fontSize: 15, color: "#6B7280", textAlign: "right", lineHeight: 22, fontWeight: "700" },
  summaryBox: { backgroundColor: "#ECFDF5", borderRadius: 24, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#A7F3D0", flexDirection: "row", alignItems: "center", gap: 12 },
  summaryIcon: { width: 50, height: 50, borderRadius: 18, backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center" },
  summaryIconText: { fontSize: 24 },
  summaryTextBox: { flex: 1, alignItems: "flex-end" },
  summaryTitle: { color: "#0F766E", textAlign: "right", fontWeight: "900" },
  summaryValue: { color: "#111827", textAlign: "right", marginTop: 5, fontSize: 28, fontWeight: "900" },
  primaryButton: { alignSelf: "center", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#0F9B6F", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 999, marginBottom: 12, shadowColor: "#0F766E", shadowOpacity: 0.14, shadowRadius: 10, elevation: 2 },
  primaryButtonPlus: { color: "#0F766E", backgroundColor: "#fff", width: 28, height: 28, borderRadius: 14, textAlign: "center", fontSize: 21, fontWeight: "900", lineHeight: 28 },
  primaryButtonText: { color: "#ffffff", fontWeight: "900", fontSize: 15 },
  listHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  listTitle: { color: "#111827", fontWeight: "900", fontSize: 17, textAlign: "right" },
  box: { backgroundColor: "#fff", padding: 14, borderRadius: 18, alignItems: "center", marginBottom: 8, borderWidth: 1, borderColor: "#EDF1F2" },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F", fontWeight: "800" },
  errorBox: { backgroundColor: "#fee2e2", padding: 12, borderRadius: 14, marginBottom: 9 },
  errorTitle: { color: "#991b1b", fontSize: 16, fontWeight: "800", textAlign: "right" },
  errorText: { color: "#7f1d1d", marginTop: 8, textAlign: "right" },
  button: { marginTop: 14, backgroundColor: "#0F766E", padding: 12, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "800" },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#EDF1F2", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 1 },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardActions: { width: 112, alignItems: "flex-start", flexDirection: "row", gap: 7 },
  miniIconButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  detailsMiniButton: { backgroundColor: "#E0F2FE" },
  miniIconText: { fontSize: 15, lineHeight: 20 },
  cardTitleBox: { flex: 1, alignItems: "flex-end" },
  cardTitle: { color: "#111827", fontSize: 18, fontWeight: "900", textAlign: "right" },
  amount: { color: "#DC2626", fontSize: 19, fontWeight: "900", minWidth: 84, textAlign: "right" },
  metaRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginTop: 12 },
  metaChip: { backgroundColor: "#EFFAF7", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  metaText: { color: "#0F766E", fontWeight: "900", fontSize: 12 },
  notes: { marginTop: 4, color: "#6B7280", fontWeight: "700", textAlign: "right", fontSize: 12 },
  formTitle: { fontSize: 20, fontWeight: "900", color: "#111827", textAlign: "right" },
  label: { color: "#374151", fontWeight: "800", textAlign: "right", marginBottom: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 8 },
  scopedPropertyBox: { backgroundColor: "#ecfeff", borderWidth: 1, borderColor: "#99f6e4", borderRadius: 12, padding: 12, marginBottom: 10 },
  scopedPropertyText: { color: "#0f766e", fontWeight: "800", textAlign: "right" },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#0F766E" },
  chipText: { color: "#374151", fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  input: { backgroundColor: "#F8FAF8", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  multilineInput: { minHeight: 70, textAlignVertical: "top" },
  saveButton: { backgroundColor: "#0F9B6F", padding: 13, borderRadius: 12, alignItems: "center", marginTop: 4 },
  saveButtonText: { color: "#fff", fontWeight: "800" },
  modalOverlay: { flex: 1, justifyContent: "center", padding: 14 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.35)" },
  formSheet: { maxHeight: "88%", backgroundColor: "#fff", borderRadius: 24, padding: 14, borderWidth: 1, borderColor: "#E5E7EB" },
  detailsSheet: { maxHeight: "76%", backgroundColor: "#fff", borderRadius: 28, padding: 16, borderWidth: 1, borderColor: "#E5E7EB", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#111827", fontSize: 24, fontWeight: "900", lineHeight: 28 },
  detailTitleBox: { flex: 1, alignItems: "flex-end", marginLeft: 12 },
  detailTitle: { color: "#111827", fontSize: 22, fontWeight: "900", textAlign: "right" },
  detailSubtitle: { color: "#0F766E", fontWeight: "800", fontSize: 13, textAlign: "right", marginTop: 4 },
  detailAmountCard: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 20, padding: 14, alignItems: "flex-end", marginBottom: 10 },
  detailAmountLabel: { color: "#991B1B", fontWeight: "900" },
  detailAmount: { color: "#DC2626", fontWeight: "900", fontSize: 26, marginTop: 4 },
  detailGrid: { gap: 8 },
  detailInfoCard: { backgroundColor: "#F8FAFC", borderRadius: 16, padding: 12, alignItems: "flex-end", borderWidth: 1, borderColor: "#EEF2F4" },
  detailInfoLabel: { color: "#6B7280", fontWeight: "800", fontSize: 12 },
  detailInfoValue: { color: "#111827", fontWeight: "900", fontSize: 16, textAlign: "right", marginTop: 4 },
  detailNotesCard: { backgroundColor: "#FFFBEB", borderRadius: 16, padding: 12, alignItems: "flex-end", marginTop: 8, borderWidth: 1, borderColor: "#FDE68A" },
  detailNotes: { color: "#92400E", fontWeight: "800", textAlign: "right", marginTop: 4 },
});
