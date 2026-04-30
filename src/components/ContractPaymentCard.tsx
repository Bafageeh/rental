import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
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
  if (status === "paid") return { label: "مدفوعة", bg: "#e9f7ea", fg: "#16834f", card: "#fbfdfb", border: "#d8eddc" };
  if (status === "overdue") return { label: "متأخرة", bg: "#fde8e8", fg: "#c73847", card: "#fff8f8", border: "#f4cccc" };
  if (status === "next") return { label: "التالي", bg: "#e5f2ff", fg: "#2878ad", card: "#f7fbff", border: "#cfe6ff" };
  return { label: "مستحقة", bg: "#f5efe3", fg: "#8d6b2c", card: "#fdfbf7", border: "#eee3d1" };
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
      await apiPostAny([
        `/edit-delete-center/payments/${item.id}/update`,
        `/my/edit-delete-center/payments/${item.id}/update`,
      ], { fields: { amount: String(numericAmount), notes: note.trim() } });

      if (mode === "pay") {
        await apiPostAny([
          `/payments/${item.id}/mark-paid`,
          `/my/payments/${item.id}/mark-paid`,
        ], {});
      }

      setSheetVisible(false);
      await onChanged();
      Alert.alert("تم", mode === "pay" ? "تم تسجيل الدفعة" : "تم حفظ التعديل");
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ الدفعة");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert("إلغاء الدفعة", "هل تريد إلغاء هذه الدفعة؟", [
      { text: "تراجع", style: "cancel" },
      {
        text: "إلغاء الدفعة",
        style: "destructive",
        onPress: async () => {
          try {
            await apiPostAny([
              `/edit-delete-center/payments/${item.id}/delete`,
              `/my/edit-delete-center/payments/${item.id}/delete`,
              `/payments/${item.id}/delete`,
            ], {});
            await onChanged();
          } catch (e) {
            Alert.alert("تعذر الإلغاء", e instanceof Error ? e.message : "تعذر إلغاء الدفعة");
          }
        },
      },
    ]);
  }

  return (
    <>
      <TouchableOpacity activeOpacity={0.9} style={[styles.card, { backgroundColor: meta.card, borderColor: meta.border }]} onPress={onToggle}>
        <View style={styles.mainRow}>
          <TouchableOpacity
            style={[styles.circleAction, isPaid ? styles.editCircle : styles.payCircle]}
            onPress={(event) => {
              event.stopPropagation?.();
              openSheet(isPaid ? "edit" : "pay");
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.circleIcon, isPaid ? styles.editCircleText : styles.payCircleText]}>{isPaid ? "✎" : "✓"}</Text>
            <Text style={styles.circleLabel}>{isPaid ? "تعديل" : "دفع"}</Text>
          </TouchableOpacity>

          <View style={styles.amountBlock}>
            <Text style={styles.amountText}>{amountText(item.amount)}</Text>
            <Text style={styles.smallText}>{isPaid ? "المسجل" : "المطلوب"}</Text>
          </View>

          <View style={styles.infoBlock}>
            <View style={styles.titleRow}>
              <Text style={styles.chevron}>‹</Text>
              <Text style={styles.title}>القسط {index + 1}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateText}>• {dueDate}</Text>
              <Text style={[styles.statusChip, { backgroundColor: meta.bg, color: meta.fg }]}>{meta.label}</Text>
            </View>
            <Text numberOfLines={1} style={styles.noteText}>{item.notes || item.subtitle || "بانتظار تسجيل الدفعة"}</Text>
          </View>
        </View>

        {expanded ? (
          <View style={styles.expandedArea}>
            <TouchableOpacity style={styles.editButton} onPress={() => openSheet("edit")} activeOpacity={0.85}>
              <Text style={styles.buttonIcon}>✎</Text>
              <Text style={styles.editText}>تعديل الدفعة</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete} activeOpacity={0.85}>
              <Text style={styles.buttonIcon}>🗑</Text>
              <Text style={styles.deleteText}>إلغاء الدفعة</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={closeSheet}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeSheet} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <TouchableOpacity style={styles.closeButton} onPress={closeSheet} activeOpacity={0.85}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
              <View style={styles.sheetTitleBlock}>
                <Text style={styles.sheetTitle}>{mode === "pay" ? "تسجيل دفعة" : "تعديل الدفعة"}</Text>
                <Text style={styles.sheetSubtitle}>القسط {index + 1} • استحقاق {dueDate}</Text>
              </View>
            </View>

            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>المبلغ المطلوب</Text>
              <Text style={styles.bigAmount}>{amountText(item.amount)}</Text>
              <Text style={styles.amountHint}>يمكن تعديل المبلغ إذا كانت الحوالة أقل أو أعلى من قيمة القسط.</Text>
              <Text style={[styles.sheetStatus, { backgroundColor: meta.bg, color: meta.fg }]}>{meta.label}</Text>
            </View>

            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.helperButton} onPress={() => setAmount(amountInput(item.amount))} activeOpacity={0.85}>
                <Text style={styles.helperText}>اعتماد المبلغ الكامل ✨</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.helperButton} onPress={() => setNote("تم السداد بدون ملاحظة.")} activeOpacity={0.85}>
                <Text style={styles.helperText}>إضافة ملاحظة جاهزة 🧾</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>قيمة الحوالة البنكية</Text>
            <TextInput value={amount} onChangeText={setAmount} style={styles.input} keyboardType="decimal-pad" textAlign="right" placeholder="قيمة الدفعة" />
            <Text style={styles.inputHint}>المبلغ الافتراضي {amountText(item.amount)}</Text>

            <Text style={styles.fieldLabel}>النص البنكي / ملاحظة</Text>
            <TextInput value={note} onChangeText={setNote} style={[styles.input, styles.notesInput]} textAlign="right" multiline placeholder="مثال: حوالة بنك الراجحي 15:20" />

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeSheet} activeOpacity={0.85}>
                <Text style={styles.cancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, saving ? styles.disabled : null]} onPress={saveSheet} disabled={saving} activeOpacity={0.85}>
                <Text style={styles.saveText}>{saving ? "جاري الحفظ..." : mode === "pay" ? "حفظ الدفعة 💳" : "حفظ التعديل 💾"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 21, padding: 13, marginTop: 10, borderWidth: 1, shadowColor: "#111827", shadowOpacity: 0.035, shadowRadius: 12, elevation: 1 },
  mainRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  circleAction: { width: 64, minHeight: 78, borderRadius: 32, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  payCircle: { backgroundColor: "#e6faef", borderColor: "#b8ead0" },
  editCircle: { backgroundColor: "#ffffff", borderColor: "#e5e7eb" },
  circleIcon: { fontSize: 25, lineHeight: 28, fontWeight: "900" },
  payCircleText: { color: "#16834f" },
  editCircleText: { color: "#111827" },
  circleLabel: { color: "#4b5563", fontSize: 12, fontWeight: "800", marginTop: 4 },
  amountBlock: { minWidth: 93, alignItems: "flex-start" },
  amountText: { color: "#111827", fontSize: 17, fontWeight: "900", textAlign: "left" },
  smallText: { color: "#7b776f", fontSize: 12, fontWeight: "800", marginTop: 5, textAlign: "left" },
  infoBlock: { flex: 1, alignItems: "flex-end" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: "#111827", fontSize: 20, fontWeight: "900", textAlign: "right" },
  chevron: { color: "#6b7280", fontSize: 31, lineHeight: 33, fontWeight: "700" },
  dateRow: { flexDirection: "row-reverse", alignItems: "center", gap: 9, marginTop: 8 },
  dateText: { color: "#8b8983", fontSize: 12, fontWeight: "800" },
  statusChip: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, fontWeight: "900" },
  noteText: { color: "#77736c", fontSize: 13, fontWeight: "700", marginTop: 9, textAlign: "right", maxWidth: "100%" },
  expandedArea: { borderTopWidth: 1, borderTopColor: "#EDECE9", marginTop: 14, paddingTop: 12, flexDirection: "row-reverse", gap: 10 },
  editButton: { flex: 1, minHeight: 48, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  deleteButton: { flex: 1, minHeight: 48, borderRadius: 18, backgroundColor: "#fde8e8", borderWidth: 1, borderColor: "#f2b8bd", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonIcon: { fontSize: 16 },
  editText: { color: "#111827", fontSize: 13, fontWeight: "900" },
  deleteText: { color: "#b42335", fontSize: 13, fontWeight: "900" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.42)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 26, maxHeight: "88%" },
  handle: { alignSelf: "center", width: 84, height: 7, borderRadius: 999, backgroundColor: "#D9D5CE", marginBottom: 17 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  closeButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#E5E2DD", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#6b7280", fontSize: 31, lineHeight: 35, fontWeight: "300" },
  sheetTitleBlock: { flex: 1, alignItems: "flex-end" },
  sheetTitle: { color: "#111827", fontSize: 29, fontWeight: "900", textAlign: "right" },
  sheetSubtitle: { color: "#7A766F", fontSize: 14, fontWeight: "800", marginTop: 6, textAlign: "right" },
  amountCard: { backgroundColor: "#F3F0EA", borderRadius: 24, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#E5E0D7" },
  amountLabel: { alignSelf: "flex-end", overflow: "hidden", backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, color: "#111827", fontWeight: "900", fontSize: 13 },
  bigAmount: { color: "#111827", fontSize: 33, fontWeight: "900", textAlign: "right", marginTop: 13 },
  amountHint: { color: "#6b6258", fontSize: 13, fontWeight: "700", textAlign: "right", marginTop: 10, lineHeight: 20 },
  sheetStatus: { position: "absolute", left: 16, top: 16, overflow: "hidden", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, fontWeight: "900" },
  quickActions: { flexDirection: "row-reverse", gap: 9, marginBottom: 15 },
  helperButton: { flex: 1, minHeight: 43, borderRadius: 999, backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#E5E2DD", alignItems: "center", justifyContent: "center", paddingHorizontal: 9 },
  helperText: { color: "#111827", fontSize: 12, fontWeight: "900", textAlign: "center" },
  fieldLabel: { color: "#111827", fontSize: 16, fontWeight: "900", textAlign: "right", marginBottom: 9, marginTop: 5 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, color: "#111827", fontSize: 17, fontWeight: "800", minHeight: 52, marginBottom: 7 },
  inputHint: { color: "#8b8983", fontSize: 12, fontWeight: "700", textAlign: "right", marginBottom: 11 },
  notesInput: { minHeight: 95, textAlignVertical: "top", fontSize: 15, lineHeight: 22 },
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 14 },
  cancelButton: { width: 105, minHeight: 58, borderRadius: 19, backgroundColor: "#F7F6F4", borderWidth: 1, borderColor: "#E5E2DD", alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#111827", fontSize: 15, fontWeight: "900" },
  saveButton: { flex: 1, minHeight: 58, borderRadius: 19, backgroundColor: "#181815", alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  disabled: { opacity: 0.65 },
});
