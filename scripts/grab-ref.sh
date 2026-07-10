#!/usr/bin/env bash
# Grab a short reference clip and explode it into frames + a contact sheet
# so Claude can analyze the animation pattern frame by frame.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/grab-ref.sh <name> <url-or-file> <start> <duration> [crop] [fps]

  name         output folder: reference/<name>/
  url-or-file  YouTube (or other) URL, or path to a local video file
  start        where the clip begins: seconds or [HH:]MM:SS(.ms), e.g. 83, 1:23, 1:23.5
  duration     clip length in seconds, e.g. 2 or 2.5 (keep it 1-3)
  crop         optional W:H:X:Y in source pixels, or "none" (default)
  fps          optional frames per second to extract (default 12; 24 for fast flicker)

Re-runs reuse reference/<name>/clip.mp4, so iterate on crop/fps freely
without re-downloading. Delete clip.mp4 to change start/duration.
EOF
  exit 1
}

[ $# -ge 4 ] || usage

NAME=$1 SRC=$2 START=$3 DUR=$4
CROP=${5:-none}
FPS=${6:-12}

DIR="reference/$NAME"
CLIP="$DIR/clip.mp4"
mkdir -p "$DIR"

# normalize start to seconds (accepts SS, MM:SS, HH:MM:SS, fractions ok)
START_S=$(awk -v t="$START" 'BEGIN {
  n = split(t, p, ":"); s = 0
  for (i = 1; i <= n; i++) s = s * 60 + p[i]
  printf "%.3f", s
}')
END_S=$(awk -v s="$START_S" -v d="$DUR" 'BEGIN { printf "%.3f", s + d }')

if [[ $START == *.* && $START != *:* ]]; then
  echo "note: start '$START' means ${START_S} seconds into the video — for minutes use M:SS (e.g. 1:11)"
fi

if [ -f "$CLIP" ]; then
  echo "reusing $CLIP (delete it to re-download / re-cut)"
elif [[ $SRC == http* ]]; then
  command -v yt-dlp >/dev/null || { echo "yt-dlp not found — brew install yt-dlp" >&2; exit 1; }
  yt-dlp --download-sections "*${START_S}-${END_S}" --force-keyframes-at-cuts \
    -S "res:1080,hdr:SDR" --remux-video mp4 -o "$DIR/clip.%(ext)s" "$SRC"
  [ -f "$CLIP" ] || { echo "expected $CLIP after download, got: $(ls "$DIR")" >&2; exit 1; }
else
  ffmpeg -hide_banner -loglevel error -y -ss "$START_S" -t "$DUR" -i "$SRC" \
    -c:v libx264 -crf 18 -an "$CLIP"
fi

VF="fps=$FPS"
[ "$CROP" != "none" ] && VF="$VF,crop=$CROP"

# frames at native (post-crop) resolution — no scaling, so pixel coordinates
# read off a frame are valid crop values for the next run
FRAMES="$DIR/frames"
rm -rf "$FRAMES"
mkdir -p "$FRAMES"
ffmpeg -hide_banner -loglevel error -i "$CLIP" -vf "$VF" "$FRAMES/f%03d.png"

N=$(ls "$FRAMES" | wc -l | tr -d ' ')
[ "$N" -gt 0 ] || { echo "no frames extracted — check start/duration" >&2; exit 1; }

COLS=6
ROWS=$(( (N + COLS - 1) / COLS ))
ffmpeg -hide_banner -loglevel error -y -i "$CLIP" \
  -vf "$VF,scale=240:-1,tile=${COLS}x${ROWS}" "$DIR/sheet.png"

FRAME_MS=$(awk -v f="$FPS" 'BEGIN { printf "%.0f", 1000 / f }')
cat <<EOF

done: $DIR/
  clip.mp4   ${DUR}s starting at ${START} (${START_S}s into the video)
  frames/    $N frames at ${FPS} fps — fNNN is at (NNN-1)/${FPS}s, one frame every ~${FRAME_MS}ms
  sheet.png  contact sheet ${COLS}x${ROWS}, reading order = time order
EOF
