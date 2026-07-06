# Companion CRUD — the "Talk to me" rail as THE interface (design for sign-off)

Status: **design, not built.** Design-first gate — sign off before the reclaim slice.
Origin: Jay's walk feedback #6 ("the Companion couldn't add to my Reclaim List — it has to be able to
CRUD from the rail for anything; it is THE interface of the Platform"). Related: the #3 late-add bug is
exactly the friction this removes — a member should be able to just *tell* the Companion to change their list.

---

## 1. The principle (Decision L)

The Companion can **read and write all member-owned QUALITATIVE content** from the rail; it **never writes the
scores.** That's the Decision L line:

- **CRUD-able:** the Reclaim List, the Door(s), the reclaimed identity/facets, trackers/measures, and the
  **Playbook** keepers.
- **Read-only (never written by the agent):** the ID Score, the Grinta Index, the Journey — the measurement
  surfaces. The agent explains and reflects them; it does not edit them.

The member should be able to say *"drop 'race Moab', and add 'ride the Alps with my brother'"* and have it happen,
warmly, in the conversation — not have to hunt for a form. The rail is the product; this makes it act, not just talk.

---

## 2. Surface set + order

| Surface | Ops | Slice |
|---|---|---|
| **Reclaim List** | add · edit · remove · reorder | **1 (first — prove the pattern)** |
| Door(s) | add · reconcile/re-see (reuses §2b `softSetMemberDoors`) | 2 |
| Identity / facets | add · rename · remove a facet | 2 |
| Trackers / measures | start tracking · edit target · stop | 3 |
| **Playbook keepers** | edit · remove · (add = the existing keeper flow) | 4 (roadmap) |
| **Legacy Letter / visioning captures** (drift, The Window) | edit · remove | 5 (roadmap) |
| ID Score · Grinta Index · Journey | **read-only** | — |

**FF's "ANY member-owned object" must not quietly narrow to these rows** (note 3). The list above is the *known*
qualitative surfaces; the rule is the invariant — any member-owned qualitative content is CRUD-able, scores are
read-only. New captures inherit CRUD by default; if a future surface should be exempt, that's an explicit decision.

Reclaim first: it's the thing Jay hit, the highest-traffic list, and it exercises every gate (validation, dedup,
confirm-before-destructive, reflect-back). Playbook + the visioning captures are on the roadmap — same rule.

---

## 3. The tool layer (`lib/agent/member-tools.ts`)

Thin, **governed** wrappers over the already-built, already-audited `lib/member/refine.ts` primitives
(`addReclaimItemForMember`, `setMemberDoors`, `softSetMemberDoors`, …). The engine — not the model — owns the
rules. Each tool returns a **structured result** the agent reflects in its own voice.

Reclaim slice tool schemas (illustrative):

```ts
// ADD — low friction. Validates, categorizes, appends. No confirm needed.
// A VAGUE add is NOT bounced back as "vague" — the tool signals `draw_out` and the agent runs the onboarding
// draw-to-measurable move WITH the member ("what would that look like on a Tuesday?") until it's bindable, then
// adds the sharpened want (note 4). A dup folds. Fog only truly fails after the member declines to sharpen.
reclaim_add(text: string)
  -> { ok: true, item: {id, text, category} }
   | { draw_out: true, heard: string }                 // too vague to bind — draw it out, don't reject
   | { ok: false, reason: 'duplicate', note: string }

// EDIT — replace one item's wording in place (measurable-sharpen, typo, rephrase).
reclaim_edit(match: string /* id or fuzzy text */, newText: string)
  -> { ok: true, before: string, after: string }
   | { ok: false, reason: 'not_found' | 'vague', candidates?: string[] }

// REMOVE — SOFT-delete (sets reclaim_item.removed_at, migration 0040 — the row is never destroyed), audited,
// two-step. Default call returns a PREVIEW; commit requires confirm:true. Because the remove is RECOVERABLE, a
// premature confirm:true is reversible — which is what makes prompt-instructed confirm safe for v1 (note 1).
// Decision L: NO raw deletes on member content. (Doors already soft via softSetMemberDoors; reclaim matches.)
reclaim_remove(match: string, confirm?: boolean)
  -> { needsConfirm: true, item: string }              // default: nothing changed yet
   | { ok: true, removed: string }                     // only when confirm:true — SOFT (removed_at set, recoverable)
   | { ok: false, reason: 'not_found', candidates?: string[] }

// REORDER — optional; low friction.
reclaim_reorder(order: string[] /* ids or texts */) -> { ok: true, list: string[] }
```

**Fuzzy match, not ids, is the norm** — the member says "drop the Moab one", not an id. The tool resolves to the
closest item; ambiguous → returns `candidates` and the agent asks which one (a natural clarify, not an error).

---

## 4. Governance gates — baked into the layer, not left to the model

1. **Soft-delete only — NO raw deletes on member content (Decision L, load-bearing).** `remove` sets
   `reclaim_item.removed_at` (migration 0040); the row is never destroyed and is recoverable. This is what makes
   the confirm safe: a premature `confirm:true` is *reversible*, so prompt-instructed confirm (not an echo-token)
   is acceptable for v1. Doors already work this way (`softSetMemberDoors`); reclaim matches.
2. **Confirm-before-destructive.** `remove` (and any replace/clear) is two-call: the first returns a preview
   (`needsConfirm`), and the commit only fires with `confirm:true`. The system prompt instructs the agent to
   **never** set `confirm:true` without an explicit member yes in the transcript. (Hardening for v2: the preview
   returns a short token the commit must echo — deferred, since soft-delete already makes a slip reversible.)
2. **Crisis routing stays on.** Any free-text the member gives runs `detectCrisis` before a write — same as
   everywhere. A distress signal routes to 988 and never becomes a silent list edit.
3. **Validation reuses `refine.ts`.** Fog ("be happier") is refused (the Beat engine could never bind it), dupes
   fold, near-dups collapse — the same discipline as onboarding capture.
4. **Audit is free.** Every `refine.ts` write already hits the `member_profile`/`member_door` audit triggers
   (migration 0032/0043). No new logging; no app-layer duplicate.
5. **Scores are not in the toolset.** There is no `id_score_set` / `grinta_set` tool to call. Structural, not
   trusted-to-the-prompt.

---

## 5. The confirm-UX beat — the felt crux (design for feel, not just correctness)

The destructive-confirm is where this either feels like a caring Companion or a bureaucratic gate. It must read
as **the Companion warmly double-checking**, in its own voice, one thing at a time — never a modal, never a
"Confirm: Y/N" prompt.

Shape:
- **Reflect the specific thing, in their words.** *"Want me to take 'race Moab' off your list?"* — names the exact
  item, so they catch a wrong match before it commits (the seatbelt, in-conversation).
- **Normalize the change — but NEVER name the negative it might carry (note 2, a beat rule, not just a line).**
  Saying "no judgment" plants judgment the same way "not regret" planted regret (the Drift-line fix). The confirm
  never reassures against a worry the member didn't raise. Normalize *sideways*: *"Some things have their season."*
  — warm, no rope named. And never "Are you sure?" (implies doubt).
- **One at a time; member sets the pace.** If they ask to drop three, confirm the set once and reflect all three,
  not three separate interrogations.
- **Additive edits need no gate** — *"Done — 'ride the Alps with my brother' is on there."* Only remove/replace
  pauses to check.
- **After any write, reflect the result + refresh context** so the next turn already knows the new list (the
  reconcile loop — §6).

Draft copy (directional — Jay's wordsmith):
> Member: "drop race Moab, I'm not chasing that anymore"
> Companion: "Want me to take **race Moab** off the list? Some things have their season."
> Member: "yeah"
> Companion: "Done. It's off. Anything you'd put in its place, or just lighter for now?"

This beat is the whole feel of "the Companion runs my stuff for me." Worth prototyping the copy against a few
real phrasings ("scrap that", "that's not me anymore", "actually keep it") before it's locked.

---

## 6. The reconcile loop (CLAUDE.md "part of done")

Whatever the agent CRUDs, it must immediately **know** — no data the member changed via the rail is invisible to
the next turn. After a write, the check-in context refreshes (it already reads the Reclaim List, Doors, facets,
Playbook), so the Companion reflects the change and the dashboard (same surface) shows it on refresh.

**A meaning-CHANGING edit reflects back the new wording** (note 4) — *"so that's now 'ride the Alps with my
brother' — got it"* — so word-drift is catchable in-conversation (the same seatbelt as the card). A pure
typo/format edit doesn't need the echo.

---

## 7. Slices (each independently shippable + verifiable)

1. **Reclaim CRUD** — the tool layer + the four reclaim tools + the confirm-UX beat + the reconcile refresh.
   Prove the confirm-gate and the felt beat here. Replay fixtures for the destructive-confirm path.
2. **Doors + identity/facets** — reuse §2b `softSetMemberDoors` (soft-delete, never destroy) + facet ops.
3. **Trackers / measures** — start/edit/stop on the existing measure store.
4. **Playbook keepers** — edit/remove (add already exists via the keeper flow). Closes the CRUD-except-scores set.

---

## 8. Resolutions (signed off)

- **Confirm hardening:** prompt-instructed `confirm:true` for v1 — approved, *conditional on removes being SOFT*
  (note 1: a reversible slip is a survivable slip). Echo-token deferred to later.
- **Fuzzy-match ambiguity:** yes — "the Moab one" matching two items is a natural confirm-which clarify. And the
  reflect-back on the confirm is what makes fuzzy matching *safe on removes* (the member catches a wrong match
  before it commits).
- **Rail ↔ dashboard parity:** yes — **ONE governed write path, audited once.** The dashboard's inline reclaim
  affordances route through the same tool layer. Do not build two.
- **Confirm copy:** don't lock the phrasing now — shape it against real transcripts during the build. But the
  **"never name the negative"** principle (note 2) applies from the start.

## 9. Slice-1 exit bar

Reclaim CRUD (add/edit/remove-soft/reorder) through the governed layer, wired to the rail, with the confirm beat
and the draw-out. **Not "done" until a felt-walk with Jay** — the confirm-UX has to *feel* like the Companion, not
a form. Replay fixtures for the destructive-confirm + the vague-add-draw-out paths. Flag-gated; prod stays v1.
```
