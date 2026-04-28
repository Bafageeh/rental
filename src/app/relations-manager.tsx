import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { smartBack } from "@/lib/navigationHistory";
export default function RelationsManagerScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => smartBack()}>
            <Text style={styles.backText}>رجوع</Text>
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.title}>إدارة الربط</Text>
            <Text style={styles.subtitle}>تم إلغاء الربط اليدوي نهائيًا</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardIcon}>✅</Text>
          <Text style={styles.cardTitle}>لا يوجد ربط يدوي للوحدات أو العقارات</Text>
          <Text style={styles.cardText}>
            العقار لا يضاف إلا بعد اختيار مالك.
          </Text>
          <Text style={styles.cardText}>
            الوحدة لا تضاف إلا بعد اختيار مالك، ثم تحديد هل هي وحدة خاصة بالمالك أو وحدة تحت عقار/عمارة.
          </Text>
        </View>

        <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/properties" as never)}>
          <Text style={styles.actionText}>إضافة / إدارة العقارات</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/units" as never)}>
          <Text style={styles.actionText}>إضافة / إدارة الوحدات</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 16, paddingBottom: 60 },
  header: { backgroundColor: "#111827", borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  backButton: { backgroundColor: "#374151", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  backText: { color: "#fff", fontWeight: "900" },
  headerText: { flex: 1 },
  title: { color: "#fff", fontWeight: "900", fontSize: 22, textAlign: "right" },
  subtitle: { color: "#C4C1BB", fontWeight: "800", textAlign: "right", marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12 },
  cardIcon: { fontSize: 34, textAlign: "center", marginBottom: 8 },
  cardTitle: { color: "#111827", fontSize: 18, fontWeight: "900", textAlign: "center", marginBottom: 10 },
  cardText: { color: "#5E5B55", fontWeight: "800", textAlign: "right", lineHeight: 24, marginBottom: 6 },
  actionButton: { backgroundColor: "#0F9B6F", borderRadius: 14, padding: 13, alignItems: "center", marginBottom: 10 },
  actionText: { color: "#fff", fontWeight: "900" },
});
