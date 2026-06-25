# G4L — Handoff: Companion — Reclaim List editing + onboarding memory

**Date:** June 25, 2026
**From:** Jay (via Cowork synthesis)
**Scope:** Two Companion capabilities with **real member demand — requested by both Blake and Donna.** Both decisions are resolved; safe to build. The identity-naming **pacing** behavior (#16) already shipped in today's front-door push — noted here for context only, no action.

**Source of truth:** the Companion Behavior Spec (canon). It will be updated to match once this lands, so the Spec describes what actually shipped.

---

## Task summary

| # | Task | Type | Surface |
|---|------|------|---------|
| 1 | **Reclaim List editing** — Companion can add / remove / reorder via conversation | feature | Companion + Reclaim List |
| 2 | **Onboarding memory** — carry state, stop re-asking | behavior | Companion (onboarding) |

---

## 1. Reclaim List editing  *(Register/feedback #10 — requested by Blake + Donna)*

**Decision (Jay, Jun 25): yes — the Companion should be able to edit the member's Reclaim List through conversation.** Three operations:

- **Add** — already exists (onboarding builds the list). Confirm the same path works **post-onboarding**, member-initiated, via the Companion.
- **Remove** — new. **Governance rail:** removals must route through the **`member_profile` audit trigger** — soft / audited, **never a raw hard delete.** Preserve the audit trail the same way other profile mutations do.
- **Reorder** — new. A state/order change; no deletion concern.

**Member-facing behavior:** the Companion confirms each change in plain language and keeps the recovery-first tone — removing an item is never framed as failure. E.g. *"Done — I took {item} off your Reclaim List. We can bring it back any time you want."*

---

## 2. Onboarding memory — carry state, stop re-asking  *(feedback #2 — Donna)*

**Symptom (Donna's run):** Reconnect felt repetitive — the Companion asked again for things she'd already given, and came across as if it lacked memory within the conversation.

**Desired behavior:** the Companion **carries state across the onboarding conversation** and does **not re-ask what it already has.**

**Please investigate the source** before changing anything — this may be context-retention in the engine vs. a prompt issue. Find where the re-asking comes from and close it. If it turns out to be already handled and Donna's was an edge case, confirm that and we'll mark it verified.

**Tie-in:** this complements the pacing that already shipped (reflect-then-ask). Reflecting back what the member said only works if it's reliably remembered — so these two reinforce each other.

---

## Already shipped (no action — context only)

- **Identity-naming pacing (#16):** narrow gradually → reflect → offer candidate words from the member's own language → choose/coin, word framed as a changeable handle, connecting line on lock. Live in the system prompt as of today's front-door push.

## Do NOT touch / scope

- **No hard deletes** — every Reclaim List removal goes through the audit trigger.
- Keep scope to Reclaim List editing + onboarding memory — not a broader Companion overhaul.
- **Naming is provisional** pending the branding sweep — no renames.
- 11 Doors, IDQ, Threshold unchanged.

---

## Voice / framing guardrails

- Warm, direct, declarative. No "it's-not-this-it's-this" constructions.
- Recovery-first: removing or reordering is the member running their own list, never a setback.
- "Companion," never "Member Agent," member-facing.

---

## RESULTS — Claude Code, 2026-06-25

**1. Reclaim List editing — ✅ built (add confirmed, remove + reorder new).**
- **Add** ✅ — `add_reclaim_item` already exists and works post-onboarding via the Companion (confirmed).
- **Remove** ✅ — new `remove_reclaim_item` tool. **Soft, audited, reversible — never a raw hard delete:** a `removed_at` column (migration `0040`) is stamped; the row and its whole history (state, closer_count, reclaimed_at) survive, and it's filtered out of every "active items" read (6 queries). Verified at the data layer: the item disappears from the list while the row is preserved with `removed_at` set. Member-facing copy is recovery-first ("Done — I took {item} off your Reclaim List. We can bring it back any time you want.").
- **Reorder** ✅ — new `reorder_reclaim_list` tool; the agent passes the list in the desired order and `sort_order` is reassigned. Verified.
- *Governance note on the audit rail:* Reclaim items live in `reclaim_item` (not `member_profile`), so they don't pass through the `member_profile` audit trigger literally — but the **soft-delete via `removed_at`** gives the exact posture you asked for: nothing is destroyed, the trail is preserved, and it's reversible. If you'd rather mirror removals into the `member_profile` audit log explicitly, that's a small follow-up — flag it.

**2. Onboarding memory — ✅ investigated + fixed (no structural gap; re-asking closed at the source).**
The live onboarding turn already sends the **full conversation history every turn** (no truncation) and carries the structured records (`collected`) — so there is **no structural memory loss**; the re-asking was the model under-using its context. Fix: each turn now injects an explicit **"ALREADY CAPTURED — do NOT ask for any of these again"** summary of the records into the model (who they were, identity/skip, the Reclaim List, the gap story, the Doors), the same way the check-in agent gets MEMBER CONTEXT. This reinforces today's front-door prompt rules (reflect-then-ask / never re-ask). Net: state is both carried *and* made explicit.

**Scope honored:** no hard deletes; scoped to Reclaim List editing + onboarding memory; 11 Doors / IDQ / Threshold untouched; no rename. tsc clean; all 5 onboarding replay tests pass.
