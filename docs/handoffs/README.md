# Handoff Standard — Cowork → Claude Code

How synthesis/copy work crosses from **Cowork** (where decisions and the living copy are made) into the
**build** (Claude Code, in this repo). This is the *process* doc; it lives next to the code on purpose.
Cowork owns and refines it — this is v0.1, seeded from the first run (the Jun 24 2026 member-facing
refresh). The *living copy* source of truth stays in Platform Content; **handoffs land here**, versioned.

## Why handoffs live in the repo
A handoff dropped in a loose Desktop folder is fragile — it got deleted in a cleanup once. In-repo it's
versioned, diffable, un-deletable, and Claude Code can reference it by path mid-build.

**Delivery (current, working flow):** Cowork produces the handoff as repo-ready markdown → **Jay places it
in `docs/handoffs/` or points CC at the file** → CC commits it and works from it → CC writes
verdicts/results **in place** in the same file and hands the read-back to Cowork. Jay is the bridge
(Cowork can't write into the repo, and CC works from a throwaway worktree, so dropped files don't
auto-appear). It's manual but quick, and it's held across multiple handoffs.

**Upgrade (drops the manual relay) — secrets-safe variant only:** connect a **dedicated drop folder
that holds NO secrets** (e.g. `~/g4l-handoffs/`, *outside* the repo) to Cowork; Cowork writes handoffs
there, CC picks them up from that folder and commits them into `docs/handoffs/`.
⚠️ **Do NOT connect the repo working folder (`~/g4l-platform`) itself** — its root holds `.env.local`
(prod `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`, …), and a folder connection grants *read*
access to those regardless of the commit/approval gate. Either way, **CC still owns the commit/push** and
the approval gates are unchanged.

**Naming:** `YYYY-MM-DD-short-slug.md` (e.g. `2026-06-24-member-facing-refresh.md`). One file per handoff.

## What a good handoff contains (keep doing)
These three made the first run build start-to-finish with zero clarifying questions:
1. **Task summary table** up top — `# · Task · Type (copy / build / string) · Page/surface`.
2. **"Ship this copy" verbatim blocks** — the exact words to ship, in blockquotes. Copy is handed
   verbatim, never paraphrased.
3. **"Do NOT touch" fence** — explicitly list what's still open/unsettled (e.g. the 11 Doors, the
   program-engine restructure) so the builder doesn't wander into half-decided territory. **Most
   valuable section in the doc.**
4. **Voice / framing guardrails** at the end — the rules to hold even on copy that gets lightly adapted
   ("associated with" not "causes"; recovery-first; no grim stats; no "it's-not-this-it's-this").

## Two required flags (added after run #1)
1. **Tag every line that contains data** as `[dynamic — keep existing]` or `[literal]`.
   - `[dynamic — keep existing]` → an example with a number in it ("ID Score is 62", "9 of 14 days") that
     should ship as the live/generated value, NOT hardcoded. Don't make the builder infer this.
   - `[literal]` → ship exactly as written (e.g. a general illustrative example like "74 of 120 reads as
     62" that isn't the member's own data).
2. **Build (visual) tasks pre-settle the boring decisions** — one sentence each, so the builder isn't
   making product calls and routing them back for review. At minimum: scale/range, label placement,
   numbers-on-chart-vs-legend, and what any mini/dashboard version shows. (Copy is airtight because it's
   verbatim; visuals are where assumptions creep in.)

## Closing the loop (every handoff)
After shipping, Claude Code returns a **3–5 line "shipped vs. spec" delta** — what went live that differs
from the spec (dynamic lines kept, final visual decisions made). Cowork folds it straight back into the
living copy so the docx and the code don't drift. Record the delta in the archived handoff's top comment
too (see `2026-06-24-member-facing-refresh.md` for the pattern).

## Minimal template
```markdown
# G4L — Handoff: <title>
**Date:** … **From:** Jay (via Cowork) **Scope:** … — all decisions resolved, safe to build.

## Task summary
| # | Task | Type | Page / surface |

## <N>. <task>  — copy / build / string
[dynamic — keep existing] or [literal] on any data-bearing line.
For build tasks: scale · labels · numbers-on-chart-vs-legend · mini-version — one line each.
> Ship this copy …

## Do NOT touch (still open)
- …

## Voice / framing guardrails
- …
```
