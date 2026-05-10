#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/home/pmsa/apps/my-rentals-expo.log"
PID_FILE="/home/pmsa/apps/my-rentals-expo.pid"
CACHE_DIR="/home/pmsa/apps/.cache"
TMP_DIR="/home/pmsa/apps/.tmp"
PORT="8083"
HOSTNAME="my.pm.sa"
API_BASE_URL="https://rental.pm.sa/api"
DEPLOY_STAMP="2026-05-10-expo-hard-refresh-unit-services-one-row-v3"

choose_app_dir() {
  if [ -n "${APP_DIR_OVERRIDE:-}" ] && [ -d "$APP_DIR_OVERRIDE" ]; then
    printf '%s\n' "$APP_DIR_OVERRIDE"
    return 0
  fi

  if [ -f "$PID_FILE" ]; then
    OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "${OLD_PID:-}" ] && [ -d "/proc/$OLD_PID/cwd" ]; then
      OLD_CWD="$(readlink "/proc/$OLD_PID/cwd" 2>/dev/null || true)"
      if [ -n "$OLD_CWD" ] && [ -f "$OLD_CWD/package.json" ]; then
        printf '%s\n' "$OLD_CWD"
        return 0
      fi
    fi
  fi

  for candidate in \
    "/home/pmsa/apps/rental/my-rentals-mobile" \
    "/home/pmsa/apps/my-rentals-mobile" \
    "/mnt/home-storage/home/pmsa/apps/rental/my-rentals-mobile" \
    "/mnt/home-storage/home/pmsa/apps/my-rentals-mobile"; do
    if [ -f "$candidate/package.json" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  echo "Cannot find my-rentals-mobile app directory" >&2
  exit 1
}

APP_DIR="$(choose_app_dir)"
cd "$APP_DIR"
mkdir -p "$CACHE_DIR" "$TMP_DIR"
touch "$LOG_FILE"
: > "$LOG_FILE"
{
  echo "Starting my-rentals Expo bundle: $DEPLOY_STAMP"
  echo "APP_DIR=$APP_DIR"
  echo "PORT=$PORT"
  echo "HOSTNAME=$HOSTNAME"
  echo "CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo "DATE=$(date '+%Y-%m-%d %H:%M:%S')"
} >> "$LOG_FILE"

# Use the fixed source directly so the unit details layout does not disappear.
if [ -f "src/components/EntityDetailsScreen.fixed.tsx" ]; then
  cp src/components/EntityDetailsScreen.fixed.tsx src/components/EntityDetailsScreen.tsx
fi

python3 - <<'PY'
from pathlib import Path
import re

details = Path('src/components/EntityDetailsScreen.tsx')
if details.exists():
    text = details.read_text()

    # Force all unit service cards into one row without changing labels/actions.
    text = re.sub(r'servicesGrid:\s*\{[^\n]+\},', 'servicesGrid: { flexDirection: "row-reverse", flexWrap: "nowrap", gap: 4 },', text)
    text = re.sub(r'headerServicesGrid:\s*\{[^\n]+\},', 'headerServicesGrid: { flexDirection: "row-reverse", flexWrap: "nowrap", gap: 4 },', text)
    text = re.sub(r'headerServicesGridCompact:\s*\{[^\n]+\},', 'headerServicesGridCompact: { flexDirection: "row-reverse", flexWrap: "nowrap", gap: 4 },', text)

    text = re.sub(r'serviceChip:\s*\{.*?\n\s*\},', '''serviceChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 3,
    paddingVertical: 5,
  },''', text, flags=re.S)
    text = re.sub(r'serviceIconWrap:\s*\{.*?\n\s*\},', 'serviceIconWrap: { width: 23, height: 23, borderRadius: 12, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#EEF2F7" },', text, flags=re.S)
    text = re.sub(r'serviceText:\s*\{.*?\n\s*\},', 'serviceText: { width: "100%", color: "#111827", fontSize: 10, fontWeight: "900", textAlign: "center" },', text, flags=re.S)

    # Remove accidental two-column width even if style shape changes later.
    text = text.replace('width: "48.5%",', '')
    text = text.replace('flexWrap: "wrap"', 'flexWrap: "nowrap"')

    details.write_text(text)

    # Quick verification in deploy log.
    final = details.read_text()
    ok = 'servicesGrid: { flexDirection: "row-reverse", flexWrap: "nowrap", gap: 4 }' in final and 'width: "48.5%"' not in final
    print(f'UNIT_SERVICES_ONE_ROW_PATCH={"ok" if ok else "failed"}')
PY

stop_pid() {
  PID="$1"
  [ -z "$PID" ] && return 0
  [ "$PID" = "$$" ] && return 0
  if kill -0 "$PID" 2>/dev/null; then
    echo "Stopping PID $PID" >> "$LOG_FILE"
    kill "$PID" 2>/dev/null || true
    sleep 1
    kill -9 "$PID" 2>/dev/null || true
  fi
}

if [ -f "$PID_FILE" ]; then
  stop_pid "$(cat "$PID_FILE" 2>/dev/null || true)"
fi

# Kill every old Metro/Expo process owned by this user, including old ports.
pkill -f "expo start|metro|react-native|node.*8081|node.*8082|node.*8083|node.*my-rentals-mobile" 2>/dev/null || true
sleep 2

if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | while read -r PID; do stop_pid "$PID"; done
  fi
fi
sleep 1

is_port_listening() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | grep -q ":$PORT " && return 0
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  fi
  return 1
}

if is_port_listening; then
  echo "Port $PORT is still busy by a process this deploy user cannot stop." >> "$LOG_FILE"
  echo "Run as root if needed: lsof -ti:$PORT | xargs -r kill -9" >> "$LOG_FILE"
  tail -n 80 "$LOG_FILE" || true
  exit 1
fi

rm -rf .expo .expo-shared .metro-cache node_modules/.cache || true
rm -rf "$CACHE_DIR"/expo "$CACHE_DIR"/metro "$CACHE_DIR"/react-native "$CACHE_DIR"/metro-* "$CACHE_DIR"/haste-map-* || true
watchman watch-del-all >/dev/null 2>&1 || true

setsid bash -lc "cd '$APP_DIR' && exec env \
  BROWSER=none \
  CI=1 \
  EXPO_NO_TELEMETRY=1 \
  EXPO_PUBLIC_API_BASE_URL='$API_BASE_URL' \
  EXPO_PUBLIC_API_URL='$API_BASE_URL' \
  EXPO_PUBLIC_DEPLOY_STAMP='$DEPLOY_STAMP' \
  REACT_NATIVE_PACKAGER_HOSTNAME='$HOSTNAME' \
  XDG_CACHE_HOME='$CACHE_DIR' \
  TMPDIR='$TMP_DIR' \
  TMP='$TMP_DIR' \
  TEMP='$TMP_DIR' \
  npx expo start --clear --go --host lan --port '$PORT'" \
  </dev/null >> "$LOG_FILE" 2>&1 &

PID="$!"
echo "$PID" > "$PID_FILE"
echo "STARTED_PID=$PID" >> "$LOG_FILE"

for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if is_port_listening; then
    echo "Expo is listening on port $PORT" >> "$LOG_FILE"
    echo "PID: $PID" >> "$LOG_FILE"
    echo "Log: $LOG_FILE" >> "$LOG_FILE"
    tail -n 80 "$LOG_FILE" || true
    exit 0
  fi
  sleep 2
done

echo "Expo was started, but port $PORT is not listening yet. Last log lines:" >> "$LOG_FILE"
tail -n 120 "$LOG_FILE" || true
exit 1
