#!/usr/bin/env bash
# greenlight.sh — "is the code I just pushed ACTUALLY serving on prod yet?"
#
# The problem this solves: "Vercel says Ready" and "git push succeeded" do NOT mean the
# live alias is serving your new code — the build can still be promoting, and a fresh
# (even incognito) walk can land on the PREVIOUS build. This reads the REAL live bundle
# and only says GREEN when today's new-code tells are present. Run it before any walk.
#
# Usage:  bash scripts/greenlight.sh [url]
#   default url: https://g4l-ten.vercel.app
#
# Each TELL is a string that only exists in the new code. Add a new tell here whenever you
# ship a member-facing change you want to gate a walk on — that's how this stays honest.

set -euo pipefail
URL="${1:-https://g4l-ten.vercel.app}"

# CSS tells (class names in the built stylesheet) and JS tells (strings in the chunks).
# Tells must live in the STATIC bundle — CSS classes or client strings. Do NOT use
# server-generated copy (engine/model replies): it renders at runtime, never in a chunk.
CSS_TELLS=("rlb-input" "onbwel-bleed")          # reclaim builder · full-bleed welcome
JS_TELLS=("This is my list")                     # reclaim builder submit button

html="$(curl -s "$URL/onboarding")"
css_path="$(echo "$html" | grep -oE '/_next/static/[^"]+\.css' | head -1)"
css="$(curl -s "$URL$css_path")"

ok=1
echo "GREEN-LIGHT — $URL"
echo "  build: $(curl -sI "$URL/onboarding" | grep -i '^x-vercel-id' | tr -d '\r' || echo 'n/a')"

for t in "${CSS_TELLS[@]}"; do
  if echo "$css" | grep -q "$t"; then echo "  ✓ css  $t"; else echo "  ✗ css  $t  MISSING"; ok=0; fi
done

for t in "${JS_TELLS[@]}"; do
  hit=0
  for c in $(echo "$html" | grep -oE '/_next/static/chunks/[^"]+\.js'); do
    curl -s "$URL$c" | grep -aqF "$t" && { hit=1; break; }
  done
  if [ "$hit" = 1 ]; then echo "  ✓ js   $t"; else echo "  ✗ js   $t  MISSING"; ok=0; fi
done

echo
if [ "$ok" = 1 ]; then
  echo "🟢 GREEN — today's code is live. Safe to walk."
  exit 0
else
  echo "🔴 RED — the live alias is NOT serving today's code yet. Wait, re-run in ~60s."
  exit 1
fi
