import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LegacyPaymentRoute() {
  const { contractId } = useLocalSearchParams<{ contractId?: string }>();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (contractId) {
        router.replace(`/contract/${contractId}` as any);
      } else {
        router.replace('/payments' as any);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [contractId]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.box}>
        <ActivityIndicator />
        <Text style={styles.text}>جاري الرجوع للدفعات...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F6F4' },
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  text: { color: '#374151', fontSize: 15, fontWeight: '800' },
});
