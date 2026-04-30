import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiPostAny } from "../lib/api";

type RelatedPayment = {
  id: number;
  title?: string;
  subtitle?: string;
  badge?: string | null;
  amount?: number | string | null;
  due_date?: string | null;
  paid_date?: string | null;
  deadline_date?: string | null;
  notes?: string | null;
  status?: string | null;
};

type Mode = "pay" | "edit";
type ActionTone = "dark" | "light" | "danger" | "success";

type Props = {
  item: RelatedPayment;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void | Promise<void>;
};

function valueOrDash(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function amountText(value: unknown) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n)) return valueOrDash(value);
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال`;
}

function amountInput(value: unknown) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n)) return "";
  return String(n);
}

function statusKey(item: RelatedPayment) {
  const status = String(item.status || item.badge || "").trim().toLowerCase();
  const badge = String(item.badge || "").trim();
  if (status.includes("paid") || badge.includes("مدفوعة") || badge.includes("مدفوع")) return "paid";
  if (status.includes("overdue") || badge.includes("متأخر") || badge.includes("متأخرة")) return "overdue";
  if (status.includes("next") || badge.includes("التالي")) return "next";
  return "due";
}

function statusMeta(item: RelatedPayment) {
  const status = statusKey(item);
  if (status === "paid") return { label: "مدفوعة", bg: "#EAF8EF", fg: "#16834F", card: "#FBFDFB", border: "#D6EFDE", accent: "#22C55E" };
  if (status === "overdue") return { label: "متأخرة", bg: "#FDECEC", fg: "#C02F42", card: "#FFF8F8", border: "#F4C7CC", accent: "#EF4444" };
  if (status === "next") return { label: "القادمة", bg: "#EAF3FF", fg: "#2369A4", card: "#F8FBFF", border: "#CEE4FF", accent: "#3B82F6" };
  return { label: "مستحقة", bg: "#F8F0E3", fg: "#8D6B2C", card: "#FFFDF8", border: "#EFE1CC", accent: "#D7A642" };
}

function ActionPill({ label, icon, tone, onPress }: { label: string; icon: string; tone: ActionTone; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[
        styles.actionPill,
        tone === "dark" ? styles.actionDark : null,
        tone === "light" ? styles.actionLight : null,
        tone === "danger" ? styles.actionDanger : null,
        tone === "success" ? styles.actionSuccess : null,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.actionPillText, tone === "dark" || tone === "success" ? styles.actionPillTextLight : null]}>{icon} {label}</Text>
    </TouchableOpacity>
  );
}

export default function ContractPaymentCard({ item, index, expanded, onToggle, onChanged }: Props) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [mode, setMode] = useState<Mode>("pay");
  const [amount, setAmount] = useState(amountInput(item.amount));
  const [note, setNote] = useState(item.notes || "");
  const [saving, setSaving] = useState(false);

  const meta = useMemo(() => statusMeta(item), [item.status, item.badge]);
  const isPaid = statusKey(item) === "paid";
  const dueDate = item.due_date || item.title || "-";
  const paidDate = item.paid_date || "لم تسجل بعد";
  const helperNote = item.notes || item.subtitle || "اضغط على زر الإجراءات للتعديل أو تسجيل الدفع.";

  function openSheet(nextMode: Mode) {
    setMode(nextMode);
    setAmount(amountInput(item.amount));
    setNote(item.notes || "");
    setSheetVisible(true);
  }

  function closeSheet() {
    if (saving) return;
    setSheetVisible(false);
  }

  async function saveSheet() {
    const numericAmount = Number(String(amount || "0").replace(/,/g, ""));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert("تنبيه", "أدخل قيمة صحيحة للدفعة.");
      return;
    }

    try {
      setSaving(true);
      await apiPostAny(
        [
          `/edit-delete-center/payments/${item.id}/update`,
          `/my/edit-delete-center/payments/${item.id}/update`,
        ],
        { fields: { amount: String(numericAmount), notes: note.trim() } },
      );

      if (mode === "pay") {
        await apiPostAny(
          [
            `/payments/${item.id}/mark-paid`,
            `/my/payments/${item.id}/mark-paid`,
          ],
          {},
        );
      }

      setSheetVisible(false);
      await onChanged();
      Alert.alert("تم", mode === "pay" ? "تم تسجيل الدفع بنجاح" : "تم حفظ تعديل الدفعة");
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ الدفعة");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert("حذف الدفعة", "هل تريد حذف هذه الدفعة من جدول العقد؟", [
      { text: "تراجع", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await apiPostAny(
              [
                `/edit-delete-center/payments/${item.id}/delete`,
                `/my/edit-delete-center/payments/${item.id}/delete`,
                `/payments/${item.id}/delete`,
              ],
              {},
            );
            await onChanged();
            Alert.alert("تم", "تم حذف الدفعة");
          } catch (e) {
            Alert.alert("تعذر الحذف", e instanceof Error ? e.message : "تعذر حذف الدفعة");
          }
        },
      },
    ]);
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.92}
        style={[styles.card, { backgroundColor: meta.card, borderColor: meta.border }]}
        onPress={onToggle}
      >
        <View style={styles.topStrip}>
          <Text style={[styles.statusChip, { backgroundColor: meta.bg, color: meta.fg }]}>{meta.label}</Text>
          <View style={[styles.accentDot, { backgroundColor: meta.accent }]} />
        </View>

        <View style={styles.mainRow}>
          <View style={styles.amountPanel}>
            <Text style={styles.amountLabel}>{isPaid ? "المسدد" : "المطلوب"}</Text>
            <Text style={styles.amountValue}>{amountText(item.amount)}</Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.title}>القسط {index + 1}</Text>
            <Text style={styles.dateText}>استحقاق: {dueDate}</Text>
            <Text numberOfLines={2} style={styles.noteText}>{helperNote}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.optionsButton, expanded ? styles.optionsButtonActive : null]}
            onPress={(event) => {
              event.stopPropagation?.();
              onToggle();
            }}
          >
            <Text style={[styles.optionsButtonText, expanded ? styles.optionsButtonTextActive : null]}>{expanded ? "إخفاء الخيارات" : "إجراءات"}</Text>
            <Text style={[styles.optionsIcon, expanded ? styles.optionsButtonTextActive : null]}>{expanded ? "⌃" : "⌄"}</Text>
          </TouchableOpacity>

          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{isPaid ? `تاريخ الدفع: ${paidDate}` : "لم يتم الدفع"}</Text>
          </View>
        </View>

        {expanded ? (
          <View style={styles.expandedArea}>
            <View style={styles.expandedHeader}>
              <Text style={styles.expandedHint}>اختر العملية بدون مغادرة تفاصيل العقد</Text>
            </View>
            <View style={styles.actionRow}>
              {!isPaid ? <ActionPill icon="💳" label="تسجيل دفع" tone="success" onPress={() => openSheet("pay")} /> : null}
              <ActionPill icon="✎" label="تعديل" tone={isPaid ? "dark" : "light"} onPress={() => openSheet("edit")} />
              <ActionPill icon="🗑" label="حذف" tone="danger" onPress={confirmDelete} />
            </View>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={closeSheet}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeSheet} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity style={styles.closeButton} onPress={closeSheet} activeOpacity={0.85}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
                <View style={styles.sheetTitleBlock}>
                  <Text style={styles.sheetEyebrow}>{mode === "pay" ? "دفع من تفاصيل العقد" : "تعديل بيانات القسط"}</Text>
                  <Text style={styles.sheetTitle}>{mode === "pay" ? "تسجيل الدفعة" : "تعديل الدفعة"}</Text>
                  <Text style={styles.sheetSubtitle}>القسط {index + 1} • استحقاق {dueDate}</Text>
                </View>
              </View>

              <View style={[styles.sheetSummary, { borderColor: meta.border, backgroundColor: meta.card }]}> 
                <View style={styles.sheetSummaryTop}>
                  <Text style={[styles.sheetStatus, { backgroundColor: meta.bg, color: meta.fg }]}>{meta.label}</Text>
                  <Text style={styles.summaryLabel}>{mode === "pay" ? "المبلغ المراد سداده" : "المبلغ الحالي"}</Text>
                </View>
                <Text style={styles.summaryAmount}>{amountText(item.amount)}</Text>
                <Text style={styles.summaryHint}>{mode === "pay" ? "يمكن تعديل المبلغ وكتابة نص الحوالة قبل الحفظ." : "عدّل المبلغ أو الملاحظة وسيتم تحديث البطاقة مباشرة بعد الحفظ."}</Text>
              </View>

              <View style={styles.quickActions}>
                <TouchableOpacity style={styles.helperButton} onPress={() => setAmount(amountInput(item.amount))} activeOpacity={0.85}>
                  <Text style={styles.helperText}>اعتماد المبلغ الكامل</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.helperButton} onPress={() => setNote("تم السداد عبر حوالة بنكية.")} activeOpacity={0.85}>
                  <Text style={styles.helperText}>ملاحظة جاهزة</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>قيمة الدفعة</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                style={styles.input}
                keyboardType="decimal-pad"
                textAlign="right"
                placeholder="مثال: 2500"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.inputHint}>القيمة المسجلة حاليًا: {amountText(item.amount)}</Text>

              <Text style={styles.fieldLabel}>الملاحظات / نص الحوالة</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                style={[styles.input, styles.notesInput]}
                textAlign="right"
                multiline
                placeholder="مثال: حوالة الراجحي - رقم العملية..."
                placeholderTextColor="#9CA3AF"
              />

              <View style={styles.sheetActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={closeSheet} activeOpacity={0.85}>
                  <Text style={styles.cancelText}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveButton, saving ? styles.disabled : null]} onPress={saveSheet} disabled={saving} activeOpacity={0.85}>
                  <Text style={styles.saveText}>{saving ? "جاري الحفظ..." : mode === "pay" ? "حفظ الدفع" : "حفظ التعديل"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    shadowColor: "#111827",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  topStrip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  statusChip: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, fontWeight: "900" },
  accentDot: { width: 12, height: 12, borderRadius: 999 },
  mainRow: { flexDirection: "row", alignItems: "stretch", gap: 12 },
  amountPanel: { width: 122, borderRadius: 20, padding: 12, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(229,231,235,0.85)", justifyContent: "center" },
  amountLabel: { color: "#6B7280", fontSize: 12, fontWeight: "900", textAlign: "left" },
  amountValue: { color: "#111827", fontSize: 17, lineHeight: 24, fontWeight: "900", textAlign: "left", marginTop: 5 },
  infoBlock: { flex: 1, alignItems: "flex-end", justifyContent: "center" },
  title: { color: "#111827", fontSize: 21, fontWeight: "900", textAlign: "right" },
  dateText: { color: "#6B7280", fontSize: 13, fontWeight: "800", marginTop: 7, textAlign: "right" },
  noteText: { color: "#7A766F", fontSize: 13, lineHeight: 20, fontWeight: "700", marginTop: 8, textAlign: "right" },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 13 },
  optionsButton: { minHeight: 44, minWidth: 116, borderRadius: 16, backgroundColor: "#111827", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 14 },
  optionsButtonActive: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#E5E2DD" },
  optionsButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  optionsButtonTextActive: { color: "#111827" },
  optionsIcon: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  datePill: { flex: 1, minHeight: 42, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.62)", alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(229,231,235,0.8)" },
  datePillText: { color: "#6B7280", fontSize: 12, fontWeight: "800", textAlign: "right" },
  expandedArea: { borderTopWidth: 1, borderTopColor: "rgba(229,231,235,0.9)", marginTop: 14, paddingTop: 13 },
  expandedHeader: { alignItems: "flex-end", marginBottom: 10 },
  expandedHint: { color: "#6B7280", fontSize: 12, fontWeight: "800", textAlign: "right" },
  actionRow: { flexDirection: "row-reverse", gap: 9, flexWrap: "wrap" },
  actionPill: { flexGrow: 1, minWidth: 94, minHeight: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderWidth: 1 },
  actionDark: { backgroundColor: "#111827", borderColor: "#111827" },
  actionLight: { backgroundColor: "#FFFFFF", borderColor: "#E5E7EB" },
  actionDanger: { backgroundColor: "#FDECEC", borderColor: "#F4C7CC" },
  actionSuccess: { backgroundColor: "#16834F", borderColor: "#16834F" },
  actionPillText: { color: "#111827", fontSize: 13, fontWeight: "900", textAlign: "center" },
  actionPillTextLight: { color: "#FFFFFF" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.46)" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingTop: 12, maxHeight: "90%" },
  handle: { alignSelf: "center", width: 86, height: 7, borderRadius: 999, backgroundColor: "#D8D3CB", marginBottom: 8 },
  sheetScroll: { paddingHorizontal: 18, paddingBottom: 28 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  closeButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#E5E2DD", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#6B7280", fontSize: 31, lineHeight: 35, fontWeight: "300" },
  sheetTitleBlock: { flex: 1, alignItems: "flex-end" },
  sheetEyebrow: { color: "#8D6B2C", fontSize: 12, fontWeight: "900", textAlign: "right", marginBottom: 5 },
  sheetTitle: { color: "#111827", fontSize: 28, fontWeight: "900", textAlign: "right" },
  sheetSubtitle: { color: "#7A766F", fontSize: 13, fontWeight: "800", marginTop: 6, textAlign: "right" },
  sheetSummary: { borderRadius: 26, padding: 16, marginBottom: 13, borderWidth: 1 },
  sheetSummaryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetStatus: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, fontWeight: "900" },
  summaryLabel: { color: "#6B7280", fontSize: 13, fontWeight: "900", textAlign: "right" },
  summaryAmount: { color: "#111827", fontSize: 34, fontWeight: "900", textAlign: "right", marginTop: 12 },
  summaryHint: { color: "#6B6258", fontSize: 13, lineHeight: 20, fontWeight: "700", textAlign: "right", marginTop: 9 },
  quickActions: { flexDirection: "row-reverse", gap: 9, marginBottom: 14 },
  helperButton: { flex: 1, minHeight: 44, borderRadius: 999, backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#E5E2DD", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  helperText: { color: "#111827", fontSize: 12, fontWeight: "900", textAlign: "center" },
  fieldLabel: { color: "#111827", fontSize: 16, fontWeight: "900", textAlign: "right", marginBottom: 9, marginTop: 5 },
  input: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 17, paddingHorizontal: 14, paddingVertical: 13, color: "#111827", fontSize: 17, fontWeight: "800", minHeight: 54, marginBottom: 7 },
  inputHint: { color: "#8B8983", fontSize: 12, fontWeight: "700", textAlign: "right", marginBottom: 12 },
  notesInput: { minHeight: 100, textAlignVertical: "top", fontSize: 15, lineHeight: 22 },
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 14 },
  cancelButton: { width: 105, minHeight: 58, borderRadius: 20, backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#E5E2DD", alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#111827", fontSize: 15, fontWeight: "900" },
  saveButton: { flex: 1, minHeight: 58, borderRadius: 20, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  saveText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  disabled: { opacity: 0.65 },
});
