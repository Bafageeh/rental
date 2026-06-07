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

function paymentUi(item: any) {
  const paid = Number(item?.paid_amount ?? 0);
  const rem = Number(item?.remaining_amount ?? 0);
  const rawStatus = String(item?.status ?? '').toLowerCase();

  const isPaid = paid > 0 && rem <= 0.009;
  const isPartial = paid > 0 && rem > 0.009;
  const isOverdue = rawStatus.includes('overdue') || rawStatus.includes('متأخر');

  if (isPaid) {
    return {
      label: 'مدفوعة',
      card: styles.cardPaid,
      badge: styles.badgePaid,
      badgeText: styles.badgeTextPaid,
    };
  }

  if (isPartial) {
    return {
      label: 'جزئي',
      card: styles.cardPartial,
      badge: styles.badgePartial,
      badgeText: styles.badgeTextPartial,
    };
  }

  if (isOverdue) {
    return {
      label: 'متأخرة',
      card: styles.cardOverdue,
      badge: styles.badgeOverdue,
      badgeText: styles.badgeTextOverdue,
    };
  }

  return {
    label: 'قادمة',
    card: styles.cardUpcoming,
    badge: styles.badgeUpcoming,
    badgeText: styles.badgeTextUpcoming,
  };
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
            const ui = paymentUi(item);
            return (
              <View style={[styles.card, ui.card]}>
                <View style={styles.row}>
                  <Text style={styles.h}>الدفعة {index + 1}</Text>
                  <View style={[styles.badge, ui.badge]}>
                    <Text style={[styles.badgeText, ui.badgeText]}>{ui.label}</Text>
                  </View>
                </View>
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
  cardPaid: { backgroundColor: '#ECFDF5', borderColor: '#86EFAC' },
  cardOverdue: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  cardPartial: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  cardUpcoming: { backgroundColor: '#FAF7EF', borderColor: '#EFE4CB' },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  h: { ...typography.h3, color: colors.text },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { fontWeight: '900' },
  badgePaid: { backgroundColor: '#DCFCE7' },
  badgeTextPaid: { color: '#166534' },
  badgeOverdue: { backgroundColor: '#FEE2E2' },
  badgeTextOverdue: { color: '#B91C1C' },
  badgePartial: { backgroundColor: '#FEF3C7' },
  badgeTextPartial: { color: '#92400E' },
  badgeUpcoming: { backgroundColor: '#F3EAD7' },
  badgeTextUpcoming: { color: '#8A5A13' },
  line: { color: colors.textSecondary, textAlign: 'right', marginTop: 6, lineHeight: 22 },
  money: { color: colors.text, textAlign: 'right', marginTop: 6, fontWeight: '900' },
});
