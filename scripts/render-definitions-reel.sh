#!/usr/bin/env bash
# One-off: build a 9:16 reel (1080x1920) from the definitions-carousel slides.
# Slides (1080x1350) are centered on the brand background with crossfades.
# Requires ffmpeg (run via: pixi exec ffmpeg -> use `pixi exec bash scripts/render-definitions-reel.sh`
# or plain bash if ffmpeg is on PATH).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/public/posts/20260715-3-words-in-health-headlines"
OUT="$DIR/reel.mp4"
FADE=0.6

# Render native 9:16 frames (1080x1920) so the reel has no letterbox bands;
# the renderer stretches inter-block gaps to fill the taller canvas.
FRAMES="$(mktemp -d)"
trap 'rm -rf "$FRAMES"' EXIT
(cd "$ROOT" && SLIDE_H=1920 npx tsx scripts/render-definitions-carousel.ts "$FRAMES")

# Per-slide seconds, sized for an average reader (~200 wpm = 3.33 words/s):
#   duration = content_words / 3.33 + 1.5s orientation (+1.5s if the slide
#   asks the viewer to parse numbers, i.e. the risk slide).
# Content words = title + plain meaning + question + example (brand header,
# kicker, and footer are skimmed, not read).
#   cover 35w -> 12, linked 48w -> 16, risk 49w + stats -> 18,
#   causes 41w -> 14, closing 30w -> 11. Total ~71s (reel cap 90s).
D1=12; D2=16; D3=18; D4=14; D5=11
# xfade offsets: cumulative shown time minus one fade per transition.
O1=$(echo "$D1 - $FADE" | bc)
O2=$(echo "$O1 + $D2 - $FADE" | bc)
O3=$(echo "$O2 + $D3 - $FADE" | bc)
O4=$(echo "$O3 + $D4 - $FADE" | bc)

ffmpeg -y \
  -loop 1 -t "$D1" -i "$FRAMES/slide-1-cover.png" \
  -loop 1 -t "$D2" -i "$FRAMES/slide-2-linked.png" \
  -loop 1 -t "$D3" -i "$FRAMES/slide-3-risk.png" \
  -loop 1 -t "$D4" -i "$FRAMES/slide-4-causes.png" \
  -loop 1 -t "$D5" -i "$FRAMES/slide-5-closing.png" \
  -filter_complex "\
[0]setsar=1,fps=30[v0];\
[1]setsar=1,fps=30[v1];\
[2]setsar=1,fps=30[v2];\
[3]setsar=1,fps=30[v3];\
[4]setsar=1,fps=30[v4];\
[v0][v1]xfade=transition=fade:duration=$FADE:offset=$O1[x1];\
[x1][v2]xfade=transition=fade:duration=$FADE:offset=$O2[x2];\
[x2][v3]xfade=transition=fade:duration=$FADE:offset=$O3[x3];\
[x3][v4]xfade=transition=fade:duration=$FADE:offset=$O4[v]" \
  -map "[v]" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 \
  -movflags +faststart "$OUT"

echo "Wrote $OUT"
