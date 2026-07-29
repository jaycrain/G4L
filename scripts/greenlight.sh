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
#
# ⚠ CRITICAL: a tell only proves the deploy landed if it is NEW IN THE BATCH YOU JUST PUSHED. Tells from an earlier
# batch are already on the old build, so they pass BEFORE your push promotes — a FALSE GREEN (this bit us: a stale
# tell list green-lit an old build). RULE: when you push, REPLACE these with a string unique to that push, and prefer
# a full declaration (`selector{prop:value}`) over a bare class name so a pre-existing use elsewhere can't match.
CSS_TELLS=("idp-own:hover" "d8d6d6")   # v3.2.1 stabilization: ghost-button hover opt-out · btn-secondary non-red hover
JS_TELLS=("This is my list")            # reclaim builder submit button (carried; not a landing proof on its own)

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

# RUNTIME surface checks (CAT-41). Bundle tells prove the code is PROMOTED; they say nothing about whether the
# member-facing surfaces actually RENDER — a half-flagged prod (route on, engine dark) passed the old check. These
# hit the real entry points a Charter member uses and fail on a non-200 or a Next.js error page.
echo
echo "  runtime surfaces:"
for path in "/" "/onboarding" "/login"; do
  body="$(curl -s --max-time 20 "$URL$path")"
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL$path")"
  if [ "$code" != "200" ]; then
    echo "    ✗ $path  HTTP $code"; ok=0
  elif echo "$body" | grep -qiE 'application error|internal server error|__next_error__'; then
    echo "    ✗ $path  renders an error page"; ok=0
  else
    echo "    ✓ $path"
  fi
done

echo
if [ "$ok" = 1 ]; then
  echo "🟢 GREEN — today's code is live and the member surfaces render. Safe to walk."
  exit 0
else
  echo "🔴 RED — NOT safe to walk (stale bundle or a broken/half-flagged surface). Re-run in ~60s."
  exit 1
fi
