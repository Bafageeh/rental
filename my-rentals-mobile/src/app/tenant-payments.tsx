import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet } from '../lib/api';
import { clearAuthSession } from '../lib/auth';
import { colors, radii, spacing, typography } from '../constants/theme';

function money(v: unknown) {
  const n = Number(String(v ?? 0).replace(/,/g, ''));
  return `${Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} ريال`;
}

export default function TenantPaymentsScreen() {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [items, setItems] = useState<any[]>([]);

  async function load() {
    try {
      const r = await apiGet('/tenant/payments');
      const d = r?.data ?? r;
      setName(d?.tenant?.name ?? 'المستأجر');
      setItems(Array.isArray(d?.payments) ? d.payments : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function logout() {
    await clearAuthSession();
    router.replace('/login' as any);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>دفعاتي</Text>
          <Text style={styles.sub}>{name}</Text>
        </View>
        <TouchableOpacity style={styles.out} onPress={logout}><Text style={styles.outText}>خروج</Text></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : (
        <FlatList
          data={items}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>لا توجد دفعات حالياً</Text>}
          renderItem={({ item, index }) => {
            const paid = Number(item.paid_amount ?? 0);
            const rem = Number(item.remaining_amount ?? 0);
            const isPaid = paid > 0 && rem <= 0.009;
            const isPartial = paid > 0 && rem > 0.009;
            const status = isPaid ? 'مدفوعة' : isPartial ? 'جزئي' : String(item.status).includes('overdue') ? 'متأخرة' : 'قادمة';
            return (
              <View style={styles.card}>
                <View style={styles.row}><Text style={styles.h}>الدفعة {index + 1}</Text><Text style={styles.badge}>{status}</Text></View>
                <Text style={styles.line}>استحقاق: {item.due_date || '-'}</Text>
                <Text style={styles.line}>سداد: {item.paid_date || 'غير مدفوعة'}</Text>
                <Text style={styles.money}>المطلوب: {money(item.amount)}</Text>
                <Text style={styles.money}>المسدد: {money(item.paid_amount)}</Text>
                <Text style={styles.line}>العقد: {item.contract_number || '-'} | العقار: {item.property_name || '-'} | الوحدة: {item.unit_number || '-'}</Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.xl, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h2, color: colors.text, textAlign: 'right' },
  sub: { color: colors.textSecondary, textAlign: 'right', marginTop: 4 },
  out: { backgroundColor: colors.surface, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  outText: { color: colors.textSecondary, fontWeight: '800' },
  list: { padding: spacing.xl },
  empty: { color: colors.textSecondary, textAlign: 'center', padding: spacing.xl, backgroundColor: colors.surface, borderRadius: radii.lg },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  h: { ...typography.h3, color: colors.text },
  badge: { color: colors.primary, fontWeight: '900' },
  line: { color: colors.textSecondary, textAlign: 'right', marginTop: 6, lineHeight: 22 },
  money: { color: colors.text, textAlign: 'right', marginTop: 6, fontWeight: '900' },
});
