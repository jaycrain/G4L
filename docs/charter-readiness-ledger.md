# Charter-Readiness Ledger — walk observations by tier

Living record of everything found during the founder's first real end-to-end walk (+ the pre-first-member
audit), tagged by **testing tier**, so the gap to charter-member distribution is always visible.

**Testing rigor by tier** (the floor for *every* change is `tsc` clean + full suite green — currently **606**):
- **T1 · Copy/cosmetic** — display strings, wording. Stores nothing. _Add:_ update any pinned fixture, eyeball.
- **T2 · Conversational flow / capture loop** — how the agent talks/reflects (load-bearing). _Add:_ a replay
  fixture asserting the capture invariants **+** a clean Joanne-persona live run **+** git-diff vs last-good. Revert-over-patch.
- **T3 · Data / persistence** — what gets stored (capture→commit, stores, migrations). _Add:_ pure-fn unit tests
  **+** a pglite round-trip proving `confirmed == persisted`. Deploy before real accounts hit it.
- **T4 · Governance** — crisis routing, AI disclosure, no-auto-send. _Add:_ a regression test proving the invariant.

Status legend: 🟢 closed (fixed + deployed + testing bar met) · 🟡 fixed/deployed, test-completeness minor · 🔴 open.

---

## Tally

| Tier | Total | 🟢 closed | 🟡 minor gap | 🔴 open |
| :--- | :---: | :---: | :---: | :---: |
| T1 · copy | 6 | 1 | 0 | 5 |
| T2 · flow | 14 | 6 | 1 | 7 |
| T3 · data | 6 | 2 | 1 | 3 |
| T4 · gov/design | 4 | 1 | 0 | 3 |
| **Total** | **30** | **10** | **2** | **18** |

**CROSS-ARC PATTERN (the batch's biggest theme):** "engine + model both contribute a question/beat → stacking" now
spans onboarding (W-02/W-08, CLOSED), Reconnect (W-14), and Rewire (W-18/W-19). One structural discipline — *the model
reflects, the engine asks, never both* — applied across the arc kernel family, not four separate patches.

**The onboarding capture batch (W-02/08/09/11) is DEPLOYED + confirmed on the founder's committed clean walk (2026-07-09)** —
the whole T2 flow column is now closed. The founder committed a pristine account: first-person gap, no junk close item,
no "Theme —" composition, smooth rhythm. **Gap to charter = the 🔴 open + 🟡 minor items below.** None compromise the
founder's live account.

---

## Ledger

### T1 · Copy / cosmetic
- **W-01 🟢 SKIP_ACK gendered pronoun** — `onboarding-staged.ts:129` "you'll find her" → "…your way back to them". Deployed. Fixtures updated (`onboarding-staged.test.ts`). _Data impact: none._
- **W-07 🔴 Other gendered-pronoun hits (audit)** — ~12 `her/she/he` hits in `onboarding-staged.ts` (131,160,177,186,262,358,532,797,944-945,1468…). Most are code comments / system-prompt persona *examples* (adapt per member) / the founder's third-person story — NOT bugs. _Testing:_ triage each; fix only true hardcoded member-facing ones (T1). **Open.**
- **A-05 🔴 `G4L_DEMO_OPEN_REBUILD` legacy demo bypass** — `lib/assets/gating.ts:43` gate-bypass flag in live code. **Inert on prod** (not set). _Testing:_ remove the flag (T1); confirm gating tests still pass. **Open, low.**

- **W-12 🔴 Gap sentence-joins drop periods** — on the founder's committed card the gap ran two sentences together
  without a period ("gotten me there **It** went deeper"; "our future **There** was a financial impact"). `set_gap`
  accumulates across turns and concatenates without a separator. Pre-existing (NOT a batch regression); content fully
  intact, purely readability. _Testing (T1):_ join accumulated gap segments with a period/space; eyeball. **Open, low —
  founder to decide (rail-editable meanwhile).**

- **W-16 🔴 Reconnect ceremony features the wrong Grinta number** — the §2f Grinta reveal leads with the COMPOSITE Grinta
  Index (3.42, +5.23%) as headline and shows the Reconnect strand (3.33, +24.72%) beneath as "the driver"
  ([reconnect-ceremony-beats.ts:15](lib/ceremony/reconnect-ceremony-beats.ts)). But the composite is diluted — it
  averages in Rewire/Rebuild/Reclaim strands still at baseline — so it UNDERSTATES the work just done. Founder's call
  (agreed): flip prominence so the RECONNECT STRAND is the hero (the honest, motivating proof of what they earned) and
  the composite is secondary context. Generalizes: each phase ceremony leads with its own strand. _Guardrail: keep the
  composite visible (canonical Grinta Index / dashboard metric [[grinta-index-measurement]]) — don't drop it._
  _Deliberate change (was built composite-forward on purpose) → wants a Decision Log line._ _Data impact: none
  (display hierarchy)._ _Fix (T1):_ swap hero/secondary in reconnect-ceremony.tsx + the reveal; ceremony-beats test.
  **Open — batched (founder may pull forward).** _SCOPE WIDENED (confirmed at the Rewire Checkpoint ceremony — same
  composite-forward reveal): NOT Reconnect-only. It's EVERY phase ceremony's Grinta reveal (Reconnect + Rewire now;
  Rebuild + Reclaim downstream). One shared fix across the ceremony-beats family, not a per-ceremony patch._

- **W-26 🔴 Rebuild ceremony button copy: "Get Reclaimed" → "Start Reclaiming"** — the Rebuild ceremony's terminal
  button (the Rebuild→Reclaim hand-off) reads "Get Reclaimed →". Founder: "Start Reclaiming" is more appropriate as an
  ONGOING effort. On-model — Reclaim is a recurring outcome state ("the Loop"), not a one-time achievement; "Get
  Reclaimed" reads as a finished transaction. _Fix (T1):_ change the label (rebuild-ceremony-beats resolve label);
  audit for any other "Get Reclaimed" instances. _Data impact: none (copy)._ **Open — batched.**

### T2 · Conversational flow / capture loop
- **W-02 🟢 Jumbled gap reflection** — the engine appends a static `GAP_MORE` widening question (`onboarding-staged.ts:189`) on top of a model turn that already wrapped ("let me make sure I have it right") → stacked transitions. Same anti-pattern as the W3 rhythm fix, still in the onboarding gap stage. _Data impact: none (display/flow)._ _Testing (T2):_ replay fixture for the stacked-transition case + a Joanne clean run + diff vs last-good. **CLOSED — root confirmed (`withQuestion` only suppressed on a literal "?"); fixed prompt-side (gather turns always end with the model's one question, never a bare wrap-coda) — no `withQuestion` code change (revert-over-patch); deployed; founder's walk smooth.**
- **W-08 🟢 Reclaim close-signal "the highlights" not recognized → re-ask + possible junk item** — member said "Those
  are the highlights" (a clear stop); `RECLAIM_CLOSE_RE` ([onboarding-intent.ts:63](lib/agent/onboarding-intent.ts:63))
  covers "those are the main/real/only/biggest ones" but NOT "the highlights", so `memberClosingReclaim`→false. Two
  effects: (1) the engine re-asked "what else?" — and that re-ask stacked a model preamble on the engine's appended
  question (same anti-pattern as **W-02**); (2) **potential data impact** — `shouldCaptureStagedReclaim("Those are the
  highlights")`→true, so the reclaim backstop ([onboarding-staged.ts:899](lib/agent/onboarding-staged.ts:899)) can
  append it as a list item, and finalize's *separate* anchored close-regex in [reclaim.ts](lib/member/reclaim.ts) also
  misses it → it would persist into the committed Reclaim List. _Data impact: pending — confirm the founder's summary
  card shows NO junk item ("the highlights"). If clean → pure T2 flow; if present → T3, fix+deploy before commit + redo
  the reclaim stage._ _Structural fix (T2/T3):_ unify the close vocabulary into ONE source of truth (capture guard +
  consolidation drop share it) so a miss can't both re-ask AND persist; fold the stacked-transition into the W-02
  rhythm fix. Replay fixture + Joanne run + diff. **CLOSED — unified close-vocab (capture + consolidation) + drift-guard
  test + T3 pglite round-trip; deployed; the founder's committed card had NO junk item.**
- **W-09 🟢 Overlap merge keeps earlier-by-position, not the cleaner text** — shape gate correctly caught a semantic
  overlap and proposed a member-confirmed merge (Decision II working). But on "keep as one" it drops `pending.drop`
  and `keep`/`drop` are assigned by LIST POSITION — the *earlier-captured* item is always `keep`
  ([reclaim-shape.ts:129](lib/agent/reclaim-shape.ts:129), [onboarding-staged.ts:455](lib/agent/onboarding-staged.ts:455)).
  In the founder's walk it kept the messier "Fitness back — riding up to Brainard Lake" over the clean "Riding up to
  Brainard Lake." Two sub-issues: (1) merge should prefer the clearer/more-complete wording (or let the member pick),
  not first-said; (2) the "Theme — " prefix ("Fitness back —") rode through capture — `stripReclaimPreamble` only
  strips "I'd like to add…" clauses, not a leading theme dash. _Origin CONFIRMED (founder): the MODEL composed the
  em-dash "Theme — concrete" phrasing when it recorded the want — same model-composition pattern as W-11's gap voice._
  _Data impact: minor — a REAL want with clumsy text; member-correctable from the rail; NOT restart-worthy._ _Fix
  (T2 + minor T3):_ (a) on merge, keep the cleaner text not earlier-by-position; (b) steer add_reclaim_item to record
  the concrete want plainly (no "Theme —" composition), consistent with the W-11 voice fix. Fixture + Joanne run.
  **CLOSED — cleanerReclaimText (keep cleaner text) + unit test + add_reclaim_item plain-want prompt; deployed; founder's
  committed list had plain wants, no "Theme —", no clumsy merge.**
- **W-10 🟢 (validation, not a defect) "That's it" closes the reclaim list cleanly** — same walk: after the merge,
  "Anything missing…?" → "That's it" → forecast, no re-ask. Confirms the close-detector works and **W-08 is specifically
  the "the highlights" vocabulary gap**, not a general close failure. _No action — recorded as the counter-example that
  scopes W-08._
- **W-11 🟢 Stored gap narrative is third-person "they" → mixed voice on the summary card** — the `set_gap` recording
  ([onboarding-staged.ts:1288](lib/agent/onboarding-staged.ts:1288)) says "record the member's account in their words,"
  so the model composed a THIRD-PERSON gap ("how they saw their wife," "the level they normally led"). But the card is
  second person everywhere else ("The doors YOU came through," "Does this look like you?") → mixed voice, plus real
  ambiguity ("they" = member? member+wife?). NOT a hardcoded default; the conversational voice rule
  ([onboarding-staged.ts:1467](lib/agent/onboarding-staged.ts:1467)) already prefers "you/your" — the `set_gap`/
  `reflect_gap` recording just isn't held to it. _Fix (T2 + stored-data) — TARGET REVISED to FIRST person (Cowork
  challenge, accepted):_ the bug was the distancing THIRD person, not first-vs-second. Hold set_gap to the member's OWN
  FIRST-PERSON voice ("I stopped training but kept riding"; "my wife got laid off"), never rewritten to third person.
  First person is the right target because (a) it matches Decision KK's card framing "here's what you shared" AND the
  dashboard label "in your own words" — which second-person transposition actively CONTRADICTS; (b) it's the model's
  NATIVE behavior, so it's robust, not a brittle transposition the model keeps splitting on; (c) it's the stronger
  self-mirror (the member hears their own admission). The live guide still speaks second person in CHAT (dialogue); only
  the STORED gap text is first person. BUILT (set_gap description). Prompt change to the LIVE capture loop → full T2
  rigor (persona run confirmed the third-person bug is gone + no capture regression; founder card-inspection is the
  authoritative voice check). _Data impact: the founder's stored gap is third-person now; content correct, voice off.
  The hold-and-rebuild plan re-does the whole walk on fixed code, so the gap re-voices itself._ **CLOSED — set_gap holds
  the member's own first-person voice; deployed; the founder's committed gap read fully first-person ("It didn't pull ME
  off the bike… MY wife had been laid off"), zero third person. Decision captured in [[gap-voice-first-person]].**
- **A-02 🟡 "Welcome back" resume gate false-promise** — `app/onboarding/chat.tsx` now verifies a server session exists before showing "nothing's lost"; clears stale storage otherwise. Deployed. _Testing:_ tsc + onboarding suite green; a dedicated automated test is hard (client effect) — verified by logic + the founder's live walk. **Minor gap: add a server-verify unit test if feasible.**

- **W-14 🔴 Doors session asks "has it shifted?" then ignores the answer** — Reconnect Doors session: the entry opener
  ([reconnect.ts:59](lib/agent/reconnect.ts:59)) invites a redirect ("still where it began, or has something shifted?"),
  but the next turn `doorOpen` ([reconnect.ts:146](lib/agent/reconnect.ts:146)) is a PURE function of the committed
  PRIMARY door — it opens Career Cliff regardless. Founder answered "the issues in my marriage have caused a tailspin"
  (a redirect to The Marriage, a committed door of his) and the agent walked past it into Career Cliff. Same
  "asks-then-won't-take-the-answer" anti-pattern as the onboarding fixes; by design, door revision is deferred to §2b,
  but the opener over-promises in the moment. _Data impact: NONE — the marriage is a committed Door, tangled-flagged,
  and §2b lets him widen toward it; flow/listening miss only._ _Fix (T2):_ entry→door hand-off reads the member's
  answer — if they name a door in their committed set, open THAT one (else default to primary), and acknowledge it.
  Reconnect arc suite + a fixture for the redirect case. **Open — batched (founder chose keep-walking).**

- **W-17 🟢 Disinformation Audit (Rewire W1) 404 — the `/rewire/[memberId]/w1` route was never created** — RWR-W1's
  asset routes to `/rewire/{memberId}/w1` ([rewire.ts:245](lib/curriculum/content/rewire.ts)), but only w2/w3/checkpoint
  sub-routes existed on disk; W1 lived only at the BASE `/rewire/[memberId]` (RewireChat defaults session='w1'). So the
  forecast link 404'd → every member would hit a wall entering Rewire (charter-blocking). Rebuild (b1–b4) + Reclaim
  (c1–c4) were checked and are COMPLETE — this was a Rewire-only one-off. _Data impact: none (routing)._ _Fix:_ added
  `app/rewire/[memberId]/w1/page.tsx` mirroring w2 (session="w1"). Deployed; live probe `/rewire/UUID/w1 → 200`. **CLOSED.**

- **W-13 🟢 Companion DOWN on a fresh account — unguarded reads crashed the cornerstone (FIXED — degrade-not-crash)** — on the founder's
  first dashboard load after committing, the companion fell back to its error greeting on load AND every turn
  ("I'm having a moment on my end… 988"). Root: `buildContext` ([checkin-actions.ts](app/dashboard/checkin-actions.ts))
  ran the Rebuild/Reclaim register reads (`latestGrintaReading`, `latestWhyReading`, `latestSkillsReading`,
  `activeCoachingPlan`, `latestBiggerWorldReading`) UNGUARDED in one `Promise.all` — one transient failure rejected the
  whole builder → openCheckin + every turn threw. (All 6 register tables confirmed PRESENT in prod, so it was a
  transient read failure on a cold ~15-query fan-out, not a missing-table drift.) _Severity: high — the cornerstone MA
  fully down for a new member; first surfaced now because it's the first fresh-account companion open since the v2.5
  code went live. Data impact: NONE (read/respond failure, no corruption)._ _Fix:_ guard EVERY supplementary register
  read with `.catch(() => null)` (each null-safe downstream; QD reads were already guarded) → companion DEGRADES, never
  crashes. **BUT the fix was insufficient AND I mis-verified it** — I saw the *Doors session* (a different surface,
  reconnect-chat, no buildContext) working and wrongly closed this. The companion rail still fell back to its error
  greeting. Root is a DIFFERENT unguarded read in the SAME builder — my `.catch` only covered the 5 register reads, but
  `getConnectSummaryForAgent` (line 141, prime suspect — Connect is the newest subsystem), `getForecast`,
  `getMemberExperience`, `recentConsumedTitles`, `getGrinta`, `getDailyBeat`, `maybeFoldMemory` are STILL unguarded; one
  rejection still crashes the whole Promise.all. All 6 register tables exist in prod, so it's a non-register read.
  _Next:_ pin the actual failing read (local repro of a fresh-account buildContext, or the prod error), then guard ALL
  supplementary reads with SHAPE-CORRECT defaults (not blind null — getGrinta/forecast have non-null shapes downstream)
  — or wrap buildContext in a minimal-context fallback tier so the companion NEVER fully crashes. **FIXED via the
  minimal-context fallback (degrade-not-crash) + a fresh-account repro test. VERIFIED on the founder's live rail (the
  right surface this time): it opens with FULL context — wove identity + reclaim specifics + Fade framing, which are
  full-build-only fields — so the crash was a TRANSIENT fan-out failure, NOT a drifted table. No drift-check needed;
  CLOSED clean, not merely degrade-safe.**

- **W-18 🔴 Rewire W1 double-bubble — model + engine both ask the domain question** — the W1 arc builds each turn as
  `[model reflection]${BEAT_SEP}[scripted W1_DOMAINS[next]]` ([rewire.ts:106](lib/agent/rewire.ts)). The model is told
  to reflect ONLY ("No question, no next domain", [rewire.ts:187](lib/agent/rewire.ts)) but ran ahead and asked the
  domain-4 question itself; the engine then appended its scripted domain-4 question → TWO bubbles both asking "what's
  still possible." No guard suppresses the engine's question when the model already asked (the guard onboarding got in
  W-02 was never applied to this arc). _Data impact: none (flow)._ _Fix (T2):_ strip the model's ran-ahead question
  before appending the scripted beat, or a `withQuestion`-style guard. Rewire arc suite + fixture. **Open — batched.**
- **W-19 🔴 Rewire W1 incoherent stacked message** — same root as W-18: the model's reflection wandered to answer the
  member's off-topic side-question ("That one we'll get into…") and stacked with the scripted "finish the audit / write
  one true line" beat → a long, multi-topic, jumbled message. _Data impact: none (coherence)._ _Fix (T2):_ folds into
  the same "model reflects, engine asks — not both" discipline as W-18. **Open — batched.**

- **W-21 🔴 Rewire session completion is a DEAD END — no onward CTA** — when a Rewire session (W1/W2/W3) closes it
  sets `stage='complete'` ([rewire.ts:131](lib/agent/rewire.ts)) → rewire-chat sets `done=true` and HIDES the input
  (`{!done && …}`, [rewire-chat.tsx:75](app/rewire/rewire-chat.tsx)) — but renders nothing in its place. The member
  finishes, sees the close message + footer, and has NO way forward (no "back to dashboard", no "next session"). Must
  manually type a URL. Affects all three Rewire sessions. (Reassuring adjacent finding: W1 DID complete + save the true
  lines to the Playbook — the W-19 tangent did not break the completion contract.) _Data impact: none (navigation)._
  _Fix (T2):_ add a `{done && …}` block with "Back to your dashboard →" (→ dashboard, which lights the next step W2).
  One small block, one file, fixes W1/W2/W3. **Open — small + contained; founder deciding fix-now vs batch.** _SCOPED
  (confirmed): the CHECKPOINT ceremony does NOT dead-end — it has a "Continue →" that hands off cleanly. Only the W1/W2/W3
  SESSION completions dead-end. The ceremony's Continue → is the exact pattern the sessions lack — use it as the model
  (though the desired session resolution is conversational per W-21, not a bare button)._ _TWO dead-end shapes (both need
the hand-home): W1/W2/W3 HIDE the input (hard dead-end); B3 Lifestyle Pilot LEAVES the input OPEN after "Great, locking
that in." (ambiguous — is it over or keep typing? — arguably worse). B3's hand-off has content: route into the PILOT
WEEK (name it, send home to the dashboard/companion where the pilot's active + calls log via the Momentum pulse), not
a generic "back to dashboard."_

- **W-22 🔴 W2 "hold" beat pauses with no clear prompt — member unsure whether to respond** — the W2 image "hold"
  stage is INTENTIONALLY question-less (design: "Receive their reaction in ONE warm sentence — no advice, no new
  question", [rewire.ts:437](lib/agent/rewire.ts)) — a contemplative pause after the vivid image. But a beat with no
  question leaves the member unsure whether to type or wait (founder chimed in "Got it!" at an ambiguous moment; it
  recovered). The flip side of the double-ask (W-18): sometimes there's NO handle where the member needs one. _Data
  impact: none (flow clarity)._ _Fix (T2):_ give contemplative pauses a gentle affordance ("…when you're ready") so the
  member knows they can respond without guessing — part of the arc-flow ("open → flow → hand-home") design pass.
  **Open — batched with the arc family (W-14/18/19/20/21).**

- **W-23 🔴 ENHANCEMENT: arcs don't recall the member's own prior-session lines verbatim** — the member's W1 true lines
  ('principle' keepers "Your true line", [rewire.ts:138](lib/agent/rewire.ts)) + W2 image ARE saved as Playbook keepers,
  and the companion RAIL context already carries `playbookKeepers` w/ `keeperType` ([[practice-week-and-keeper-recall-rails]]).
  But the arc SESSIONS inject only identity + reclaim list + current anchor ([rewire.ts:405](lib/agent/rewire.ts)) — NOT
  the prior keepers — so W3 said "the picture you already built" generically instead of quoting the member's ACTUAL W2
  image / W1 true line. Founder (recalling a prior design discussion): serving actual member lines back "could be
  powerful." It is — hearing your OWN words at the moment of a slip is the "remember, so the knowing compounds" north
  star doing real work. _Not a defect — arcs function; this is leaving potency on the table._ _Fix (enhancement):_ give
  the arcs the same keeper-recall the rail has (load prior keepers + instruct verbatim serve at the right beat); existing
  plumbing. **Open — enhancement, batched with the arc-flow pass (W-14/18/19/20/21/22).**

- **W-25 🔴 DESIGN: practice week monopolizes the hero — relocate to Momentum** — an active practice week PREEMPTS the
  companion hero (`practiceMessage ?? litCurrent`, [dashboard:178](app/dashboard/[memberId]/page.tsx); Decision MM R4).
  Founder: it's passive, requires login, and (the load-bearing point) **owns the hero so it can't be used for anything
  else** — and with two practices active (b2_noticing + b3_pilot) the hero can only show one. _Founder's direction
  (agreed):_ (a) a compact "changes" indication in the **Momentum panel** (dashboard) + (b) a real **logging surface on
  the Momentum subpage** (already reads `activePracticeWeek`, [momentum page:25](app/momentum/[memberId]/page.tsx) — the
  natural owner; Resilience Pulse already lives there); (c) **free the hero** back to greeting + next step, maybe a light
  pointer only. _Hold: prominence tradeoff — the hero-lead made the practice unmissable; the Momentum indication must be
  genuinely inviting or the practice gets ignored._ _Separate gap (noted, not this UI): "requires login" wants an
  out-of-app nudge — a **text/SMS or push notification** (more likely to land than email for a daily-practice reminder),
  or HubSpot lifecycle email — Cowork/HubSpot + notifications lane [[marketing-via-cowork]]._ _Data impact: none
  (surface design)._ **Open — revisits Decision MM R4; design item.**

### T3 · Data / persistence
- **A-03 🟢 Reclaim List ↔ categories lockstep** — finalize consolidated the list but index-matched stale categories → an item could inherit a neighbour's category (drives its coaching path). Fixed (`consolidateReclaim` lockstep), deployed, tested (`reclaim-consolidate-categories.test.ts`, 4 cases). _The one real data bug found — closed._
- **A-01 🟡 Skipped identity → NULL not `''`** — `lib/gateway/flow.ts` now stores NULL when identity is skipped (distinguishes never-named from lost). Deployed. _Testing:_ logic-verified; **minor gap: a pglite assert that a skipped-identity commit stores NULL would fully close it.**
- **A-04 🔴 Checkpoint/session deep-link gate-bypass** — a member can navigate straight to a later checkpoint URL (`/c4`, `/b4`, etc.) and complete it, setting the gate without earning it. No UI path leads there (forecast guides correctly), so it doesn't bite a normal walk. _Testing (T3):_ add prerequisite route-guards + a test proving the guard blocks the bypass AND doesn't break the happy path. **Open (spun into a background task).**
  _CONFIRMED LIVE on the founder's walk: he URL-navigated to B3 with B2 unfinished and COMPLETED + COMMITTED a pilot
  plan (not just viewed) → the bypass fully works end-to-end, and B3's coaching ran with no B2 skill profile (B2 never
  scored) — a hollow, out-of-order commit. Still not a normal-walk path (the forecast guides correctly), but the hole
  lets a later session be earned-without-prerequisite. Founder cleanup: finish B2 then re-do B3 in order._
- **W-24 🔴 Administered scales carry over → mis-scaled answers corrupt scores (DATA INTEGRITY)** — instruments use
  different VALIDATED native scales (FIVE so far: IDQ 1–5, B1/TSRQ 1–7, B2 self-management 1–4, Reclaim C2/C3 1–10,
  grit /5 — correct, verbatim, can't rescale without breaking validity). But the scale is stated only ONCE at the instrument's start, and the ingrained
  1–5 mental model reasserts during the item run: **the FOUNDER answered B1's 1–7 items as if 1–5, right after reading
  "1–7" and typing it.** Every charter member will do the same → invalid instrument scores. _Data impact: REAL — the
  founder's B1 "why" baseline is mis-scaled (stored-not-shown per RB-1, so low-stakes + nothing visible wrong, but it
  colors the agent's motivation read; recommend re-doing B1 after the fix)._ _Fix (T3), applies to ALL administered
  instruments:_ (min) repeat the scale anchors under EVERY item; (better, recommended) replace the free-text number box
  with tappable scale buttons (1–N chips) → mis-scaling becomes IMPOSSIBLE, self-documents the scale, removes typing.
  **DECIDED (founder): tappable scale CHIPS (Option A — a single number row 1..max with the two pole anchors labelled
  at the ends) across ALL administered instruments** — one reusable administered-input
  component: N chips (1..max) WITH anchor labels (e.g. "1 Not at all … 7 Very true") so it's fully self-documenting,
  the engine already knows each instrument's scale (parameterized administered factory), the chat just needs to signal
  "this turn expects a 1..N scale pick" so the client renders chips instead of the text box. Covers IDQ, B1, B2,
  Reconnect measurement, C2/C3, grit checkpoints. **Open — FIX-BEFORE-CHARTER priority (#1, above the flow-polish batch
  — it corrupts real scores).**

- **W-15 🔴 Reconnect Doors session has NO resume — a refresh/navigation loses the excavation** — the Doors (and the
  rest of the Reconnect arc) conversation is CLIENT-HELD only: [reconnect-chat.tsx:22-23](app/reconnect/reconnect-chat.tsx)
  keeps messages + state in React `useState`, and mount calls `startReconnectAction` which returns a FRESH opening —
  no per-turn save, no resume (unlike onboarding, which saves every turn to `onboarding_session`). So a refresh, crash,
  tab-switch, or navigating to the dashboard mid-session loses the in-progress excavation (only committed door-revisions
  + the IDQ/Checkpoint beats persist as they cross). Fragile for a deep, emotionally heavy arc — and it silently drops
  the transcript that would harvest to the Playbook. Appears to be a deliberate simplification ("conversation state is
  client-held," [reconnect/actions.ts:20](app/reconnect/actions.ts)). _Data impact: in-session work LOSS on
  navigation/refresh (not corruption of committed data); the founder's account is safe if he finishes Doors in one
  sitting._ _Fix (T3):_ give the Reconnect arc the same per-turn session persistence + resume onboarding has (save
  state+messages each turn, load on mount). **Open — flagged from the founder's "can I wait on the dashboard?" question.**

### T4 · Governance
- **A-06 🟢 Crisis routing on every phase arc** — `detectCrisis` was only in onboarding/check-in/IDQ; the four phase arcs relied on the model's instruction alone. Fixed (deterministic guard at the top of `runArcTurn` + `respondToStep`), deployed, tested (`crisis-arcs.test.ts`). _Closed._

---

- **W-27 🔴 STRATEGIC (content/experience): Rebuild underdelivers vs Rewire — "assess" without "reveal"** — founder,
  unprompted, at the B4 ceremony: *"underwhelming Checkpoint; I scored lower because I genuinely didn't feel there was
  something to be learned like in Rewire."* The pattern: **Rewire REVEALS** (insight lands in-session — catch the lies,
  build the image, write true lines; every beat has a reveal), **Rebuild ASSESSES + PLANS** (measure motivation B1 →
  measure skills B2 → commit plan B3 → re-measure B4) — and B1/B2 are STORED-NOT-SHOWN, so the member never even sees
  what their answers revealed → it reads as homework, and grit honestly dips because nothing moved them. Compounders:
  (1) Rebuild's real payoff is LONGITUDINAL (living the pilot over weeks) not in-session, so a one-sitting walk always
  feels thin — structural; (2) the checkpoint down-branch reframe ("a dip means you're looking clearly") can't tell a
  clarity-dip from a disengagement-dip and defaults to spinning it positive — when the real signal is "this
  underdelivered," that reframe rings hollow and brushes the posture line (don't reframe genuine low-value as "doing
  great"). _Directions for JAY + GREG (science/content, not code):_ give Rebuild a genuine in-session REVEAL (surface the
  B1/B2 profile in the governance-safe "help you understand yourself" way — an aha, not a black box); reconsider whether
  the checkpoint reframe should assume every dip is clarity. _Data impact: none (design)._
  _FOUNDER'S PROPOSED DIRECTION (for the Greg consideration):_ Rebuild's takeaway shouldn't imitate Rewire's
  hidden-truth reveal — its payoff is **felt AGENCY / momentum**. Reflect the member's own **change initiatives** (their
  B3 pilot / committed changes) back so they FEEL forward progress: *"you're taking action, you have a plan to build
  on."* That's the register of the body/habits R (reward = capability + motion, not insight). It also fixes the hollow
  reframe: the checkpoint foregrounds *"you named your why, faced your habits, built a plan you're in motion on — real
  ground under you"* instead of "your dip means you're looking clearly" — honest and energizing, independent of whether
  the number rose. **Open — the highest-value strategic finding of the walk; owner = Jay + Greg.**

- **W-29 🟢 C1 read the Reclaim List as EMPTY — reclaim_item drift + no jsonb fallback (FIXED)** — C1
  loads via `getReclaimItems` = `reclaim_item where removed_at is null` ([beats/store.ts:22](lib/beats/store.ts)). If
  migration 0040 (removed_at) is unapplied in prod the query throws; the DASHBOARD catches → falls back to the legacy
  jsonb list (shows the founder's 7 items), but C1 catches → EMPTY ([reclaim/actions.ts:47](app/reclaim/actions.ts))
  and invites the member to "build it here" → a PARALLEL list, violating [[reclaim-c1-step2-data-contract]] (touch the
  LIVE list, never a parallel/stale one). Same prod-migration-drift class as W-13. _Data impact: NO loss — the founder's
  items are in reclaim_item + jsonb (dashboard shows them); C1 just can't read them. Risk is only if a member BUILDS on
  the empty list._ _Fix (T3):_ apply 0040 in prod AND give C1 the same jsonb fallback the dashboard has (degrade to the
  live list, never empty). _CONFIRMED on prod: `select tier from reclaim_item` → "column tier does not exist" → migration
  0053 (tier) unapplied in prod (0040 removed_at almost certainly too — the dashboard jsonb fallback masks it). Prod's
  `reclaim_item` is behind on migrations — the Reclaim data layer partially broke in prod when v2.5 flipped without
  applying 0040/0053. Map the full drift + apply the missing reclaim migrations._ **Open — data-integrity; fix before
  charter (a member could overwrite their real list).**
- **W-28 🔴 STRATEGIC (mechanism): the 4Rs run as a LINEAR pipeline, contradicting the program model** — founder,
  walking it: "no one goes through all the Rs linearly like I am; Rebuild shouldn't default straight into Reclaim — you
  reach Reclaim later, in a different cycle." Correct, and it's the SPEC (CLAUDE.md program model): the 4Rs are NOT a
  linear pipeline — Rewire + Rebuild run in PARALLEL, dosed per member by IDQ subscores; **Reclaim is an outcome STATE
  reached when ready** (IDQ signal or member-declared), "the Loop," no fixed cycle. The current forecast marches
  Reconnect→Rewire→Rebuild→Reclaim in fixed order, which contradicts that. _Data impact: none (sequencing/mechanism)._
  _Directions for JAY + GREG (design, not code): dosing/parallel Rewire+Rebuild, Reclaim gated on readiness not order,
  the Loop._ **Open — strategic; owner = Jay + Greg. Pairs with W-27 (does each phase deliver).**

### T4 · Governance (cont.)
- **W-20 🔴 MA oversteps its lane — deep out-of-domain coaching (role boundary)** — inside the W1 audit the companion
  became a full cycling coach: threshold/tempo prescriptions, pacing seconds-per-mile, "check your SBT power data,"
  per-pound climbing math, weight-loss/deficit strategy. Founder: "not wrong, but more than it should." The Member
  Agent is an IDENTITY companion, not a domain coach — deep training/nutrition prescription is out of role AND edges
  toward the advice-liability line governance guards ("asks before advises", "no clinical claims"). Pairs with W-19:
  the MECHANISM is off-script wandering (the model leaves the arc's job and stays gone); the CONTENT is out-of-lane
  coaching. _Data impact: none (posture)._ _Fix (T4):_ one posture constraint on the arc + MA system prompts — LIGHT
  domain acknowledgment in service of identity ("that's the Athlete you're reclaiming"), never deep domain coaching;
  keep each arc on its job. **Needs an explicit posture call from Jay + Greg (same weight as the "safe to be honest"
  rules) — Claude drafts the constraint, they ratify where the line sits.** **Open — batched; posture decision pending.**
  _CALIBRATION EXAMPLES (the line, from the founder's walk):_ **KEEP** — logging a good call in the rail, the companion:
  "Staying disciplined on an endurance ride — not pushing when the legs want to — is the harder call. A lot of cyclists
  blow that line. How did it feel out there?" (light, AFFIRMS identity-relevant discipline, serves the work, ends with
  MI). **CUT** — the W1 detour into threshold/tempo zones, pacing seconds-per-mile, "check your SBT power data,"
  per-pound climbing math (deep domain coaching that hijacks the arc). The constraint should preserve the first, kill
  the second.

_Updated as the walk continues. Every new observation gets an ID, a tier, and a status; this table is the charter-readiness gate._
