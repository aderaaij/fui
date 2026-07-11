#!/usr/bin/env bash
# Grab a window of a video's audio, map it (waveform + spectrogram + a
# silencedetect event table), and cut every detected sound event into a
# padded, faded, peak-normalized asset ready to ship inside an exhibit.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/grab-audio.sh <name> <url-or-file> <start> <duration> [noise] [gap] [denoise]

  name         output folder: reference/<name>/audio/
  url-or-file  YouTube (or other) URL, or path to a local video/audio file
               (reference/<name>/full.mp4 from scan-ref.sh works; clip.mp4
               from grab-ref.sh only if it came from a URL — local cuts
               are made with -an)
  start        where the window begins: seconds or [HH:]MM:SS(.ms)
  duration     window length in seconds
  noise        silencedetect threshold in dBFS (default -35). Raise toward
               -25 when room tone or music sits under the effects, lower
               toward -45 for very quiet sources.
  gap          minimum silence that splits two events, seconds (default 0.08;
               lower it to separate fast key clicks, raise it to keep a
               beep sequence together)
  denoise      noise-reduction dB (default 0 = off; try 20-40). Samples the
               hum/hiss bed from the longest gap between events and
               spectrally subtracts it from every exported event. Needs a
               bed-only gap of at least 0.15s, so tune noise/gap until the
               event list looks right, then add this.

Re-runs reuse reference/<name>/audio/clip.wav, so iterate on noise/gap
freely without re-downloading. Delete clip.wav to change start/duration.

Outputs (all under reference/<name>/audio/):
  clip.wav    the whole window, mono 48kHz (clip-dn.wav when denoising)
  map.png     waveform over spectrogram, shared time axis, gridline = 1s
  events.tsv  event times in the clip AND in the source video
  events/     eNN.wav (master) + eNN.m4a (web) per event, peaks at -1dBFS
EOF
  exit 1
}

[ $# -ge 4 ] || usage

NAME=$1 SRC=$2 START=$3 DUR=$4
NOISE=${5:--35}
GAP=${6:-0.08}
DENOISE=${7:-0}

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR="$REPO_ROOT/reference/$NAME/audio"
CLIP="$DIR/clip.wav"
mkdir -p "$DIR"

# normalize start to seconds (accepts SS, MM:SS, HH:MM:SS, fractions ok)
START_S=$(awk -v t="$START" 'BEGIN {
  n = split(t, p, ":"); s = 0
  for (i = 1; i <= n; i++) s = s * 60 + p[i]
  printf "%.3f", s
}')

if [[ $START == *.* && $START != *:* ]]; then
  echo "note: start '$START' means ${START_S} seconds into the video — for minutes use M:SS (e.g. 1:11)"
fi

if [ -f "$CLIP" ]; then
  echo "reusing $CLIP (delete it to re-download / re-cut)"
elif [[ $SRC == http* ]]; then
  command -v yt-dlp >/dev/null || { echo "yt-dlp not found — brew install yt-dlp" >&2; exit 1; }
  # download a padded section, then cut precisely — section downloads on
  # compressed audio land on packet boundaries, not exact times
  DL_START=$(awk -v s="$START_S" 'BEGIN { s -= 2; if (s < 0) s = 0; printf "%.3f", s }')
  DL_END=$(awk -v s="$START_S" -v d="$DUR" 'BEGIN { printf "%.3f", s + d + 2 }')
  OFFSET=$(awk -v s="$START_S" -v a="$DL_START" 'BEGIN { printf "%.3f", s - a }')
  rm -f "$DIR"/dl.*
  yt-dlp --download-sections "*${DL_START}-${DL_END}" -f bestaudio -o "$DIR/dl.%(ext)s" "$SRC"
  DL=$(ls "$DIR"/dl.* 2>/dev/null | head -1 || true)
  [ -n "$DL" ] || { echo "expected $DIR/dl.* after download, got: $(ls "$DIR")" >&2; exit 1; }
  ffmpeg -hide_banner -loglevel error -y -ss "$OFFSET" -t "$DUR" -i "$DL" \
    -ac 1 -ar 48000 -vn "$CLIP"
  rm -f "$DIR"/dl.*
else
  ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 "$SRC" 2>/dev/null | grep -q . ||
    { echo "no audio stream in $SRC — grab-ref.sh strips audio from local-file cuts; point at the original source or a URL download" >&2; exit 1; }
  ffmpeg -hide_banner -loglevel error -y -ss "$START_S" -t "$DUR" -i "$SRC" \
    -ac 1 -ar 48000 -vn "$CLIP"
fi

DUR_S=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$CLIP")

# waveform + spectrogram on one time axis; grid ticks every second so
# pixel x / PXS read off the image is a valid event time. Display-only
# gain brings quiet film mixes up to readable amplitude.
PXS=$(awk -v d="$DUR_S" 'BEGIN { p = int(4000 / d); if (p > 100) p = 100; if (p < 2) p = 2; print p }')
W=$(awk -v d="$DUR_S" -v p="$PXS" 'BEGIN { print int(d * p) }')
CLIPMAX=$(ffmpeg -hide_banner -nostats -nostdin -i "$CLIP" \
  -af volumedetect -f null - 2>&1 | awk '/max_volume/ { print $(NF-1) }')
MAPGAIN=$(awk -v m="${CLIPMAX:-0}" 'BEGIN { g = -1.0 - m; if (g < 0) g = 0; if (g > 30) g = 30; printf "%.1f", g }')
ffmpeg -hide_banner -loglevel error -y -i "$CLIP" -filter_complex \
  "[0:a]volume=${MAPGAIN}dB,asplit[a][b];
   [a]showwavespic=s=${W}x260:colors=0x33ff88:scale=sqrt:draw=full[w];
   [b]showspectrumpic=s=${W}x260:legend=0:fscale=log[s];
   [w][s]vstack,drawgrid=w=${PXS}:h=520:t=1:c=0x33ff88@0.25,format=rgb24" "$DIR/map.png"

# sound events = the gaps between silences
DETECT=$(ffmpeg -hide_banner -nostats -nostdin -i "$CLIP" \
  -af "silencedetect=noise=${NOISE}dB:d=${GAP}" -f null - 2>&1 |
  grep -E "silence_(start|end)" || true)
EVENTS=$(printf '%s\n' "$DETECT" | awk -v dur="$DUR_S" '
  BEGIN { pos = 0 }
  /silence_start/ { s = $NF + 0; if (s - pos >= 0.01) print pos, s; insil = 1 }
  /silence_end/   { for (i = 1; i <= NF; i++) if ($i == "silence_end:") pos = $(i+1) + 0; insil = 0 }
  END { if (!insil && dur - pos >= 0.01) print pos, dur }
')

# denoise: learn the bed's spectrum from the longest event-free gap, then
# subtract it from the whole clip. afftdn's floor (nf) must sit AT the
# measured bed level — the sampled profile alone does nothing against a
# bed far above the default -50dB floor.
CUTSRC="$CLIP"
rm -f "$DIR/clip-dn.wav"
if [ "$DENOISE" != "0" ]; then
  read -r GS GL <<<"$(printf '%s\n' "$EVENTS" | awk -v dur="$DUR_S" '
    BEGIN { pos = 0; best = 0; bs = 0 }
    NF == 2 { if ($1 - pos > best) { best = $1 - pos; bs = pos }; pos = $2 }
    END {
      if (dur - pos > best) { best = dur - pos; bs = pos }
      if (best > 1) best = 1
      printf "%.3f %.3f", bs, best
    }')"
  if awk -v l="$GL" 'BEGIN { exit !(l < 0.15) }'; then
    echo "warning: longest bed-only gap is ${GL}s (<0.15s) — denoise skipped, events stay raw" >&2
  else
    BEDMEAN=$(ffmpeg -hide_banner -nostats -nostdin -ss "$GS" -t "$GL" -i "$CLIP" \
      -af volumedetect -f null - 2>&1 | awk '/mean_volume/ { print $(NF-1) }')
    NFLOOR=$(awk -v m="${BEDMEAN:--50}" 'BEGIN { f = m + 4; if (f > -20) f = -20; if (f < -80) f = -80; printf "%.1f", f }')
    GE=$(awk -v s="$GS" -v l="$GL" 'BEGIN { printf "%.3f", s + l }')
    SNSTOP=$(awk -v l="$GL" 'BEGIN { printf "%.3f", l - 0.05 }')
    ffmpeg -hide_banner -loglevel error -nostdin -y -i "$CLIP" -filter_complex \
      "[0:a]atrim=${GS}:${GE},asetpts=PTS-STARTPTS[n];
       [0:a]asetpts=PTS-STARTPTS[f];
       [n][f]concat=n=2:v=0:a=1,
       asendcmd=c='0.0 afftdn@dn sample_noise start; ${SNSTOP} afftdn@dn sample_noise stop',
       afftdn@dn=nr=${DENOISE}:nf=${NFLOOR},
       atrim=${GL},asetpts=PTS-STARTPTS" "$DIR/clip-dn.wav"
    CUTSRC="$DIR/clip-dn.wav"
    echo "denoise: sampled bed at ${GS}s-${GE}s (mean ${BEDMEAN}dB), nf=${NFLOOR} nr=${DENOISE}"
  fi
fi

EV="$DIR/events"
rm -rf "$EV"
mkdir -p "$EV"
printf 'event\tclip_start\tclip_end\tdur\tsource_time\tgain_db\n' > "$DIR/events.tsv"

N=0
while read -r ES EE; do
  [ -n "$ES" ] || continue
  N=$((N + 1))
  ID=$(printf 'e%02d' "$N")
  # pad 30ms each side (clamped to the clip) so transients keep their attack
  read -r CS CL EDUR <<<"$(awk -v s="$ES" -v e="$EE" -v dur="$DUR_S" 'BEGIN {
    cs = s - 0.03; if (cs < 0) cs = 0
    ce = e + 0.03; if (ce > dur) ce = dur
    printf "%.3f %.3f %.3f", cs, ce - cs, e - s
  }')"
  MAXVOL=$(ffmpeg -hide_banner -nostats -nostdin -ss "$CS" -t "$CL" -i "$CUTSRC" \
    -af volumedetect -f null - 2>&1 | awk '/max_volume/ { print $(NF-1) }')
  GAIN=$(awk -v m="${MAXVOL:-0}" 'BEGIN { g = -1.0 - m; if (g > 30) g = 30; printf "%.1f", g }')
  FADE_OUT=$(awk -v l="$CL" 'BEGIN { printf "%.3f", l - 0.006 }')
  ffmpeg -hide_banner -loglevel error -nostdin -y -ss "$CS" -t "$CL" -i "$CUTSRC" \
    -af "volume=${GAIN}dB,afade=t=in:d=0.006,afade=t=out:st=${FADE_OUT}:d=0.006" "$EV/$ID.wav"
  ffmpeg -hide_banner -loglevel error -nostdin -y -i "$EV/$ID.wav" -c:a aac -b:a 160k "$EV/$ID.m4a"
  SRC_T=$(awk -v b="$START_S" -v s="$ES" 'BEGIN {
    t = b + s; h = int(t / 3600); m = int((t - h * 3600) / 60)
    printf "%d:%02d:%06.3f", h, m, t - h * 3600 - m * 60
  }')
  printf '%s\t%.3f\t%.3f\t%.3f\t%s\t%+.1f\n' "$ID" "$ES" "$EE" "$EDUR" "$SRC_T" "$GAIN" >> "$DIR/events.tsv"
done <<< "$EVENTS"

cat <<EOF

done: $DIR/
  clip.wav    ${DUR}s starting at ${START} (${START_S}s into the source)
  map.png     waveform + spectrogram, ${PXS}px = 1s
  events.tsv  $N event(s) at noise=${NOISE}dB gap=${GAP}s
  events/     eNN.wav (master) + eNN.m4a (web) per event, peaks at -1dBFS
EOF

if [ "$N" -eq 0 ]; then
  echo "no events — the window never rose above ${NOISE}dB, or never fell below it long enough; check map.png, then retune noise/gap"
elif [ "$N" -eq 1 ]; then
  echo "one event spanning most of the window usually means the bed noise sits above the threshold — try noise=-25 or higher"
else
  echo
  column -t -s $'\t' "$DIR/events.tsv"
fi
