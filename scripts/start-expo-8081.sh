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
path = Path('src/components/EntityDetailsScreen.tsx')
text = path.read_text()
text = text.replace(
    'const [openDetailSections, setOpenDetailSections] = useState<Record<string, boolean>>({ primary: true, extra: true });',
    'const [openDetailSections, setOpenDetailSections] = useState<Record<string, boolean>>({ primary: false, extra: false });'
)
text = text.replace(
'''          {normalizedEntity === "unit" ? (\n            <HeaderIconButton icon="add" label="إضافة وحدة" onPress={openAddUnit} />\n          ) : null}''',
'''          {normalizedEntity === "unit" ? (\n            <View style={styles.topActionsRow}>\n              <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails compact iconOnly onChanged={() => load(false)} />\n              <HeaderIconButton icon="add" label="إضافة وحدة" onPress={openAddUnit} />\n            </View>\n          ) : null}'''
)
text = text.replace(
'''        <View style={styles.detailsActionsBox}>\n          <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails compact iconOnly onChanged={() => load(false)} />\n        </View>''',
'''        {normalizedEntity !== "unit" ? (\n          <View style={styles.detailsActionsBox}>\n            <InlineEditDeleteActions resource={resourceForEntity(String(entity))} id={id} hideDetails compact iconOnly onChanged={() => load(false)} />\n          </View>\n        ) : null}'''
)
text = text.replace(
'''  topTitleBlock: { flex: 1, alignItems: "flex-end" },''',
'''  topTitleBlock: { flex: 1, alignItems: "flex-end" },\n  topActionsRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 6 },'''
)
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
