# §2b — Doors Excavation (APPROACH, for review)

Status: **review draft — NO build authorized.** Design-first, same gate as the callback + the kernel seam.
Prod stays v1. This replaces the OLD curriculum Doors Session (session-guide RCN-FDR) with a new arc-config beat
on the kernel; when it ships behind `RECONNECT`, the route-gate makes the old one unreachable.

The one-line bar: **the excavation must BREATHE and be INSIGHTFUL** — not competent recall of the doors the
member already named, but something they don't yet see. #6 below is the whole point; the rest is the scaffolding
that makes it possible.

---

## 1. Governing mechanic — model-judged depth + verbatim gate + floor/cap (Decision T)
The Doors beat is a draw-out beat, same shape as the gap beat, and this is where Decision T matters MOST:
- The MODEL judges when the door is genuinely excavated (it signals `door_ready`), NEVER a proxy — no door-count
  ("we have 3 doors, done"), no length ("200 chars, done"). Those leak; the whole lesson of v2.0/v2.1.
- The engine only BOUNDS the judgment: a FLOOR (never close before N real drawing-out exchanges, so it can't
  wrap on recall) and a CAP (anti-loop). Same as GAP_MIN/MAX_DEPTH.
- The VERBATIM-REFLECTION GATE: advance only on a substantive reflection that quotes the member's OWN words about
  the door — inherited from the gap beat, and (per your kernel condition) carried in resolveConfirm's contract.
- Intent + capture ride the Phase-2 model-SIGNALED floor (member_reply, tool-only capture) — no regex inference.

## 2. The branded-12 as conversation, not a click-grid
- Opens FROM the committed PRIMARY door (from onboarding, loaded via loadReconnectCaptures) — "you named The
  Marriage as where it started." Never recites the 12-menu.
- "Most people walked through more than one." After the primary is drawn out, the Companion surfaces ADJACENT
  doors conversationally — the ones that commonly stack ("when The Marriage opens, The Load-Bearer is often right
  behind it — did that land for you too?"), or the ones onboarding tagged secondarily. Offered, never a checklist.
- Relevance is INFERRED underneath: the model tags which doors are real for THIS member (note_door / a relevance
  signal on the Phase-2 capture floor), with a strength, so the output is a ranked relevance set — the §2b output
  the spec's frozen contract calls for. The member never sees a grid; they see a conversation that happens to map.

## 3. The Acceptance teaching beat (the aging-decline thread)
- The Acceptance (resignation to age-decline — "this is just who I am now, at my age") is the door members almost
  never self-name, because it doesn't feel like a door — it feels like the truth. So it needs TEACHING, but only
  when the story carries the signal (never forced): "There's a quieter one we call The Acceptance — the sense that
  at your age, this is just how it is now. Does any of that ring true?" Surfacing it, gently, IS an insight (#6f).

## 4. Revision lives here (Decision L)
- The excavation can WIDEN (add a door), CORRECT (the primary was wrong — it was really X), or NAME (a door that
  was quietly there, unnamed). The Companion PROPOSES, the member CONFIRMS, and it's VERSIONED: preserve the old,
  record the new, audit the shift. Never silently overwrite.
- The SHIFT ITSELF is a harvest "tell" — a keeper ("you came in calling it The Marriage; sitting with it, it was
  really The Load-Bearer"). Re-seeing your own story is the deepest insight the beat produces (#6e).
- Data model (small new design, flagged for sign-off): a versioned door capture — member_door gains a version /
  supersedes link + the existing audit — vs. an update-plus-audit. Scores stay immutable; captures are revisable
  (the CRUD-except-scores rule from the v2.2 spec).

## 5. Structure
- A new `doorsStage: StageDef` in RECONNECT_ARC, **mode 'drawout'** (administered instruments — IDQ/Grinta — are
  §2c, and never run through the depth kernel). It reads the committed captures loaded at arc entry.
- Model-judged depth (`door_ready`) + floor/cap + verbatim gate; model-signaled capture (relevance, revision).
- **Fold in 2.4 doors-recall** as the on-demand affordance: "what were my doors again?" → stated plainly from the
  committed captures, never "no record" (the exact bug we just fixed in the old session).
- On complete: the ranked relevance set + any versioned revision + the harvest tell commit; advance to §2c (stub).

---

## 6. THE FELT BAR — insight, not recall (the make-or-break)
Your walk's verdict was *"it knew me but wasn't that insightful."* **Recall is the FLOOR, not the goal.** Knowing
the member's doors is table stakes (the callback already does that). The excavation earns its place only if it
surfaces something the member **doesn't yet see.** That is a design requirement, not a hope — here's HOW it's
generated, so we can hold the build to it:

**The excavation produces insight in five specific ways (the reflect is built to do these, not to list doors):**
1. **The through-line** — what the doors SHARE. Four doors aren't four problems; they're one shape. *"The Marriage,
   The Full House, The Load-Bearer — notice they're all the same move: you became the one who holds it all up, and
   no one was holding you."* Naming the pattern under the doors is the core insight.
2. **The sequence** — which door opened which. *"The Load-Bearer didn't come from nowhere — it opened the day The
   Marriage did. One propped the next open."* Causality the member lived but never traced.
3. **The normalized cost** — what they accepted as normal that wasn't. *"You've said 'I just did what had to be
   done' three times. You stopped counting the cost — because counting it wouldn't have changed anything. But it
   cost you {the specific thing they named}."*
4. **The identity target** — how the doors specifically pushed out WHO THEY WERE (ties back to the reclaimed
   identity). *"Every one of these is a door that pushed out the Racer — the runs, the rides, the version that
   moved. The Fade wasn't random; it had a target."*
5. **The re-seeing (revision)** — the deepest: *"you came in calling it The Marriage; but everything you just said
   is about carrying the load. I think the real door is The Load-Bearer — does that feel truer?"* The member
   re-sees their own story. (This is #4's revision + harvest tell.)

**How the model actually does it — the enforceable part:**
- **Depth FIRST.** You can't synthesize without material. The model-judged floor guarantees enough drawing-out
  before any reflect, so the synthesis has something true to work from (not a generic pattern).
- **The reflect is a CONNECTION, not a catalog.** The prompt DEMANDS it: *"You already know their doors — do NOT
  list them back. Find what they don't yet see: the through-line across the doors, which opened which, the cost
  they've normalized, how the doors targeted who they were. Reflect a connection, in their words."*
- **Grounded by the verbatim gate.** The insight has to quote THEIR words, so it can't drift into a horoscope —
  a generic pattern won't pass the gate.

**Governance — insight is OFFERED, never asserted (this is what keeps it safe AND is what makes revision work):**
- The Companion proposes the pattern as a reflect-and-CHECK — *"does it feel like the through-line is X?"* — never
  a verdict. The member confirms, corrects, or deepens it. This is the "never a verdict, help them understand
  themselves" posture, and it's the SAME mechanic as the revision confirm (#4). A wrong synthesis is caught by the
  member, exactly like the card seatbelt.
- Never diagnose or pathologize (hard rule). The through-line is *their* pattern reflected back, not a label.

**The build acceptance test for §2b** (so "insightful" isn't hand-wavy): in a felt walk, the reflect should make
the member say some version of *"huh — I hadn't put it together like that."* If it only makes them say *"yes,
those are my doors,"* it has failed the felt bar and isn't done — same standard as the gap beat's breathe.

---

## Open for your sign-off before build
1. **The insight design (#6)** — the reflect as a *synthesis* (through-line / sequence / cost / identity-target /
   re-seeing), offered-not-asserted, gated by verbatim + depth. Is that the right shape for the felt bar?
2. **Revision data model (#4)** — versioned door rows + audit, vs. update-plus-audit. Which?
3. **Scope of the first build increment** — do the WHOLE beat (primary → adjacents → pattern → revision → harvest
   tell), or land it in slices (e.g. primary-door draw-out + insight first, then revision + adjacents), each felt-walked?
