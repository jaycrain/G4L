# Your G4L Playbook — design decisions & build plan

Status: **approved design, pre-build** · Owner: Jay · Drafted with Claude, 2026-06-11

The Playbook is the member's synthesized record of *what's working* — the product's
tangible, keepable deliverable ("the thing a member tells a friend about"), and the working
draft of the eventual Legacy Letter / Success Story. It is fed by the **Checkpoint absorption
engine**: at each R's Checkpoint the Member Agent (MA) runs application-style probes that produce
two outputs from one conversation — a *private absorption read* (what to reinforce) and
member-facing *keepers* harvested into the Playbook.

Source material: `G4L_Playbook_Build_Spec_v1.1`, `G4L_Checkpoint_Rubric_v1.0` (for Greg's
blessing), and the `G4L_Field_Notes_Mockup.html` secondary-page mockup.

It is distinct from **Past Beats / "The Story so Far"** — that is the full *log* of everything done;
the Playbook is the short, curated *synthesis* of what it meant. History vs. cheat sheet.

---

## Locked decisions (Q1–Q7)

**Q1 — Sequencing: the "middle path."** Build the **Playbook first**, then the Checkpoint engine.
The Playbook can begin filling immediately from things we already capture (Beat `close_response`s,
MA follow-ups, member free-adds), so it delivers value standing alone; the Checkpoint engine is
gated on Greg anyway. Accepted caveats:
- The **"Why it works"** section has no existing seed source, so it stays empty until Phase 2. Every
  bare section gets an **instructional empty-state** ("Here's how you build this section of Your G4L
  Playbook…") in the member's voice — never a blank panel.
- Seeding runs **through MA curation**, never a raw `close_response` dump (or it becomes a second
  activity feed — the thing the spec warns against).
- The `playbook_entry` model + `proposed → kept` flow is **designed once now** so the later Checkpoint
  harvest plugs into the same pipe (no double-built proposal UX).
- Seeds are **proposals, never auto-kept** — same keep gate as everything else.

**Q2 — Greg's frames as config.** The per-R core frames / probes / keepers ship as **swappable
config/data, not hardcoded** (architecture principle #2; same pattern as `beats.json → beats.data.ts`).
Build the Checkpoint engine against the **v1.0 rubric as provisional config**, flagged not-yet-blessed,
and **do not expose Checkpoint probes to real members until Greg signs off** (internal/Jay/Donna testing
is fine pre-launch). Config schema designed generously (N frames per R, each `{frame, probe, keeperType}`)
so anything short of rethinking the mechanic stays a content edit. Jay relays Greg's edits; no
Greg-facing editor for now.

**Q3 — Keep/dismiss lives in both surfaces, one source of truth.** Every gathered entry is a
`playbook_entry` with state `proposed → kept | dismissed`. The MA **creates proposed entries** at a
Checkpoint/follow-up and may **mention ≤2 in chat**; the **Playbook page is the durable place to
resolve them** (dashed keep/dismiss cards per the mockup). Either surface updates the same row. The
member may also **keep verbally** ("yeah, keep that") via an MA tool. **Member free-adds skip
`proposed`** — they land `kept`, marked authored. Proposals **do not expire** (member can dismiss
anytime).

**Q4 — The private absorption read.** Persist it **per member, per R, per frame** (`landed / partial /
not_yet` + a one-line MA rationale, keyed to rubric frame keys). For v1 it **only flavors the MA's later
reinforcement** — it does **not** change Beat selection/dosing (that stays IDQ-subscore driven). It is
**invisible to the member** (no grade, not even a positive reflection — "too much information"),
**readable by the MA only** (never the Founder Agent), and **never touches the ID Score**. A future hook
(an un-landed frame nudging a Beat re-serve) is explicitly **deferred**.

**Q5 — Governance: who can read the Playbook.**
- **Member Agent — yes**, as the two-way loop, but **folds it into understanding, never parrots it cold,
  never weaponizes it.** (Build detail: inject a capped summary/recent slice, not the whole journal.)
- **Founder Agent — fully blind.** It drafts outreach in Jay's name; it never reads the Playbook.
- **Human operators — cannot see it**, even for charter members, to begin with.
- **Future, member-initiated:** a member may *choose* to share it (or parts) when they want feedback —
  a revocable, default-off `shared` flag, designed into the model now, lit up later.
- **Research/export:** the Playbook's personal writing never flows into research without explicit,
  separate consent. Kept out of any export path by default.

**Q6 — Free-add placement & companion response.**
- **Placement: a dedicated "Your own entries" journal section** (not interleaved) for v1 — the three
  synthesized sections stay a tight, curated cheat sheet; free-form notes don't get force-filed. A
  "promote a note up into a section" affordance is a clean **future** hook.
- **Companion response: silent-absorb by default, with an optional member-initiated invite.** The MA
  reads a free entry as context and uses it later; it does **not** auto-reply. Each entry carries a light
  **"talk to your companion about this"** affordance for when the member *wants* a response — so
  journaling stays journaling.

**Q7 — Checkpoint trigger.** The **Checkpoint Beat's "work" *is* the probe+harvest conversation** — one
moment, two outputs — and completing it marks the Beat done (feeding readiness as `rewireCheckpointDone`
already does). **No new trigger**: reuse Beat sequencing. It is a **richer, multi-probe conversation**
(1–3 probes per the rubric), by design more extensive than a normal single-shot Beat close, and runs on
a **focused conversation surface** (like onboarding/doors) in the MA's voice — not the small dashboard
bubble. It **always advances** regardless of the read. Coverage: **Reconnect** keepers are *already
captured at onboarding* (Reclaimed Identity, cost-of-the-Fade, protagonist line) → harvest from there, no
separate probe; **Reclaim** gets its own Checkpoint Beat. (Reconnect/Reclaim coverage finalized in
Phase 2, Greg-gated.)

---

## Data model (designed once)

`playbook_entry`
- `member_id` (FK → member_profile, cascade)
- `section` — `what_works | why_works | own_words | journal`
- `text`
- `authorship` — `gathered` (MA-proposed) | `authored` (member free-add)
- `state` — `proposed | kept | dismissed` (authored → `kept` on create)
- `source_kind` / `source_ref` / `source_label` — provenance + chip ("Rewire · Food as fuel",
  "Science · Greg", "Reconnect Checkpoint", "your own")
- `pinned` (bool)
- `shared` (bool, default false — future member-initiated sharing)
- `sort_order`, `created_at`, `updated_at`
- RLS enabled.

`checkpoint_read` (Phase 2; invisible, MA-only)
- `member_id`, `r` (`reconnect|rewire|rebuild|reclaim`), `frame_key`, `level`
  (`landed|partial|not_yet`), `note`, `updated_at`. RLS enabled. Never exposed to member; never the
  Founder Agent; never touches the ID Score.

Checkpoint rubric (Phase 2): a `checkpoint-rubric` config module (provisional v1.0) — per R, an array of
`{ key, frame, probe, keeperType }`. Greg-blessable as a content edit.

---

## Phasing

**Phase 1 — The Playbook (no Greg dependency)**
1. `playbook_entry` model (+RLS, migration) — the shared pipe.
2. Store layer: propose / list / keep / dismiss / pin / edit / remove / free-add (+ tests).
3. Playbook page: own route, "← Dashboard", header "Playbook" link beside Field Guide; three
   synthesized sections + journal; instructional empty-states; keep/dismiss cards; pin/edit/remove;
   "+ Add your own note".
4. MA gathering: a `propose_playbook_entry` tool + verbal keep; seeding via MA curation of existing
   `close_response`s; reuse refresh-on-write.
5. Two-way loop + governance: inject capped Playbook context into the MA (help, never cold/weaponized);
   Founder Agent blind; operators blind.
6. Tests + tsc + build.

**Phase 2 — Checkpoint absorption engine (provisional; member exposure Greg-gated)**
1. `checkpoint-rubric` config (v1.0).
2. `checkpoint_read` table (invisible, MA-only).
3. Checkpoint Beat = focused multi-probe conversation → records read → proposes keepers (same pipe) →
   marks Beat done.
4. Reconnect harvest from onboarding; add Reclaim Checkpoint Beat.
5. MA reinforcement flavored by the read (no dosing change).
6. Gate member exposure on Greg.

**Deferred (explicit):** promote-a-note-into-a-section · member-initiated sharing (`shared`) ·
absorption-read → Beat re-serve · Legacy Letter + Success Story (Playbook is their raw material) ·
delete/edit records with progress (carried from prior session).

## For Greg (not blocking the build)
Confirm the per-R must-absorb frames and that the science is represented faithfully; flag any to add,
cut, or sharpen; confirm the lighter-cognitive Rebuild Checkpoint is the right call. Until then the
Checkpoint engine runs on provisional config and is not exposed to real members.

## Standing reconciliation (CLAUDE.md)
The Playbook is member-facing, so by rule it must be **known to the Member Agent** (it is — the two-way
loop) and reconciled for its **significance to the Reclaim List**: the Playbook captures *why the work is
sticking*, which is what sustains a member through closing their list — it is the meaning-layer over the
Reclaim List, not a separate track.
