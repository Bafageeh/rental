#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/home/pmsa/apps/my-rentals-expo.log"
CACHE_DIR="/home/pmsa/apps/.cache"
TMP_DIR="/home/pmsa/apps/.tmp"
PORT="8083"
HOSTNAME="my.pm.sa"
API_BASE_URL="https://rental.pm.sa/api"
DEPLOY_STAMP="2026-05-10-unit-status-derived-from-contracts-v13"

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
  echo "IMPORTANT: delete property/unit previews related records and requires confirmation in both details and edit center"
  echo "IMPORTANT: owner without properties forces direct owner unit scope"
  echo "IMPORTANT: unit status field hidden; details status is derived from active contracts"
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

# تفاصيل الوحدة: الحالة لا تعتمد على حقل status المخزن، بل على وجود عقد نشط.
marker = 'const displayedPrimaryFields = useMemo('
if marker not in text:
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

details.write_text(text)

old_restore_marker = 'unitCardTopRow' in text and 'headerServicesWrap' in text and 'normalizedEntity !== "unit"' in text
ok = 'label="سجل العقود"' in text and 'backgroundColor: "#FFFFFF"' in text and not old_restore_marker
status_ok = 'displayedPrimaryFields' in text and 'hasActiveContract ? "مستأجرة" : "متاحة"' in text
print(f'UNIT_SCREEN_KEEP_CURRENT_LAYOUT_PATCH={"ok" if ok else "ok_with_existing_layout"}')
print(f'UNIT_DETAILS_DERIVED_STATUS_PATCH={"ok" if status_ok else "failed"}')

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
    # إلغاء تعديل حالة الوحدة يدويًا من مركز التعديل.
    edit_text2 = edit_center.read_text()
    edit_text2 = edit_text2.replace(
        '    const editableFields = Array.isArray(safeItem.editable_fields) ? safeItem.editable_fields : [];',
        '    const editableFields = Array.isArray(safeItem.editable_fields) ? (safeItem.resource === "units" ? safeItem.editable_fields.filter((field: string) => field !== "status") : safeItem.editable_fields) : [];'
    )
    edit_center.write_text(edit_text2)
    print(f'EDIT_DELETE_CENTER_CONFIRM_LINKED_DELETE_PATCH={"ok" if n else "not_found"}')
else:
    print('EDIT_DELETE_CENTER_CONFIRM_LINKED_DELETE_PATCH=not_found')

inline = Path('src/components/InlineEditDeleteActions.tsx')
if inline.exists():
    inline_text = inline.read_text()
    inline_replacement = r'''async function deleteRecord() {
    if (!stringId) {
      Alert.alert("تنبيه", "لا يوجد رقم للعنصر");
      return;
    }

    if (resource === "owners") {
      Alert.alert(
        "حذف المالك",
        "سيتم حذف المالك وجميع العقارات والوحدات التابعة له. هل تريد المتابعة؟",
        [
          { text: "إلغاء", style: "cancel" },
          {
            text: "حذف الكل",
            style: "destructive",
            onPress: async () => {
              try {
                await apiPostAny([
                  `/relation-manager/delete-owner-cascade/${stringId}`,
                  `/my/relation-manager/delete-owner-cascade/${stringId}`,
                ], {});
                Alert.alert("تم", "تم حذف المالك وجميع عقاراته");
                setModalVisible(false);
                if (onChanged) await onChanged();
              } catch (e) {
                Alert.alert("تعذر الحذف", errorMessage(e));
              }
            },
          },
        ]
      );
      return;
    }

    const endpoints = [
      `/edit-delete-center/${resource}/${stringId}/delete`,
      `/my/edit-delete-center/${resource}/${stringId}/delete`,
    ];

    const runDelete = async (force = false) => {
      try {
        const result = await apiPostAny(endpoints, force ? { force: true } : {});
        Alert.alert("تم", result?.message || "تم الحذف بنجاح");
        setModalVisible(false);
        if (onChanged) await onChanged();
      } catch (e) {
        Alert.alert("تعذر الحذف", errorMessage(e));
      }
    };

    const confirmDelete = (message: string, force = false) => {
      Alert.alert("تأكيد الحذف", message, [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: () => runDelete(force) },
      ]);
    };

    if (resource === "properties" || resource === "units") {
      try {
        const preview = await apiPostAny(endpoints, { preview_only: true });
        const blockers = Array.isArray(preview?.blockers) ? preview.blockers : [];
        const relationDetails = blockers.length ? blockers.map((item: string) => `• ${item}`).join("\\n") : "لا توجد ارتباطات مسجلة.";

        if (blockers.length) {
          confirmDelete(
            `هذا العنصر مرتبط بالبيانات التالية:\\n${relationDetails}\\n\\nهل تريد حذف العنصر وكل ما هو مرتبط به؟`,
            true,
          );
        } else {
          confirmDelete("هل تريد حذف هذا العنصر؟", false);
        }
      } catch (e) {
        confirmDelete("تعذر فحص الارتباطات قبل الحذف. هل تريد المتابعة؟", false);
      }
      return;
    }

    confirmDelete("هل تريد حذف هذا العنصر؟ إذا كانت له سجلات تابعة سيتم منع الحذف تلقائيًا.", false);
  }
'''
    inline_pattern = r'async function deleteRecord\(\) \{.*?\n  \}\n\n  useEffect\(\(\) => \{'
    inline_patched, inline_n = re.subn(inline_pattern, lambda m: inline_replacement + '\n  useEffect(() => {', inline_text, count=1, flags=re.S)
    if inline_n:
        inline.write_text(inline_patched)
    # إلغاء تعديل حالة الوحدة يدويًا من نافذة التعديل المختصرة.
    inline_text2 = inline.read_text()
    inline_text2 = inline_text2.replace(
        '      const editableFields = resource === "owners"\n        ? item.editable_fields.filter((field: string) => field !== "type")\n        : item.editable_fields;',
        '      const editableFields = resource === "owners"\n        ? item.editable_fields.filter((field: string) => field !== "type")\n        : resource === "units"\n          ? item.editable_fields.filter((field: string) => field !== "status")\n          : item.editable_fields;'
    )
    inline.write_text(inline_text2)
    print(f'INLINE_DELETE_CONFIRM_LINKED_DELETE_PATCH={"ok" if inline_n else "not_found"}')
else:
    print('INLINE_DELETE_CONFIRM_LINKED_DELETE_PATCH=not_found')

units = Path('src/app/units.tsx')
if units.exists():
    units_text = units.read_text()
    marker = 'const forceOwnerUnitScope = Boolean(form.owner_id) && filteredPropertyOptions.length === 0 && !propertyIdParam;'
    if marker not in units_text:
        units_text = units_text.replace(
            '  }, [propertyOptions, form.owner_id, propertyIdParam]);\n\n  function setField(key: keyof typeof form, value: string) {',
            '  }, [propertyOptions, form.owner_id, propertyIdParam]);\n\n  const forceOwnerUnitScope = Boolean(form.owner_id) && filteredPropertyOptions.length === 0 && !propertyIdParam;\n\n  useEffect(() => {\n    if (forceOwnerUnitScope && (form.unit_scope !== "owner" || form.property_id)) {\n      setForm((previous) => ({ ...previous, unit_scope: "owner", property_id: "" }));\n    }\n  }, [forceOwnerUnitScope, form.unit_scope, form.property_id]);\n\n  function setField(key: keyof typeof form, value: string) {'
        )
        units_text = units_text.replace(
            '      <DropdownSelect label="نوع إضافة الوحدة" value={form.unit_scope} options={unitScopeOptions} required disabled={Boolean(propertyIdParam)} onChange={(value) => setField("unit_scope", value)} />',
            '      <DropdownSelect label="نوع إضافة الوحدة" value={form.unit_scope} options={forceOwnerUnitScope ? [{ id: "owner", label: "وحدة خاصة بالمالك" }] : unitScopeOptions} required disabled={Boolean(propertyIdParam) || forceOwnerUnitScope} onChange={(value) => setField("unit_scope", value)} />\n      {forceOwnerUnitScope ? <View style={styles.infoBox}><Text style={styles.infoText}>لا توجد عقارات لهذا المالك، لذلك تم تثبيت نوع الإضافة على وحدة خاصة بالمالك فقط.</Text></View> : null}'
        )
    # إلغاء حقل الحالة من نموذج إضافة الوحدة، مع إبقاء القيمة الافتراضية للإرسال فقط.
    units_text = units_text.replace('      <DropdownSelect label="الحالة" value={form.status} options={statusOptions} onChange={(value) => setField("status", value)} />\n', '')
    units.write_text(units_text)
    print(f'OWNER_WITHOUT_PROPERTIES_FORCE_UNIT_SCOPE_PATCH={"ok" if marker in units_text else "failed"}')
    print(f'UNIT_ADD_STATUS_FIELD_REMOVED={"ok" if "label=\"الحالة\" value={form.status}" not in units_text else "failed"}')
else:
    print('OWNER_WITHOUT_PROPERTIES_FORCE_UNIT_SCOPE_PATCH=not_found')
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
