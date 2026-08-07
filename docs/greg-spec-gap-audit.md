# Greg's specs vs what we built — audit in progress

**Started 2026-08-07** on Jay's instruction: *"if there's anything you haven't read thoroughly in ANY of them
and applied to the app, we should. It ultimately makes our job easier."*

**Status: 4 of 12 assets audited (B1, B2, R1, R2). 8 remain.** This file is the running record; do not read it as
complete.

---

## The pattern, consistent across all four so far

**We built the instruments and skipped the conversational layer Greg specified around them.**

Every asset audited follows the same shape: his memos specify a multi-stage coached conversation with elicitation,
reflection, summaries offered for confirmation, and a structured closure. We built the measurement and a fixed
closing paragraph.

| Asset | Greg specifies | We built |
| --- | --- | --- |
| B1 | 5 stages: engagement → activity elicitation → eating elicitation → didactic informing → consolidation | `stageOrder: ['why']` — 12 items, one canned close |
| B2 | 5 stages: engagement → assessment support → evocation → didactic informing → consolidation | `stageOrder: ['skills']` — 24 items, one canned close |
| R1 | 7-step per-domain loop + 4-step closure; capture of values / hopes / fears / remembered-self as `prior_module_context` for R2 and R3 | 24 items, one closing turn, no capture |
| R2 | Per-door 1–3 relevance ratings; temporal reflection (which door came first / biggest impact / still open / what it changes) | Primary-door excavation only, then straight to measurement |

The B1 finding has its own write-up: `docs/b1-closure-findings.md`. It also carries the correction that Greg does
**not** want B1's score shown — our RB-1 decision was right — and the observation that the didactic guidance is
concentrated in B1 (63 refs) and B2 (52), the two assets we built as bare surveys.

**Why this happened is worth naming.** The Gated Assets V4 doc — the SOURCE under Greg's own precedence rule —
describes the *instrument*: items, scale, storage. The Companion and Engineering Memos describe the *conversation
around it*. We built to V4 and under-read the memos. That is a reading habit, not twelve separate mistakes.

---

## The most valuable single finding so far: R1 starves R2 and R3

R1 is specified to capture the member's own language — their remembered fuller self, the hopes inside it, the
fears in the gap — and hand it forward as `prior_module_context`. Greg states R3's Legacy Letter is seeded from
it.

We capture 24 numbers and nothing else. So the downstream assets have no material to build on, and every later
"we already know this about you" moment has to be reconstructed or invented.

If only one thing from this audit gets built, it should probably be this.

---

## Caveat: these findings need filtering, not just collecting

Two of the four audits produced findings that are **wrong or already settled**, which is a warning about how to
consume the rest:

- The R2 audit flagged the missing **"Spark space" community share** as a gap. There is no Spark space — we
  established today it exists in no route, screen or table, and retired the name. Building to that finding would
  mean building a feature for a place that does not exist.
- The R1 audit flagged the **ID Score being computed and shown** as a governance violation, and recommended
  adopting Greg's 90-day cadence. Both collide with frozen contracts: the ID Score IS the mirror, and Jay ruled
  on 60 days earlier the same day.

Neither auditor was careless — they were reading the spec faithfully without the decision history. It does mean
**no finding here should reach a build queue without being checked against the frozen contracts and the decision
log.** An unfiltered list is worse than no list, because it looks authoritative.

---

## Still to audit

R3, W1, W2, W3, B3, C1, C2, C3 — eight assets, roughly 700 of the 1,065 extracted requirements.

Expect more of the same shape, plus asset-specific gaps. B3, C1 and C3 already have coach mode, so their gaps are
likely smaller and more about specific didactic content than missing structure.
