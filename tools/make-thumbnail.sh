#!/usr/bin/env bash
# 썸네일 GIF 만들기 (1280×720, 25fps, 끊김 없이 반복)
# 필요: node + playwright, ffmpeg, 저장소 루트에서 정적 서버 (python3 -m http.server 8765)
# 사용: bash tools/make-thumbnail.sh [출력 경로]
set -euo pipefail
OUT="${1:-assets/thumbnail.gif}"
WORK="$(mktemp -d)"
node tools/thumbnail-frames.cjs "$WORK/frames" 25
ffmpeg -v error -y -framerate 25 -pattern_type glob -i "$WORK/frames/f*.png" -vf "palettegen=max_colors=256:stats_mode=full" "$WORK/pal.png"
ffmpeg -v error -y -framerate 25 -pattern_type glob -i "$WORK/frames/f*.png" -i "$WORK/pal.png" \
  -lavfi "paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" -loop 0 "$OUT"
echo "saved $OUT"
