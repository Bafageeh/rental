import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGetScoped } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type MessageItem = {
  id: number;
  type?: string;
  severity?: string;
  title?: string;
  tenant_name?: string | null;
  tenant_phone?: string | null;
  owner_name?: string | null;
  owner_phone?: string | null;
  property_name?: string | null;
  unit_number?: string | null;
  contract_number?: string | number | null;
  amount?: number;
  due_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  days?: number | null;
  balance?: number;
  overdue?: number;
  message?: string;
};

type CommunicationPayload = {
  summary?: {
    payment_reminders?: number;
    contract_renewals?: number;
    tenant_statements?: number;
    owner_statements?: number;
  };
  payment_reminders?: MessageItem[];
  contract_renewals?: MessageItem[];
  tenant_statements?: MessageItem[];
  owner_statements?: MessageItem[];
  settings?: {
    company_name?: string;
    company_phone?: string;
    payment_reminder_days?: number;
    contract_renewal_days?: number;
  };
};

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

function statusLabel(value?: string | null) {
  if (value === "due") return "مستحقة";
  if (value === "overdue") return "متأخرة";
  if (value === "partial") return "جزئية";
  if (value === "paid") return "مدفوعة";
  return value || "-";
}

function daysLabel(days?: number | null, futureLabel = "باقي", pastLabel = "متأخر") {
  if (days === null || days === undefined) return "-";
  if (days < 0) return `${pastLabel} ${Math.abs(days)} يوم`;
  if (days === 0) return "اليوم";
  return `${futureLabel} ${days} يوم`;
}

function severityStyle(severity?: string) {
  if (severity === "late" || severity === "expired") return styles.badgeDanger;
  if (severity === "soon") return styles.badgeWarning;
  return styles.badgeInfo;
}

export default function CommunicationCenterScreen() {
  const [data, setData] = useState<CommunicationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("payments");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/communication-center/data",
        "/my/communication-center/data"
      );

      setData(result as CommunicationPayload);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل مركز المراسلات");
    } finally {
      setLoading(false);
    }
  }

  async function shareMessage(item: MessageItem) {
    if (!item.message) {
      Alert.alert("تنبيه", "لا توجد رسالة جاهزة");
      return;
    }

    try {
      await Share.share({
        title: item.title || "رسالة",
        message: item.message,
      });
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر مشاركة الرسالة");
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

  const tabs = [
    { id: "payments", label: "السداد", count: data?.summary?.payment_reminders ?? 0 },
    { id: "contracts", label: "العقود", count: data?.summary?.contract_renewals ?? 0 },
    { id: "tenants", label: "كشوف المستأجرين", count: data?.summary?.tenant_statements ?? 0 },
    { id: "owners", label: "كشوف الملاك", count: data?.summary?.owner_statements ?? 0 },
  ];

  const visibleItems = useMemo(() => {
    if (tab === "payments") return data?.payment_reminders || [];
    if (tab === "contracts") return data?.contract_renewals || [];
    if (tab === "tenants") return data?.tenant_statements || [];
    if (tab === "owners") return data?.owner_statements || [];
    return [];
  }, [tab, data]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>مركز المراسلات</Text>
        <Text style={styles.subtitle}>
          رسائل جاهزة للمشاركة مع المستأجرين والملاك حسب الدفعات والعقود والكشوف
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>تذكيرات السداد: {data?.summary?.payment_reminders ?? 0}</Text>
          <Text style={styles.summaryText}>تجديد العقود: {data?.summary?.contract_renewals ?? 0}</Text>
          <Text style={styles.summaryText}>كشوف المستأجرين: {data?.summary?.tenant_statements ?? 0}</Text>
          <Text style={styles.summaryText}>كشوف الملاك: {data?.summary?.owner_statements ?? 0}</Text>
        </View>
<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {tabs.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.tabChip, tab === item.id ? styles.tabChipActive : null]}
              onPress={() => {
                setTab(item.id);
                setExpandedKey(null);
              }}
            >
              <Text style={[styles.tabText, tab === item.id ? styles.tabTextActive : null]}>
                {item.label} ({item.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل الرسائل...</Text>
          </View>
        ) : null}

        {!loading && visibleItems.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد رسائل في هذا القسم حاليًا</Text>
          </View>
        ) : null}

        {visibleItems.map((item, index) => {
          const key = `${tab}-${item.id}-${index}`;
          const expanded = expandedKey === key;

          return (
            <View key={key} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={[styles.badge, severityStyle(item.severity)]}>
                  {item.title || "رسالة"}
                </Text>
                <Text style={styles.cardTitle}>
                  {item.tenant_name || item.owner_name || "مستفيد"}
                </Text>
              </View>

              {tab === "payments" ? (
                <>
                  <Text style={styles.detail}>الجوال: {item.tenant_phone || "-"}</Text>
                  <Text style={styles.detail}>العقار: {item.property_name || "-"}</Text>
                  <Text style={styles.detail}>الوحدة: {item.unit_number || "-"}</Text>
                  <Text style={styles.detail}>المبلغ: {money(item.amount)}</Text>
                  <Text style={styles.detail}>الاستحقاق: {item.due_date || "-"} — {daysLabel(item.days)}</Text>
                  <Text style={styles.detail}>الحالة: {statusLabel(item.status)}</Text>
                </>
              ) : null}

              {tab === "contracts" ? (
                <>
                  <Text style={styles.detail}>الجوال: {item.tenant_phone || "-"}</Text>
                  <Text style={styles.detail}>العقد: #{item.contract_number || item.id}</Text>
                  <Text style={styles.detail}>العقار: {item.property_name || "-"}</Text>
                  <Text style={styles.detail}>الوحدة: {item.unit_number || "-"}</Text>
                  <Text style={styles.detail}>نهاية العقد: {item.end_date || "-"} — {daysLabel(item.days, "باقي", "منتهي منذ")}</Text>
                </>
              ) : null}

              {tab === "tenants" ? (
                <>
                  <Text style={styles.detail}>الجوال: {item.tenant_phone || "-"}</Text>
                  <Text style={styles.detail}>الرصيد المستحق: {money(item.balance)}</Text>
                  <Text style={styles.detail}>المتأخر الحالي: {money(item.overdue)}</Text>
                </>
              ) : null}

              {tab === "owners" ? (
                <>
                  <Text style={styles.detail}>الجوال: {item.owner_phone || "-"}</Text>
                  <Text style={styles.detail}>رصيد المالك: {money(item.balance)}</Text>
                </>
              ) : null}

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.previewButton]}
                  onPress={() => setExpandedKey(expanded ? null : key)}
                >
                  <Text style={styles.actionText}>{expanded ? "إخفاء" : "معاينة"}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.shareButton]}
                  onPress={() => shareMessage(item)}
                >
                  <Text style={styles.actionText}>مشاركة</Text>
                </TouchableOpacity>
              </View>

              {expanded ? (
                <View style={styles.previewBox}>
                  <Text style={styles.previewText}>{item.message || "-"}</Text>
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            يتم توليد رسائل السداد وتجديد العقود من قوالب: المزيد ثم إعدادات النظام. يمكن تعديل القوالب حسب صياغتك.
          </Text>
        </View>
      </ScrollView>
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
  tabsRow: { flexDirection: "row-reverse", paddingBottom: 12 },
  tabChip: { backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginLeft: 8, borderWidth: 1, borderColor: "#DDDBD6" },
  tabChipActive: { backgroundColor: "#111827" },
  tabText: { color: "#374151", fontWeight: "900" },
  tabTextActive: { color: "#fff" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  badgeDanger: { backgroundColor: "#fee2e2", color: "#991b1b" },
  badgeWarning: { backgroundColor: "#fef3c7", color: "#92400e" },
  badgeInfo: { backgroundColor: "#dbeafe", color: "#065F44" },
  cardTitle: { color: "#111827", fontSize: 19, fontWeight: "900", textAlign: "right", flex: 1 },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right" },
  actionsRow: { flexDirection: "row-reverse", marginTop: 14 },
  actionButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: "center", marginLeft: 8 },
  previewButton: { backgroundColor: "#111827" },
  shareButton: { backgroundColor: "#16a34a" },
  actionText: { color: "#fff", fontWeight: "900" },
  previewBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginTop: 14 },
  previewText: { color: "#374151", textAlign: "right", lineHeight: 23 },
  noteBox: { backgroundColor: "#fffbeb", borderRadius: 18, padding: 14, marginTop: 4 },
  noteText: { color: "#92400e", fontWeight: "700", textAlign: "right", lineHeight: 22 },
});
