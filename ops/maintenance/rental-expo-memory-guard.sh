#!/usr/bin/env bash
# Protect the Expo Go/Metro development server from exhausting RAM on the PSM host.
# Does NOT touch the application checkout, wipe caches, or restart any service.
set -euo pipefail

SERVICE=rental-expo.service
LIMIT_BYTES=1610612736  # 1536 MiB, per-service cgroup memory limit.
MIN_HEADROOM_BYTES=209715200 # Do not impose a limit close to current usage.
test "$(id -u)" -eq 0 || { echo "Root administrator is required" >&2; exit 1; }
systemctl is-active --quiet "$SERVICE" || { echo "Expo is not running" >&2; exit 1; }

pid_before="$(systemctl show --value -p MainPID "$SERVICE")"
mem_before="$(systemctl show --value -p MemoryCurrent "$SERVICE")"
limit_before="$(systemctl show --value -p MemoryMax "$SERVICE")"
test "$pid_before" -gt 1
[[ "$mem_before" =~ ^[0-9]+$ ]]
if ((mem_before + MIN_HEADROOM_BYTES >= LIMIT_BYTES)); then
  echo "Refusing to lower limit while Expo is near cap: memory=$mem_before limit=$LIMIT_BYTES" >&2
  exit 1
fi

systemctl set-property "$SERVICE" MemoryMax=1536M

limit_after="$(systemctl show --value -p MemoryMax "$SERVICE")"
if [[ "$limit_after" != "$LIMIT_BYTES" ]]; then
  echo "Unexpected systemd resource limit: $limit_after" >&2
  systemctl set-property "$SERVICE" "MemoryMax=$limit_before" || true
  exit 1
fi

# AlmaLinux 8 uses a cgroups v1 memory controller. Verify the kernel has the limit.
cg=/sys/fs/cgroup/memory/system.slice/rental-expo.service/memory.limit_in_bytes
if [[ -r "$cg" ]]; then
  kernel_limit="$(cat "$cg")"
  if [[ "$kernel_limit" != "$LIMIT_BYTES" ]]; then
    echo "Kernel memory limit mismatch: $kernel_limit" >&2
    systemctl set-property "$SERVICE" "MemoryMax=$limit_before" || true
    exit 1
  fi
fi

sleep 2
pid_after="$(systemctl show --value -p MainPID "$SERVICE")"
if [[ "$pid_after" != "$pid_before" ]] || ! systemctl is-active --quiet "$SERVICE"; then
  echo "Expo restarted or failed during limit application. Reverting memory cap." >&2
  systemctl set-property "$SERVICE" "MemoryMax=$limit_before" || true
  exit 1
fi
echo "PSM rental Expo memory guard applied without restart."
echo "MainPID=$pid_after MemoryMax=$limit_after MemoryCurrent=$(systemctl show --value -p MemoryCurrent "$SERVICE")"
echo "Other PSM, mail and database services were not changed."
