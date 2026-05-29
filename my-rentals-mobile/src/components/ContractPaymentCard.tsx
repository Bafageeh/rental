import { useEffect, useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiPostAny } from "../lib/api";

type RelatedPayment = {
  id: number;
  title?: string;
  subtitle?: string;
  badge?: string | null;
  amount?: number | string | null;
  display_amount?: number | string | null;
  remaining_amount?: number | string | null;
  paid_amount?: number | string | null;
  actual_paid_amount?: number | string | null;
  due_date?: string | null;
  paid_date?: string | null;
  deadline_date?: string | null;
  notes?: string | null;
  status?: string | null;
};

type Mode = "edit";
type ActionTone = "dark" | "danger" | "success";

type Props = {
  item: RelatedPayment;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void | Promise<void>;
};

function amountNumber(value: unknown) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function amountText(value: unknown) {
  const n = amountNumber(value);
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال`;
}

function amountInput(value: unknown) {
  const n = amountNumber(value);
  return Number.isFinite(n) ? String(n) : "0";
}

function todayText() {
  return new Date().toISOString().slice(0, 10);
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
  const insets = useSafeAreaInsets();
  const [localItem, setLocalItem] = useState<RelatedPayment>(item);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState(item.notes || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalItem(item);
  }, [item.id, item.amount, item.display_amount, item.remaining_amount, item.paid_amount, item.actual_paid_amount, item.notes, item.status, item.badge, item.paid_date, item.due_date, item.title, item.subtitle]);

  const displayItem = localItem;
  const bottomSafeGap = Math.max(insets.bottom, 10) + 48;
  const meta = useMemo(() => statusMeta(displayItem), [displayItem.status, displayItem.badge]);
  const isPaid = statusKey(displayItem) === "paid";
  const shownAmount = isPaid
    ? (displayItem.paid_amount ?? displayItem.actual_paid_amount ?? displayItem.display_amount ?? displayItem.amount)
    : (displayItem.display_amount ?? displayItem.remaining_amount ?? displayItem.amount);
  const originalAmount = displayItem.amount;
  const dueDate = displayItem.due_date || displayItem.title || "-";
  const paidDate = displayItem.paid_date || "لم تسجل بعد";
  const deadlineDate = displayItem.deadline_date || displayItem.subtitle || "";

  function openSheet(nextMode: Mode) {
    setMode(nextMode);
    setAmount("0");
    setNote(displayItem.notes || "");
    setSheetVisible(true);
  }

  function closeSheet() {
    if (saving) return;
    setSheetVisible(false);
  }

  async function refreshFromServer() {
    await Promise.resolve(onChanged()).catch(() => undefined);
  }

  async function registerPayment(paymentAmount: string, notes: string) {
    await apiPostAny(
      [`/payments/${displayItem.id}/pay`, `/my/payments/${displayItem.id}/pay`, `/edit-delete-center/payments/${displayItem.id}/pay`, `/my/edit-delete-center/payments/${displayItem.id}/pay`],
      { amount: paymentAmount, notes },
    );
  }

  async function payFullAmount() {
    const fullAmount = amountInput(shownAmount);
    if (amountNumber(fullAmount) <= 0) {
      Alert.alert("تنبيه", "لا توجد قيمة مطلوبة لاعتمادها كدفعة.");
      return;
    }
    try {
      setSaving(true);
      await registerPayment(fullAmount, displayItem.notes || "تم السداد كاملًا.");
      setLocalItem((current) => ({
        ...current,
        status: "paid",
        badge: "مدفوعة",
        paid_date: todayText(),
        paid_amount: fullAmount,
        actual_paid_amount: fullAmount,
        display_amount: fullAmount,
        remaining_amount: 0,
      }));
      await refreshFromServer();
      Alert.alert("تم", "تم اعتماد قيمة الدفعة المطلوبة كدفعة مستلمة");
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تسجيل الدفع");
    } finally {
      setSaving(false);
    }
  }

  async function saveSheet() {
    const numericAmount = Number(String(amount || "0").replace(/,/g, ""));
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      Alert.alert("تنبيه", "أدخل قيمة صحيحة للدفعة.");
      return;
    }

    try {
      setSaving(true);
      if (numericAmount > 0) {
        await registerPayment(String(numericAmount), note.trim());
      } else {
        await apiPostAny(
          [`/edit-delete-center/payments/${displayItem.id}/update`, `/my/edit-delete-center/payments/${displayItem.id}/update`],
          { fields: { notes: note.trim() } },
        );
      }

      setLocalItem((current) => ({
        ...current,
        notes: note.trim(),
        status: numericAmount > 0 ? "paid" : current.status,
        badge: numericAmount > 0 ? "مدفوعة" : current.badge,
        paid_date: numericAmount > 0 ? todayText() : current.paid_date,
        paid_amount: numericAmount > 0 ? String(numericAmount) : current.paid_amount,
        actual_paid_amount: numericAmount > 0 ? String(numericAmount) : current.actual_paid_amount,
        display_amount: numericAmount > 0 ? String(numericAmount) : current.display_amount,
        remaining_amount: numericAmount > 0 ? 0 : current.remaining_amount,
      }));
      setSheetVisible(false);
      await refreshFromServer();
      Alert.alert("تم", numericAmount > 0 ? "تم اعتماد المبلغ المكتوب كدفعة مستلمة" : "تم حفظ التعديل بدون تسجيل مبلغ دفع");
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
              [`/edit-delete-center/payments/${displayItem.id}/delete`, `/my/edit-delete-center/payments/${displayItem.id}/delete`, `/payments/${displayItem.id}/delete`],
              {},
            );
            await refreshFromServer();
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
      <TouchableOpacity activeOpacity={0.92} style={[styles.card, { backgroundColor: meta.card, borderColor: meta.border }]} onPress={onToggle}>
        <View style={styles.compactTopRow}>
          <View style={styles.statusWrap}>
            <View style={[styles.accentDot, { backgroundColor: meta.accent }]} />
            <Text style={[styles.statusChip, { backgroundColor: meta.bg, color: meta.fg }]}>{meta.label}</Text>
          </View>
          <Text style={styles.title}>القسط {index + 1}</Text>
        </View>

        <View style={styles.compactBodyRow}>
          <View style={styles.amountPanel}>
            <Text style={styles.amountLabel}>{isPaid ? "المسدد" : "المطلوب"}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.amountValue}>{amountText(shownAmount)}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.dateText} numberOfLines={1}>استحقاق: {dueDate}</Text>
            {deadlineDate ? <Text style={styles.miniText} numberOfLines={1}>مهلة: {deadlineDate}</Text> : null}
            <Text style={styles.miniText} numberOfLines={1}>{isPaid ? `دفع: ${paidDate}` : "غير مدفوعة"}</Text>
          </View>
        </View>

        <View style={styles.compactFooterRow}>
          <Text style={styles.tapHint}>{expanded ? "إخفاء الخيارات" : "اضغط للخيارات"}</Text>
          <Text style={styles.chevron}>{expanded ? "⌃" : "⌄"}</Text>
        </View>

        {expanded ? (
          <View style={styles.expandedArea}>
            <View style={styles.actionRow}>
              {!isPaid ? <ActionPill icon="💳" label={saving ? "جاري..." : "دفع"} tone="success" onPress={payFullAmount} /> : null}
              <ActionPill icon="✎" label="تعديل" tone="dark" onPress={() => openSheet("edit")} />
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
                  <Text style={styles.sheetEyebrow}>تعديل بيانات القسط</Text>
                  <Text style={styles.sheetTitle}>تعديل الدفعة</Text>
                  <Text style={styles.sheetSubtitle}>القسط {index + 1} • {dueDate}</Text>
                </View>
              </View>

              <View style={[styles.sheetSummary, { borderColor: meta.border, backgroundColor: meta.card }]}> 
                <View style={styles.sheetSummaryTop}>
                  <Text style={[styles.sheetStatus, { backgroundColor: meta.bg, color: meta.fg }]}>{meta.label}</Text>
                  <Text style={styles.summaryLabel}>قيمة القسط الأصلية</Text>
                </View>
                <Text style={styles.summaryAmount}>{amountText(originalAmount)}</Text>
              </View>

              <View style={styles.quickActions}>
                <TouchableOpacity style={styles.helperButton} onPress={() => setAmount("0")} activeOpacity={0.85}>
                  <Text style={styles.helperText}>تصفير المبلغ</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.helperButton} onPress={() => setAmount(amountInput(shownAmount))} activeOpacity={0.85}>
                  <Text style={styles.helperText}>اعتماد المطلوب</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.helperButton} onPress={() => setNote("تم السداد عبر حوالة بنكية.")} activeOpacity={0.85}>
                  <Text style={styles.helperText}>ملاحظة جاهزة</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>مبلغ مدفوع جديد</Text>
              <TextInput value={amount} onChangeText={setAmount} style={styles.input} keyboardType="decimal-pad" textAlign="right" placeholder="0" placeholderTextColor="#9CA3AF" />

              <Text style={styles.fieldLabel}>الملاحظات / نص الحوالة</Text>
              <TextInput value={note} onChangeText={setNote} style={[styles.input, styles.notesInput]} textAlign="right" multiline placeholder="مثال: حوالة الراجحي - رقم العملية..." placeholderTextColor="#9CA3AF" />
            </ScrollView>

            <View style={[styles.sheetActionsDock, { paddingBottom: bottomSafeGap }]}> 
              <View style={styles.sheetActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={closeSheet} activeOpacity={0.85}>
                  <Text style={styles.cancelText}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveButton, saving ? styles.disabled : null]} onPress={saveSheet} disabled={saving} activeOpacity={0.85}>
                  <Text style={styles.saveText}>{saving ? "جاري الحفظ..." : "حفظ التعديل"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 9, marginTop: 7, borderWidth: 1, shadowColor: "#111827", shadowOpacity: 0.035, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  compactTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  statusWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusChip: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: "900" },
  accentDot: { width: 9, height: 9, borderRadius: 999 },
  title: { color: "#111827", fontSize: 17, fontWeight: "900", textAlign: "right" },
  compactBodyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  amountPanel: { width: 96, minHeight: 58, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 7, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(229,231,235,0.85)", justifyContent: "center" },
  amountLabel: { color: "#6B7280", fontSize: 10, fontWeight: "900", textAlign: "left" },
  amountValue: { color: "#111827", fontSize: 14, lineHeight: 18, fontWeight: "900", textAlign: "left", marginTop: 2 },
  infoBlock: { flex: 1, alignItems: "flex-end", justifyContent: "center", gap: 2 },
  dateText: { color: "#4B5563", fontSize: 11, fontWeight: "900", textAlign: "right" },
  miniText: { color: "#7A766F", fontSize: 10.5, lineHeight: 15, fontWeight: "800", textAlign: "right" },
  compactFooterRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: "rgba(229,231,235,0.75)" },
  tapHint: { color: "#6B7280", fontSize: 10.5, fontWeight: "900", textAlign: "center" },
  chevron: { color: "#111827", fontSize: 13, fontWeight: "900" },
  expandedArea: { marginTop: 6 },
  actionRow: { flexDirection: "row-reverse", gap: 6, flexWrap: "wrap" },
  actionPill: { flexGrow: 1, minWidth: 76, minHeight: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderWidth: 1 },
  actionDark: { backgroundColor: "#111827", borderColor: "#111827" },
  actionDanger: { backgroundColor: "#FDECEC", borderColor: "#F4C7CC" },
  actionSuccess: { backgroundColor: "#16834F", borderColor: "#16834F" },
  actionPillText: { color: "#111827", fontSize: 11, fontWeight: "900", textAlign: "center" },
  actionPillTextLight: { color: "#FFFFFF" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.46)" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 9, maxHeight: "84%" },
  handle: { alignSelf: "center", width: 72, height: 6, borderRadius: 999, backgroundColor: "#D8D3CB", marginBottom: 8 },
  sheetScroll: { paddingHorizontal: 16, paddingBottom: 12 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#E5E2DD", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#6B7280", fontSize: 27, lineHeight: 30, fontWeight: "300" },
  sheetTitleBlock: { flex: 1, alignItems: "flex-end" },
  sheetEyebrow: { color: "#8D6B2C", fontSize: 11, fontWeight: "900", textAlign: "right", marginBottom: 3 },
  sheetTitle: { color: "#111827", fontSize: 24, fontWeight: "900", textAlign: "right" },
  sheetSubtitle: { color: "#7A766F", fontSize: 12, fontWeight: "800", marginTop: 4, textAlign: "right" },
  sheetSummary: { borderRadius: 20, padding: 13, marginBottom: 10, borderWidth: 1 },
  sheetSummaryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetStatus: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: "900" },
  summaryLabel: { color: "#6B7280", fontSize: 12, fontWeight: "900", textAlign: "right" },
  summaryAmount: { color: "#111827", fontSize: 28, fontWeight: "900", textAlign: "right", marginTop: 8 },
  quickActions: { flexDirection: "row-reverse", gap: 8, marginBottom: 10 },
  helperButton: { flex: 1, minHeight: 38, borderRadius: 999, backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#E5E2DD", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  helperText: { color: "#111827", fontSize: 12, fontWeight: "900", textAlign: "center" },
  fieldLabel: { color: "#111827", fontSize: 14, fontWeight: "900", textAlign: "right", marginBottom: 7, marginTop: 4 },
  input: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 15, paddingHorizontal: 13, paddingVertical: 10, color: "#111827", fontSize: 16, fontWeight: "800", minHeight: 48, marginBottom: 8 },
  notesInput: { minHeight: 74, textAlignVertical: "top", fontSize: 14, lineHeight: 20 },
  sheetActionsDock: { paddingHorizontal: 16, paddingTop: 9, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EEECE7" },
  sheetActions: { flexDirection: "row", gap: 10 },
  cancelButton: { width: 96, minHeight: 52, borderRadius: 18, backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#E5E2DD", alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#111827", fontSize: 14, fontWeight: "900" },
  saveButton: { flex: 1, minHeight: 52, borderRadius: 18, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  saveText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.65 },
});
