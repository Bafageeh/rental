import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet, apiPost, apiPostFormData } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { colors, radii, spacing, typography } from '../constants/theme';

type ChatAttachment = {
  id: number;
  original_name?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  file_kind?: string | null;
  url?: string | null;
  download_url?: string | null;
};

type ChatMessage = {
  id: number;
  body: string;
  sender_role?: string;
  is_mine?: boolean;
  is_system?: boolean;
  created_at?: string;
  read_at?: string | null;
  attachments?: ChatAttachment[];
};

type ThreadInfo = {
  id: number;
  tenant_name?: string | null;
  tenant_phone?: string | null;
  tenant_national_id?: string | null;
  tenant_nationality?: string | null;
  property_name?: string | null;
  unit_number?: string | null;
  contract_number?: string | null;
  contract_status?: string | null;
  status?: string | null;
  status_label?: string | null;
  request_type?: string | null;
  request_type_label?: string | null;
  priority?: string | null;
  priority_label?: string | null;
  is_closed?: boolean;
};

const REQUEST_TYPES = [
  { key: 'general', label: 'استفسار عام' },
  { key: 'maintenance', label: 'صيانة' },
  { key: 'payment', label: 'دفعات' },
  { key: 'contract', label: 'عقد' },
];

const STATUS_OPTIONS = [
  { key: 'open', label: 'مفتوحة' },
  { key: 'in_progress', label: 'قيد المتابعة' },
  { key: 'closed', label: 'مغلقة' },
];

const PRIORITY_OPTIONS = [
  { key: 'normal', label: 'عادي' },
  { key: 'important', label: 'مهم' },
  { key: 'urgent', label: 'عاجل' },
];

function display(value: unknown) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function timeText(value?: string | null) {
  const raw = String(value || '').replace('T', ' ');
  return raw ? raw.slice(0, 16) : '';
}

function fileSize(value?: number | null) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function attachmentName(attachment: ChatAttachment) {
  return String(attachment.original_name || attachment.file_name || 'مرفق');
}

function attachmentUrl(attachment: ChatAttachment) {
  return String(attachment.url || attachment.download_url || '').trim();
}

export default function ChatThreadScreen() {
  const { isTenant } = useAuth();
  const params = useLocalSearchParams<{ id?: string; threadId?: string }>();
  const threadId = String(params.id || params.threadId || '');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const [updatingMeta, setUpdatingMeta] = useState(false);
  const [closing, setClosing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [thread, setThread] = useState<ThreadInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const closedForTicket = Boolean(thread?.is_closed);

  const load = useCallback(async (silent = false) => {
    if (!threadId) return;
    try {
      if (!silent) setLoading(true);
      const response = await apiGet(`/chat/threads/${threadId}/messages-v2`);
      const data = response?.data ?? response;
      setThread(data?.thread ?? null);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (e) {
      if (!silent) Alert.alert('تعذر تحميل التذكرة', e instanceof Error ? e.message : 'حدث خطأ أثناء تحميل الرسائل');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [threadId]);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  useEffect(() => {
    const timer = setInterval(() => { void load(true); }, 6000);
    return () => clearInterval(timer);
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load(true);
  }

  async function updateMeta(changes: Record<string, string>) {
    if (!threadId || updatingMeta || closing) return;
    try {
      setUpdatingMeta(true);
      const response = await apiPost(`/chat/threads/${threadId}/meta`, changes);
      const data = response?.data ?? response;
      if (data?.thread) setThread(data.thread);
      await load(true);
    } catch (e) {
      Alert.alert('تعذر التحديث', e instanceof Error ? e.message : 'حدث خطأ أثناء تحديث بيانات التذكرة');
    } finally {
      setUpdatingMeta(false);
    }
  }

  function closeTicket() {
    if (!threadId || closedForTicket || closing) return;
    Alert.alert('إغلاق التذكرة', 'بعد الإغلاق تبقى التذكرة محفوظة ويمكن الرجوع لها، لكن لا يمكن الرد عليها.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إغلاق',
        style: 'destructive',
        onPress: async () => {
          try {
            setClosing(true);
            const response = await apiPost(`/chat/threads/${threadId}/close`, {});
            const data = response?.data ?? response;
            if (data?.thread) setThread(data.thread);
            await load(true);
          } catch (e) {
            Alert.alert('تعذر إغلاق التذكرة', e instanceof Error ? e.message : 'حدث خطأ أثناء إغلاق التذكرة');
          } finally {
            setClosing(false);
          }
        },
      },
    ]);
  }

  async function sendMessage() {
    const text = body.trim();
    if (!text || sending) return;
    if (closedForTicket) {
      Alert.alert('التذكرة مغلقة', 'هذه التذكرة مغلقة ولا يمكن الرد عليها. افتح تذكرة جديدة عند الحاجة.');
      return;
    }

    try {
      setSending(true);
      setBody('');
      const response = await apiPost(`/chat/threads/${threadId}/messages`, { body: text });
      const data = response?.data ?? response;
      const message = data?.message;
      if (message) setMessages((prev) => [...prev, message]);
      else await load(true);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setBody(text);
      Alert.alert('تعذر إرسال الرسالة', e instanceof Error ? e.message : 'حدث خطأ أثناء إرسال الرسالة');
    } finally {
      setSending(false);
    }
  }

  async function pickAndSendAttachment() {
    if (sendingAttachment || closedForTicket) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: ['image/*', 'application/pdf', 'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.name || 'attachment',
        type: asset.mimeType || 'application/octet-stream',
      } as any);
      const caption = body.trim();
      if (caption) formData.append('body', caption);

      setSendingAttachment(true);
      setBody('');
      const response = await apiPostFormData(`/chat/threads/${threadId}/attachments`, formData);
      const data = response?.data ?? response;
      if (data?.message) setMessages((prev) => [...prev, data.message]);
      else await load(true);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    } catch (e) {
      Alert.alert('تعذر إرسال المرفق', e instanceof Error ? e.message : 'حدث خطأ أثناء إرسال الصورة أو الملف');
    } finally {
      setSendingAttachment(false);
    }
  }

  function openAttachment(attachment: ChatAttachment) {
    const url = attachmentUrl(attachment);
    if (!url) {
      Alert.alert('المرفق غير متاح', 'لا يوجد رابط صالح لهذا المرفق.');
      return;
    }
    Linking.openURL(url).catch(() => Alert.alert('تعذر فتح المرفق', 'لم يتمكن الجهاز من فتح هذا الملف.'));
  }

  function AttachmentView({ attachment, mine }: { attachment: ChatAttachment; mine: boolean }) {
    const isImage = attachment.file_kind === 'image' || String(attachment.mime_type || '').startsWith('image/');
    const url = attachmentUrl(attachment);

    if (isImage && url) {
      return (
        <TouchableOpacity style={styles.imageAttachmentWrap} activeOpacity={0.9} onPress={() => openAttachment(attachment)}>
          <Image source={{ uri: url }} style={styles.imageAttachment} resizeMode="cover" />
          <View style={styles.attachmentCaption}>
            <Ionicons name="image-outline" size={14} color="#fff" />
            <Text numberOfLines={1} style={styles.imageCaptionText}>{attachmentName(attachment)}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity style={[styles.fileAttachment, mine ? styles.fileAttachmentMine : null]} activeOpacity={0.85} onPress={() => openAttachment(attachment)}>
        <View style={styles.fileIcon}><Ionicons name={attachment.file_kind === 'pdf' ? 'document-text-outline' : 'document-attach-outline'} size={22} color={colors.primary} /></View>
        <View style={styles.fileTextWrap}>
          <Text numberOfLines={1} style={[styles.fileName, mine ? styles.fileNameMine : null]}>{attachmentName(attachment)}</Text>
          <Text style={[styles.fileMeta, mine ? styles.fileMetaMine : null]}>{fileSize(attachment.file_size) || 'اضغط للفتح'}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function InfoCard() {
    if (!thread) return null;
    const detailsToggleLabel = detailsOpen
      ? (isTenant ? 'إخفاء تفاصيل العقد' : 'إخفاء تفاصيل المستأجر والعقد')
      : (isTenant ? 'عرض تفاصيل العقد' : 'عرض تفاصيل المستأجر والعقد');

    return (
      <View style={styles.infoCard}>
        <View style={styles.infoTop}>
          <View style={[styles.statusPill, thread.status === 'closed' ? styles.statusClosed : thread.status === 'in_progress' ? styles.statusProgress : styles.statusOpen]}>
            <Text style={styles.statusText}>{thread.status_label || 'مفتوحة'}</Text>
          </View>
          <View style={styles.infoTitleWrap}>
            <Text style={styles.infoTitle}>تذكرة #{thread.id}</Text>
            <Text style={styles.infoSub}>النوع: {thread.request_type_label || 'استفسار عام'} | الأولوية: {thread.priority_label || 'عادي'}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.detailsToggle} activeOpacity={0.85} onPress={() => setDetailsOpen((v) => !v)}>
          <Ionicons name={detailsOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={17} color={colors.textSecondary} />
          <Text style={styles.detailsToggleText}>{detailsToggleLabel}</Text>
        </TouchableOpacity>

        {detailsOpen ? (
          <View style={styles.infoGrid}>
            {!isTenant ? (
              <>
                <InfoItem label="المستأجر" value={thread.tenant_name} />
                <InfoItem label="الجوال" value={thread.tenant_phone} />
                <InfoItem label="رقم الهوية" value={thread.tenant_national_id} />
                <InfoItem label="الجنسية" value={thread.tenant_nationality} />
              </>
            ) : null}
            <InfoItem label="العقار" value={thread.property_name} />
            <InfoItem label="الوحدة" value={thread.unit_number} />
            <InfoItem label="رقم العقد" value={thread.contract_number} />
            <InfoItem label="حالة العقد" value={thread.contract_status} />
          </View>
        ) : null}

        <Text style={styles.controlLabel}>نوع الطلب</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {REQUEST_TYPES.map((item) => {
            const selected = thread.request_type === item.key;
            return (
              <TouchableOpacity key={item.key} style={[styles.chip, selected ? styles.chipSelected : null]} onPress={() => updateMeta({ request_type: item.key })} disabled={updatingMeta || closedForTicket}>
                <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {!isTenant ? (
          <>
            <Text style={styles.controlLabel}>حالة التذكرة</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {STATUS_OPTIONS.map((item) => {
                const selected = thread.status === item.key;
                return (
                  <TouchableOpacity key={item.key} style={[styles.chip, selected ? styles.chipSelected : null]} onPress={() => updateMeta({ status: item.key })} disabled={updatingMeta}>
                    <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.controlLabel}>الأولوية</Text>
            <View style={[styles.readOnlyPill, thread.priority === 'urgent' ? styles.readOnlyUrgent : thread.priority === 'important' ? styles.readOnlyImportant : null]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.readOnlyPillText}>{thread.priority_label || 'عادي'} - يحددها المستأجر فقط</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.controlLabel}>الأولوية</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {PRIORITY_OPTIONS.map((item) => {
                const selected = thread.priority === item.key;
                return (
                  <TouchableOpacity key={item.key} style={[styles.chip, selected ? styles.chipSelected : null, item.key === 'urgent' ? styles.chipDanger : null]} onPress={() => updateMeta({ priority: item.key })} disabled={updatingMeta || closedForTicket}>
                    <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {!closedForTicket ? (
          <TouchableOpacity style={styles.closeTicketBtn} activeOpacity={0.85} onPress={closeTicket} disabled={closing}>
            {closing ? <ActivityIndicator size="small" color="#B91C1C" /> : <Ionicons name="checkmark-done-outline" size={18} color="#B91C1C" />}
            <Text style={styles.closeTicketText}>إغلاق التذكرة</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80} style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Ionicons name="arrow-forward" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text numberOfLines={1} style={styles.title}>تذكرة #{thread?.id || ''}</Text>
            <Text numberOfLines={1} style={styles.subtitle}>العقار: {thread?.property_name || '-'} | الوحدة: {thread?.unit_number || '-'}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>جاري تحميل التذكرة...</Text></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.messagesList}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={<InfoCard />}
            ListEmptyComponent={<Text style={styles.emptyText}>لا توجد رسائل بعد. اكتب أول رسالة الآن.</Text>}
            renderItem={({ item }) => {
              if (item.is_system || item.sender_role === 'system') {
                return <View style={styles.systemMessage}><Text style={styles.systemMessageText}>{item.body}</Text></View>;
              }
              const mine = !!item.is_mine;
              const attachments = Array.isArray(item.attachments) ? item.attachments : [];
              return (
                <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
                  <View style={[styles.messageBubble, mine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
                    {item.body ? <Text style={[styles.messageText, mine ? styles.messageTextMine : styles.messageTextOther]}>{item.body}</Text> : null}
                    {attachments.length > 0 ? <View style={styles.attachmentsList}>{attachments.map((a) => <AttachmentView key={a.id} attachment={a} mine={mine} />)}</View> : null}
                    <View style={styles.messageFooter}>
                      <Text style={[styles.messageTime, mine ? styles.messageTimeMine : styles.messageTimeOther]}>{timeText(item.created_at)}</Text>
                      {mine ? <Text style={styles.readText}>{item.read_at ? 'مقروءة' : 'مرسلة'}</Text> : null}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}

        {closedForTicket ? <Text style={styles.closedNotice}>هذه التذكرة مغلقة ويمكن الرجوع لها من شاشة مراسلاتي.</Text> : null}
        <View style={styles.inputWrap}>
          <TouchableOpacity style={[styles.attachBtn, (sendingAttachment || closedForTicket) && styles.sendBtnDisabled]} onPress={pickAndSendAttachment} disabled={sendingAttachment || closedForTicket} activeOpacity={0.85}>
            {sendingAttachment ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="attach-outline" size={23} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sendBtn, (!body.trim() || sending || closedForTicket) && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!body.trim() || sending || closedForTicket}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
          </TouchableOpacity>
          <TextInput style={styles.input} value={body} onChangeText={setBody} placeholder={closedForTicket ? 'التذكرة مغلقة' : 'اكتب رسالتك أو أرفق صورة/ملف...'} placeholderTextColor={colors.textTertiary} textAlign="right" multiline maxLength={2000} editable={!closedForTicket} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoItem({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoValue}>{display(value)}</Text>
    </View>
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
  infoCard: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.lg, marginBottom: spacing.lg },
  infoTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.md },
  infoTitleWrap: { flex: 1, alignItems: 'flex-end' },
  infoTitle: { color: colors.text, fontWeight: '900', fontSize: 16, textAlign: 'right' },
  infoSub: { color: colors.textSecondary, fontWeight: '700', fontSize: 12, marginTop: 3, textAlign: 'right' },
  statusPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  statusOpen: { backgroundColor: '#DCFCE7' },
  statusProgress: { backgroundColor: '#FEF3C7' },
  statusClosed: { backgroundColor: '#FEE2E2' },
  statusText: { color: colors.text, fontWeight: '900', fontSize: 12 },
  detailsToggle: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.background, borderRadius: radii.md, paddingVertical: 9, marginBottom: spacing.sm },
  detailsToggleText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
  infoGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  infoItem: { width: '48%', backgroundColor: colors.background, borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.sm, alignItems: 'flex-end' },
  infoLabel: { color: colors.textTertiary, fontSize: 11, fontWeight: '800' },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 3, textAlign: 'right' },
  controlLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '900', textAlign: 'right', marginTop: spacing.sm, marginBottom: 6 },
  chipsRow: { flexDirection: 'row-reverse', gap: spacing.xs, paddingBottom: 2 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingVertical: 8 },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDanger: { borderColor: '#FCA5A5' },
  chipText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
  chipTextSelected: { color: colors.textInverse },
  readOnlyPill: { alignSelf: 'flex-end', flexDirection: 'row-reverse', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingVertical: 8, marginBottom: spacing.xs },
  readOnlyUrgent: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  readOnlyImportant: { backgroundColor: '#FEF3C7', borderColor: '#FBBF24' },
  readOnlyPillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
  closeTicketBtn: { marginTop: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', height: 44, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  closeTicketText: { color: '#B91C1C', fontWeight: '900' },
  messageRow: { marginBottom: spacing.sm, flexDirection: 'row' },
  messageRowMine: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  messageBubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  messageBubbleMine: { backgroundColor: colors.primary, borderTopRightRadius: 6 },
  messageBubbleOther: { backgroundColor: colors.surface, borderTopLeftRadius: 6, borderWidth: 1, borderColor: colors.borderLight },
  messageText: { fontSize: 15, lineHeight: 23, textAlign: 'right' },
  messageTextMine: { color: colors.textInverse },
  messageTextOther: { color: colors.text },
  attachmentsList: { marginTop: spacing.sm, gap: spacing.xs },
  imageAttachmentWrap: { width: 210, height: 150, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: '#E5E7EB' },
  imageAttachment: { width: '100%', height: '100%' },
  attachmentCaption: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 30, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 8 },
  imageCaptionText: { color: '#fff', fontSize: 11, fontWeight: '800', flex: 1, textAlign: 'right' },
  fileAttachment: { minWidth: 220, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.background, padding: spacing.sm, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  fileAttachmentMine: { borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.12)' },
  fileIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  fileTextWrap: { flex: 1, alignItems: 'flex-end' },
  fileName: { color: colors.text, fontWeight: '900', fontSize: 13, textAlign: 'right' },
  fileNameMine: { color: colors.textInverse },
  fileMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2, textAlign: 'right' },
  fileMetaMine: { color: 'rgba(255,255,255,0.75)' },
  systemMessage: { alignSelf: 'center', maxWidth: '90%', borderRadius: 999, backgroundColor: '#F1F5F9', paddingHorizontal: spacing.md, paddingVertical: 7, marginBottom: spacing.sm },
  systemMessageText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: 4 },
  messageTime: { fontSize: 10, textAlign: 'left' },
  messageTimeMine: { color: 'rgba(255,255,255,0.75)' },
  messageTimeOther: { color: colors.textTertiary },
  readText: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800' },
  closedNotice: { color: '#B91C1C', backgroundColor: '#FEF2F2', borderTopWidth: 1, borderTopColor: '#FCA5A5', textAlign: 'center', paddingVertical: 8, fontWeight: '900' },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 15 },
  attachBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.45 },
});
