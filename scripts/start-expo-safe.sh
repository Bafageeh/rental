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
DEPLOY_STAMP="2026-05-10-contract-payment-card-compact-safe"

cd "$APP_DIR"
mkdir -p "$CACHE_DIR" "$TMP_DIR"
: > "$LOG_FILE"
echo "Starting my-rentals Expo bundle: $DEPLOY_STAMP" >> "$LOG_FILE"

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$OLD_PID" 2>/dev/null || true
  fi
fi

if command -v lsof >/dev/null 2>&1; then
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | while read -r PID; do
    [ -z "$PID" ] && continue
    [ "$PID" = "$$" ] && continue
    kill "$PID" 2>/dev/null || true
    sleep 1
    kill -9 "$PID" 2>/dev/null || true
  done
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
  if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
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
