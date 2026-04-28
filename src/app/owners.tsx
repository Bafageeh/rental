import { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGet, apiPost } from "../lib/api";
import InlineEditDeleteActions from "../components/InlineEditDeleteActions";

type Owner = {
  id: number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  national_id?: string | null;
  properties_count?: number;
  units_count?: number;
  contracts_count?: number;
  has_rental_assets?: boolean;
};

function valueOrDash(value?: string | null) {
  return value && String(value).trim() ? value : "-";
}

export default function OwnersScreen() {
  const [items, setItems] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nationalId, setNationalId] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const result = await apiGet("/owners");
      setItems(Array.isArray(result) ? result : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير معروف");
    } finally {
      setLoading(false);
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

  async function saveOwner() {
    if (!name.trim()) {
      Alert.alert("تنبيه", "اكتب اسم المالك");
      return;
    }

    try {
      setSaving(true);

      await apiPost("/owners", {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        national_id: nationalId.trim() || null,
      });

      setName("");
      setPhone("");
      setEmail("");
      setNationalId("");
      setShowForm(false);

      Alert.alert("تم", "تم إضافة المالك بنجاح");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ المالك");
    } finally {
      setSaving(false);
    }
  }

  function openOwnerAssets(owner: Owner) {
    router.push(`/owner/${owner.id}` as never);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.addIconButton, showForm ? styles.closeIconButton : null]}
            onPress={() => setShowForm(!showForm)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={showForm ? "إغلاق نموذج إضافة مالك" : "إضافة مالك جديد"}
          >
            <Text style={styles.addIconText}>{showForm ? "×" : "+"}</Text>
          </TouchableOpacity>

          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>الملاك</Text>
            <Text style={styles.subtitle}>اضغط على بطاقة المالك لعرض تفاصيل الأملاك</Text>
          </View>
        </View>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>بيانات المالك</Text>

            <TextInput
              style={styles.input}
              placeholder="اسم المالك"
              value={name}
              onChangeText={setName}
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="رقم الجوال"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="البريد الإلكتروني"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              textAlign="right"
            />

            <TextInput
              style={styles.input}
              placeholder="رقم الهوية / السجل"
              value={nationalId}
              onChangeText={setNationalId}
              keyboardType="number-pad"
              textAlign="right"
            />

            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveOwner}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={styles.saveButtonText}>{saving ? "جاري الحفظ..." : "حفظ المالك"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل الملاك...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>تعذر تحميل الملاك</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.button} onPress={load} activeOpacity={0.85}>
              <Text style={styles.buttonText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا يوجد ملاك حاليًا</Text>
          </View>
        ) : null}

        {items.map((owner) => (
          <TouchableOpacity
            key={owner.id}
            style={styles.card}
            activeOpacity={0.88}
            onPress={() => openOwnerAssets(owner)}
            accessibilityRole="button"
            accessibilityLabel={`تفاصيل أملاك ${owner.name || "المالك"}`}
          >
            <View style={styles.cardTopRow}>
              <InlineEditDeleteActions
                resource="owners"
                id={owner.id}
                onChanged={load}
                hideDetails
                hideDelete
                compact
                iconOnly
              />

              <Text style={styles.badge}>مالك</Text>
            </View>

            <Text numberOfLines={2} style={styles.cardTitle}>{owner.name || "مالك بدون اسم"}</Text>

            <View style={styles.metricsRow}>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>{owner.properties_count ?? 0}</Text>
                <Text style={styles.metricLabel}>عقار</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>{owner.units_count ?? 0}</Text>
                <Text style={styles.metricLabel}>وحدة</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>{owner.contracts_count ?? 0}</Text>
                <Text style={styles.metricLabel}>عقد</Text>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.detail}>الجوال: {valueOrDash(owner.phone)}</Text>
              <Text style={styles.detail}>البريد: {valueOrDash(owner.email)}</Text>
              <Text style={styles.detail}>رقم الهوية: {valueOrDash(owner.national_id)}</Text>
            </View>

            {owner.has_rental_assets ? (
              <TouchableOpacity
                style={styles.uploadContractButton}
                activeOpacity={0.85}
                onPress={() => router.push(`/upload-contract?owner_id=${owner.id}&owner_name=${encodeURIComponent(owner.name || "مالك")}` as never)}
              >
                <Text style={styles.uploadContractButtonText}>📤 رفع عقد لهذا المالك</Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 12, paddingBottom: 40 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  headerTextBlock: { flex: 1, alignItems: "flex-end" },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#111827",
    textAlign: "right",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#7A766F",
    textAlign: "right",
    fontWeight: "700",
  },
  addIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  closeIconButton: { backgroundColor: "#7f1d1d" },
  addIconText: { color: "#ffffff", fontSize: 30, lineHeight: 34, fontWeight: "900" },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EDECE9",
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    textAlign: "right",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#F7F6F4",
    borderWidth: 1,
    borderColor: "#DDDBD6",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    color: "#111827",
  },
  saveButton: {
    backgroundColor: "#16a34a",
    padding: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: { color: "#fff", fontWeight: "900" },
  box: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 18,
    alignItems: "center",
    marginBottom: 8,
  },
  boxText: { marginTop: 8, color: "#5E5B55", fontWeight: "700" },
  emptyText: { color: "#7A766F", fontWeight: "800" },
  errorBox: {
    backgroundColor: "#fee2e2",
    padding: 12,
    borderRadius: 18,
    marginBottom: 9,
  },
  errorTitle: {
    color: "#991b1b",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },
  errorText: {
    color: "#7f1d1d",
    marginTop: 8,
    textAlign: "right",
  },
  button: {
    marginTop: 14,
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "900" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EDECE9",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badge: {
    backgroundColor: "#e0f2fe",
    color: "#075985",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "900",
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    textAlign: "right",
    marginBottom: 10,
  },
  metricsRow: {
    flexDirection: "row-reverse",
    gap: 7,
    marginBottom: 10,
  },
  metricPill: {
    flex: 1,
    backgroundColor: "#F7F6F4",
    borderWidth: 1,
    borderColor: "#EDECE9",
    borderRadius: 16,
    paddingVertical: 9,
    alignItems: "center",
  },
  metricValue: { color: "#111827", fontWeight: "900", fontSize: 18 },
  metricLabel: { color: "#6b7280", fontWeight: "800", fontSize: 12, marginTop: 2 },
  infoBox: {
    backgroundColor: "#FAFAF9",
    borderRadius: 16,
    padding: 10,
    gap: 4,
  },
  detail: {
    color: "#5E5B55",
    textAlign: "right",
    fontWeight: "700",
    lineHeight: 21,
  },
  uploadContractButton: {
    marginTop: 10,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#99f6e4",
    padding: 10,
    borderRadius: 14,
    alignItems: "center",
  },
  uploadContractButtonText: {
    color: "#065f46",
    fontWeight: "900",
  },
});
