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
import { SafeAreaView } from "react-native-safe-area-context";

type AppSetting = {
  id?: number;
  key: string;
  value?: string | null;
  type?: string | null;
  group?: string | null;
  label?: string | null;
  notes?: string | null;
};

type SettingGroup = {
  group: string;
  label?: string;
  settings: AppSetting[];
};

type SettingsPayload = {
  groups?: SettingGroup[];
  settings?: Record<string, string>;
};

function inputMultiline(type?: string | null) {
  return type === "text";
}

export default function SystemSettingsScreen() {
  const [groups, setGroups] = useState<SettingGroup[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);

      const result = await apiGetScoped(
        "/app-settings",
        "/my/app-settings"
      );

      const payload = result as SettingsPayload;
      const nextGroups = payload.groups || [];
      const nextValues: Record<string, string> = {};

      nextGroups.forEach((group) => {
        group.settings.forEach((setting) => {
          nextValues[setting.key] = String(setting.value ?? "");
        });
      });

      setGroups(nextGroups);
      setValues(nextValues);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل إعدادات النظام");
    } finally {
      setLoading(false);
    }
  }

  function updateValue(key: string, value: string) {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function save() {
    try {
      setSaving(true);

      const settings = groups.flatMap((group) =>
        group.settings.map((setting) => ({
          key: setting.key,
          value: values[setting.key] ?? "",
          type: setting.type || "string",
          group: setting.group || group.group,
          label: setting.label,
          notes: setting.notes,
        }))
      );

      const result = await apiPost("/app-settings", {
        settings,
      });

      Alert.alert("تم", result.message || "تم حفظ الإعدادات");
      load();
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر حفظ إعدادات النظام");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    Alert.alert(
      "تأكيد",
      "هل تريد إعادة الإعدادات الافتراضية؟ سيتم استبدال القوالب الحالية.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "إعادة",
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);
              const result = await apiPost("/app-settings/reset-defaults");
              Alert.alert("تم", result.message || "تمت إعادة الإعدادات");
              load();
            } catch (e) {
              Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر إعادة الإعدادات");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>إعدادات النظام</Text>
        <Text style={styles.subtitle}>
          إعدادات عامة وقوالب رسائل قابلة للتعديل من داخل التطبيق
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>عدد المجموعات: {groups.length}</Text>
          <Text style={styles.summaryText}>
            عدد الإعدادات: {groups.reduce((sum, group) => sum + group.settings.length, 0)}
          </Text>
        </View>

        <View style={styles.actionsRow}>
<TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
            <Text style={styles.actionText}>{saving ? "جاري الحفظ..." : "حفظ"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetButton} onPress={resetDefaults} disabled={saving}>
            <Text style={styles.actionText}>افتراضي</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل الإعدادات...</Text>
          </View>
        ) : null}

        {!loading && groups.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد إعدادات حاليًا</Text>
          </View>
        ) : null}

        {groups.map((group) => (
          <View key={group.group} style={styles.groupCard}>
            <Text style={styles.groupTitle}>{group.label || group.group}</Text>

            {group.settings.map((setting) => (
              <View key={setting.key} style={styles.settingBox}>
                <Text style={styles.label}>{setting.label || setting.key}</Text>

                {setting.notes ? (
                  <Text style={styles.notes}>{setting.notes}</Text>
                ) : null}

                <TextInput
                  style={[
                    styles.input,
                    inputMultiline(setting.type) ? styles.multilineInput : null,
                  ]}
                  value={values[setting.key] ?? ""}
                  onChangeText={(value) => updateValue(setting.key, value)}
                  keyboardType={setting.type === "number" ? "number-pad" : "default"}
                  multiline={inputMultiline(setting.type)}
                  textAlign="right"
                  placeholder={setting.label || setting.key}
                />

                <Text style={styles.keyText}>{setting.key}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.helpBox}>
          <Text style={styles.helpTitle}>متغيرات القوالب</Text>
          <Text style={styles.helpText}>{"{tenant_name}"} اسم المستأجر</Text>
          <Text style={styles.helpText}>{"{property_name}"} اسم العقار</Text>
          <Text style={styles.helpText}>{"{unit_number}"} رقم الوحدة</Text>
          <Text style={styles.helpText}>{"{amount}"} مبلغ الدفعة</Text>
          <Text style={styles.helpText}>{"{due_date}"} تاريخ الاستحقاق</Text>
          <Text style={styles.helpText}>{"{end_date}"} تاريخ نهاية العقد</Text>
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
  actionsRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 14 },
  refreshButton: { flex: 1, backgroundColor: "#0F9B6F", padding: 12, borderRadius: 12, alignItems: "center" },
  saveButton: { flex: 1, backgroundColor: "#16a34a", padding: 12, borderRadius: 12, alignItems: "center" },
  resetButton: { flex: 1, backgroundColor: "#7A766F", padding: 12, borderRadius: 12, alignItems: "center" },
  actionText: { color: "#fff", fontWeight: "900" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  groupCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14 },
  groupTitle: { color: "#111827", fontSize: 21, fontWeight: "900", textAlign: "right", marginBottom: 12 },
  settingBox: { backgroundColor: "#F7F6F4", borderRadius: 14, padding: 12, marginBottom: 12 },
  label: { color: "#111827", fontWeight: "900", textAlign: "right", marginBottom: 5 },
  notes: { color: "#7A766F", textAlign: "right", marginBottom: 8, lineHeight: 20 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 12, padding: 12, color: "#111827" },
  multilineInput: { minHeight: 110, textAlignVertical: "top" },
  keyText: { color: "#9ca3af", fontSize: 12, textAlign: "left", marginTop: 6 },
  helpBox: { backgroundColor: "#eff6ff", borderRadius: 18, padding: 14, marginTop: 4 },
  helpTitle: { color: "#065F44", fontWeight: "900", textAlign: "right", marginBottom: 8 },
  helpText: { color: "#065F44", fontWeight: "700", textAlign: "right", marginTop: 4 },
});
