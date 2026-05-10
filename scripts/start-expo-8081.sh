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

text = text.replace(
    'const [openDetailSections, setOpenDetailSections] = useState<Record<string, boolean>>({ primary: true, extra: true });',
    'const [openDetailSections, setOpenDetailSections] = useState<Record<string, boolean>>({ primary: false, extra: false });'
)
text = text.replace(
    'const [openDetailSections, setOpenDetailSections] = useState<Record<string, boolean>>({ primary: true, extra: false });',
    'const [openDetailSections, setOpenDetailSections] = useState<Record<string, boolean>>({ primary: false, extra: false });'
)

# Remove any unit action buttons from the small title row; actions will live inside the main unit card.
text = text.replace(
'''          {normalizedEntity === "unit" ? (\n            <HeaderIconButton icon="add" label="إضافة وحدة" onPress={openAddUnit} />\n          ) : null}''',
''
)
text = text.replace(
'''          {normalizedEntity === "unit" ? (\n            <View style={styles.topActionsRow}>\n              <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails compact iconOnly onChanged={() => load(false)} />\n              <HeaderIconButton icon="add" label="إضافة وحدة" onPress={openAddUnit} />\n            </View>\n          ) : null}''',
''
)

# Hide the old action box for unit details because the icons are now in the main card.
text = text.replace(
'''        <View style={styles.detailsActionsBox}>\n          <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails compact iconOnly onChanged={() => load(false)} />\n        </View>''',
'''        {normalizedEntity !== "unit" ? (\n          <View style={styles.detailsActionsBox}>\n            <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails compact iconOnly onChanged={() => load(false)} />\n          </View>\n        ) : null}'''
)
text = text.replace(
'''        {normalizedEntity !== "unit" ? (\n          <View style={styles.detailsActionsBox}>\n            <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails compact iconOnly onChanged={() => load(false)} />\n          </View>\n        ) : null}''',
'''        {normalizedEntity !== "unit" ? (\n          <View style={styles.detailsActionsBox}>\n            <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails compact iconOnly onChanged={() => load(false)} />\n          </View>\n        ) : null}'''
)

# Put action icons inside the main header card.
text = text.replace(
'''        <View style={styles.headerCard}>\n          <Text style={styles.entityLabel}>{data?.entity_title || entityTitle[normalizedEntity] || "تفاصيل"}</Text>\n          <Text numberOfLines={2} style={styles.title}>{data?.title || "جاري التحميل..."}</Text>''',
'''        <View style={styles.headerCard}>\n          <View style={styles.unitCardTopRow}>\n            {normalizedEntity === "unit" ? (\n              <View style={styles.unitCardActions}>\n                <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails compact iconOnly onChanged={() => load(false)} />\n                <HeaderIconButton icon="add" label="إضافة وحدة" onPress={openAddUnit} />\n              </View>\n            ) : <View />}\n            <Text style={styles.entityLabel}>{data?.entity_title || entityTitle[normalizedEntity] || "تفاصيل"}</Text>\n          </View>\n          <Text numberOfLines={2} style={styles.title}>{data?.title || "جاري التحميل..."}</Text>'''
)

# Put unit services inside the main header card under the stats row.
text = text.replace(
'''          <View style={styles.headerStatsRow}>\n            <Text style={styles.statPill}>{relatedLabel}: {relatedCount}</Text>\n            <Text style={styles.statPill}>رقم السجل: {valueOrDash(id)}</Text>\n          </View>\n        </View>''',
'''          <View style={styles.headerStatsRow}>\n            <Text style={styles.statPill}>{relatedLabel}: {relatedCount}</Text>\n            <Text style={styles.statPill}>رقم السجل: {valueOrDash(id)}</Text>\n          </View>\n          {normalizedEntity === "unit" ? (\n            <View style={styles.headerServicesWrap}>\n              <Text style={styles.headerServicesTitle}>خدمات الوحدة</Text>\n              <View style={styles.headerServicesGrid}>\n                <ServiceChip icon="documents-outline" label="العقود" onPress={() => openUnitService("/contracts")} />\n                <ServiceChip icon="create-outline" label="إنشاء عقد" onPress={() => openUnitService("/create-contract")} />\n                <ServiceChip icon="cloud-upload-outline" label="رفع عقد" onPress={() => openUnitService("/upload-contract")} />\n                <ServiceChip icon="images-outline" label="الوسائط" onPress={() => openUnitService("/files", "mode=media")} />\n              </View>\n            </View>\n          ) : null}\n        </View>'''
)

# Remove the old separate unit services card if it still exists.
text = re.sub(
    r'\n\s*\{normalizedEntity === "unit" \? \(\n\s*<View style=\{styles\.servicesCard\}>.*?\n\s*\) : null\}\n\n\s*<SegmentedTabs',
    '\n\n        <SegmentedTabs',
    text,
    flags=re.S,
)

# Add styles for the merged top card layout.
text = text.replace(
'''  topTitleBlock: { flex: 1, alignItems: "flex-end" },''',
'''  topTitleBlock: { flex: 1, alignItems: "flex-end" },\n  topActionsRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 6 },\n  unitCardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 },\n  unitCardActions: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 6 },\n  headerServicesWrap: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)" },\n  headerServicesTitle: { color: "#e5e7eb", fontSize: 12, fontWeight: "900", textAlign: "right", marginBottom: 8 },\n  headerServicesGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },'''
)
# Avoid duplicate style entries if the script runs repeatedly.
text = re.sub(r'(topActionsRow: \{[^\n]+\},\n)(\s*topActionsRow: \{[^\n]+\},\n)+', r'\1', text)
text = re.sub(r'(unitCardTopRow: \{[^\n]+\},\n)(\s*unitCardTopRow: \{[^\n]+\},\n)+', r'\1', text)
text = re.sub(r'(unitCardActions: \{[^\n]+\},\n)(\s*unitCardActions: \{[^\n]+\},\n)+', r'\1', text)
text = re.sub(r'(headerServicesWrap: \{[^\n]+\},\n)(\s*headerServicesWrap: \{[^\n]+\},\n)+', r'\1', text)
text = re.sub(r'(headerServicesTitle: \{[^\n]+\},\n)(\s*headerServicesTitle: \{[^\n]+\},\n)+', r'\1', text)
text = re.sub(r'(headerServicesGrid: \{[^\n]+\},\n)(\s*headerServicesGrid: \{[^\n]+\},\n)+', r'\1', text)

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
