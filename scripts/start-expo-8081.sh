#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/pmsa/apps/my-rentals-mobile"
LOG_FILE="/home/pmsa/apps/my-rentals-expo.log"
PID_FILE="/home/pmsa/apps/my-rentals-expo.pid"
CACHE_DIR="/home/pmsa/apps/.cache"
TMP_DIR="/home/pmsa/apps/.tmp"
PORT="8081"
HOSTNAME="my.pm.sa"
API_BASE_URL="https://my.pm.sa/api"

cd "$APP_DIR"
mkdir -p "$CACHE_DIR" "$TMP_DIR"
touch "$LOG_FILE"
: > "$LOG_FILE"

stop_port() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti:"$PORT" | xargs -r kill -9 || true
  fi
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "$PORT/tcp" || true
  fi
  pkill -f "expo.*--port $PORT" || true
  pkill -f "expo.*$PORT" || true
  pkill -f "metro.*$PORT" || true
  pkill -f "node.*$PORT" || true
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

stop_port
sleep 2
rm -rf .expo "$CACHE_DIR"/metro-* "$CACHE_DIR"/haste-map-* || true

# Fully detached background run: does not reserve or block the SSH shell.
setsid bash -lc "cd '$APP_DIR' && exec env \
  BROWSER=none \
  CI=1 \
  EXPO_NO_TELEMETRY=1 \
  EXPO_PUBLIC_API_BASE_URL='$API_BASE_URL' \
  REACT_NATIVE_PACKAGER_HOSTNAME='$HOSTNAME' \
  XDG_CACHE_HOME='$CACHE_DIR' \
  TMPDIR='$TMP_DIR' \
  TMP='$TMP_DIR' \
  TEMP='$TMP_DIR' \
  npx expo start --clear --go --host lan --port '$PORT'" \
  </dev/null >> "$LOG_FILE" 2>&1 &

PID="$!"
echo "$PID" > "$PID_FILE"

# Wait until Expo opens the fixed port, then print useful diagnostics.
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
