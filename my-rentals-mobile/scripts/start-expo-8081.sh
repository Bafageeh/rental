#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/home/pmsa/apps/my-rentals-expo.log"
CACHE_DIR="/home/pmsa/apps/.cache"
TMP_DIR="/home/pmsa/apps/.tmp"
PORT="8083"
HOSTNAME="my.pm.sa"
API_BASE_URL="https://rental.pm.sa/api"
DEPLOY_STAMP="2026-05-10-unit-edit-floor-number-and-boolean-cleanup-v15"

choose_app_dir() {
  for candidate in \
    "/home/pmsa/apps/rental/my-rentals-mobile" \
    "/home/pmsa/apps/my-rentals-mobile" \
    "/mnt/home-storage/home/pmsa/apps/rental/my-rentals-mobile" \
    "/mnt/home-storage/home/pmsa/apps/my-rentals-mobile"; do
    if [ -f "$candidate/package.json" ]; then printf '%s\n' "$candidate"; return 0; fi
  done
  echo "Cannot find my-rentals-mobile app directory" >&2; exit 1
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
  echo "IMPORTANT: unit edit floor accepts digits only"
  echo "IMPORTANT: boolean yes/no fields no longer render duplicate numeric input"
} >> "$LOG_FILE"

python3 - <<'PY' | tee -a "/home/pmsa/apps/my-rentals-expo.log"
from pathlib import Path
import re

def patch_file(path, fn):
    p = Path(path)
    if not p.exists():
        print(f'{path}=not_found')
        return
    before = p.read_text()
    after = fn(before)
    if after != before:
        p.write_text(after)
    print(f'{path}=patched')

def add_numeric_helpers(text):
    if 'function numericOnly(value: unknown)' not in text:
        text = text.replace(
            'function valueToString(value: unknown) {',
            'function numericOnly(value: unknown) { return String(value ?? "").replace(/[^0-9]/g, ""); }\n\nfunction valueToString(value: unknown) {'
        )
    return text

def patch_inline(text):
    text = add_numeric_helpers(text)
    text = text.replace(
        '      const editableFields = resource === "owners"\n        ? item.editable_fields.filter((field: string) => field !== "type")\n        : item.editable_fields;',
        '      const editableFields = resource === "owners"\n        ? item.editable_fields.filter((field: string) => field !== "type")\n        : resource === "units"\n          ? item.editable_fields.filter((field: string) => field !== "status")\n          : item.editable_fields;'
    )
    text = text.replace(
        '    const nextValue = field === "national_short_address" ? value.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() : value;',
        '    const nextValue = field === "national_short_address" ? value.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() : field === "floor" ? numericOnly(value) : value;'
    )
    text = text.replace(
        '{!relationField && optionList.length === 0 ? (',
        '{!relationField && !isBoolean && optionList.length === 0 ? ('
    )
    text = text.replace(
        'keyboardType={field === "property_area" ? "decimal-pad" : "default"}',
        'keyboardType={field === "floor" ? "number-pad" : field === "property_area" ? "decimal-pad" : "default"}'
    )
    if 'inputMode={field === "floor" ? "numeric" : undefined}' not in text:
        text = text.replace(
            'keyboardType={field === "floor" ? "number-pad" : field === "property_area" ? "decimal-pad" : "default"}\n            placeholder={fieldLabel(field)}',
            'keyboardType={field === "floor" ? "number-pad" : field === "property_area" ? "decimal-pad" : "default"}\n            inputMode={field === "floor" ? "numeric" : undefined}\n            placeholder={fieldLabel(field)}'
        )
    return text

patch_file('src/components/InlineEditDeleteActions.tsx', patch_inline)

def patch_edit_center(text):
    text = text.replace('rent_amount: "قيمة الإيجار",', 'rent_amount: "قيمة الإيجار المقترحة",')
    text = add_numeric_helpers(text)
    text = text.replace(
        '    const editableFields = Array.isArray(safeItem.editable_fields) ? safeItem.editable_fields : [];',
        '    const editableFields = Array.isArray(safeItem.editable_fields) ? (safeItem.resource === "units" ? safeItem.editable_fields.filter((field: string) => field !== "status") : safeItem.editable_fields) : [];'
    )
    text = text.replace(
        '    const nextValue = field === "national_short_address" ? value.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() : value;',
        '    const nextValue = field === "national_short_address" ? value.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() : field === "floor" ? numericOnly(value) : value;'
    )
    text = text.replace(
        '{!relationKey && !isBoolean && optionList.length === 0 ? (',
        '{!relationKey && !isBoolean && optionList.length === 0 ? ('
    )
    # Older versions had boolean TextInput because !isBoolean was missing; normalize any old condition.
    text = text.replace(
        '{!relationKey && optionList.length === 0 ? (',
        '{!relationKey && !isBoolean && optionList.length === 0 ? ('
    )
    text = text.replace(
        'keyboardType={field === "property_area" ? "decimal-pad" : "default"}',
        'keyboardType={field === "floor" ? "number-pad" : field === "property_area" ? "decimal-pad" : "default"}'
    )
    if 'inputMode={field === "floor" ? "numeric" : undefined}' not in text:
        text = text.replace(
            'keyboardType={field === "floor" ? "number-pad" : field === "property_area" ? "decimal-pad" : "default"}\n            placeholder={labelFor(field, selected?.resource)}',
            'keyboardType={field === "floor" ? "number-pad" : field === "property_area" ? "decimal-pad" : "default"}\n            inputMode={field === "floor" ? "numeric" : undefined}\n            placeholder={labelFor(field, selected?.resource)}'
        )
    return text

patch_file('src/app/edit-delete-center.tsx', patch_edit_center)

def patch_units(text):
    text = text.replace('placeholder="قيمة الإيجار"', 'placeholder="قيمة الإيجار المقترحة"')
    text = text.replace('الإيجار / الحالة:', 'الإيجار المقترح / الحالة:')
    text = text.replace('      <DropdownSelect label="الحالة" value={form.status} options={statusOptions} onChange={(value) => setField("status", value)} />\n', '')
    if 'const forceOwnerUnitScope = Boolean(form.owner_id) && filteredPropertyOptions.length === 0 && !propertyIdParam;' not in text:
        text = text.replace(
            '  }, [propertyOptions, form.owner_id, propertyIdParam]);\n\n  function setField(key: keyof typeof form, value: string) {',
            '  }, [propertyOptions, form.owner_id, propertyIdParam]);\n\n  const forceOwnerUnitScope = Boolean(form.owner_id) && filteredPropertyOptions.length === 0 && !propertyIdParam;\n\n  useEffect(() => {\n    if (forceOwnerUnitScope && (form.unit_scope !== "owner" || form.property_id)) {\n      setForm((previous) => ({ ...previous, unit_scope: "owner", property_id: "" }));\n    }\n  }, [forceOwnerUnitScope, form.unit_scope, form.property_id]);\n\n  function setField(key: keyof typeof form, value: string) {'
        )
    text = text.replace(
        '<DropdownSelect label="نوع إضافة الوحدة" value={form.unit_scope} options={unitScopeOptions} required disabled={Boolean(propertyIdParam)} onChange={(value) => setField("unit_scope", value)} />',
        '<DropdownSelect label="نوع إضافة الوحدة" value={form.unit_scope} options={forceOwnerUnitScope ? [{ id: "owner", label: "وحدة خاصة بالمالك" }] : unitScopeOptions} required disabled={Boolean(propertyIdParam) || forceOwnerUnitScope} onChange={(value) => setField("unit_scope", value)} />\n      {forceOwnerUnitScope ? <View style={styles.infoBox}><Text style={styles.infoText}>لا توجد عقارات لهذا المالك، لذلك تم تثبيت نوع الإضافة على وحدة خاصة بالمالك فقط.</Text></View> : null}'
    )
    return text

patch_file('src/app/units.tsx', patch_units)

def patch_arabic(text):
    return text.replace('rent_amount: "قيمة الإيجار"', 'rent_amount: "قيمة الإيجار المقترحة"')

patch_file('src/lib/arabicDisplay.ts', patch_arabic)
PY

rm -rf .expo .expo-shared .metro-cache node_modules/.cache || true
rm -rf "$CACHE_DIR"/expo "$CACHE_DIR"/metro "$CACHE_DIR"/react-native "$CACHE_DIR"/metro-* "$CACHE_DIR"/haste-map-* || true

if command -v lsof >/dev/null 2>&1; then
  old_pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  [ -n "$old_pids" ] && echo "$old_pids" | xargs -r kill -9 2>/dev/null || true
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
