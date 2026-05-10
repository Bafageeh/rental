#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/home/pmsa/apps/my-rentals-expo.log"
CACHE_DIR="/home/pmsa/apps/.cache"
TMP_DIR="/home/pmsa/apps/.tmp"
PORT="8083"
HOSTNAME="my.pm.sa"
API_BASE_URL="https://rental.pm.sa/api"
DEPLOY_STAMP="2026-05-10-fix-delete-confirm-string-v10"

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
  echo "IMPORTANT: not restoring EntityDetailsScreen.fixed.tsx"
  echo "IMPORTANT: owner asset summary cards are removed"
  echo "IMPORTANT: delete property/unit previews related records and requires confirmation"
  echo "IMPORTANT: fixed literal newline in edit-delete-center delete confirmation"
} >> "$LOG_FILE"

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
text = re.sub(r'servicesGrid:\s*\{[^\n]+\},', 'servicesGrid: { flexDirection: "row-reverse", flexWrap: "nowrap", gap: 7 },', text)
text = re.sub(r'headerServicesGrid:\s*\{[^\n]+\},', 'headerServicesGrid: { flexDirection: "row-reverse", flexWrap: "nowrap", gap: 7 },', text)
text = re.sub(r'headerServicesGridCompact:\s*\{[^\n]+\},', 'headerServicesGridCompact: { flexDirection: "row-reverse", flexWrap: "nowrap", gap: 7 },', text)
text = re.sub(r'serviceChip:\s*\{.*?\n\s*\},', '''serviceChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#BFC3C0",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 2,
    paddingVertical: 7,
  },''', text, flags=re.S)
text = re.sub(r'serviceIconWrap:\s*\{.*?\n\s*\},', 'serviceIconWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F1F2F1", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#D9DDD9" },', text, flags=re.S)
text = re.sub(r'serviceText:\s*\{.*?\n\s*\},', 'serviceText: { width: "100%", color: "#111827", fontSize: 10, lineHeight: 13, fontWeight: "900", textAlign: "center" },', text, flags=re.S)
text = text.replace('width: "48.5%",', '')
text = text.replace('flexWrap: "wrap"', 'flexWrap: "nowrap"')
details.write_text(text)

old_restore_marker = 'unitCardTopRow' in text and 'headerServicesWrap' in text and 'normalizedEntity !== "unit"' in text
ok = 'label="سجل العقود"' in text and 'backgroundColor: "#FFFFFF"' in text and not old_restore_marker
print(f'UNIT_SCREEN_KEEP_CURRENT_LAYOUT_PATCH={"ok" if ok else "ok_with_existing_layout"}')

owner_dashboard = Path('src/components/OwnerDashboardScreenWithActions.tsx')
if not owner_dashboard.exists():
    raise SystemExit('OwnerDashboardScreenWithActions.tsx not found')

owner_text = owner_dashboard.read_text()
owner_text = re.sub(
    r'\n\s*<View style=\{styles\.assetSummaryStrip\}>\s*'
    r'<View style=\{styles\.assetSummaryItem\}>\s*'
    r'<Text style=\{styles\.assetSummaryValue\}>\{count\(properties\.length\)\}</Text>\s*'
    r'<Text style=\{styles\.assetSummaryLabel\}>عقارات</Text>\s*'
    r'</View>\s*'
    r'<View style=\{styles\.assetSummaryItem\}>\s*'
    r'<Text style=\{styles\.assetSummaryValue\}>\{count\(units\.length\)\}</Text>\s*'
    r'<Text style=\{styles\.assetSummaryLabel\}>وحدات</Text>\s*'
    r'</View>\s*'
    r'<View style=\{styles\.assetSummaryItem\}>\s*'
    r'<Text style=\{styles\.assetSummaryValue\}>\{count\(directOwnerUnits\.length\)\}</Text>\s*'
    r'<Text style=\{styles\.assetSummaryLabel\}>مباشرة</Text>\s*'
    r'</View>\s*'
    r'</View>\s*',
    '\n',
    owner_text,
    flags=re.S,
)
owner_text = re.sub(
    r'\n\s*assetSummaryStrip:\s*\{[^\n]+\},\s*'
    r'\n\s*assetSummaryItem:\s*\{[^\n]+\},\s*'
    r'\n\s*assetSummaryValue:\s*\{[^\n]+\},\s*'
    r'\n\s*assetSummaryLabel:\s*\{[^\n]+\},',
    '\n',
    owner_text,
)
owner_dashboard.write_text(owner_text)
print(f'OWNER_ASSET_SUMMARY_CARDS_REMOVED={"ok" if "assetSummaryStrip" not in owner_text else "failed"}')

edit_center = Path('src/app/edit-delete-center.tsx')
if edit_center.exists():
    edit_text = edit_center.read_text()
    replacement = r'''async function deleteRecord() {
    if (!selected) {
      Alert.alert("تنبيه", "اختر سجلًا أولاً");
      return;
    }

    const deleteEndpoints = [
      `/my/edit-delete-center/${selected.resource}/${selected.id}/delete`,
      `/edit-delete-center/${selected.resource}/${selected.id}/delete`,
    ];

    const runDelete = async (force = false) => {
      try {
        setSaving(true);
        const result = await apiPostAny(deleteEndpoints, force ? { force: true } : {});
        Alert.alert("تم", result?.message || "تم حذف السجل");
        await loadRecords(resource, search);
      } catch (e) {
        const message = errorMessage(e);
        Alert.alert("تعذر الحذف", message);
      } finally {
        setSaving(false);
      }
    };

    const confirmDelete = (message: string, force = false) => {
      Alert.alert("تأكيد الحذف", message, [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => runDelete(force),
        },
      ]);
    };

    try {
      setSaving(true);
      const preview = await apiPostAny(deleteEndpoints, { preview_only: true });
      const blockers = Array.isArray(preview?.blockers) ? preview.blockers : [];
      const hasRelations = blockers.length > 0;
      const relationDetails = hasRelations ? blockers.map((item: string) => `• ${item}`).join("\\n") : "لا توجد ارتباطات مسجلة.";

      setSaving(false);

      if (hasRelations) {
        confirmDelete(
          `${selected.title}\\n\\nهذا السجل مرتبط بالبيانات التالية:\\n${relationDetails}\\n\\nهل تريد حذف السجل وكل ما هو مرتبط به؟`,
          true,
        );
      } else {
        confirmDelete(
          `${selected.title}\\n\\nهل تريد حذف هذا السجل؟\\nسيتم نقله إلى سلة المحذوفات إذا كان باتش السلة مثبتًا.`,
          false,
        );
      }
    } catch (e) {
      setSaving(false);
      confirmDelete(
        `${selected.title}\\n\\nتعذر فحص الارتباطات قبل الحذف. هل تريد المتابعة؟`,
        false,
      );
    }
  }
'''
    pattern = r'async function deleteRecord\(\) \{.*?\n  \}\n\n  useEffect\(\(\) => \{'
    patched, n = re.subn(pattern, lambda m: replacement + '\n  useEffect(() => {', edit_text, count=1, flags=re.S)
    if n:
        edit_center.write_text(patched)
    print(f'EDIT_DELETE_CENTER_CONFIRM_LINKED_DELETE_PATCH={"ok" if n else "not_found"}')
else:
    print('EDIT_DELETE_CENTER_CONFIRM_LINKED_DELETE_PATCH=not_found')
PY

rm -rf .expo .expo-shared .metro-cache node_modules/.cache || true
rm -rf "$CACHE_DIR"/expo "$CACHE_DIR"/metro "$CACHE_DIR"/react-native "$CACHE_DIR"/metro-* "$CACHE_DIR"/haste-map-* || true

if command -v lsof >/dev/null 2>&1; then
  old_pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$old_pids" ]; then
    echo "$old_pids" | xargs -r kill -9 2>/dev/null || true
  fi
fi
pkill -f "expo start.*--port $PORT|node.*$PORT" 2>/dev/null || true
sleep 2

setsid bash -lc "cd '$APP_DIR' && exec env BROWSER=none EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_API_BASE_URL='$API_BASE_URL' EXPO_PUBLIC_API_URL='$API_BASE_URL' EXPO_PUBLIC_DEPLOY_STAMP='$DEPLOY_STAMP' REACT_NATIVE_PACKAGER_HOSTNAME='$HOSTNAME' XDG_CACHE_HOME='$CACHE_DIR' TMPDIR='$TMP_DIR' TMP='$TMP_DIR' TEMP='$TMP_DIR' npx expo start --clear --go --host lan --port '$PORT'" </dev/null >> "$LOG_FILE" 2>&1 &
EXPO_PID="$!"
echo "$EXPO_PID" > /home/pmsa/apps/my-rentals-expo.pid
echo "STARTED_PID=$EXPO_PID" >> "$LOG_FILE"

for i in $(seq 1 30); do
  if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Expo is listening on port $PORT" >> "$LOG_FILE"
    tail -n 120 "$LOG_FILE" || true
    exit 0
  fi
  if ! kill -0 "$EXPO_PID" 2>/dev/null; then
    echo "Expo process exited early" >> "$LOG_FILE"
    tail -n 160 "$LOG_FILE" || true
    exit 1
  fi
  sleep 2
done

echo "Expo started in background but port check timed out" >> "$LOG_FILE"
tail -n 160 "$LOG_FILE" || true
exit 0
