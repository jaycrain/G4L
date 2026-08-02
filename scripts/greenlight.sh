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
# Bundle tells only work for chunks reachable from /onboarding. For a surface with its own route, prefer a
# RUNTIME tell below (SURFACES) — it proves the page actually RENDERS the new thing, which is what we care about.
# Founder Companion tweaks — header row, merged composer sizing, pins removed. All three are NEW in this
# push, so none of them can match the previous build (which is the whole point of the rule above).
CSS_TELLS=(".draft-done-when")
JS_TELLS=()

# COMMIT CHECK — the authoritative proof for an ENGINE-ONLY push (server logic, no bundle change), where no static
# tell exists. NOTE: `vercel ls --meta githubCommitSha=...` returns NOTHING on this project (the meta isn't queryable),
# so do NOT use it — it reads as "not deployed" forever and will leave you waiting on a build that already shipped.
# Compare TIMESTAMPS instead: the newest production deployment must be newer than your HEAD commit.
#
# `ok` IS INITIALISED HERE, not after this block. It used to be set to 1 further down, which silently threw
# away a commit-check failure — the gate could report ⚠ and still exit GREEN.
ok=1
echo "GREEN-LIGHT — $URL"

# EVERY grep IN A COMMAND SUBSTITUTION NEEDS `|| true`. Under `set -euo pipefail` a grep that matches nothing
# exits 1, pipefail promotes it, and the whole script dies — before its first line of output. That is exactly
# what happened on 2026-08-01: a gate whose job is to say GO or WAIT printed NOTHING and exited 1. A check
# that can fail silently is worse than no check, because you read the silence as "fine".
if command -v vercel >/dev/null 2>&1 && [ "$URL" = "https://g4l-ten.vercel.app" ]; then
  commit_ts="$(git log -1 --format=%ct 2>/dev/null || true)"
  newest="$(vercel ls 2>/dev/null | grep -oE 'https://g4l-[a-z0-9]+-[a-z-]+\.vercel\.app' | head -1 || true)"
  if [ -n "$newest" ] && [ -n "$commit_ts" ]; then
    info="$(vercel inspect "$newest" 2>&1 || true)"
    dep_date="$(echo "$info" | grep -E '^\s+created' | sed -E 's/.*created[[:space:]]+//; s/ \[.*//' || true)"
    dep_ts="$(date -j -f '%a %b %d %Y %H:%M:%S' "$(echo "$dep_date" | sed -E 's/ GMT.*//')" +%s 2>/dev/null || true)"
    aliased="$(echo "$info" | grep -c 'g4l-ten.vercel.app' || true)"
    if [ -n "$dep_ts" ] && [ "$dep_ts" -ge "$commit_ts" ] && [ "${aliased:-0}" -gt 0 ]; then
      echo "  commit: ✓ newest prod deploy is newer than HEAD $(git rev-parse --short HEAD) AND serves this alias"
    else
      echo "  commit: ⚠ newest prod deploy predates HEAD $(git rev-parse --short HEAD) or isn't aliased — still building"
      ok=0
    fi
  fi
fi

html="$(curl -s "$URL/onboarding" || true)"
css_path="$(echo "$html" | grep -oE '/_next/static/[^"]+\.css' | head -1 || true)"
css="$(curl -s "$URL$css_path" || true)"

echo "  build: $(curl -sI "$URL/onboarding" | grep -i '^x-vercel-id' | tr -d '\r' || echo 'n/a')"

for t in ${CSS_TELLS[@]+"${CSS_TELLS[@]}"}; do
  # -F -e: a tell is a LITERAL string, and `-e` is what stops grep reading a leading `--` as an option.
  # A CSS custom property (`--composer-h`) is a perfectly good tell and read as a flag → "MISSING" on a
  # build that was serving it correctly. The gate reported RED on healthy code for ten minutes.
  if echo "$css" | grep -qF -e "$t"; then echo "  ✓ css  $t"; else echo "  ✗ css  $t  MISSING"; ok=0; fi
done

for t in ${JS_TELLS[@]+"${JS_TELLS[@]}"}; do
  hit=0
  for c in $(echo "$html" | grep -oE '/_next/static/chunks/[^"]+\.js'); do
    curl -s "$URL$c" | grep -aqF -e "$t" && { hit=1; break; }
  done
  if [ "$hit" = 1 ]; then echo "  ✓ js   $t"; else echo "  ✗ js   $t  MISSING"; ok=0; fi
done

# RUNTIME surface checks (CAT-41). Bundle tells prove the code is PROMOTED; they say nothing about whether the
# member-facing surfaces actually RENDER — a half-flagged prod (route on, engine dark) passed the old check. These
# hit the real entry points a Charter member uses and fail on a non-200 or a Next.js error page.
echo
echo "  runtime surfaces:"
# "path" alone = must render without erroring. "path|string" = must ALSO contain that string — that second form
# is the strongest tell we have: it proves the deployed page really renders today's change, not just that the
# route exists. Add one for each member-facing surface you ship.
SURFACES=(
  "/"
  "/onboarding"
  "/login|Forgot your password?"            # NEW THIS PUSH (SEC-08): the way back in is reachable from the door
  "/login/forgot|Send me a reset link"      # SEC-08: the reset request surface renders
  # NOTE (learned 2026-07-30): do NOT try to tell on the sign-up gate's fields. The gate renders BEHIND the
  # welcome screen, so the email/password inputs are never in the SSR HTML — a runtime tell on them is a
  # guaranteed false RED. For changes with no static tell, the COMMIT TIMESTAMP check above is the proof.
)
for entry in "${SURFACES[@]}"; do
  path="${entry%%|*}"
  want=""
  [ "$entry" != "$path" ] && want="${entry#*|}"
  # -L FOLLOWS redirects and judges the DESTINATION: "/" legitimately 307s to the welcome now, and a bare status
  # check called that a broken surface (a false RED on a healthy app). What matters is where the member lands.
  body="$(curl -sL --max-time 20 "$URL$path")"
  code="$(curl -sL -o /dev/null -w '%{http_code}' --max-time 20 "$URL$path")"
  if [ "$code" != "200" ]; then
    echo "    ✗ $path  HTTP $code"; ok=0
  elif echo "$body" | grep -qiE 'application error|internal server error|__next_error__'; then
    echo "    ✗ $path  renders an error page"; ok=0
  elif [ -n "$want" ] && ! echo "$body" | grep -qF "$want"; then
    echo "    ✗ $path  renders, but is STALE (missing: $want)"; ok=0
  else
    echo "    ✓ $path${want:+  ($want)}"
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
