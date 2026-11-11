#!/usr/bin/env bash
# Apply a native-only Expo Go runtime config to the persistent rental Metro service.
# Production web exports retain Expo web support (env var is only set on systemd service).
# No dependency reinstalls, no cache deletion, no changes to app.json or customer data.
set -Eeuo pipefail

APP=/mnt/HC_Volume_107348367/psm/pm/rental/source/my-rentals-mobile
REPO=Bafageeh/rental
SERVICE=rental-expo.service
FILE="$APP/app.config.js"
DROP=/etc/systemd/system/rental-expo.service.d/40-native-metro.conf
TEMP="$(mktemp -d)"
APPLIED=no
trap 'rm -rf "$TEMP"' EXIT

test "$(id -u)" -eq 0 || { echo "Administrator rights required" >&2; exit 1; }
systemctl is-active --quiet "$SERVICE" || { echo "Rental Expo must be running before the change" >&2; exit 1; }
test -e "$APP/app.json" && test -d "$APP/node_modules/@expo/config"
test ! -e "$FILE" || { echo "An existing app.config.js must be reviewed manually" >&2; exit 1; }
test ! -e "$DROP" || { echo "Existing native-only override already present" >&2; exit 1; }

BEFORE_PID="$(systemctl show -p MainPID --value "$SERVICE")"
BEFORE_LIMIT="$(systemctl show -p MemoryMax --value "$SERVICE")"
test "$BEFORE_PID" -gt 1
echo "Preflight: PID=$BEFORE_PID, MemoryMax=$BEFORE_LIMIT"

gh api "repos/$REPO/contents/ops/maintenance/rental-native-only-app.config.js" \
    -H Accept:application/vnd.github.raw+json > "$TEMP/app.config.js"
node --check "$TEMP/app.config.js"

rollback() {
    echo "Applying safe rollback of Expo runtime configuration" >&2
    rm -f "$DROP" "$FILE"
    systemctl daemon-reload || true
    systemctl restart "$SERVICE" || true
}
trap 'if [ "$APPLIED" = yes ]; then rollback; fi' ERR

# This local runtime override is intentionally outside committed mobile source.
# The GitHub repo carries its canonical version under ops/maintenance.
install -o root -g root -m 0644 "$TEMP/app.config.js" "$FILE"
APPLIED=yes
cd "$APP"

# Verify both modes before interrupting any running service.
runuser -u psm-rental -- env PSM_RENTAL_NATIVE_METRO=1 \
  node -e 'const p=require("@expo/config").getConfig(process.cwd()).exp.platforms;if(!(p.includes("ios")&&p.includes("android")&&!p.includes("web")))process.exit(1);console.log("NATIVE_ONLY="+p.join(","))'
runuser -u psm-rental -- env -u PSM_RENTAL_NATIVE_METRO \
  node -e 'const p=require("@expo/config").getConfig(process.cwd()).exp.platforms;if(!p.includes("web"))process.exit(1);console.log("WEB_EXPORT_PRESERVED="+p.join(","))'

install -d -o root -g root -m 0755 "$(dirname "$DROP")"
printf '[Service]\nEnvironment=PSM_RENTAL_NATIVE_METRO=1\n' > "$DROP"
chmod 0644 "$DROP"
systemctl daemon-reload

# Do not clear .expo, metro caches, or change package dependencies.
systemctl restart "$SERVICE"
healthy=no
for attempt in $(seq 1 20); do
    if systemctl is-active --quiet "$SERVICE" &&
       curl -fsS --max-time 3 http://127.0.0.1:8090/status | grep -q 'packager-status:running'; then
        healthy=yes
        break
    fi
    sleep 1
done
if [ "$healthy" != yes ]; then
    echo "Expo failed local status probe after change" >&2
    false
fi
test "$(systemctl show -p MemoryMax --value "$SERVICE")" = "$BEFORE_LIMIT" || {
    echo "Unexpected change to Expo memory protection limit" >&2
    false
}
for url in https://psm.pm.sa/privacy https://rental.pm.sa/; do
    curl --fail --silent --show-error --max-time 10 "$url" -o /dev/null
done

APPLIED=no
trap - ERR
echo "SUCCESS: Native Metro remains available and production rental web is healthy."
systemctl show "$SERVICE" -p MainPID -p ActiveState -p MemoryCurrent -p MemoryMax -p NRestarts
