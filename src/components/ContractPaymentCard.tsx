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
  const insets = useSafeAreaInsets();
  const [localItem, setLocalItem] = useState<RelatedPayment>(item);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [mode, setMode] = useState<Mode>("pay");
  const [amount, setAmount] = useState(amountInput(item.amount));
  const [note, setNote] = useState(item.notes || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalItem(item);
  }, [item.id, item.amount, item.notes, item.status, item.badge, item.paid_date, item.due_date, item.title, item.subtitle]);

  const displayItem = localItem;
  const bottomSafeGap = Math.max(insets.bottom, 10) + 48;
  const meta = useMemo(() => statusMeta(displayItem), [displayItem.status, displayItem.badge]);
  const isPaid = statusKey(displayItem) === "paid";
  const dueDate = displayItem.due_date || displayItem.title || "-";
  const paidDate = displayItem.paid_date || "لم تسجل بعد";
  const deadlineLine = displayItem.deadline_date
    ? `نهاية مهلة السداد: ${displayItem.deadline_date}`
    : (displayItem.subtitle || "");

  function openSheet(nextMode: Mode) {
    setMode(nextMode);
    setAmount(amountInput(displayItem.amount));
    setNote(displayItem.notes || "");
    setSheetVisible(true);
  }

  function closeSheet() {
    if (saving) return;
    setSheetVisible(false);
  }

  function refreshFromServer() {
    Promise.resolve(onChanged()).catch(() => undefined);
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
          `/edit-delete-center/payments/${displayItem.id}/update`,
          `/my/edit-delete-center/payments/${displayItem.id}/update`,
        ],
        { fields: { amount: String(numericAmount), notes: note.trim() } },
      );

      if (mode === "pay") {
        await apiPostAny(
          [
            `/payments/${displayItem.id}/mark-paid`,
            `/my/payments/${displayItem.id}/mark-paid`,
          ],
          {},
        );
      }

      setLocalItem((current) => ({
        ...current,
        amount: String(numericAmount),
        notes: note.trim(),
        status: mode === "pay" ? "paid" : current.status,
        badge: mode === "pay" ? "مدفوعة" : current.badge,
        paid_date: mode === "pay" ? todayText() : current.paid_date,
      }));
      setSheetVisible(false);
      refreshFromServer();
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
                `/edit-delete-center/payments/${displayItem.id}/delete`,
                `/my/edit-delete-center/payments/${displayItem.id}/delete`,
                `/payments/${displayItem.id}/delete`,
              ],
              {},
            );
            refreshFromServer();
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
          <View style={styles.statusSide}>
            <View style={[styles.accentDot, { backgroundColor: meta.accent }]} />
            <Text style={[styles.statusChip, { backgroundColor: meta.bg, color: meta.fg }]}>{meta.label}</Text>
          </View>
          <Text style={styles.title}>القسط {index + 1}</Text>
        </View>

        <View style={styles.mainRow}>
          <View style={styles.amountPanel}>
            <Text style={styles.amountLabel}>{isPaid ? "المسدد" : "المطلوب"}</Text>
            <Text numberOfLines={2} style={styles.amountValue}>{amountText(displayItem.amount)}</Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.dateText} numberOfLines={1}>استحقاق: {dueDate}</Text>
            {deadlineLine ? <Text style={styles.noteText} numberOfLines={1}>{deadlineLine}</Text> : null}
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
            <Text style={[styles.optionsButtonText, expanded ? styles.optionsButtonTextActive : null]}>{expanded ? "إخفاء" : "خيارات"}</Text>
            <Text style={[styles.optionsIcon, expanded ? styles.optionsButtonTextActive : null]}>{expanded ? "⌃" : "⌄"}</Text>
          </TouchableOpacity>

          <View style={styles.datePill}>
            <Text style={styles.datePillText} numberOfLines={1}>{isPaid ? `تاريخ الدفع: ${paidDate}` : "لم يتم الدفع"}</Text>
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
                  <Text style={styles.sheetSubtitle}>القسط {index + 1} • {dueDate}</Text>
                </View>
              </View>

              <View style={[styles.sheetSummary, { borderColor: meta.border, backgroundColor: meta.card }]}> 
                <View style={styles.sheetSummaryTop}>
                  <Text style={[styles.sheetStatus, { backgroundColor: meta.bg, color: meta.fg }]}>{meta.label}</Text>
                  <Text style={styles.summaryLabel}>{mode === "pay" ? "المبلغ المراد سداده" : "المبلغ الحالي"}</Text>
                </View>
                <Text style={styles.summaryAmount}>{amountText(displayItem.amount)}</Text>
              </View>

              <View style={styles.quickActions}>
                <TouchableOpacity style={styles.helperButton} onPress={() => setAmount(amountInput(displayItem.amount))} activeOpacity={0.85}>
                  <Text style={styles.helperText}>اعتماد المبلغ</Text>
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
            </ScrollView>

            <View style={[styles.sheetActionsDock, { paddingBottom: bottomSafeGap }]}> 
              <View style={styles.sheetActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={closeSheet} activeOpacity={0.85}>
                  <Text style={styles.cancelText}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveButton, saving ? styles.disabled : null]} onPress={saveSheet} disabled={saving} activeOpacity={0.85}>
                  <Text style={styles.saveText}>{saving ? "جاري الحفظ..." : mode === "pay" ? "حفظ الدفع" : "حفظ التعديل"}</Text>
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
  card: {
    borderRadius: 19,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    shadowColor: "#111827",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  topStrip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7 },
  statusSide: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusChip: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: "900" },
  accentDot: { width: 10, height: 10, borderRadius: 999 },
  mainRow: { flexDirection: "row", alignItems: "stretch", gap: 9 },
  amountPanel: { width: 98, borderRadius: 16, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(229,231,235,0.85)", justifyContent: "center" },
  amountLabel: { color: "#6B7280", fontSize: 11, fontWeight: "900", textAlign: "left" },
  amountValue: { color: "#111827", fontSize: 15, lineHeight: 20, fontWeight: "900", textAlign: "left", marginTop: 3 },
  infoBlock: { flex: 1, alignItems: "flex-end", justifyContent: "center", gap: 4 },
  title: { color: "#111827", fontSize: 18, fontWeight: "900", textAlign: "right" },
  dateText: { color: "#6B7280", fontSize: 12, fontWeight: "800", textAlign: "right" },
  noteText: { color: "#7A766F", fontSize: 12, lineHeight: 17, fontWeight: "700", textAlign: "right" },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 },
  optionsButton: { minHeight: 36, minWidth: 92, borderRadius: 13, backgroundColor: "#111827", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10 },
  optionsButtonActive: { backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#E5E2DD" },
  optionsButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  optionsButtonTextActive: { color: "#111827" },
  optionsIcon: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  datePill: { flex: 1, minHeight: 36, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.62)", alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(229,231,235,0.8)" },
  datePillText: { color: "#6B7280", fontSize: 11, fontWeight: "800", textAlign: "right" },
  expandedArea: { borderTopWidth: 1, borderTopColor: "rgba(229,231,235,0.9)", marginTop: 10, paddingTop: 10 },
  expandedHeader: { alignItems: "flex-end", marginBottom: 8 },
  expandedHint: { color: "#6B7280", fontSize: 11, fontWeight: "800", textAlign: "right" },
  actionRow: { flexDirection: "row-reverse", gap: 7, flexWrap: "wrap" },
  actionPill: { flexGrow: 1, minWidth: 86, minHeight: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, borderWidth: 1 },
  actionDark: { backgroundColor: "#111827", borderColor: "#111827" },
  actionLight: { backgroundColor: "#FFFFFF", borderColor: "#E5E7EB" },
  actionDanger: { backgroundColor: "#FDECEC", borderColor: "#F4C7CC" },
  actionSuccess: { backgroundColor: "#16834F", borderColor: "#16834F" },
  actionPillText: { color: "#111827", fontSize: 12, fontWeight: "900", textAlign: "center" },
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
