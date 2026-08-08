# The artifact destination — design proposal

**2026-08-07.** Follows `docs/greg-audit-epiphanies.md` (all 12 assets audited). Jay's steer:

> *"a mobile UI restriction led us down this design pattern, but that doesn't make it wrong. People are
> mobile-first. So I'm leaning toward 'the fix is a destination, not a panel'."*

**Proposal, not a build.** Nothing here is started.

---

## The principle

**The work a member does becomes an object they can return to.** Not a panel that fills beside a conversation —
a place they go.

That is not a concession to mobile. On a phone a side panel is a compromise at best; a destination is the
*native* shape. The single-column session was the right call and stays. What was lost was never the panel — it
was the persistence.

**Momentum already proves this.** You go to it, it is still there next week, it shows your own marks and no
verdict. Greg points at it repeatedly. It is the pattern; it just only exists for one of three tiers.

---

## Where it lives: the Playbook grows into the artifact home

Not a new destination. **The Playbook is already conceived as exactly this** and hasn't grown into the role — its
stated vision is *"not scrapbook/journal but roll-up + Loop roadmap: how did I handle this before? → run that
exercise again."* That is an artifact home described in different words.

What it holds today: `playbook_entry` rows with `section` (what_works · why_works · own_words · journal), a
`keeperType` (`principle` · `lights_you_up` · `recovery_move` · `plan` · `tell` · `definition`), pinning and
sharing. **The data is already typed by what the thing IS.** It is filed as prose and read as a scrapbook.

So the split becomes:

| Surface | Holds | Why separate |
| --- | --- | --- |
| **Momentum** | the LIVE tracked week — in flight, marked daily | a week in progress is a daily habit surface; it belongs one tap from the dashboard |
| **Playbook** | everything FINISHED — readings, tools, closed weeks | the thing you return to, organised by phase |

---

## Three renderings, not twelve screens

`CANVAS_FOR_TYPE` already names them. One surface, three card shapes, keyed off data we already store:

**L3 · a tracked week** → the log. Built. A closed week becomes a Playbook card carrying the review in the
member's own numbers (`buildReview` already produces exactly this).

**L2 · a tool** → the authored artifact. Mostly built, badly presented. W1's true lines, W2's image, W3's
protocol are already `playbook_entry` rows with the right `keeperType`. **The fix is presentation, not capture** —
a tool should read as a tool ("Your true lines — the answers you wrote to the lies"), grouped by function, with
the Loop affordance the Playbook vision already wants: *run this again*.

**L1 · a reading** → the governance-safe qualitative frame. **This is the tier with nothing**, and it is the one
that needs actual design work. See below.

---

## The hard part: showing a reading without it becoming a verdict

This is where we went wrong, and it is worth being precise so we do not repeat it in the other direction.

The rule stays: **never a bare number, never a verdict, never a rank.** What Greg asks for is not a score with a
softer label — it is a different object. His words: *"a development map."*

**B2 — the clearest case, and the one to build first.** We already compute three factor scores across getting
ready / taking action / staying consistent. The map is not those numbers. It is:
- the three groups, named, as terrain
- within each, the specific skills the member rated thin — **their own item responses, not a computed figure**
- phrased as where practice would go, never as a deficiency

No number appears. Nothing is ranked against anyone. The member sees *their own answers, organised* — which is
exactly what `artifact.ts` already calls a *"governance-safe qualitative frame."*

**B1 — needs the conversation first.** The autonomous/controlled/amotivation profile must not be shown (Greg is
explicit: no gauge, no progress bar, no motivation level). What CAN be shown is **the member's own stated
reasons** — which we do not currently capture, because B1 has no elicitation. So B1's reading card is blocked
behind the B1 conversational wrapper. That ordering is a finding, not an inconvenience: *the card is empty until
there is something of theirs to put in it.*

**The general rule this yields:** a reading card shows **what the member said, organised** — never what we
computed about them. The computation stays internal, feeding the Companion's interpretation. That satisfies
"visible" and "never a verdict" simultaneously, which is what we failed to do.

---

## The Companion's role, which Greg specifies twice

> *"the Companion connects lived experience to what is shown"* (B3, and again nearly verbatim in C3)

The card is not self-explanatory and should not try to be. The Companion is what makes it mean something —
which is also the answer to B1's "needed closure": the reading is not a paragraph at the end of a session, it is
an object the Companion can point at, later, when it is relevant.

This is already how keeper-recall works (`keeperType` → *"true line — a line they wrote to answer a specific
lie"*, served when the old voice resurfaces). **Extend the same mechanism to readings**, rather than inventing one.

---

## Build sequence — smallest first, each shippable alone

1. **B2's development map.** The only L1 reading whose data we already hold and whose display Greg has specified.
   Proves the reading rendering end to end. It also closes a live promise: our own copy says *"you'll come away
   with a map."*
2. **The Playbook's L2 presentation pass.** No new capture — group the existing keepers by function, make a tool
   read as a tool, add *run this again*. Highest value per hour, since the content is already there.
3. **Closed weeks into the Playbook.** `buildReview` already produces the review; give it a home so a finished
   week persists instead of scrolling away.
4. **B1's wrapper, then B1's card** — in that order, because the card has nothing to show until the conversation
   captures their reasons.
5. **C1/C2/C3 readings** once the pattern is proven on B2.

---

## Open questions for Jay

1. **Playbook as the home — agreed?** It fits its stated vision, but that vision is also unbuilt, so this merges
   two efforts. The alternative is a separate destination, which I do not recommend: two places for "your work"
   is how you end up with neither being the one people use.
2. **Does a finished week leave Momentum?** My instinct is Momentum shows the current week and the Playbook keeps
   the closed ones — otherwise Momentum becomes an archive and stops being a daily surface.
3. **Mobile shape.** A destination of stacked cards works on a phone. Worth a mock before building, given mobile
   is what redirected this design once already.
4. **Does this change what we tell Greg?** He has been asking for the grid, the map, the visible tracking. The
   honest answer to him is that his three Levels map to three artifact types, we finished one, and this is the
   plan for the other two. That is a better answer than twelve separate fixes.
