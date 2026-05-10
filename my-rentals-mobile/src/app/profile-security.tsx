import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiPost } from "../lib/api";
import { colors, spacing } from "../constants/theme";

export default function ProfileSecurityScreen() {
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState("");
  const [nextValue, setNextValue] = useState("");
  const [confirm, setConfirm] = useState("");

  async function save() {
    if (!current.trim() || nextValue.length < 6 || nextValue !== confirm) {
      Alert.alert("تنبيه", "تأكد من إدخال البيانات بشكل صحيح.");
      return;
    }
    try {
      setSaving(true);
      await apiPost("/auth/change-password", { current_password: current, password: nextValue, password_confirmation: confirm });
      setCurrent("");
      setNextValue("");
      setConfirm("");
      Alert.alert("تم", "تم الحفظ بنجاح.");
    } catch (e) {
      Alert.alert("تعذر الحفظ", e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>تغيير الرقم السري</Text>
        <TextInput value={current} onChangeText={setCurrent} style={styles.input} secureTextEntry textAlign="right" placeholder="الرقم الحالي" />
        <TextInput value={nextValue} onChangeText={setNextValue} style={styles.input} secureTextEntry textAlign="right" placeholder="الرقم الجديد" />
        <TextInput value={confirm} onChangeText={setConfirm} style={styles.input} secureTextEntry textAlign="right" placeholder="تأكيد الرقم الجديد" />
        <TouchableOpacity style={styles.button} onPress={save} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? "جاري الحفظ..." : "حفظ"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 110 },
  title: { color: colors.text, fontSize: 26, fontWeight: "900", textAlign: "right", marginBottom: spacing.lg },
  input: { minHeight: 52, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: spacing.md, marginBottom: spacing.sm, textAlign: "right" },
  button: { minHeight: 54, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  buttonText: { color: colors.textInverse, fontWeight: "900" },
});
