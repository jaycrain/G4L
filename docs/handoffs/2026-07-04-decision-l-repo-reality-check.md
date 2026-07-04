# Decision L (§2b Revision) — repo reality check

For the Cowork task drafting the **§2b Revision (Decision L) approach doc.** These are facts from the codebase the
spec session can't discover without repo access, plus the build-side calls on R1–R4. Hand this to Cowork alongside the
state-of-play primer; it should **revise the approach doc to reconcile with what's already shipped.**

Design-first, no build implied. Prod stays v1.

---

## The headline: the door-revision data model is already partly shipped (migration 0043)

`member_door` already went through a CRUD/audit revision pass — `0043_member_door_crud_audit.sql` — that made the
Decision L call, but via **soft-delete + full audit**, NOT a `supersedes` versioned-row scheme. What exists today:

- **`removed_at timestamptz`** — a set-aside Door is *stamped, never hard-deleted*. This IS the "never overwrite"
  guarantee Decision L asks for.
- **Per-column audit** into `member_profile_audit` (`source='member_door'`) — every widen / correct / name change is
  already preserved: one audit row per changed column on UPDATE, plus `_created` / `_deleted` markers, with the actor
  from the `g4l.actor` GUC. (Mirrors `audit_reclaim_item`, 0041.)
- **`cycle_indicator int default 1`** — versioning ACROSS Loop cycles (a Door set can differ by cycle).
- **PK is `(member_id, door_slug)`** — a member has each slug at most once. So you CANNOT append "a new row per
  revision" for the same slug; a re-add is a **reactivation** (`removed_at → null`), not a new row.
- The migration is **dormant and v1-safe**: "nothing writes `removed_at`/cycle yet; the audit trigger only records."
  It is infra *waiting* for this increment to turn on.

**Implication for the approach doc.** The proposed `supersedes` link + `revision_kind` + "new record per revision" is a
SECOND, parallel revision mechanism next to one that already exists — the "match decisions, don't reinvent them" trap
(CLAUDE.md). **Reconcile to 0043:** adopt soft-delete + audit as the versioning substrate, and add only what's
genuinely missing:

1. **`revision_kind`** (widen / correct / name) — probably as an **audit annotation** (or a small revision-event),
   NOT necessarily a new `member_door` column. Decide where it lives.
2. **The correct-pair link.** Soft-delete alone yields `_deleted marriage` and `_created load_bearer` as *separate*
   adjacent audit events — not explicitly linked. If the harvest tell wants "came in calling it X, it was really Y,"
   that one link (**correct only**) is the real gap worth designing. This is the *scoped* version of `supersedes` —
   not a general versioning table.

## The write-path semantics (per revision kind)
- **widen** — insert / reactivate an additional active Door. Removes nothing.
- **name** — same as widen at the data layer (a Door that was implicit becomes explicit / active).
- **correct** — soft-remove the old primary (`removed_at` stamped) + insert / reactivate the new one, and record the
  pair link. This is the ONLY kind that retires anything.
- Reprioritizing which Door is primary is an UPDATE (`is_primary`), already audited.

## R1–R4 — the build-side calls
- **R1 — DISAMBIGUATE / flip.** "Member-signalled only (not engine-initiated)" would kill the **re-seeing beat**,
  which is companion-*proposed* (insight move #6e — "you came in calling it The Marriage, but everything you said is
  about carrying the load — truer as The Load-Bearer?"). Split **propose** from **commit**: the Companion MAY propose a
  re-seeing; it only COMMITS on member confirmation. Commit-side member-signalled = yes; proposal-side
  engine-allowed = required.
- **R2 — ACCEPT, one clarification.** Re-reflect only when a correction re-opens the beat is fine — but a **correct**
  (primary Door replaced) MUST count as re-opening, because the insight was synthesized on the *old* Door. Don't limit
  re-reflection to an explicit dispute.
- **R3 — REFINE.** widen (adds, removes nothing) and correct (soft-removes + adds) are NOT one data-layer mechanism —
  "widen supersedes like correct" has nothing to supersede. Unify the **write path** (every revision = one audited
  change through the same function), but the **soft-remove fires only for correct**. One code path, conditional by kind.
- **R4 — FLIP.** The marquee tell IS a correct — the re-seeing (Marriage → Load-Bearer). Firing harvest on widen/name
  but not correct MISSES the deepest keeper. Key the tell to **whether it was a re-seeing** (companion-proposed &
  confirmed, or a revision that surfaced new understanding), NOT to the CRUD kind. The only no-harvest case is a **flat
  mislabel fix** ("oops, wrong tag").

## Kernel + bar constraints (unchanged — the doc must still hold these)
- Model **signals**, engine **disposes**: a revision proposal is a model signal; the engine bounds + routes it, and
  the commit is gated by member confirmation (the card/confirm seatbelt).
- Verbatim basis: a proposed re-seeing must quote the member's own words (same gate as the insight reflect).
- Never assume past what they said; never overwrite; always correctable. Never diagnose/pathologize — a re-seeing is
  *their* pattern offered back, never a verdict.
- Harvest emission stays **decoupled**: emit the tell as a signal (per the frozen two-layer harvest contract —
  `member_event` capture joined to a later commit by `momentId`); this increment does NOT implement what harvest does
  with it.

## Reference (for a Cowork task that gains repo access)
- `supabase/migrations/0012_member_door.sql` — base table (`is_primary`, `sort_order`, PK).
- `supabase/migrations/0043_member_door_crud_audit.sql` — soft-delete + audit + `cycle_indicator` (the revision infra).
- `supabase/migrations/0041` — `audit_reclaim_item` (the parity pattern 0043 mirrors).
- `lib/agent/reconnect.ts` — the `doorsStage` (excavation increment 1) this revision beat extends.
- `docs/handoffs/2026-07-03-2b-doors-excavation-approach.md` — the §2b design this continues.
