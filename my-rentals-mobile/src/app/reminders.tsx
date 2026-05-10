import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGetScoped, apiPost } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type Reminder = {
  id: number;
  amount?: number;
  due_date?: string | null;
  status?: string | null;
  days_late?: number;
  is_overdue_by_date?: boolean;
  tenant_name?: string | null;
  tenant_phone?: string | null;
  property_name?: string | null;
  owner_name?: string | null;
  unit_number?: string | null;
  contract_number?: string | null;
  message?: string | null;
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function normalizePhone(phone?: string | null) {
  if (!phone) return "";

  let value = String(phone).trim();
  value = value.replace(/[^\d+]/g, "");

  if (value.startsWith("+")) {
    return value.replace("+", "");
  }

  if (value.startsWith("00")) {
    return value.slice(2);
  }

  if (value.startsWith("05")) {
    return `966${value.slice(1)}`;
  }

  if (value.startsWith("5") && value.length === 9) {
    return `966${value}`;
  }

  return value;
}

function statusLabel(item: Reminder) {
  if ((item.days_late || 0) > 0 || item.status === "overdue") {
    return `متأخرة ${item.days_late || 0} يوم`;
  }

  return "مستحقة / قادمة";
}

export default function RemindersScreen() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/payment-reminders?days=30",
        "/my/payment-reminders?days=30"
      );

      setItems(Array.isArray(result) ? result : []);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل التذكيرات");
    } finally {
      setLoading(false);
    }
  }

  async function openWhatsapp(item: Reminder) {
    const phone = normalizePhone(item.tenant_phone);

    if (!phone) {
      Alert.alert("تنبيه", "لا يوجد رقم جوال للمستأجر");
      return;
    }

    const message = item.message || "تذكير بسداد دفعة إيجار";
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      Alert.alert("تنبيه", "تعذر فتح واتساب على هذا الجهاز");
      return;
    }

    await Linking.openURL(url);
  }

  async function markPaid(id: number) {
    try {
      setUpdatingId(id);
      await apiPost(`/payments/${id}/mark-paid`);
      Alert.alert("تم", "تم تسجيل الدفعة كمدفوعة");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحديث الدفعة");
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

  const overdue = items.filter((item) => (item.days_late || 0) > 0 || item.status === "overdue");
  const upcoming = items.filter((item) => !((item.days_late || 0) > 0 || item.status === "overdue"));
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>تذكيرات السداد</Text>
        <Text style={styles.subtitle}>
          رسائل جاهزة للدفعات المتأخرة والقادمة خلال 30 يوم
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>إجمالي التذكيرات: {items.length}</Text>
          <Text style={styles.summaryText}>المتأخرة: {overdue.length} | القادمة: {upcoming.length}</Text>
          <Text style={styles.summaryText}>إجمالي المبالغ: {money(total)}</Text>
        </View>
{loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل التذكيرات...</Text>
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد دفعات تحتاج تذكير حاليًا</Text>
          </View>
        ) : null}

        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.badge}>{statusLabel(item)}</Text>
              <Text style={styles.amount}>{money(item.amount)}</Text>
            </View>

            <Text style={styles.detail}>المستأجر: {item.tenant_name || "-"}</Text>
            <Text style={styles.detail}>الجوال: {item.tenant_phone || "-"}</Text>
            <Text style={styles.detail}>العقار: {item.property_name || "-"}</Text>
            <Text style={styles.detail}>الوحدة: {item.unit_number || "-"}</Text>
            <Text style={styles.detail}>العقد: {item.contract_number || "-"}</Text>
            <Text style={styles.detail}>تاريخ الاستحقاق: {item.due_date || "-"}</Text>

            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{item.message || "-"}</Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.whatsappButton]}
                onPress={() => openWhatsapp(item)}
              >
                <Text style={styles.actionText}>واتساب</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.paidButton]}
                onPress={() => markPaid(item.id)}
                disabled={updatingId === item.id}
              >
                <Text style={styles.actionText}>
                  {updatingId === item.id ? "..." : "مدفوعة"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 18, paddingBottom: 50 },
  title: { fontSize: 30, fontWeight: "800", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", fontSize: 15, textAlign: "right" },
  summaryBox: { backgroundColor: "#111827", borderRadius: 18, padding: 16, marginBottom: 14 },
  summaryText: { color: "#fff", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  primaryButton: { backgroundColor: "#111827", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  badge: { backgroundColor: "#fee2e2", color: "#991b1b", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  amount: { color: "#111827", fontSize: 22, fontWeight: "800", textAlign: "right", flex: 1 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  messageBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 12 },
  messageText: { color: "#374151", lineHeight: 22, textAlign: "right" },
  actionsRow: { flexDirection: "row-reverse", marginTop: 14 },
  actionButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  whatsappButton: { backgroundColor: "#16a34a" },
  paidButton: { backgroundColor: "#0F9B6F" },
  actionText: { color: "#fff", fontWeight: "800" },
});
