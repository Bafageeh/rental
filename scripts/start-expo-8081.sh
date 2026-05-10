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

# Use the fixed source directly so the unit services layout does not disappear.
if [ -f "src/components/EntityDetailsScreen.fixed.tsx" ]; then
  cp src/components/EntityDetailsScreen.fixed.tsx src/components/EntityDetailsScreen.tsx
fi

# Final unit-card refinements requested by user.
python3 - <<'PY'
from pathlib import Path
import re

path = Path('src/components/EntityDetailsScreen.tsx')
text = path.read_text()
old = '''        <View style={styles.headerCard}>
          <View style={styles.unitCardTopRow}>
            {normalizedEntity === "unit" ? (
              <View style={styles.unitCardActions}>
                <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails compact iconOnly onChanged={() => load(false)} />
              </View>
            ) : <View />}
            <Text style={styles.entityLabel}>{data?.entity_title || entityTitle[normalizedEntity] || "تفاصيل"}</Text>
          </View>
          <Text numberOfLines={2} style={styles.title}>{data?.title || "جاري التحميل..."}</Text>
          <View style={styles.headerStatsRow}>
            <Text style={styles.statPill}>{relatedLabel}: {relatedCount}</Text>
          </View>

          {normalizedEntity === "unit" ? (
            <View style={styles.headerServicesWrap}>
              <View style={styles.headerServicesHeader}>
                <Text style={styles.headerServicesTitle}>خدمات الوحدة</Text>
                <Ionicons name="grid-outline" size={16} color="#6b7280" />
              </View>
              <View style={styles.headerServicesGrid}>
                <ServiceChip icon="documents-outline" label="العقود" onPress={() => openUnitService("/contracts")} />
                <ServiceChip icon="create-outline" label="إنشاء عقد" onPress={() => openUnitService("/create-contract")} />
                <ServiceChip icon="cloud-upload-outline" label="رفع عقد" onPress={() => openUnitService("/upload-contract")} />
                <ServiceChip icon="images-outline" label="الوسائط" onPress={() => openUnitService("/files", "mode=media")} />
              </View>
            </View>
          ) : null}
        </View>'''
new = '''        <View style={styles.headerCard}>
          {normalizedEntity === "unit" ? (
            <>
              <View style={styles.unitHeroRow}>
                <View style={styles.unitCardActions}>
                  <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails compact iconOnly onChanged={() => load(false)} />
                </View>
                <View style={styles.unitTitleWrap}>
                  <Text numberOfLines={2} style={styles.title}>{data?.title || "جاري التحميل..."}</Text>
                </View>
              </View>

              <View style={styles.headerServicesWrapCompact}>
                <View style={styles.headerServicesHeaderCompact}>
                  <Text style={styles.headerServicesTitleCompact}>خدمات الوحدة</Text>
                  <Ionicons name="grid-outline" size={14} color="#6b7280" />
                </View>
                <View style={styles.headerServicesGridCompact}>
                  <ServiceChip icon="time-outline" label="سجل العقود" onPress={() => openUnitService("/contracts", "history=1")} />
                  <ServiceChip icon="create-outline" label="إنشاء عقد" onPress={() => openUnitService("/create-contract")} />
                  <ServiceChip icon="cloud-upload-outline" label="رفع عقد" onPress={() => openUnitService("/upload-contract")} />
                  <ServiceChip icon="images-outline" label="الوسائط" onPress={() => openUnitService("/files", "mode=media")} />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.entityLabel}>{data?.entity_title || entityTitle[normalizedEntity] || "تفاصيل"}</Text>
              <Text numberOfLines={2} style={styles.title}>{data?.title || "جاري التحميل..."}</Text>
              <View style={styles.headerStatsRow}>
                <Text style={styles.statPill}>{relatedLabel}: {relatedCount}</Text>
              </View>
            </>
          )}
        </View>'''
if old not in text:
    raise SystemExit('Expected unit card block not found')
text = text.replace(old, new, 1)

# Compact services and lift title visually.
text = re.sub(r'serviceChip:\s*\{.*?\n\s*\},', '''serviceChip: {
    width: "48.5%",
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },''', text, flags=re.S)
text = re.sub(r'serviceIconWrap:\s*\{.*?\n\s*\},', 'serviceIconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#EEF2F7" },', text, flags=re.S)
text = re.sub(r'serviceText:\s*\{.*?\n\s*\},', 'serviceText: { flex: 1, color: "#111827", fontSize: 11, fontWeight: "900", textAlign: "right" },', text, flags=re.S)
text = re.sub(r'title:\s*\{.*?\n\s*\},', '''title: {
    color: "#111827",
    fontSize: 23,
    lineHeight: 31,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 0,
  },''', text, flags=re.S)
text = re.sub(r'headerCard:\s*\{.*?\n\s*\},', '''headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E6E9E6",
    shadowColor: "#0f766e",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },''', text, flags=re.S)

anchor = '  unitCardActions: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 6 },'
insert = '''  unitCardActions: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 6 },
  unitHeroRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  unitTitleWrap: { flex: 1, alignItems: "flex-end", gap: 7 },
  headerServicesWrapCompact: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  headerServicesHeaderCompact: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  headerServicesTitleCompact: { color: "#374151", fontSize: 11, fontWeight: "900", textAlign: "right" },
  headerServicesGridCompact: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },'''
text = text.replace(anchor, insert, 1)
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
