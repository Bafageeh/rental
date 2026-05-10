#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/pmsa/apps/rental/my-rentals-mobile"
LOG_FILE="/home/pmsa/apps/my-rentals-expo.log"
PID_FILE="/home/pmsa/apps/my-rentals-expo.pid"
CACHE_DIR="/home/pmsa/apps/.cache"
TMP_DIR="/home/pmsa/apps/.tmp"
PORT="8083"
HOSTNAME="my.pm.sa"
API_BASE_URL="https://rental.pm.sa/api"

cd "$APP_DIR"
mkdir -p "$CACHE_DIR" "$TMP_DIR"
touch "$LOG_FILE"
: > "$LOG_FILE"

python3 - <<'PY'
from pathlib import Path
import re

path = Path('src/components/EntityDetailsScreen.tsx')
text = path.read_text()

# القوائم المنسدلة مغلقة افتراضيًا
text = text.replace(
    'const [openDetailSections, setOpenDetailSections] = useState<Record<string, boolean>>({ primary: true, extra: true });',
    'const [openDetailSections, setOpenDetailSections] = useState<Record<string, boolean>>({ primary: false, extra: false });'
)
text = text.replace(
    'const [openDetailSections, setOpenDetailSections] = useState<Record<string, boolean>>({ primary: true, extra: false });',
    'const [openDetailSections, setOpenDetailSections] = useState<Record<string, boolean>>({ primary: false, extra: false });'
)

# إخفاء عنوان الصفحة العلوي في تفاصيل الوحدة حتى تبدأ الشاشة ببطاقة الوحدة مباشرة
text = re.sub(
    r'\n\s*<View style=\{styles\.topBar\}>\n\s*<View style=\{styles\.topTitleBlock\}>\n\s*<Text style=\{styles\.topTitle\}>\{entityTitle\[normalizedEntity\] \|\| "التفاصيل"\}</Text>\n\s*<Text style=\{styles\.topSubtitle\}>تفاصيل السجل والخدمات المرتبطة</Text>\n\s*</View>\n(?:\s*\{normalizedEntity === "unit" \? \(.*?\) : null\}\n)?\s*</View>',
    '''\n        {normalizedEntity !== "unit" ? (\n          <View style={styles.topBar}>\n            <View style={styles.topTitleBlock}>\n              <Text style={styles.topTitle}>{entityTitle[normalizedEntity] || "التفاصيل"}</Text>\n              <Text style={styles.topSubtitle}>تفاصيل السجل والخدمات المرتبطة</Text>\n            </View>\n          </View>\n        ) : null}''',
    text,
    flags=re.S,
)

# إعادة بناء بطاقة الوحدة: بدون كلمة وحدة، بدون رقم سجل، والاسم مع بدج العقود في الأعلى
header_pattern = r'\n\s*<View style=\{styles\.headerCard\}>.*?\n\s*</View>\n\n\s*\{normalizedEntity !== "unit" \? \('
new_header = '''\n        <View style={styles.headerCard}>\n          {normalizedEntity === "unit" ? (\n            <>\n              <View style={styles.unitHeroRow}>\n                <View style={styles.unitCardActions}>\n                  <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails compact iconOnly onChanged={() => load(false)} />\n                </View>\n                <View style={styles.unitHeroTitleBlock}>\n                  <View style={styles.unitTitleBadgeRow}>\n                    <Text style={styles.contractBadge}>{relatedLabel}: {relatedCount}</Text>\n                    <Text numberOfLines={2} style={styles.title}>{data?.title || "جاري التحميل..."}</Text>\n                  </View>\n                </View>\n              </View>\n\n              <View style={styles.headerServicesWrap}>\n                <Text style={styles.headerServicesTitle}>خدمات الوحدة</Text>\n                <View style={styles.headerServicesGrid}>\n                  <ServiceChip icon="documents-outline" label="العقود" onPress={() => openUnitService("/contracts")} />\n                  <ServiceChip icon="create-outline" label="إنشاء عقد" onPress={() => openUnitService("/create-contract")} />\n                  <ServiceChip icon="cloud-upload-outline" label="رفع عقد" onPress={() => openUnitService("/upload-contract")} />\n                  <ServiceChip icon="images-outline" label="الوسائط" onPress={() => openUnitService("/files", "mode=media")} />\n                </View>\n              </View>\n            </>\n          ) : (\n            <>\n              <Text style={styles.entityLabel}>{data?.entity_title || entityTitle[normalizedEntity] || "تفاصيل"}</Text>\n              <Text numberOfLines={2} style={styles.title}>{data?.title || "جاري التحميل..."}</Text>\n              <View style={styles.headerStatsRow}>\n                <Text style={styles.statPill}>{relatedLabel}: {relatedCount}</Text>\n              </View>\n            </>\n          )}\n        </View>\n\n        {normalizedEntity !== "unit" ? ('''
text = re.sub(header_pattern, new_header, text, count=1, flags=re.S)

# حذف صندوق الخدمات المنفصل إن وجد
text = re.sub(
    r'\n\s*\{normalizedEntity === "unit" \? \(\n\s*<View style=\{styles\.servicesCard\}>.*?\n\s*\) : null\}\n\n\s*<SegmentedTabs',
    '\n\n        <SegmentedTabs',
    text,
    flags=re.S,
)

# إلغاء أي زر إضافة متبقٍ في البطاقة
text = text.replace('''                <HeaderIconButton icon="add" label="إضافة وحدة" onPress={openAddUnit} />\n''', '')

# تصميم البطاقة الجديد
text = re.sub(r'headerCard:\s*\{.*?\n\s*\},', '''headerCard: {
    backgroundColor: "#FFFDF8",
    borderRadius: 28,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8E1D6",
    shadowColor: "#92400e",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },''', text, flags=re.S)
text = re.sub(r'title:\s*\{.*?\n\s*\},', '''title: {
    color: "#111827",
    fontSize: 23,
    lineHeight: 32,
    fontWeight: "900",
    textAlign: "right",
    flexShrink: 1,
  },''', text, flags=re.S)
text = re.sub(r'statPill:\s*\{.*?\n\s*\},', '''statPill: {
    overflow: "hidden",
    backgroundColor: "#F7F3EA",
    color: "#6B4F24",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: "900",
    fontSize: 12,
  },''', text, flags=re.S)
text = re.sub(r'serviceChip:\s*\{.*?\n\s*\},', '''serviceChip: {
    width: "48.5%",
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E8E1D6",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },''', text, flags=re.S)
text = re.sub(r'serviceIconWrap:\s*\{.*?\n\s*\},', '''serviceIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F7F3EA", alignItems: "center", justifyContent: "center" },''', text, flags=re.S)

# إضافة/تطبيع ستايلات البطاقة الجديدة
style_anchor = '  topTitleBlock: { flex: 1, alignItems: "flex-end" },'
style_insert = '''  topTitleBlock: { flex: 1, alignItems: "flex-end" },
  unitHeroRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  unitHeroTitleBlock: { flex: 1, alignItems: "flex-end" },
  unitTitleBadgeRow: { width: "100%", flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  unitCardActions: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 6, paddingTop: 1 },
  contractBadge: { overflow: "hidden", backgroundColor: "#ECFDF5", color: "#0f766e", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: "900", marginTop: 2 },
  headerServicesWrap: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EFE7DA" },
  headerServicesTitle: { color: "#6B4F24", fontSize: 12, fontWeight: "900", textAlign: "right", marginBottom: 8 },
  headerServicesGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },'''
text = text.replace(style_anchor, style_insert)
for key, value in {
    'unitHeroRow': 'unitHeroRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },',
    'unitHeroTitleBlock': 'unitHeroTitleBlock: { flex: 1, alignItems: "flex-end" },',
    'unitTitleBadgeRow': 'unitTitleBadgeRow: { width: "100%", flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },',
    'unitCardActions': 'unitCardActions: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 6, paddingTop: 1 },',
    'contractBadge': 'contractBadge: { overflow: "hidden", backgroundColor: "#ECFDF5", color: "#0f766e", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: "900", marginTop: 2 },',
    'headerServicesWrap': 'headerServicesWrap: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EFE7DA" },',
    'headerServicesTitle': 'headerServicesTitle: { color: "#6B4F24", fontSize: 12, fontWeight: "900", textAlign: "right", marginBottom: 8 },',
    'headerServicesGrid': 'headerServicesGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },',
}.items():
    text = re.sub(rf'{key}: \{{[^\n]+\}},', value, text)

# إزالة تكرارات محتملة لنفس السطر
for line in set(re.findall(r'\n\s*(?:unitHeroRow|unitHeroTitleBlock|unitTitleBadgeRow|unitCardActions|contractBadge|headerServicesWrap|headerServicesTitle|headerServicesGrid): \{[^\n]+\},', text)):
    first = text.find(line)
    if first != -1:
        before = text[:first+len(line)]
        after = text[first+len(line):].replace(line, '')
        text = before + after

path.write_text(text)
PY

stop_known_pid() {
  if [ -f "$PID_FILE" ]; then
    OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
      kill "$OLD_PID" 2>/dev/null || true
      sleep 1
      kill -9 "$OLD_PID" 2>/dev/null || true
    fi
  fi
}

stop_port_if_allowed() {
  if command -v lsof >/dev/null 2>&1; then
    PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$PIDS" ]; then
      echo "$PIDS" | while read -r PID; do
        [ -z "$PID" ] && continue
        [ "$PID" = "$$" ] && continue
        kill "$PID" 2>/dev/null || true
        sleep 1
        kill -9 "$PID" 2>/dev/null || true
      done
    fi
  fi
}

is_port_listening() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | grep -q ":$PORT " && return 0
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  fi
  return 1
}

stop_known_pid
stop_port_if_allowed
pkill -f "expo start.*--port $PORT" 2>/dev/null || true
pkill -f "node .*expo.*--port $PORT" 2>/dev/null || true
sleep 2

if is_port_listening; then
  echo "Port $PORT is still busy by a process this user cannot stop. Run as root: lsof -ti:8083 | xargs -r kill -9"
  exit 1
fi

rm -rf .expo .expo-shared .metro-cache node_modules/.cache || true
rm -rf "$CACHE_DIR"/expo "$CACHE_DIR"/metro "$CACHE_DIR"/react-native "$CACHE_DIR"/metro-* "$CACHE_DIR"/haste-map-* || true

setsid bash -lc "cd '$APP_DIR' && exec env \
  BROWSER=none \
  CI=1 \
  EXPO_NO_TELEMETRY=1 \
  EXPO_PUBLIC_API_BASE_URL='$API_BASE_URL' \
  EXPO_PUBLIC_API_URL='$API_BASE_URL' \
  REACT_NATIVE_PACKAGER_HOSTNAME='$HOSTNAME' \
  XDG_CACHE_HOME='$CACHE_DIR' \
  TMPDIR='$TMP_DIR' \
  TMP='$TMP_DIR' \
  TEMP='$TMP_DIR' \
  npx expo start --clear --go --host lan --port '$PORT'" \
  </dev/null >> "$LOG_FILE" 2>&1 &

PID="$!"
echo "$PID" > "$PID_FILE"

for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if is_port_listening; then
    echo "Expo is listening on port $PORT"
    echo "PID: $PID"
    echo "Log: $LOG_FILE"
    exit 0
  fi
  sleep 2
done

echo "Expo was started, but port $PORT is not listening yet. Last log lines:"
tail -n 120 "$LOG_FILE" || true
exit 1
