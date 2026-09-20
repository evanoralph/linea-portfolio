#!/usr/bin/env bash
# Regenerate the scroll-film frames from a video.
# Usage:  ./scripts/extract-frames.sh path/to/video.mp4
# Needs ffmpeg built with libwebp (the standard builds from ffmpeg.org / Homebrew include it).
set -euo pipefail
VIDEO="${1:-assets/video/source.mp4}"
OUT="assets/frames"
WIDTH=1152      # frame width in px; 1152 balances sharpness against download size
QUALITY=46      # WebP quality 0-100; raise for sharper frames, lower for smaller files

rm -f "$OUT"/f*.webp
ffmpeg -v error -i "$VIDEO" -vf "fps=24,scale=${WIDTH}:-2" \
  -c:v libwebp -quality "$QUALITY" -compression_level 6 "$OUT/f%03d.webp"

COUNT=$(ls "$OUT"/f*.webp | wc -l | tr -d ' ')
echo "Wrote $COUNT frames to $OUT"
echo "If this is not 240, set FRAME_COUNT = $COUNT at the top of js/main.js and adjust KEYS/CUTS."
