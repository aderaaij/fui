#!/usr/bin/env bash
# Builds saver/build/MUTHUR.saver — the MU/TH/UR attract loop as a macOS
# screensaver: the saver-mode web build (one self-contained HTML, see
# scripts/inline-saver.mjs) hosted by a WKWebView ScreenSaverView,
# universal arm64+x86_64, ad-hoc signed.
#
# Usage: saver/build.sh [--install]
#   --install  also copy the result into ~/Library/Screen Savers
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm vite build --mode saver
node scripts/inline-saver.mjs

OUT=saver/build
APP="$OUT/MUTHUR.saver"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

for ARCH in arm64 x86_64; do
  swiftc -O -module-name MuthurSaver \
    -target "$ARCH-apple-macos12.0" \
    -emit-library -o "$OUT/MUTHUR-$ARCH" \
    -framework ScreenSaver -framework WebKit \
    saver/MuthurSaverView.swift
done
lipo -create "$OUT/MUTHUR-arm64" "$OUT/MUTHUR-x86_64" \
  -output "$APP/Contents/MacOS/MUTHUR"
rm "$OUT/MUTHUR-arm64" "$OUT/MUTHUR-x86_64"

cp saver/Info.plist "$APP/Contents/Info.plist"
cp dist-saver/screensaver.html "$APP/Contents/Resources/"

# Ad-hoc signature: installs and runs locally; recipients of a shared copy
# must approve it once (right-click → Open / Privacy & Security), unless a
# Developer ID signs and notarizes it instead.
codesign --force --deep --sign - "$APP"
echo "built: $APP"

if [[ "${1:-}" == "--install" ]]; then
  DEST="$HOME/Library/Screen Savers"
  mkdir -p "$DEST"
  rm -rf "$DEST/MUTHUR.saver"
  cp -R "$APP" "$DEST/"
  echo "installed: $DEST/MUTHUR.saver — pick it in System Settings → Screen Saver"
fi
