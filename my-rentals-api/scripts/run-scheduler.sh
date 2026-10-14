#!/bin/sh
set -eu
task_app_directory=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$task_app_directory"
if [ "$(id -u)" -eq 0 ]; then
    exec /usr/sbin/runuser -u pmsa -- /usr/local/bin/php artisan schedule:run
fi
exec /usr/local/bin/php artisan schedule:run
