#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/pmsa/apps/my-rentals-mobile"
WEB_ROOT="/home/pmsa/public_html/rental"
CACHE_DIR="/home/pmsa/apps/.cache"
TMP_DIR="/home/pmsa/apps/.tmp"

echo "==> Preparing folders"
mkdir -p "$WEB_ROOT" "$CACHE_DIR" "$TMP_DIR"
cd "$APP_DIR"

echo "==> Cleaning old Expo web build"
rm -rf .expo dist node_modules/.cache

echo "==> Building Expo web for rental.pm.sa"
EXPO_NO_TELEMETRY=1 \
XDG_CACHE_HOME="$CACHE_DIR" \
TMPDIR="$TMP_DIR" TMP="$TMP_DIR" TEMP="$TMP_DIR" \
npx expo export --platform web

echo "==> Publishing dist to $WEB_ROOT"
rsync -a --delete dist/ "$WEB_ROOT"/

cat > "$WEB_ROOT/.htaccess" <<'HTACCESS'
Options -Indexes
DirectoryIndex index.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Keep existing files and folders served normally
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Expo Router / React fallback for direct links and refresh
  RewriteRule . /index.html [L]
</IfModule>

<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "SAMEORIGIN"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
HTACCESS

echo "==> Fixing ownership"
chown -R pmsa:pmsa "$WEB_ROOT" "$CACHE_DIR" "$TMP_DIR" .expo dist 2>/dev/null || true

echo "==> Done: https://rental.pm.sa"
