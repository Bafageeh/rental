import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet, apiPost } from '../lib/api';
import { colors, radii, spacing, typography } from '../constants/theme';

type ChatMessage = { id: number; body: string; is_mine?: boolean; created_at?: string };
type ThreadInfo = { id: number; tenant_name?: string | null; property_name?: string | null; unit_number?: string | null; contract_number?: string | null };

export default function ChatThreadScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const threadId = String(params.id || '');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [thread, setThread] = useState<ThreadInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    if (!threadId) return;
    try {
      setLoading(true);
      const response = await apiGet(`/chat/threads/${threadId}/messages`);
      const data = response?.data ?? response;
      setThread(data?.thread ?? null);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (e) {
      Alert.alert('تعذر تحميل المحادثة', e instanceof Error ? e.message : 'حدث خطأ أثناء تحميل الرسائل');
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function sendMessage() {
    const text = body.trim();
    if (!text || sending) return;
    try {
      setSending(true);
      setBody('');
      const response = await apiPost(`/chat/threads/${threadId}/messages`, { body: text });
      const data = response?.data ?? response;
      const message = data?.message;
      if (message) setMessages((prev) => [...prev, message]);
      else await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setBody(text);
      Alert.alert('تعذر إرسال الرسالة', e instanceof Error ? e.message : 'حدث خطأ أثناء إرسال الرسالة');
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80} style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Ionicons name="arrow-forward" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text numberOfLines={1} style={styles.title}>{thread?.tenant_name || 'المحادثة'}</Text>
            <Text numberOfLines={1} style={styles.subtitle}>العقار: {thread?.property_name || '-'} | الوحدة: {thread?.unit_number || '-'}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>جاري تحميل الرسائل...</Text></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<Text style={styles.emptyText}>لا توجد رسائل بعد. اكتب أول رسالة الآن.</Text>}
            renderItem={({ item }) => {
              const mine = !!item.is_mine;
              return (
                <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
                  <View style={[styles.messageBubble, mine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
                    <Text style={[styles.messageText, mine ? styles.messageTextMine : styles.messageTextOther]}>{item.body}</Text>
                    <Text style={[styles.messageTime, mine ? styles.messageTimeMine : styles.messageTimeOther]}>{String(item.created_at || '').slice(0, 16)}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={styles.inputWrap}>
          <TouchableOpacity style={[styles.sendBtn, (!body.trim() || sending) && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!body.trim() || sending}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
          </TouchableOpacity>
          <TextInput style={styles.input} value={body} onChangeText={setBody} placeholder="اكتب رسالتك..." placeholderTextColor={colors.textTertiary} textAlign="right" multiline maxLength={2000} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.surface },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderLight },
  headerText: { flex: 1, alignItems: 'flex-end' },
  title: { ...typography.h3, color: colors.text, textAlign: 'right' },
  subtitle: { color: colors.textSecondary, textAlign: 'right', marginTop: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.textSecondary, marginTop: spacing.sm },
  messagesList: { padding: spacing.lg, paddingBottom: spacing.xl },
  emptyText: { color: colors.textSecondary, textAlign: 'center', backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radii.lg, overflow: 'hidden' },
  messageRow: { marginBottom: spacing.sm, flexDirection: 'row' },
  messageRowMine: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  messageBubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  messageBubbleMine: { backgroundColor: colors.primary, borderTopRightRadius: 6 },
  messageBubbleOther: { backgroundColor: colors.surface, borderTopLeftRadius: 6, borderWidth: 1, borderColor: colors.borderLight },
  messageText: { fontSize: 15, lineHeight: 23, textAlign: 'right' },
  messageTextMine: { color: colors.textInverse },
  messageTextOther: { color: colors.text },
  messageTime: { fontSize: 10, marginTop: 4, textAlign: 'left' },
  messageTimeMine: { color: 'rgba(255,255,255,0.75)' },
  messageTimeOther: { color: colors.textTertiary },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.45 },
});
