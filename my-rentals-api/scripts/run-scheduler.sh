#!/bin/sh
set -eu
if [ "$(id -u)" -ne 0 ]; then
    echo 'The scheduler is managed by psm-rental-scheduler.timer.'
    exit 0
fi
exec /usr/local/sbin/psm-rental-php artisan schedule:run
