#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/home/pmsa/apps/my-rentals-expo.log"
CACHE_DIR="/home/pmsa/apps/.cache"
TMP_DIR="/home/pmsa/apps/.tmp"
PORT="8083"
HOSTNAME="my.pm.sa"
API_BASE_URL="https://rental.pm.sa/api"
DEPLOY_STAMP="2026-05-10-unit-rent-suggested-label-v14"

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
  echo "IMPORTANT: owner asset summary cards are removed"
  echo "IMPORTANT: delete property/unit previews related records and requires confirmation"
  echo "IMPORTANT: owner without properties forces direct owner unit scope"
  echo "IMPORTANT: unit status hidden and derived from active contracts"
  echo "IMPORTANT: unit rent input says قيمة الإيجار المقترحة"
} >> "$LOG_FILE"

python3 - <<'PY' | tee -a "/home/pmsa/apps/my-rentals-expo.log"
from pathlib import Path
import re

def patch_file(path: str, fn):
    p = Path(path)
    if not p.exists():
        print(f'{path}=not_found')
        return
    before = p.read_text()
    after = fn(before)
    if after != before:
        p.write_text(after)
    print(f'{path}=patched')

# شاشة تفاصيل الوحدة والخدمات وحالة الوحدة المشتقة من العقود.
def patch_details(text: str) -> str:
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
    if 'const displayedPrimaryFields = useMemo(' not in text:
        text = text.replace(
            '  const primaryFields = useMemo(() => (data?.fields || []).filter((field) => isPrimaryField(field.key)), [data]);\n  const otherFields = useMemo(() => (data?.fields || []).filter((field) => !isPrimaryField(field.key)), [data]);',
            '''  const primaryFields = useMemo(() => (data?.fields || []).filter((field) => isPrimaryField(field.key)), [data]);
  const otherFields = useMemo(() => (data?.fields || []).filter((field) => !isPrimaryField(field.key)), [data]);
  const hasActiveContract = useMemo(() => {
    if (normalizedEntity !== "unit") return false;
    return (data?.sections || []).some((section) =>
      String(section.key || "").includes("contract") &&
      (section.items || []).some((item) => {
        const status = String(item.status || item.badge || "").toLowerCase();
        return status.includes("active") || status.includes("نشط");
      }),
    );
  }, [data, normalizedEntity]);
  const derivedUnitStatusField = useMemo(() => ({
    key: "status",
    label: "الحالة",
    value: hasActiveContract ? "مستأجرة" : "متاحة",
    raw_value: hasActiveContract ? "rented" : "available",
  }), [hasActiveContract]);
  const displayedPrimaryFields = useMemo(() => {
    if (normalizedEntity !== "unit") return primaryFields;
    const withoutStatus = primaryFields.filter((field) => field.key !== "status");
    const statusIndex = withoutStatus.findIndex((field) => ["unit_number", "property_id", "owner_id"].includes(field.key));
    if (statusIndex >= 0) {
      const next = [...withoutStatus];
      next.splice(statusIndex + 1, 0, derivedUnitStatusField);
      return next;
    }
    return [derivedUnitStatusField, ...withoutStatus];
  }, [normalizedEntity, primaryFields, derivedUnitStatusField]);
  const displayedOtherFields = useMemo(() => normalizedEntity === "unit" ? otherFields.filter((field) => field.key !== "status") : otherFields, [normalizedEntity, otherFields]);'''
        )
        text = text.replace('count={primaryFields.length}', 'count={displayedPrimaryFields.length}')
        text = text.replace('primaryFields.length ? primaryFields.map((field) => <FieldRow key={field.key} field={field} />)', 'displayedPrimaryFields.length ? displayedPrimaryFields.map((field) => <FieldRow key={field.key} field={field} />)')
        text = text.replace('otherFields.length ? (', 'displayedOtherFields.length ? (')
        text = text.replace('count={otherFields.length}', 'count={displayedOtherFields.length}')
        text = text.replace('{otherFields.map((field) => <FieldRow key={field.key} field={field} />)}', '{displayedOtherFields.map((field) => <FieldRow key={field.key} field={field} />)}')
    return text

patch_file('src/components/EntityDetailsScreen.tsx', patch_details)

# شاشة المالك: إزالة بطاقات عقارات/وحدات/مباشرة.
def patch_owner_dashboard(text: str) -> str:
    text = re.sub(
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
        text,
        flags=re.S,
    )
    text = re.sub(
        r'\n\s*assetSummaryStrip:\s*\{[^\n]+\},\s*'
        r'\n\s*assetSummaryItem:\s*\{[^\n]+\},\s*'
        r'\n\s*assetSummaryValue:\s*\{[^\n]+\},\s*'
        r'\n\s*assetSummaryLabel:\s*\{[^\n]+\},',
        '\n',
        text,
    )
    return text

patch_file('src/components/OwnerDashboardScreenWithActions.tsx', patch_owner_dashboard)

# شاشة الوحدات: تثبيت وحدة خاصة بالمالك، إخفاء الحالة، وتغيير تسمية الإيجار المقترح.
def patch_units(text: str) -> str:
    if 'const forceOwnerUnitScope = Boolean(form.owner_id) && filteredPropertyOptions.length === 0 && !propertyIdParam;' not in text:
        text = text.replace(
            '  }, [propertyOptions, form.owner_id, propertyIdParam]);\n\n  function setField(key: keyof typeof form, value: string) {',
            '  }, [propertyOptions, form.owner_id, propertyIdParam]);\n\n  const forceOwnerUnitScope = Boolean(form.owner_id) && filteredPropertyOptions.length === 0 && !propertyIdParam;\n\n  useEffect(() => {\n    if (forceOwnerUnitScope && (form.unit_scope !== "owner" || form.property_id)) {\n      setForm((previous) => ({ ...previous, unit_scope: "owner", property_id: "" }));\n    }\n  }, [forceOwnerUnitScope, form.unit_scope, form.property_id]);\n\n  function setField(key: keyof typeof form, value: string) {'
        )
        text = text.replace(
            '      <DropdownSelect label="نوع إضافة الوحدة" value={form.unit_scope} options={unitScopeOptions} required disabled={Boolean(propertyIdParam)} onChange={(value) => setField("unit_scope", value)} />',
            '      <DropdownSelect label="نوع إضافة الوحدة" value={form.unit_scope} options={forceOwnerUnitScope ? [{ id: "owner", label: "وحدة خاصة بالمالك" }] : unitScopeOptions} required disabled={Boolean(propertyIdParam) || forceOwnerUnitScope} onChange={(value) => setField("unit_scope", value)} />\n      {forceOwnerUnitScope ? <View style={styles.infoBox}><Text style={styles.infoText}>لا توجد عقارات لهذا المالك، لذلك تم تثبيت نوع الإضافة على وحدة خاصة بالمالك فقط.</Text></View> : null}'
        )
    text = text.replace('      <DropdownSelect label="الحالة" value={form.status} options={statusOptions} onChange={(value) => setField("status", value)} />\n', '')
    text = text.replace('placeholder="قيمة الإيجار"', 'placeholder="قيمة الإيجار المقترحة"')
    text = text.replace('الإيجار / الحالة:', 'الإيجار المقترح / الحالة:')
    return text

patch_file('src/app/units.tsx', patch_units)

# منع تعديل حالة الوحدة يدويًا من محرري التعديل.
def patch_edit_center(text: str) -> str:
    text = text.replace(
        '    const editableFields = Array.isArray(safeItem.editable_fields) ? safeItem.editable_fields : [];',
        '    const editableFields = Array.isArray(safeItem.editable_fields) ? (safeItem.resource === "units" ? safeItem.editable_fields.filter((field: string) => field !== "status") : safeItem.editable_fields) : [];'
    )
    return text

patch_file('src/app/edit-delete-center.tsx', patch_edit_center)

def patch_inline(text: str) -> str:
    text = text.replace(
        '      const editableFields = resource === "owners"\n        ? item.editable_fields.filter((field: string) => field !== "type")\n        : item.editable_fields;',
        '      const editableFields = resource === "owners"\n        ? item.editable_fields.filter((field: string) => field !== "type")\n        : resource === "units"\n          ? item.editable_fields.filter((field: string) => field !== "status")\n          : item.editable_fields;'
    )
    return text

patch_file('src/components/InlineEditDeleteActions.tsx', patch_inline)

# ملف الترجمات العام: قيمة الإيجار المقترحة.
def patch_arabic(text: str) -> str:
    return text.replace('rent_amount: "قيمة الإيجار"', 'rent_amount: "قيمة الإيجار المقترحة"')

patch_file('src/lib/arabicDisplay.ts', patch_arabic)
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
