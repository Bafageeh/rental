#!/bin/sh
set -eu
PSM_RENTAL_ROOT=/mnt/HC_Volume_107348367/psm/pm/rental
cd "$PSM_RENTAL_ROOT/source/my-rentals-mobile"
export HOME="$PSM_RENTAL_ROOT/home"
export XDG_CACHE_HOME="$PSM_RENTAL_ROOT/cache"
export TMPDIR="$PSM_RENTAL_ROOT/tmp"
npx expo export --platform web --output-dir "$PSM_RENTAL_ROOT/web"
