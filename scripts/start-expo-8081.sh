#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/pmsa/apps/my-rentals-mobile"
LOG_FILE="/home/pmsa/apps/my-rentals-expo.log"
CACHE_DIR="/home/pmsa/apps/.cache"
TMP_DIR="/home/pmsa/apps/.tmp"
PORT="8081"
HOSTNAME="my.pm.sa"
API_BASE_URL="https://my.pm.sa/api"

cd "$APP_DIR"
mkdir -p "$CACHE_DIR" "$TMP_DIR"
touch "$LOG_FILE"

# Stop old Expo/Metro processes on the fixed project port only.
if command -v lsof >/dev/null 2>&1; then
  lsof -ti:"$PORT" | xargs -r kill -9 || true
fi
pkill -f "expo.*$PORT" || true
pkill -f "metro.*$PORT" || true
pkill -f "node.*$PORT" || true
if command -v fuser >/dev/null 2>&1; then
  fuser -k "$PORT/tcp" || true
fi

rm -rf .expo "$CACHE_DIR"/metro-* "$CACHE_DIR"/haste-map-* || true

# Detached background run: does not reserve or block the SSH shell.
nohup env \
  BROWSER=none \
  EXPO_NO_TELEMETRY=1 \
  EXPO_PUBLIC_API_BASE_URL="$API_BASE_URL" \
  REACT_NATIVE_PACKAGER_HOSTNAME="$HOSTNAME" \
  XDG_CACHE_HOME="$CACHE_DIR" \
  TMPDIR="$TMP_DIR" \
  TMP="$TMP_DIR" \
  TEMP="$TMP_DIR" \
  npx expo start --clear --go --host lan --port "$PORT" \
  </dev/null > "$LOG_FILE" 2>&1 &

echo $! > /home/pmsa/apps/my-rentals-expo.pid
disown 2>/dev/null || true

echo "Expo started in background on port $PORT"
echo "PID: $(cat /home/pmsa/apps/my-rentals-expo.pid)"
echo "Log: $LOG_FILE"
