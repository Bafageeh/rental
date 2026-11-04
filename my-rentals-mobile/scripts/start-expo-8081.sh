#!/bin/sh
set -eu
if [ "$(id -u)" -eq 0 ]; then
    exec /usr/local/sbin/psm-rental-control restart-expo
fi
exec sudo -n /usr/local/sbin/psm-rental-control restart-expo
