import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiGetScoped } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

type SearchItem = {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  meta: string;
  raw: string;
};

function value(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(number).toLocaleString()} ريال`;
}

const propertyTypeLabels: Record<string, string> = {
  building: "عمارة",
  apartment: "شقة",
  villa: "فيلا",
  land: "أرض",
  commercial: "تجاري",
  office: "مكتب",
  shop: "محل",
  mixed: "مختلط",
};

function propertyTypeText(type?: string | null) {
  if (!type) return "-";
  return propertyTypeLabels[type] || type;
}

function addItem(items: SearchItem[], item: SearchItem) {
  items.push({ ...item, raw: `${item.group} ${item.title} ${item.subtitle} ${item.meta}`.toLowerCase() });
}

export default function SearchScreen() {
  const [items, setItems] = useState<SearchItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const endpoints = [
        ["owners", "/my/owners"],
        ["properties", "/my/properties"],
        ["units", "/my/units"],
        ["tenants", "/my/tenants"],
        ["contracts", "/my/contracts"],
        ["payments", "/my/payments"],
        ["expenses", "/my/expenses"],
      ] as const;

      const responses = await Promise.allSettled(
        endpoints.map(async ([key, path]) => ({ key, data: await apiGetScoped(path, path) }))
      );

      const resultItems: SearchItem[] = [];
      let successfulLoads = 0;

      for (const response of responses) {
        if (response.status !== "fulfilled") continue;
        successfulLoads += 1;

        const { key, data } = response.value;
        const list = Array.isArray(data) ? data : [];

        if (key === "owners") {
          list.forEach((owner: any) => {
            addItem(resultItems, {
              id: `owner-${owner.id}`,
              group: "الملاك",
              title: value(owner.name),
              subtitle: `الجوال: ${value(owner.phone)} | البريد: ${value(owner.email)}`,
              meta: `الهوية/السجل: ${value(owner.national_id)} | العقارات: ${value(owner.properties_count)}`,
              raw: "",
            });
          });
        }

        if (key === "properties") {
          list.forEach((property: any) => {
            addItem(resultItems, {
              id: `property-${property.id}`,
              group: "العقارات",
              title: value(property.name),
              subtitle: `المالك: ${value(property.owner?.name)} | المدينة: ${value(property.city)} | الحي: ${value(property.district)}`,
              meta: `الصك: ${value(property.deed_number)} | النوع: ${propertyTypeText(property.property_type)} | الوحدات: ${value(property.units_count)}`,
              raw: "",
            });
          });
        }

        if (key === "units") {
          list.forEach((unit: any) => {
            addItem(resultItems, {
              id: `unit-${unit.id}`,
              group: "الوحدات",
              title: value(unit.unit_number),
              subtitle: `العقار: ${value(unit.property?.name)} | المالك: ${value(unit.property?.owner?.name)} | الدور: ${value(unit.floor)}`,
              meta: `الغرف: ${value(unit.rooms_count)} | الحمامات: ${value(unit.bathrooms_count)} | الحالة: ${value(unit.status)}`,
              raw: "",
            });
          });
        }

        if (key === "tenants") {
          list.forEach((tenant: any) => {
            addItem(resultItems, {
              id: `tenant-${tenant.id}`,
              group: "المستأجرون",
              title: value(tenant.name),
              subtitle: `الجوال: ${value(tenant.phone)} | الهوية: ${value(tenant.national_id)}`,
              meta: `الجنسية: ${value(tenant.nationality)} | البريد: ${value(tenant.email)} | العقود: ${value(tenant.contracts_count)}`,
              raw: "",
            });
          });
        }

        if (key === "contracts") {
          list.forEach((contract: any) => {
            addItem(resultItems, {
              id: `contract-${contract.id}`,
              group: "العقود",
              title: `عقد ${value(contract.government_contract_number || contract.contract_number || contract.id)}`,
              subtitle: `المستأجر: ${value(contract.tenant?.name)} | الوحدة: ${value(contract.unit?.unit_number)} | العقار: ${value(contract.unit?.property?.name)}`,
              meta: `البداية: ${value(contract.start_date)} | النهاية: ${value(contract.end_date)} | الإيجار: ${money(contract.rent_amount)} | الحالة: ${value(contract.status)}`,
              raw: "",
            });
          });
        }

        if (key === "payments") {
          list.forEach((payment: any) => {
            addItem(resultItems, {
              id: `payment-${payment.id}`,
              group: "الدفعات",
              title: money(payment.amount),
              subtitle: `المستأجر: ${value(payment.contract?.tenant?.name)} | العقار: ${value(payment.contract?.unit?.property?.name)} | الوحدة: ${value(payment.contract?.unit?.unit_number)}`,
              meta: `الاستحقاق: ${value(payment.due_date)} | السداد: ${value(payment.paid_date)} | الحالة: ${value(payment.status)}`,
              raw: "",
            });
          });
        }

        if (key === "expenses") {
          list.forEach((expense: any) => {
            addItem(resultItems, {
              id: `expense-${expense.id}`,
              group: "المصاريف",
              title: money(expense.amount),
              subtitle: `العقار: ${value(expense.property?.name)} | النوع: ${value(expense.category?.name)}`,
              meta: `التاريخ: ${value(expense.expense_date)} | العنوان: ${value(expense.title)} | الوصف: ${value(expense.description)}`,
              raw: "",
            });
          });
        }
      }

      if (successfulLoads === 0) {
        setError("تعذر تحميل بيانات البحث من الخادم");
      }

      setItems(resultItems);
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

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.raw.includes(q));
  }, [items, query]);

  const groups = useMemo(() => {
    const map = new Map<string, SearchItem[]>();
    filtered.forEach((item) => {
      const groupItems = map.get(item.group) || [];
      groupItems.push(item);
      map.set(item.group, groupItems);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshScreen} tintColor="#0F9B6F" />}
      >
        <Text style={styles.title}>بحث شامل</Text>
        <Text style={styles.subtitle}>ابحث في الملاك والعقارات والوحدات والمستأجرين والعقود والدفعات والمصاريف</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="اكتب اسم، جوال، صك، عقار، وحدة، عقد..."
          value={query}
          onChangeText={setQuery}
          textAlign="right"
        />
<View style={styles.summaryBox}>
          <Text style={styles.summaryText}>النتائج: {filtered.length} من أصل {items.length}</Text>
        </View>

        {loading ? (
          <View style={styles.box}>
            <ActivityIndicator />
            <Text style={styles.boxText}>جاري تحميل بيانات البحث...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>تعذر البحث</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!loading && !error && filtered.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.emptyText}>لا توجد نتائج مطابقة</Text>
          </View>
        ) : null}

        {groups.map(([group, groupItems]) => (
          <View key={group} style={styles.groupBox}>
            <Text style={styles.groupTitle}>{group} ({groupItems.length})</Text>

            {groupItems.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.detail}>{item.subtitle}</Text>
                <Text style={styles.meta}>{item.meta}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F6F4" },
  container: { padding: 18, paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: "800", color: "#111827", textAlign: "right" },
  subtitle: { marginTop: 8, marginBottom: 18, color: "#7A766F", fontSize: 15, lineHeight: 23, textAlign: "right" },
  searchInput: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#DDDBD6", borderRadius: 16, padding: 14, color: "#111827", marginBottom: 12 },
  refreshButton: { backgroundColor: "#111827", padding: 13, borderRadius: 14, alignItems: "center", marginBottom: 12 },
  refreshButtonText: { color: "#fff", fontWeight: "800" },
  summaryBox: { backgroundColor: "#eff6ff", borderRadius: 14, padding: 12, marginBottom: 12 },
  summaryText: { color: "#1d4ed8", fontWeight: "800", textAlign: "right" },
  box: { backgroundColor: "#fff", padding: 18, borderRadius: 18, alignItems: "center", marginBottom: 12 },
  boxText: { marginTop: 8, color: "#5E5B55" },
  emptyText: { color: "#7A766F" },
  errorBox: { backgroundColor: "#fee2e2", padding: 16, borderRadius: 18, marginBottom: 14 },
  errorTitle: { color: "#991b1b", fontSize: 18, fontWeight: "800", textAlign: "right" },
  errorText: { color: "#7f1d1d", marginTop: 8, textAlign: "right" },
  groupBox: { marginTop: 12 },
  groupTitle: { fontSize: 21, fontWeight: "800", color: "#111827", textAlign: "right", marginBottom: 10 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#111827", textAlign: "right" },
  detail: { marginTop: 8, color: "#5E5B55", textAlign: "right", lineHeight: 22 },
  meta: { marginTop: 8, color: "#075985", fontWeight: "700", textAlign: "right", lineHeight: 22 },
});
