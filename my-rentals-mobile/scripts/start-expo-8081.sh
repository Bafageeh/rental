#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/home/pmsa/apps/my-rentals-expo.log"
CACHE_DIR="/home/pmsa/apps/.cache"
TMP_DIR="/home/pmsa/apps/.tmp"
PORT="8083"
HOSTNAME="my.pm.sa"
API_BASE_URL="https://rental.pm.sa/api"
DEPLOY_STAMP="2026-05-10-unit-services-one-row-cards-v4"

choose_app_dir() {
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

if [ -f "src/components/EntityDetailsScreen.fixed.tsx" ]; then
  cp src/components/EntityDetailsScreen.fixed.tsx src/components/EntityDetailsScreen.tsx
fi

python3 - <<'PY' | tee -a "/home/pmsa/apps/my-rentals-expo.log"
from pathlib import Path
import re

details = Path('src/components/EntityDetailsScreen.tsx')
if not details.exists():
    raise SystemExit('EntityDetailsScreen.tsx not found')

text = details.read_text()
text = text.replace(
    '<ServiceChip icon="documents-outline" label="العقود" onPress={() => openUnitService("/contracts")} />',
    '<ServiceChip icon="time-outline" label="سجل العقود" onPress={() => openUnitService("/contracts", "history=1")} />',
)
text = re.sub(r'servicesGrid:\s*\{[^\n]+\},', 'servicesGrid: { flexDirection: "row-reverse", flexWrap: "nowrap", gap: 5 },', text)
text = re.sub(r'headerServicesGrid:\s*\{[^\n]+\},', 'headerServicesGrid: { flexDirection: "row-reverse", flexWrap: "nowrap", gap: 5 },', text)
text = re.sub(r'headerServicesGridCompact:\s*\{[^\n]+\},', 'headerServicesGridCompact: { flexDirection: "row-reverse", flexWrap: "nowrap", gap: 5 },', text)
text = re.sub(r'serviceChip:\s*\{.*?\n\s*\},', '''serviceChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 2,
    paddingVertical: 6,
  },''', text, flags=re.S)
text = re.sub(r'serviceIconWrap:\s*\{.*?\n\s*\},', 'serviceIconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#EEF2F7" },', text, flags=re.S)
text = re.sub(r'serviceText:\s*\{.*?\n\s*\},', 'serviceText: { width: "100%", color: "#111827", fontSize: 9.5, fontWeight: "900", textAlign: "center" },', text, flags=re.S)
text = text.replace('width: "48.5%",', '')
text = text.replace('flexWrap: "wrap"', 'flexWrap: "nowrap"')
details.write_text(text)

ok = 'label="سجل العقود"' in text and 'flexWrap: "nowrap"' in text and 'width: "48.5%"' not in text
print(f'UNIT_SERVICES_ONE_ROW_CARDS_PATCH={"ok" if ok else "failed"}')
PY

rm -rf .expo .expo-shared .metro-cache node_modules/.cache || true
rm -rf "$CACHE_DIR"/expo "$CACHE_DIR"/metro "$CACHE_DIR"/react-native "$CACHE_DIR"/metro-* "$CACHE_DIR"/haste-map-* || true

BROWSER=none \
CI=1 \
EXPO_NO_TELEMETRY=1 \
EXPO_PUBLIC_API_BASE_URL="$API_BASE_URL" \
EXPO_PUBLIC_API_URL="$API_BASE_URL" \
EXPO_PUBLIC_DEPLOY_STAMP="$DEPLOY_STAMP" \
REACT_NATIVE_PACKAGER_HOSTNAME="$HOSTNAME" \
XDG_CACHE_HOME="$CACHE_DIR" \
TMPDIR="$TMP_DIR" \
TMP="$TMP_DIR" \
TEMP="$TMP_DIR" \
npx expo start --clear --go --host lan --port "$PORT"
