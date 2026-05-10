#!/bin/bash

cd /home/pmsa/apps/my-rentals-mobile || exit 1

pkill -f "expo start" 2>/dev/null
pkill -f "metro" 2>/dev/null
pkill -f "node.*expo" 2>/dev/null
pkill -f "node.*metro" 2>/dev/null

mkdir -p /home/pmsa/apps/.cache /home/pmsa/apps/.tmp

BROWSER=none \
EXPO_NO_TELEMETRY=1 \
REACT_NATIVE_PACKAGER_HOSTNAME=my.pm.sa \
XDG_CACHE_HOME=/home/pmsa/apps/.cache \
TMPDIR=/home/pmsa/apps/.tmp \
TMP=/home/pmsa/apps/.tmp \
TEMP=/home/pmsa/apps/.tmp \
npx expo start --clear --go --host lan --port 8081
