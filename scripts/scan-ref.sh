#!/usr/bin/env bash
# Survey an entire video: sample one frame every N seconds and tile the
# result into timestamped contact sheets Claude can skim to spot the
# moments worth a detail grab with scripts/grab-ref.sh.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/scan-ref.sh <name> <url-or-file> [interval]

  name         output folder: reference/<name>/
  url-or-file  YouTube (or other) URL, or path to a local video file
  interval     seconds between sampled frames (default 2; raise for long videos)

Produces reference/<name>/scan/sheet_*.png — 4x6 grids of timestamped
thumbnails, reading order = time order. URLs are downloaded in full to
reference/<name>/full.mp4, so follow-up grab-ref.sh calls can point at
that file instead of re-downloading.
EOF
  exit 1
}

[ $# -ge 2 ] || usage

NAME=$1 SRC=$2
INTERVAL=${3:-2}

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR="$REPO_ROOT/reference/$NAME"
mkdir -p "$DIR"

if [[ $SRC == http* ]]; then
  VID="$DIR/full.mp4"
  if [ -f "$VID" ]; then
    echo "reusing $VID (delete it to re-download)"
  else
    command -v yt-dlp >/dev/null || { echo "yt-dlp not found — brew install yt-dlp" >&2; exit 1; }
    yt-dlp -S "res:1080,hdr:SDR" --remux-video mp4 -o "$DIR/full.%(ext)s" "$SRC"
    [ -f "$VID" ] || { echo "expected $VID after download, got: $(ls "$DIR")" >&2; exit 1; }
  fi
else
  VID="$SRC"
fi

FONT="$REPO_ROOT/src/assets/fonts/VT323-Regular.ttf"
[ -f "$FONT" ] || FONT="/System/Library/Fonts/Monaco.ttf"

# timestamp overlay needs drawtext, which slim ffmpeg builds omit —
# fall back to brew's unlinked ffmpeg-full, then to unlabeled tiles
FFMPEG=ffmpeg
DRAW=",drawtext=fontfile=$FONT:text='%{pts\:hms}':x=6:y=4:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55"
if ! "$FFMPEG" -hide_banner -filters 2>/dev/null | grep -q drawtext; then
  if [ -x /opt/homebrew/opt/ffmpeg-full/bin/ffmpeg ]; then
    FFMPEG=/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg
  else
    echo "warning: ffmpeg lacks drawtext — sheets will have no timestamps" >&2
    DRAW=""
  fi
fi

SCAN="$DIR/scan"
rm -rf "$SCAN"
mkdir -p "$SCAN"

"$FFMPEG" -hide_banner -loglevel error -i "$VID" \
  -vf "fps=1/$INTERVAL,scale=320:-1${DRAW},tile=4x6" "$SCAN/sheet_%03d.png"

N=$(ls "$SCAN" | wc -l | tr -d ' ')
[ "$N" -gt 0 ] || { echo "no sheets produced — check the input video" >&2; exit 1; }

cat <<EOF

done: $DIR/scan/
  $N sheet(s), one thumbnail every ${INTERVAL}s, 24 per sheet (~$(( INTERVAL * 24 ))s each)
  each tile carries its own timestamp — use those as start times for grab-ref.sh
EOF
