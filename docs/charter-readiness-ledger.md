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
| T1 · copy | 6 | 6 | 0 | 0 |
| T2 · flow | 15 | 14 | 0 | 1 |
| T3 · data | 6 | 5 | 0 | 1 |
| T4 · gov/design | 4 | 2 | 0 | 2 |
| **Total** | **31** | **27** | **0** | **4** |

_The 4 remaining 🔴 are all OFF the code lane — W-20 (posture ceiling wording, Greg ratifies), W-27 + W-28 (strategy, Jay+Greg), A-04 (deep-link route guards, spun to a background task). Every code finding from the founder walk is closed. The 🟡 minor-gap column is now empty._

**CROSS-ARC PATTERN (the batch's biggest theme):** "engine + model both contribute a question/beat → stacking" now
spans onboarding (W-02/W-08, CLOSED), Reconnect (W-14), and Rewire (W-18/W-19). One structural discipline — *the model
reflects, the engine asks, never both* — applied across the arc kernel family, not four separate patches.

**The onboarding capture batch (W-02/08/09/11) is DEPLOYED + confirmed on the founder's committed clean walk (2026-07-09)** —
the whole T2 flow column is now closed. The founder committed a pristine account: first-person gap, no junk close item,
no "Theme —" composition, smooth rhythm. **Gap to charter = the 🔴 open + 🟡 minor items below.** None compromise the
founder's live account.

**STATELESS-ARCS / HONOR-THE-MEMBER batch — BUILT + persona-verified 2026-07-20 (suite green 800; pending prod deploy).**
The v2.5 re-walk's biggest theme (also what Greg's engineering memos specify: `prior_module_context` threading). Six items:
- **W-34** deterministic redirect detector — engine proposes the primacy correction when the member pivots to another
  committed Door (opener-anchored · committed-only · origin-cue · propose→confirm · once). `reconnect.ts` +
  `tests/reconnect-redirect.test.ts`. Live-verified: fired on the redirect, swapped Diagnosis→Grind. Limit (documented):
  an un-aliased word like "the job"→Grind falls to the model (forcing it collides with career_cliff's "lost my job").
- **W-37 + W-36** drift beat RECALLS the Reclaim List + never fabricates a loss (killed the hardcoded "deep friendships").
  `driftOpen(c)` pure + `tests/reconnect-drift-recall.test.ts`. Live-verified.
- **W-40** W1 true-line SEEDED from the member's own prior honest lines (gap + Reclaim List now loaded into W1;
  `w1Context`) + `tests/rewire-true-line-seed.test.ts`. Live-verified: quoted the member's gap + list verbatim.
- **W-35** Doors→IDQ handoff leads with the model's acknowledgment of the member's final answer (receive-before-move).
  `tests/reconnect-receive-handoff.test.ts`.
- **W-39** W1 campaign beat is receive→reveal→seed→ask (the model owns the flowing turn; scripted `W1_CAMPAIGN` is now the
  FALLBACK — the persona walk caught a double-beat when both fired) + a governance guard (no identity verdicts).
  _NOTE: this made `W1_CAMPAIGN` a fallback rather than a verbatim scripted beat — the live model's seeded version was
  better; revertible if the exact copy is preferred._ Greg ratifies the label wording (build-now, not a gate).

---

## Ledger

### T1 · Copy / cosmetic
- **W-01 🟢 SKIP_ACK gendered pronoun** — `onboarding-staged.ts:129` "you'll find her" → "…your way back to them". Deployed. Fixtures updated (`onboarding-staged.test.ts`). _Data impact: none._
- **W-07 🟢 Other gendered-pronoun hits (audit)** — ~12 `her/she/he` hits in `onboarding-staged.ts` (131,160,177,186,262,358,532,797,944-945,1468…). Most are code comments / system-prompt persona *examples* (adapt per member) / the founder's third-person story — NOT bugs. _Testing:_ triage each; fix only true hardcoded member-facing ones (T1). **CLOSED — triaged: 0 true member-facing hits (rest are comments / persona examples / founder story); the one real one was W-01.**
- **A-05 🟢 `G4L_DEMO_OPEN_REBUILD` legacy demo bypass** — `lib/assets/gating.ts:43` gate-bypass flag in live code. **Inert on prod** (not set). _Testing:_ remove the flag (T1); confirm gating tests still pass. **CLOSED — flag removed from gating.ts; suite 621 green; deployed.**

- **W-12 🟢 Gap sentence-joins drop periods** — on the founder's committed card the gap ran two sentences together
  without a period ("gotten me there **It** went deeper"; "our future **There** was a financial impact"). `set_gap`
  accumulates across turns and concatenates without a separator. Pre-existing (NOT a batch regression); content fully
  intact, purely readability. _Testing (T1):_ join accumulated gap segments with a period/space. **CLOSED — joinGapChapters() + unit test; deployed.**

- **W-16 🟢 Ceremonies feature the wrong Grinta number (composite, not the phase strand)** — the §2f Grinta reveal leads with the COMPOSITE Grinta
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

- **W-26 🟢 Rebuild ceremony button copy: "Get Reclaimed" → "Start Reclaiming"** — the Rebuild ceremony's terminal
  button (the Rebuild→Reclaim hand-off) reads "Get Reclaimed →". Founder: "Start Reclaiming" is more appropriate as an
  ONGOING effort. On-model — Reclaim is a recurring outcome state ("the Loop"), not a one-time achievement; "Get
  Reclaimed" reads as a finished transaction. _Fix (T1):_ change the label (rebuild-ceremony-beats resolve label);
  audit for any other "Get Reclaimed" instances. _Data impact: none (copy)._ **CLOSED — "Start Reclaiming →"; pinned test updated; deployed.**

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
- **A-02 🟢 "Welcome back" resume gate false-promise** — `app/onboarding/chat.tsx` now verifies a server session exists before showing "nothing's lost"; clears stale storage otherwise. Deployed. _Testing:_ tsc + onboarding suite green; a dedicated automated test is hard (client effect) — verified by logic + the founder's live walk. **CLOSED — 4 server-verify tests in `onboarding-session.test.ts` encode the gate predicate (`session && messages.length > 0`): absent session, empty-messages session, and a completed/wiped session all demote to fresh; only a session-with-messages resumes. Suite 643 green.**

- **W-14 🟢 Doors session asks "has it shifted?" then ignores the answer** — Reconnect Doors session: the entry opener
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

- **W-18 🟢 Rewire W1 double-bubble — model + engine both ask the domain question** — the W1 arc builds each turn as
  `[model reflection]${BEAT_SEP}[scripted W1_DOMAINS[next]]` ([rewire.ts:106](lib/agent/rewire.ts)). The model is told
  to reflect ONLY ("No question, no next domain", [rewire.ts:187](lib/agent/rewire.ts)) but ran ahead and asked the
  domain-4 question itself; the engine then appended its scripted domain-4 question → TWO bubbles both asking "what's
  still possible." No guard suppresses the engine's question when the model already asked (the guard onboarding got in
  W-02 was never applied to this arc). _Data impact: none (flow)._ _Fix (T2):_ strip the model's ran-ahead question
  before appending the scripted beat, or a `withQuestion`-style guard. Rewire arc suite + fixture. **Open — batched.**
- **W-19 🟢 Rewire W1 incoherent stacked message** — same root as W-18: the model's reflection wandered to answer the
  member's off-topic side-question ("That one we'll get into…") and stacked with the scripted "finish the audit / write
  one true line" beat → a long, multi-topic, jumbled message. _Data impact: none (coherence)._ _Fix (T2):_ folds into
  the same "model reflects, engine asks — not both" discipline as W-18. **Open — batched.**

- **W-21 🟢 Rewire session completion is a DEAD END — no onward CTA** — **CLOSED (2026-07-10):** on completion the
  companion now speaks a parting hand-home line (its own voice, appended as a final bubble) and the surface shows a
  `Continue →` CTA that routes to the dashboard (companion-home, next step lit) — no more hidden-input dead-end. Applied
  to ALL session arcs, not just Rewire: Rewire W1/W2/W3, Rebuild B1/B2/B3, Reclaim C1/C2/C3. The practice-week sessions
  (B3 / C3) route in with `Start the week →` + a pilot/quality-day hand-home line; the rest use `Continue →`. Copy: Cowork
  Copy Pack v0.2. Client-only (engine/closes untouched — zero risk to the capture loop); tsc + 632 green; deployed.
  _Original finding below._ — when a Rewire session (W1/W2/W3) closes it
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

- **W-22 🟢 W2 "hold" beat pauses with no clear prompt — member unsure whether to respond** — the W2 image "hold"
  stage is INTENTIONALLY question-less (design: "Receive their reaction in ONE warm sentence — no advice, no new
  question", [rewire.ts:437](lib/agent/rewire.ts)) — a contemplative pause after the vivid image. But a beat with no
  question leaves the member unsure whether to type or wait (founder chimed in "Got it!" at an ambiguous moment; it
  recovered). The flip side of the double-ask (W-18): sometimes there's NO handle where the member needs one. _Data
  impact: none (flow clarity)._ _Fix (T2):_ give contemplative pauses a gentle affordance ("…when you're ready") so the
  member knows they can respond without guessing — part of the arc-flow ("open → flow → hand-home") design pass.
  **Open — batched with the arc family (W-14/18/19/20/21).**

- **W-23 🟢 ENHANCEMENT: arcs don't recall the member's own prior-session lines verbatim** — **CLOSED (2026-07-10):**
  the W3 plumbing already loaded the W1 true lines + W2 image and injected them verbatim into context — the gap was the
  system prompt said "offer the true lines / point them to the picture" but never said *quote their exact words*, so the
  model paraphrased ("the picture you built") — the founder's exact symptom. Added an explicit VERBATIM-RECALL rule to
  `REWIRE_W3_SYSTEM` ("QUOTE THEIR EXACT WORDS… never paraphrase or generalize"; first-person stays first person) +
  a regression test (`tests/rewire-keeper-recall.test.ts`, 4 cases) locking the verbatim context injection + the prompt
  rule. Copy: Cowork Copy Pack v0.2. tsc + 632 green; deployed. _Original finding below._ — the member's W1 true lines
  ('principle' keepers "Your true line", [rewire.ts:138](lib/agent/rewire.ts)) + W2 image ARE saved as Playbook keepers,
  and the companion RAIL context already carries `playbookKeepers` w/ `keeperType` ([[practice-week-and-keeper-recall-rails]]).
  But the arc SESSIONS inject only identity + reclaim list + current anchor ([rewire.ts:405](lib/agent/rewire.ts)) — NOT
  the prior keepers — so W3 said "the picture you already built" generically instead of quoting the member's ACTUAL W2
  image / W1 true line. Founder (recalling a prior design discussion): serving actual member lines back "could be
  powerful." It is — hearing your OWN words at the moment of a slip is the "remember, so the knowing compounds" north
  star doing real work. _Not a defect — arcs function; this is leaving potency on the table._ _Fix (enhancement):_ give
  the arcs the same keeper-recall the rail has (load prior keepers + instruct verbatim serve at the right beat); existing
  plumbing. **Open — enhancement, batched with the arc-flow pass (W-14/18/19/20/21/22).**

- **W-25 🟢 DESIGN: practice week monopolizes the hero — relocate to Momentum** — **CLOSED (2026-07-10):** the practice
  week no longer owns the hero. New `practicePanelLine()` (drift-hardened, per-kind compact copy) surfaces a quiet
  teal-tinted "This week: [the plan] — logging as you go." strip on the **Momentum panel** (all 3 dashboard states +
  the Momentum subpage, with a `Log →` inline link); the hero (`heroMessage`) returns to greeting + next step
  (`practiceMessage ??` dropped). Copy: Cowork Copy Pack v0.2. Prod-build-verified the `.practice-strip` CSS compiles
  (dev Turbopack flakily drops it; `next build` includes it correctly). tsc + 632 green; deployed. _The separate
  "requires login → out-of-app SMS/push nudge" gap stays open (notifications lane, [[marketing-via-cowork]])._
  _Original finding below._ — an active practice week PREEMPTS the
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
- **W-30 🟢 Companion loops the empty-reply fallback ("I'm with you — say a little more?")** — on repeated cycling-
  telemetry messages the companion returned the SAME fallback verbatim 3×, ignoring the member. Root:
  [checkin.ts:699](lib/agent/checkin.ts) — the live model call SUCCEEDS (not a crash/outage → that's a different
  fallback) but returns EMPTY TEXT, so the "never render an empty bubble" guard fires. Most likely the model treats the
  telemetry as log-only (calls log_call/momentum, returns no prose) → empty → static nudge, looped. Two bugs: (1) the
  model must always SPEAK when it acts (prompt); (2) the empty-fallback must not repeat one fixed line — if a tool WAS
  called (toolNames non-empty), acknowledge it ("logged that — what else?"), else vary. Pairs with W-20 (companion
  behavior on domain/telemetry input). _Data impact: none (it logs fine; only the reply degrades)._ _Fix (T2,
  cornerstone):_ system-prompt "always speak" + a smarter empty-degrade in checkinReply. **CLOSED — checkinReply acknowledges a tool-only turn (no more identical loop) + system-prompt "always speak"; deployed; suite 621 green. Built from Cowork Copy Pack v0.2.**

### T3 · Data / persistence
- **A-03 🟢 Reclaim List ↔ categories lockstep** — finalize consolidated the list but index-matched stale categories → an item could inherit a neighbour's category (drives its coaching path). Fixed (`consolidateReclaim` lockstep), deployed, tested (`reclaim-consolidate-categories.test.ts`, 4 cases). _The one real data bug found — closed._
- **A-01 🟢 Skipped identity → NULL not `''`** — `lib/gateway/flow.ts` now stores NULL when identity is skipped (distinguishes never-named from lost). Deployed. _Testing:_ logic-verified. **CLOSED — pglite round-trip in `gateway.integration.test.ts`: a skipped identity (`identitySkipped`, empty noun) commits `identity_noun IS NULL`, and a named identity commits the noun (natural case) — proving the NULL is meaningful. Suite 643 green.**
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
  Reconnect measurement, C2/C3, grit checkpoints. **✅ CLOSED (2026-07-10) — BUILT + tsc/628-green + component render
  proven live.** The engine emits a `ScaleExpectation` (`{kind:'scale',min,max,minLabel,maxLabel}`) from a single kernel
  point in `runArcTurn` (derived from the resulting administered stage — covers opener / item / re-prompt, absent on the
  prose close), plus each arc's opening fn; anchors live per-instrument on the `administeredStage` config. Shared
  `app/components/scale-chips.tsx` (Option A: rounded-square number row 1..max, teal-fill on pick, pole anchors under the
  ends, Barlow) renders on EVERY administered surface — onboarding (Grinta), Reconnect (IDQ + §2e grit), Rewire
  checkpoint, Rebuild B1/B2/B4, Reclaim C1/C2/C4, and the standalone IDQ retake. The free-text box stays beneath (nothing
  lost). Test: `tests/scale-expects.test.ts`. _Recommend the founder re-do B1 after this deploys so the "why" baseline is
  scored on the right scale._

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
  state+messages each turn, load on mount). **CLOSED — new `arc_session` table (migration 0056, keyed by (member, arc) —
  reusable for Rewire/Rebuild/Reclaim later) + `lib/agent/arc-session.ts` store; `reconnectTurnAction` saves the
  transcript each turn and clears it at the ceremony; `loadReconnectSessionAction` resumes on mount (recomputing the chip
  signal so a refresh mid-IDQ restores the scale chips). Best-effort/degrade-not-crash: without the table it silently
  falls back to today's no-resume behavior (no regression). Tested: 6-case pglite round-trip (`arc-session.test.ts`) +
  tsc + suite 643 green. Deploy: code is safe pre-migration; migration 0056 handed to Jay for the Supabase SQL Editor to
  ACTIVATE resume on prod.**

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
  applying 0040/0053. Map the full drift + apply the missing reclaim migrations._ **CLOSED — migrations 0040/0053
  applied to prod (both columns verified present) + `liveReclaimTexts` jsonb fallback deployed (2 unit tests, suite 618
  green) + LIVE-CONFIRMED: the founder re-opened C1 and his 7 items showed instead of "empty."**
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

---

## v2.5 Re-walk (2026-07-10, all four Rs live)

- **W-31 🟡 Idiomatic "yes" not caught by the excavation→Reclaim confirm gate** — member answered the door-excavation
  completion check ("do we have the heart of it now?") with *"That's about the size of it"* (a colloquial yes); the
  confirm gate didn't recognize it → re-asked the completion question ("have we got a good handle… or is there more?").
  A plain "Yes" then advanced correctly into Reclaim-List naming. _Data impact: NONE — nothing dropped/mis-captured; the
  gate degraded gracefully (a re-ask, the safe failure mode)._ _Class: flow roughness, capture-loop-adjacent._ _Fix
  (T2, low, revert-over-patch): broaden the idiomatic-affirmation set in the excavation→reclaim confirm gate ("that's
  about the size of it", "pretty much", "you got it", "that's it"). PATTERN fix — do only if it RECURS (first occurrence
  = track, per capture discipline). **Open — watching for more colloquial-confirm misses during the walk.**_

- **W-32 🟢 On chip (administered) turns, drop the text box + Send — chips already autosend** — the scale chips (W-24)
  already submit on tap (`onPick → submit`); no Send needed. But the free-text box + Send button still render beneath
  them, which (a) makes autosend look unnecessary/ambiguous and (b) leaves the mis-scaling hole open (a member can still
  hand-type a wrong-scale number, the exact W-24 bug). _Founder (v2.5 re-walk): "Do we need the text entry field? …just
  have the buttons autosend?"_ _Fix (T2, client-only, low risk): when the turn `expects` a scale, render ONLY the chips
  — hide the `<form>` text box + Send. Keep the box on conversational (draw-out) turns. Fully closes the mis-scaling
  bug + makes the autosend obvious. Touches the 6 chat clients' render only (no engine)._ **Open — ready to ship;
  founder holding deploy until a walk stopping point.**

- **W-34 🔴 Redirect-railroad RECURS despite the W-14 prompt fix — model ignored the honor-redirect rule (2nd occurrence → structural)** —
  in the Reconnect DEEPENING arc (returning member), companion opened on The Diagnosis; member redirected —
  *"It was really the job before the diagnosis. The job lead to the sickness"* (= The Grind is the real origin) — and
  the companion railroaded straight into The Diagnosis anyway ("the one you named as where it started"). The W-14
  redirect-honor rule IS present in the prompt (`reconnect.ts:809`, used by this arc) → this is a **model miss**, not a
  missing fix. _Data impact: YES (contained) — a missed door-PRIMACY redirect / Decision L §2b revision: the member
  corrected the origin door (Grind, not Diagnosis) and it wasn't honored or captured; all doors still stored, but the
  origin focus + deepening target are now wrong._ _By capture discipline (CLAUDE.md), the 2nd occurrence of a shape
  despite a prompt patch = stop patching the prompt, fix the abstraction._ _Fix (T2/T3, structural, focused session —
  NOT a mid-walk patch): a deterministic REDIRECT DETECTOR — when the member names a different door than the excavation
  target (`matchDoors`), the ENGINE proposes the switch (member-confirmed, propose→confirm per Decision L/II) instead of
  trusting the model to notice; routes the primacy correction through the revision path so the data is fixed too._
  **Open — HIGHEST-VALUE capture finding of the v2.5 re-walk (repeat shape + data relevance); above W-31/32/33.**

- **W-35 🟡 Excavation→IDQ handoff clobbers the member's final answer (posture miss)** — member answered a weighty
  deepening question ("How many years did that story hold?") with *"12 years"*; the companion fired the scripted IDQ
  transition frame ("We've been deep… let's shift to something lighter… first, a few about your body") with **no
  acknowledgment** of the answer. The Doors-excavation → IDQ (§2c) handoff is a DETERMINISTIC scripted opener (administered
  stages run off the depth kernel), so it overwrites any reflection of the member's last turn. _Data impact: NONE ("12
  years" is an excavation detail, not a dropped field) — purely posture/warmth, but HIGH north-star weight (reflect
  before moving on; receive, don't extract — posture IS the product). Feels transactional: the answer became a stage
  trigger._ _Same FAMILY as W-21: arc transitions that don't honor the member's last input before the next frame (2nd
  instance)._ _Fix (T2, posture): reuse the `withScriptedBeat` reflect-then-frame pattern — land a brief in-voice
  acknowledgment of the member's final answer BEFORE the scripted IDQ opener._ **Open — posture-weighted; pair with the
  W-21 transition family.**

- **W-36 🔴 Drift beat FABRICATES a loss the member never named ("deep friendships")** — post-IDQ Reconnect drift beat
  ("name a few things the Fade cost you: the morning rides, the deep friendships, the feeling of being in your body…")
  offered *deep friendships* as an example loss; the member never mentioned friendships/social loss (story was cycling,
  work, marriage, health). Founder confirmed: "didn't mention that." Likely inferred from a low Social IDQ subscore then
  stated as fact. _Same family as W-34: the model states things the member didn't say (assume-past-what-they-said
  violation)._ _Data impact: low-persistence (a conversational prompt, not a stored field) but a real GOVERNANCE/posture
  breach — it puts a specific loss in the member's mouth._ _Fix (T2): the drift beat's examples must be grounded ONLY in
  the member's actual story / Reclaim List / doors — never invent a loss category. Reflect back, don't fabricate._
  **Open — governance; pair with W-34 (model-states-what-wasn't-said family).**

- **W-37 🔴 Reconnect drift beat RE-COLLECTS the Reclaim List instead of RECALLING it — "no new framing" (founder's biggest concern)** —
  after the "this time we go deeper" promise, the post-IDQ beat asks cold: "name a few things the Fade cost you" —
  duplicating the onboarding Reclaim List (what you want back) with no new angle. Founder: "this is my biggest concern,
  seems repetitive, no new framing." Re-asking a list the member already built reads as the system having NO MEMORY of
  what they told it — the opposite of "deeper." _Data impact: risk of a parallel/duplicate list; mainly a DESIGN +
  posture defect._ _Fix (T2, arc design + copy): SERVE the member's own prior Reclaim List back and deepen from it
  (prioritize / sequence / connect to the doors — "if one came back first and made the rest possible, which?") — reuse,
  don't re-collect. Ties to W-23 keeper-recall._ **Open — HIGH (founder's biggest re-walk concern).**

- **THEME (v2.5 re-walk) — arcs behave STATELESSLY, don't build on prior captures.** W-23 (arcs don't recall prior keeper
  lines), W-35 (transition ignores the member's last answer), W-37 (re-collects the Reclaim List instead of recalling).
  ONE architectural direction, not three patches: **arcs must recall + deepen from what's already captured, never
  re-collect cold.** The design session's through-line.

- **W-38 🟡 Reconnect Visioning beat gives no clear handle + muddled two-Tuesday frame ("what's the member supposed to say?")** —
  after member's future-Tuesday answer ("energetic, a short ride"), companion: "Now the OTHER Tuesday — same year out,
  but you've been doing the work. What's different by 7am? …how you wake, what you reach for, how you move." TWO issues:
  (a) the question is ABSTRACT + COMPOUND (imagine a future morning; three sub-prompts) with no concrete anchor — the
  "no clear handle" shape; (b) the two-Tuesday contrast (drift-future vs work-future) reads COLLAPSED — the member just
  described the good future, so "the OTHER Tuesday you've been doing the work, what's different" seems to re-ask the same
  thing. Founder: "Still doing these dead-end statements, what's the member supposed to say?" _RECURRENCE of the W-22
  clear-handle family ("still doing these") → past a copy tweak, structural._ _Data impact: none (prompt clarity)._ _Fix
  (T2): every draw-out beat ends on ONE concrete answerable question; the vision exercise's two scenarios must be
  unambiguously distinct (bleak-drift vs done-the-work). Pending founder's read on which lands harder (vagueness vs
  confusion)._ **Open — clear-handle family (W-22); "still doing these" = recurring shape.**

  - **W-38 RESOLVED-IN-DESIGN (founder, 2026-07-10):** collapse the two-Tuesday "Window" (Greg's RCN-WIN, `reconnect.ts:383`)
    to a SINGLE "ordinary day" vision — "picture an ordinary day a year out, after you've done the work: how you wake,
    what you reach for, how you move." One concrete answerable picture; drops the drift-Tuesday contrast. SAME data
    (the reclaimed-ordinary-day `lights_you_up` keeper), cleaner elicitation. _NOTE: "The Window" is Greg's authored
    science content → build now, Greg-heads-up to ratify the reframe (his lane, not a build gate)._ Fold into the batch
    (load-bearing draw-out beat), not a mid-walk hotfix.

- **W-39 🟡 Rewire W1 audit leads with ANALYSIS before receiving the member's admission (W-35 variant) + interpretive-label edge** —
  member answered "Don't have time to even imagine such things"; companion led with the audit summary ("Now look at what
  you just laid out… that's the trick… the campaign on autopilot") BEFORE receiving the vulnerable admission, then (beat 2)
  centered it heavily. Founder: "Same thing here, didn't acknowledge last comment." _Distinct from W-35: the comment WASN'T
  ignored (beat 2 built its whole reflection on it) — the gap is analysis-FIRST: it explains the mechanism before simply
  receiving. Same ROOT (receive before you move/interpret) → reinforces W-35's posture fix._ _GOVERNANCE edge: "That's a
  man who stopped believing he's allowed to want anything for himself" = a strong interpretation of WHO the member is,
  stated as fact — brushes "never label/diagnose without confirmation." Reflect words back, don't assign an identity._
  _Data impact: none (posture + governance texture)._ _Fix (T2): receive-before-analyze at the audit summary beat; soften
  interpretive labels to member-confirmable reflections._ **Open — W-35 posture family (2nd instance) + governance watch.**

- **W-40 🔴 The "true line" is introduced as a COLD generative ask — should seed from the member's OWN prior honest lines (stateless-arcs, highest-leverage instance)** —
  Rewire W1 introduces the reframe ("What's the true line? One honest sentence — yours — that tells the real story")
  as a from-scratch demand, ignoring that the member has been giving honest first-person lines for two sessions
  (onboarding gap, Reclaim List, Reconnect `lights_you_up` vision keeper) + prior W1 true lines on a return. Founder:
  "When 'true line' gets introduced, we need to bring some the member actually gave us in the earlier session." _Fix
  (T2, stateless-arcs theme): seed the true-line INTRODUCTION with a recalled member honest-line ("You already told me
  true things — '[their line]'. That's a true line. Now against this belief, what's yours?"). Grounds the concept in
  their words + makes it feel like one continuous relationship. Same keeper-recall plumbing as W-23._ _Data impact:
  none (elicitation quality)._ **Open — stateless-arcs theme; HIGHEST-LEVERAGE instance (true line = the central Rewire
  mechanic). Pairs with W-23/35/37/39.**

- **W-41 🟡 Rewire W1 (Disinformation Audit) close has no sign-off + no "saved to your Playbook" + ambiguous-open dead-end** —
  the audit close presents the "full set" of true lines and says "That's the audit done…" but (a) leaves the INPUT BOX
  OPEN (no resolution — the ambiguous-open W-21 dead-end variant, like B3; the Continue→ hand-home only fires when a
  session HIDES the input, so this slips through), and (b) never tells the member the lines are SAVED to the Playbook.
  Founder: "needs a sign off and a 'this is in your playbook' or something." _Fix (T2, W-21 hand-home family): sign-off
  → "these five are in your Playbook, reach for them anytime" → Continue home. The Playbook acknowledgment also makes the
  recall promise (W-40/W-23) concrete._ **Open — W-21 family (ambiguous-open variant on the audit W1).**

- **W-42 🟡 Mis-captured "true lines" promoted into the audit set (durable-data risk)** — the saved 5-line set includes
  *"Then do something more constructive for yourself."* (SECOND-person imperative — not a first-person member true line;
  looks like a stray fragment promoted in) and *"I'm not fine."* (a raw admission, not a constructive true-line reframe).
  The set should be clean, first-person, member-authored true lines only. _Data impact: YES — the audit saves these to the
  Playbook (keepers), so a mis-captured line becomes durable wrong data + gets recalled later (W-40)._ _Fix (T2/T3): the
  true-line capture needs a shape check (first-person, constructive reframe) before a line joins the set; add a replay
  fixture for the 2nd-person / raw-admission shapes._ **Open — capture-quality; pairs with W-40 (Playbook recall makes
  mis-captures durable).**

  - **W-41 REFINED (founder saw the full close):** the pieces ALL EXIST and the W-21 hand-home is CONFIRMED LIVE here
    ("Head back whenever you're ready — I'm right here in the rail" + Continue → = the exact W-21 copy/button), plus the
    sign-off ("Good work today… yours to keep") + Playbook mention ("I've saved them to your Playbook"). The REAL defect:
    the terminal close UNSPOOLS across 2–3 member turns — "that's the audit done" (no resolution) → member prods "Great"
    → sign-off → member prods "ok" → Playbook + Continue →. The member has to type filler to walk themselves out.
    _Fix (T2): fire the FULL resolution (sign-off → Playbook → Continue) when the audit COMPLETES, in one clean landing —
    don't spread the terminal close across follow-up turns._ **Refined — not "missing," but "arrives 2–3 turns late."**

### v2.5 re-walk — SHIPPED batch (2026-07-10, deploy `g4l-ajhborc7v` = commit 6786df3)
- **W-32 🟢 CLOSED — deployed.** Chips-only on administered turns across all 6 chat clients; text box hidden on scale
  turns (returns on conversational turns), idq chips-only. Autosend now unambiguous + mis-scaling hole closed. tsc + 644 green.
- **W-33 🟢 CLOSED — deployed.** Staged gap backstop-append now routes through `joinGapChapters` (was a bare-space join
  → run-on sentences); `set_gap` instructed to compose clean mechanics, voice preserved. Test on the founder's exact shape.
- _Still OPEN (design session / watch): W-31, W-34, W-35, W-36, W-37, W-38(resolved-in-design), W-39, W-40, W-41, W-42;
  themes = stateless-arcs + honor-the-member/clear-handle + interpretive-label ceiling._

## Scott Runkel cold walk (2026-07-11, post-W-33 deploy — first outside-expert account)
- **W-43 🔴 `identity_paragraph` holds DOOR content in 2nd person (field conflation / off-target composition)** —
  Scott's identity_paragraph = "The Door that opened the Fade was your marriage — not the ending alone…" (matches
  primary_door=marriage). The identity-narrative field is describing his DOOR, not who "the Catalyst" is, and in second
  person. _Data impact: YES — the stored/shown identity narrative is wrong content._ _Fix: verify what identity_paragraph
  is meant to hold; ensure the identity composition centers the IDENTITY (natural-case, the member's own sense), not the
  door/fade description. Check for a swap/conflation at finalize (flow.ts identityParagraph)._ **Open — new, from cold walk.**
- **W-42 CONFIRMED 🔴 (was 🟡) — mis-captured list item in the wild.** Scott's Reclaim List committed his EXIT line
  "that's the end can i continue later?" [self] as a want. No longer hypothetical — independent first walk. Reinforces:
  the reclaim capture needs a shape check (member-stated WANT vs meta/exit/fragment) before an item joins the list.
- **W-44 🔴 Finalize accepted a BAIL-OUT + a thin list — completion contract too permissive** — Scott tried to leave
  ("that's the end, can I continue later?"); onboarding (a) captured that as a reclaim item and (b) FINALIZED him with
  effectively ONE real want ("waking up… building a life I'm excited about"). A cold user who bailed mid-Reclaim got
  committed with junk + a thin list (floor=1 passed, but soft aim ~7). _Data impact: YES — thin/dirty finalize._ _Fix:
  the completion path should recognize a pause/exit intent (offer resume, not finalize) + not count meta/exit lines toward
  the floor. Pairs with W-42 (shape check) + the resume gate (A-02)._ **Open — finalize-quality; from cold walk.**

## DESIGN-SESSION SCOPE — two buckets (v2.5 re-walk + Scott cold walk)

**Bucket A · Arc conversational texture** (from Jay's re-walk — how the arcs *talk*):
- *Stateless arcs* (recall + build on prior captures, never re-collect cold): W-23, W-35, W-37, W-39, W-40.
- *Honor-the-member / clear-handle* (don't railroad, fabricate, or leave no answerable handle): W-14, W-22, W-34, W-36, W-38.
- *Interpretive-label ceiling* (reflect words back, don't declare who they are): W-39, W-20 (Greg ratifies wording).
- W-38 resolved-in-design (single "ordinary day" reframe; Greg heads-up on his Window content).

**Bucket B · Onboarding capture-quality** (from Scott's cold walk — what the intake *stores*):
- W-42 🔴 reclaim shape check (member-stated WANT vs meta/exit/fragment) — CONFIRMED in the wild.
- W-43 🔴 identity_paragraph holding Door content / off-target composition.
- W-44 🔴 finalize too permissive (accepted a bail-out + a thin list; should offer resume, not commit).
- Shared root: the onboarding capture commits almost anything typed near the end. One shape-gate + a stricter completion
  contract closes W-42 + W-44 together; W-43 is a separate finalize-composition check. Pairs with the existing reclaim
  shape gate (Decision II / reclaim-shape.ts) and the resume gate (A-02).

_Bucket A = conversational design (needs Greg on posture/Window). Bucket B = capture engineering (testable: pure shape
fns + replay fixtures + pglite finalize asserts) — the more mechanically fixable of the two._

- **W-43 RETRACTED (false alarm).** Full identity_paragraph is well-composed: opens with Door context, LANDS on the
  identity ("The Catalyst is still there: the creator who comes alive when building toward something difficult…
  That's the identity you're here to reclaim"). Second-person agent voice = intended format. NOT a mis-capture — the
  earlier flag was a premature read of a truncated cell. No fix needed.
- **W-45 🔴 Gap accumulation BLOAT/REPETITION — progressive revealer's gap re-tells the same arc 3–4×** — Scott's stored
  intake_gap (~1500 words, shown on card + "Your full story") repeats the same beats multiple times ("responsibility
  replaced intention" 3×, "solved problems for teams" 3×, "marriage ended after eighteen years" 3×, "stopped choosing
  myself" 3×). The gap-accumulation appended each full re-telling instead of merging/replacing. _Data impact: YES —
  bloated, redundant stored narrative the member reads back._ _Fix (T2, Bucket B): the gap accumulation should MERGE or
  REPLACE-with-latest-full-composition, not blindly append re-compositions; dedupe recurring beats. Distinct from W-33
  (which fixed join PUNCTUATION, not bloat)._ **Open — Bucket B (onboarding capture-quality).**
- **W-33 mechanics CONFIRMED HOLDING** — Scott's full gap has clean sentences/periods, no run-ons. The fix works in the wild.

- **W-46 🔴 FIXED (deployed) — reclaim capture now SEEDS from the gap + a garbled prompt repaired** — Scott named his
  wants inside his gap ("lifting again, creating art, writing…") but the Reclaim List captured one item. ROOT (two parts):
  (1) the reclaim stage instruction was **garbled** — a bad edit crossed sentence fragments ("build on BREATHE…",
  "march. those, don't re-ask") → the model got incoherent guidance; (2) no directive to mine the gap for wants. _Fix:
  rewrote the reclaim instruction — repaired the garble + added SEED-FROM-THE-GAP-FIRST (surface the wants the gap already
  names, propose→confirm→add_reclaim_item, never start from zero). Exported `stageInstruction`; test
  `reclaim-gap-seeding.test.ts` locks the seeding + garble-gone + preserved tag/concrete/end-question rules. tsc + 647
  green._ _Bridges Bucket A (recall/build-from-prior) × Bucket B (capture)._ **Deployed — effect on live capture wants a
  persona re-walk eyeball (the garble repair is an unambiguous win regardless).** _Still open in Bucket B: W-42 (reclaim
  shape gate for junk/exit lines), W-44 (permissive finalize), W-45 (gap bloat/dedup)._

## Scott Runkel iPad review (2026-07-11)
- **W-47 🟡 No way OUT of a measurement instrument — no home/back affordance** — on the administered chat surfaces there's
  no "← Dashboard" and the logos aren't clickable home; W-32 (chips-only, text box gone) made the locked-in feel more
  acute. Scott: "no way out if you don't want to finish it in one sitting." _Two layers:_ **(a) W-47a quick win** — the
  logo is global (`app/layout.tsx`) but a plain `<img>`; wrap it in `<Link href="/">` (‘/’ redirects an authed member to
  their dashboard) → instant universal home button, one file. **(b) W-47b deeper** — leaving mid-instrument LOSES progress
  on Rewire/Rebuild/Reclaim arcs (only onboarding + Reconnect persist per-turn, W-15); true "finish later" = extend the
  `arc_session` persistence to those arcs (T3, DB). Instruments are short (~2-3 min) so the EXIT (a) matters more than
  mid-instrument resume (b). **Open — ship (a) now; (b) lower-priority follow-up.**
- **W-48 🟡 Progress "(question x of y)" not universal across instruments** — grinta baseline shows "n of 12"
  (onboarding-staged.ts:1098 progress cue) but it's inconsistent across IDQ/B1-B4/C1-C4. Scott: signal length on EVERY
  measurement instrument. _Fix (clean, single point): add item position to the `expects`/`ScaleExpectation` signal (W-24
  engine already emits it from one kernel spot; administeredStage knows itemCount + responses.length) and render "Question
  n of y" in the shared `ScaleChips` — covers ALL instruments at once._ **Open — quick win.**

- **W-47a 🟢 SHIPPED — logo is the home button.** `app/layout.tsx` brand-bar logo wrapped in `<Link href="/">` (‘/’
  redirects an authed member to their dashboard) → universal "way out" on every page/instrument. (W-47b per-turn resume
  for the administered arcs remains the deeper follow-up.)
- **W-48 🟢 SHIPPED — universal "Question n of y" on every instrument.** Added `index`/`total` (optional) to the
  `ScaleExpectation`; `administeredStage` carries `itemCount`; `scaleExpects(…, answered)` computes position; the shared
  `ScaleChips` renders the cue. Grinta's ad-hoc bubble "n of 12" removed (now single-sourced on the chips). IDQ (separate
  flow) computes it per-render from `responses.length` + `TOTAL_ITEMS`. Also set `expects` in `enterGrintaSurvey` (the
  sole grinta entry) — fixed a latent gap where a force-progressed member got the text box for item 1. tsc + 648 green.

## Bucket B build (2026-07-11) — onboarding capture-quality
- **W-42 🟢 BUILT+tested — reclaim SHAPE GATE.** `isProcessMetaOrAssent(text)` (pure, exported) rejects session-meta /
  exit lines (Scott's "that's the end can i continue later?"), bare assent/dissent, and agent-directed questions —
  gated at the TOP of `appendReclaim`, the single choke every add path funnels through (model tag, distill, late-add,
  AND the under-tag BACKSTOP that force-captures the member message — exactly how Scott's junk got in). Tightly scoped:
  behavior-change wants with an object ("stop drinking", "quit smoking") are KEPT. `tests/reclaim-shape-gate.test.ts`.
- **W-45 🟢 BUILT — gap concision + dedup.** `set_gap` instructed to compose the story ONCE (each part a single time,
  never re-tell — the gap GROWS with new parts, doesn't repeat the arc); + a deterministic exact-re-paste guard in
  `joinGapChapters` (drops a verbatim-duplicate chapter, keeps distinct ones). Test added. _The concision prompt's
  effect on model-composed bloat wants a re-walk eyeball; the dedup guard is deterministic._
- **W-44 🟢 substantially COVERED** — the permissive/thin finalize's data core is fixed by W-42 (junk no longer counts
  toward the floor) + W-46 (gap seeding surfaces more REAL wants). Remaining: an explicit "offer resume on a bail-out
  intent" affordance — a smaller optional follow-up (onboarding already persists + resumes). Not blocking.
- tsc + 653 green.

- **W-47a EXTENDED — universal "← Dashboard" back affordance (subpages + Sessions).** One global client component
  `app/components/back-to-dashboard.tsx` in the root layout (Suspense-wrapped for the IDQ's `?member=` query read):
  extracts the member UUID from the path (all `/[memberId]/…` routes) OR the query (IDQ), renders "← Dashboard" →
  `/dashboard/{id}` on every member page, and nothing on the dashboard itself / login / onboarding / admin. Verified in
  dev: present on a Session (reclaim C1 → correct dashboard href), absent on /login. tsc + 653 green. Covers every
  subpage + Session automatically (incl. future routes). **Shipped.**

## Identity tap-to-pick walk (2026-07-29, Jay) — COMPILING, fixes held
- **IDP-1 🎨 cosmetic — picker link-buttons unreadable on rollover.** The `.idp-own` ("None of these — I'll write my
  own") and `.idp-skip` ("Not sure yet — we'll find it later") link-styled buttons go dark-on-dark on `:hover`/`:active`:
  the GLOBAL `button:hover { background: var(--navy) }` (globals.css:106) paints them navy while their text stays
  teal/grey. Fix = give the two link-buttons a `:hover`/`:active` override (keep `background: none`, only shift color/
  underline) — same treatment `.pb-tools button` etc. already use. NOT YET FIXED (Jay compiling walk observations first).
- **IDP-2 ⛔ GOVERNANCE (serious) — false DECLINE of a real member.** The Athlete member gave a textbook
  Doors-accumulation fade (married → "didn't have the ultimate freedom anymore" → kids shifted priorities → work
  ramped up), yet the model fired `note_no_fade` → terminal Decision-E decline ("you're reaching forward… keep
  building"). Root cause: the decline guard `hasGenuineLoss(corpus)` (onboarding-intent.ts) keys ONLY on loss-VERB
  vocabulary (lost/divorce/died/burned out…) and does NOT consult the named Doors — so the CANONICAL slow
  Doors-accumulation fade (the program's most common case) reads as "no loss." Compounded by: (a) the last message
  "Bigger job, more hours" tripped AMBITION_RE ("bigger") reinforcing the false forward-ambition read; (b) the model
  over-eagerly tagged note_no_fade on upbeat phrasing. Also "too quick" — the decline fired the instant the member
  answered, without acknowledging it or reflecting the drawn-out story. Fix direction (later): decline gate must treat
  ≥1–2 named Doors in the corpus as a real-fade signal (use hasLossSignal, which includes matchDoors, not the
  vocab-only hasGenuineLoss) → engine overrides a wrong note_no_fade; never decline once Doors are in hand. This is the
  known [[staged-backstops-break-no-fade]] hole. NOT cosmetic — deploy before the cosmetic batch. NOT YET FIXED.
- **IDP-3 ⛔ DATA — summary card reachable with an EMPTY Reclaim List (+ no Grinta).** Same Athlete walk: after the
  IDP-2 false-decline detour, the flow recovered into a strong reflection AND reached the "Here's what you shared" card
  — but "YOUR COMEBACK — WHAT YOU WANT BACK" is EMPTY and there is no Grinta baseline block. The card must be
  UNREACHABLE without ≥RECLAIM_LIST_MIN (3) items + the Grinta survey; the reclaim builder + grinta stage were never
  run. Root suspect: the terminal `declined` off-ramp corrupts the stage flow so a later path lands on `complete`
  bypassing reclaim→grinta. Likely fixed as a side effect of IDP-2 (don't decline a real fade → the normal
  gap→reclaim→grinta path runs), but ADD a completion-contract guard: never render/commit the card unless the reclaim
  floor + grinta baseline are both satisfied (the deterministic completion contract should already gate this — verify
  the decline path can't slip past it). NOT YET FIXED.
