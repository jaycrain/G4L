# Approach — §2b Revision (Decision L) — v2, reconciled to shipped infra

**Status:** Draft for sign-off · design-first · **no build** until approved · prod stays v1
**Date:** 2026-07-04
**Arc / config:** Reconnect (config #2), §2b Doors Excavation — revision increment (extends excavation increment 1)
**Flags:** `RECONNECT=staged`
**Supersedes:** my v1 draft (which proposed a `supersedes` versioned-row model — withdrawn; see §2).

---

## 0. What changed from v1 (and why)

v1 proposed a new versioning scheme for door records: one new row per revision, a `supersedes` link, a `revision_kind` column. That was a **parallel reinvention** — migration `0043_member_door_crud_audit.sql` already made the Decision L call, and the prior §2b approach doc (2026-07-03, open question #2) is exactly where that call was pending. This version reconciles to what shipped instead of building a second mechanism next to it (the "match decisions, don't reinvent them" rule).

**Verified against the code (worktree `xenodochial-ardinghelli-481324`):**

- `member_door` PK is `(member_id, door_slug)` — a member holds each slug at most once. You **cannot** append a new row per revision for the same door; a re-add is a **reactivation**, not a new row. (`0012_member_door.sql`)
- `0043` added `removed_at timestamptz` (soft-delete — a set-aside door is stamped, never hard-deleted) and `cycle_indicator int default 1` (versioning across Loop cycles).
- `0043` added per-column audit into the shared `member_profile_audit` (`source='member_door'`): one row per changed column on UPDATE, plus `_created` / `_deleted` markers, actor from the `g4l.actor` GUC. Mirrors `audit_reclaim_item` (0041).
- The migration is **dormant and v1-safe** by design: nothing writes `removed_at`/`cycle` yet; the audit trigger only records. It is infra *waiting* for this increment to turn on.

So the "never overwrite / preserve the old / audit the shift" guarantees Decision L asks for **already exist** — as soft-delete + audit, not versioned rows.

## 1. What revision is

The member correcting the door record after excavation has named a primary door. Three moves, one surface (the taxonomy the 0043 comment and the §2b design already name — Depth Arch §5a):

- **Widen** — add a door. The Fade traced through more than the one named.
- **Name** — a door that was quietly there becomes explicit/active. Same as widen at the data layer.
- **Correct** — the primary was wrong; it was really X. The one move that *retires* something.

Held to the bar throughout: never drop what they gave you, never assume past what they said, always correctable.

## 2. Data model — reconcile to 0043, design only the real gap

The versioning substrate is **soft-delete + audit** (0043), not new versioned rows. Write semantics per kind:

| Kind | Data-layer write | Retires anything? |
|---|---|---|
| **widen** | insert (or reactivate: `removed_at → null`) an additional active door | no |
| **name** | same as widen — implicit door becomes explicit/active | no |
| **correct** | soft-remove old primary (stamp `removed_at`) + insert/reactivate the new one + **record the pair link** | yes (soft) |
| reprioritize primary | `UPDATE is_primary` (already audited) | no |

**The one genuine gap worth designing: the correct-pair link.** Soft-delete alone yields `_deleted: The Marriage` and `_created: The Load-Bearer` as two *adjacent but unlinked* audit events. The harvest tell wants "came in calling it The Marriage, it was really The Load-Bearer" — that association is a single **correct-only** link, and it does not exist yet. This is the *scoped* version of what v1 called `supersedes` — a correct-pair pointer, **not** a general versioning table.

**Open decision R5 (new):** where does the correct-pair link live? Options: (a) a lightweight revision-event row carrying `{from_slug, to_slug, momentId}`; (b) an audit annotation on the `_created`/`_deleted` pair. My lean: **(a) a small revision-event**, because the harvest tell already reads events by `momentId` (§5) — same seam, nothing bespoke.

**Open decision R6 (new):** where does `revision_kind` (widen/name/correct) live? Probably an **annotation on the revision-event / audit**, not a new `member_door` column — the column set is about door *state*, not the history of how it changed. Flag if you'd rather it be a column.

## 3. R1–R4 — reconciled

These replace the v1 defaults; each now matches what's shipped and the companion-proposed re-seeing beat.

- **R1 — split propose from commit (not "member-signalled only").** My v1 default would have killed the re-seeing beat, which is **companion-proposed** — it's insight move #6e in the excavation prompt (*"you came in calling it The Marriage; everything you said is about carrying the load — truer as The Load-Bearer?"*). So: the Companion **MAY propose** a revision (engine-allowed, on earned material); it **COMMITS only on member confirmation**. Propose-side engine-allowed = required; commit-side member-confirmed = the seatbelt.
- **R2 — accept, with one clarification.** Re-reflect the insight only when a correction re-opens it — but a **correct MUST count as re-opening**, because the increment-1 insight was synthesized on the *old* primary door. Don't gate re-reflection on an explicit dispute; a primary swap re-opens by definition.
- **R3 — one write path, conditional soft-remove.** Widen (adds, removes nothing) and correct (soft-removes + adds) are not the same data-layer move — there is nothing for a widen to "supersede." Unify at the **write path** (every revision is one audited change through the same function), but the **soft-remove fires only for correct**. One code path, branched by kind.
- **R4 — flip: key the tell to re-seeing, not CRUD kind.** The marquee tell *is* a correct (Marriage → Load-Bearer). Firing harvest on widen/name but not correct would miss the deepest keeper. So: emit the harvest tell whenever the revision was a **re-seeing** — companion-proposed and member-confirmed, or a revision that surfaced new understanding — regardless of CRUD kind. The **only** no-harvest case is a flat mislabel fix ("wrong tag, fix it").

## 4. Interaction design (unchanged posture)

The revision turn: member reaches (or the Companion proposes on earned material) → **reflect first**, in the member's own words, quoting them (same verbatim gate as the insight reflect) → **offer, don't assert** → **member confirms** before anything commits. The existing `member_reply` classifier already emits `dispute` (the insight was off — they're correcting it); a dispute on the increment-1 insight is a natural entry into a **correct**. Posture holds: never diagnose/pathologize; a re-seeing is *their* pattern offered back, never a verdict.

## 5. Harvest tell — decoupled, via the frozen contract

Emit the re-seeing as a signal only. Per the frozen two-layer harvest contract, a `member_event` capture is joined to a later commit by `momentId`; **this increment emits the tell and does not implement what harvest does with it.** The correct-pair link (R5) carries the `from_slug → to_slug` the tell needs.

## 6. Scope boundary

**In:** widen / name / correct through one audited write path on the 0043 substrate; soft-remove on correct only; the correct-pair link (R5); companion-*propose* + member-*confirm*; re-reflect on correct; re-seeing harvest-tell emission.

**Out (later slices):** the harvest-tell *commit* path (emit only here); adjacent doors + the Acceptance teaching beat (§2b, separate); §2c measurement.

## 7. Felt bar

A revision should feel like being *heard more precisely* — not corrected or re-interviewed. The record changes without friction and without losing what they said before (the soft-delete keeps the earlier self-understanding). The tell of success: *"yes — that's actually it,"* on the member's own re-seeing.

## 8. Sign-off checklist

- [ ] R1 — propose/commit split (companion may propose; member confirms). Confirm.
- [ ] R2 — re-reflect on correct always (primary swap re-opens the insight). Confirm.
- [ ] R3 — one write path, soft-remove on correct only. Confirm.
- [ ] R4 — harvest tell keyed to re-seeing, not CRUD kind; only flat mislabel is silent. Confirm.
- [ ] R5 — correct-pair link as a small revision-event (my lean) vs. audit annotation.
- [ ] R6 — `revision_kind` as annotation (my lean) vs. a `member_door` column.

No build until these are settled — same gate as the excavation spec.

## 9. Build-side addendum (Claude Code, 2026-07-04) — R5/R6 pressure-tested against the harvest seam

R1–R4 verified sound. R5/R6 leans are right in spirit; R5 needs one sharpening after checking the actual capture layer:

- **R5 — sharpen (a): reuse `member_event`, do NOT add a revision-event table.** `member_event` already exists
  (`0028_member_event.sql`), and `lib/agent/harvest.ts` already emits the harvest signal through
  `emitHarvestMoment(db, memberId, {...})` → `insert into member_event (member_id, kind, surface, ref, meta)` with
  `kind='harvest_moment'` and a `momentId` written into `meta`, returning the id; the keeper (`playbook_entry`) joins by
  `moment_id`. So the correct-pair link should ride on **that existing event's `meta`** (`{fromSlug, toSlug}`) — not a new
  row type. For a **re-seeing correct, one `harvest_moment` event is simultaneously the harvest tell (R4) and the
  correct-pair link (R5)** — they unify. This is strictly cleaner than a bespoke revision-event and stays exactly on the
  frozen two-layer contract. (A new revision-event table would repeat v1's parallel-mechanism error one layer down.)
- **Sub-case to decide (falls out of R4+R5):** a **flat mislabel correct** still soft-removes + creates but, by R4,
  emits **no** `harvest_moment` — so it has no semantic pair link, only the audit's adjacent `_deleted`/`_created`. My
  lean: **that's fine** — a mislabel fix isn't a re-seeing, and `revision_kind='correct'` on the audit annotation (R6) is
  enough to know the two rows were one correction. Only flag if you want every correct to carry a durable from→to
  pointer regardless of harvest.
- **R6 — endorse, now consistent with R5.** `revision_kind` rides on the event/audit annotation, **not** a `member_door`
  column. `member_door` columns are door *state* (`door_slug`, `is_primary`, `removed_at`, `cycle_indicator`); *how it
  changed* is history and belongs with the event. Same principle as R5 — keep `member_door` pure state.

Net: R1–R4 as written; **R5 = the existing `member_event`/`emitHarvestMoment` seam, not a new table**; R6 as leaned;
plus the one flat-correct sub-decision above. Then it's build-ready pending Jay's sign-off.

## References

- `supabase/migrations/0012_member_door.sql` — base table (PK `(member_id, door_slug)`, `is_primary`, `sort_order`).
- `supabase/migrations/0043_member_door_crud_audit.sql` — soft-delete + audit + `cycle_indicator` (the revision substrate).
- `supabase/migrations/0041...` — `audit_reclaim_item` (the parity pattern 0043 mirrors).
- `lib/agent/reconnect.ts` — the excavation increment-1 `reflect_door` / `member_reply` beat this extends.
- `docs/handoffs/2026-07-03-2b-doors-excavation-approach.md` — §2b design of record (revision = #4; open question #2).
- `docs/handoffs/2026-07-04-decision-l-repo-reality-check.md` — the build-side reality check this reconciles to.
