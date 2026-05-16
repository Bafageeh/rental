import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
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
import { apiGet, apiGetScoped, apiPost } from "../lib/api";
import InlineEditDeleteActions from "../components/InlineEditDeleteActions";
import { SafeAreaView } from "react-native-safe-area-context";
import { smartBack } from "@/lib/navigationHistory";

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

export default function ExpensesScreen() {
  const params = useLocalSearchParams();
  const propertyIdParam = firstParam(params.property_id as string | string[] | undefined);
  const propertyNameParam = firstParam(params.property_name as string | string[] | undefined);
  const unitIdParam = firstParam(params.unit_id as string | string[] | undefined);
  const unitNameParam = firstParam(params.unit_name as string | string[] | undefined);
  const scopedPropertyId = propertyIdParam ? Number(propertyIdParam) : null;
  const scopedPropertyName = decodeParam(propertyNameParam);
  const scopedUnitId = unitIdParam ? Number(unitIdParam) : null;
  const scopedUnitName = decodeParam(unitNameParam);
  const isUnitScoped = !!scopedUnitId;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
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
          : "";
      const propertyFilter = scopedPropertyId ? `?property_id=${scopedPropertyId}` : "";

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
  }, [propertyIdParam, unitIdParam]);

  const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const selectedPropertyLabel = scopedPropertyName || properties.find((property) => property.id === propertyId)?.name || (scopedPropertyId ? `عقار #${scopedPropertyId}` : "");
  const subtitle = isUnitScoped
    ? `مصروفات الوحدة: ${scopedUnitName || `#${scopedUnitId}`}`
    : scopedPropertyId
      ? `مصروفات العقار: ${selectedPropertyLabel} — تشمل مصروفات العقار والوحدات التابعة له`
      : "مصروفات الخدمات والصيانة لكل عقار";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => smartBack()}>
          <Text style={styles.backText}>→ رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>المصاريف</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>إجمالي المصاريف</Text>
          <Text style={styles.summaryValue}>{money(total)}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setShowForm(!showForm)}>
          <Text style={styles.primaryButtonText}>{showForm ? "إغلاق نموذج الإضافة" : isUnitScoped ? "إضافة مصروف للوحدة" : "إضافة مصروف"}</Text>
        </TouchableOpacity>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>بيانات المصروف</Text>

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

            <TextInput style={styles.input} placeholder="المبلغ" value={amount} onChangeText={setAmount} keyboardType="number-pad" textAlign="right" />
            <TextInput style={styles.input} placeholder="تاريخ المصروف YYYY-MM-DD" value={expenseDate} onChangeText={setExpenseDate} textAlign="right" />
            <TextInput style={styles.input} placeholder="عنوان المصروف" value={title} onChangeText={setTitle} textAlign="right" />
            <TextInput style={[styles.input, styles.multilineInput]} placeholder="وصف أو ملاحظات" value={description} onChangeText={setDescription} multiline textAlign="right" />

            <TouchableOpacity style={styles.saveButton} onPress={saveExpense} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? "جاري الحفظ..." : "حفظ المصروف"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

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
            <InlineEditDeleteActions resource="property_expenses" id={expense.id} onChanged={load} />
            <Text style={styles.amount}>{money(expense.amount)}</Text>
            <Text style={styles.detail}>التاريخ: {expense.expense_date || "-"}</Text>
            <Text style={styles.detail}>العقار: {expense.property?.name || "-"}</Text>
            <Text style={styles.detail}>الوحدة: {expense.unit?.unit_number || (expense.unit?.id ? `#${expense.unit.id}` : "مصروف عام للعقار")}</Text>
            <Text style={styles.detail}>المالك: {expense.property?.owner?.name || "-"}</Text>
            <Text style={styles.detail}>النوع: {expense.category?.name || "-"}</Text>
            <Text style={styles.detail}>العنوان: {expense.title || "-"}</Text>
            {expense.description ? <Text style={styles.notes}>ملاحظات: {expense.description}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 12, paddingBottom: 40 },
  backButton: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 4, marginBottom: 4 },
  backText: { color: "#111827", fontWeight: "800" },
  title: { fontSize: 30, fontWeight: "800", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, fontSize: 15, color: "#7A766F", textAlign: "right", lineHeight: 22 },
  summaryBox: { backgroundColor: "#111827", borderRadius: 14, padding: 12, marginBottom: 9 },
  summaryTitle: { color: "#C4C1BB", textAlign: "right", fontWeight: "700" },
  summaryValue: { color: "#ffffff", textAlign: "right", marginTop: 8, fontSize: 24, fontWeight: "800" },
  primaryButton: { backgroundColor: "#111827", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 9 },
  primaryButtonText: { color: "#ffffff", fontWeight: "800" },
  formCard: { backgroundColor: "#ffffff", borderRadius: 14, padding: 12, marginBottom: 9 },
  formTitle: { fontSize: 17, fontWeight: "800", color: "#111827", textAlign: "right", marginBottom: 8 },
  label: { color: "#374151", fontWeight: "800", textAlign: "right", marginBottom: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", marginBottom: 8 },
  scopedPropertyBox: { backgroundColor: "#ecfeff", borderWidth: 1, borderColor: "#99f6e4", borderRadius: 12, padding: 12, marginBottom: 10 },
  scopedPropertyText: { color: "#0f766e", fontWeight: "800", textAlign: "right" },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, marginLeft: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#111827" },
  chipText: { color: "#374151", fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  input: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, marginBottom: 10, color: "#111827" },
  multilineInput: { minHeight: 70, textAlignVertical: "top" },
  saveButton: { backgroundColor: "#16a34a", padding: 13, borderRadius: 12, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "800" },
  box: { backgroundColor: "#fff", padding: 12, borderRadius: 14, alignItems: "center", marginBottom: 8 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  errorBox: { backgroundColor: "#fee2e2", padding: 12, borderRadius: 14, marginBottom: 9 },
  errorTitle: { color: "#991b1b", fontSize: 16, fontWeight: "800", textAlign: "right" },
  errorText: { color: "#7f1d1d", marginTop: 8, textAlign: "right" },
  button: { marginTop: 14, backgroundColor: "#111827", padding: 12, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "800" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8 },
  amount: { color: "#b91c1c", fontSize: 16, fontWeight: "800", textAlign: "right" },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  notes: { marginTop: 10, color: "#92400e", fontWeight: "700", textAlign: "right" },
});
