import { useLocalSearchParams } from 'expo-router';
import EntityDetailsScreen from '../../components/EntityDetailsScreen';

export default function PaymentDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <EntityDetailsScreen entity="payment" id={id || ''} />;
}
