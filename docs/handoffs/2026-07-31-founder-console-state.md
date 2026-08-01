# Founder Console — where we stopped, 2026-07-31

Written at the end of the day so the morning starts from state, not from memory.
**Prod is at `0e41efd`.** Three ships today, all live, all behind `FOUNDER_CONSOLE=staged`.

---

## THE ONE THING TO DO FIRST

**Jay walks `/admin` on prod.** Everything below is verified locally or offline; the console is admin-gated,
so nothing after the CSS layer can be checked from outside. His walk is the missing half.

The question that matters most: **does "What moved" have content?**

The activity feed has been rendering empty since the console shipped — `activityFeed` selected `e.payload`,
a column `member_event` does not have, and a `catch` turned the throw into `[]`. That is now fixed and the
catch logs instead of lying. **If the feed is STILL empty with 12 Sessions closed, the fix was not the whole
story and the events are not landing** — a different and worse problem, and the first thing to chase. See
[[prod-telemetry-debugging]] for that playbook; the deploy/alias-staleness suspect is #1 there.

Also on that walk: the cohort tile should no longer contradict itself (it read "3 members · 4 Active"), and
Members will now read "3 · +2 demo" — deliberate, the two surfaces finally admitting they count different
populations.

---

## What shipped today

**1. The Founder Companion retrieves** (`295c6df`). Five read tools + a bounded tool loop, replacing a fixed
cohort brief that couldn't scale past a handful of members. Jay's framing: *"down the road to 100s and 1000s
of users, the quickest way to answers would be asking the Companion, not drilling through panels."*

**2. Real subpages** (`dbaa655`). `/admin/members · attention · activity · review · moderation · health ·
feedback`. Sections are defined ONCE in `app/admin/sections/` and rendered by both the long page and their own
route — `app/admin/page.tsx` went 366 → 69 lines. `?view=roster` still works; nothing became unreachable.

**3. One write + conversation memory** (`0e41efd`). `draft_message` into the review queue; the thread is now
actually sent to the model.

## The governance shape (the part to not re-litigate)

Jay's line: *"I don't want to pry into Member's info any more than I could see before, but make the Companion
knowledgeable about everything else I could ask."* That resolved into three properties, all enforced in code
rather than in the prompt, because a prompt rule is a wish:

- **Access parity.** Search tools return operational fields ONLY and physically cannot return a gap or a
  Reclaim List. `member_detail` — the one tool that returns a member's own words — requires naming the person,
  which is parity with opening their page. The test asserts the exact field set, so "let's make this more
  helpful" fails CI.
- **Caps, because a rule that holds sometimes is a tendency.** Max 2 members' private records per question
  (a live walk caught the model fanning `member_detail` across the whole cohort on one run and declining on
  the next). Max 1 draft per question — five messages from one sentence turns review into a rubber stamp.
- **Writes are enumerated, not pattern-matched.** `WRITE_TOOLS = ['draft_message']`. The morning's guard was
  "no tool name may look like a mutation"; that changed shape when the write landed, deliberately and in the
  open. The next tool that wants to write must add itself there on purpose. Nothing can send or approve.

## How to prove it again (both are repeatable, neither needs Jay)

```
node --experimental-strip-types scripts/founder-companion-walk.ts   # real model + tools + seeded DB
node --experimental-strip-types scripts/console-walk.ts             # every surface in a real browser
```

The Companion walk carries a **conversation**, not standalone questions — that is load-bearing, see below.
The console walk mints a local admin cookie from `ADMIN_PASSWORD` (never printed, never written) and asserts
each page's OWN content rendered, then follows every link out of the console to prove none is dead.

Last run: 1,022 offline tests · 9/9 surfaces · 7/7 links · no privacy crossings · 0 drafts sent.

---

## Open, ranked

1. **Jay's prod walk** — above. Blocks calling any of today's work done.
2. **Companion memory is per-page-load.** The thread is client state; a refresh is amnesia. The Member Agent
   persists its thread and this should too — same reason ([[ma-is-the-cornerstone]]: remember everything).
   Small, and the natural next slice.
3. **Inline data cards + saved prompts** in the Companion — in Jay's mockup, not built.
4. **CAT-54** — the identity pick beat can trap a member in a dead loop. Medium, written up, not fixed.
5. **Adjective identity handles** — 3/3 walks produced adjectives ("Untamed") not nouns ("the Swimmer"). The
   noun form is the intended voice; it is an OPEN item in the Cowork brief awaiting Jay.
6. **Cowork** — cut the glossary to v1.1 for the Beat retirement, and add `lib/founder/draft.ts` to the
   transcript sources (a gap found in the sync protocol: founder-drafted copy is member-facing and wasn't
   being captured).

## What today kept teaching

Four bugs, one shape: **a query written from memory with a wrong column, hidden by a swallowed catch.**
`payload` vs `ref`; `gap` vs `intake_gap`; `door_key` vs `door_slug`. Written up as
[[swallowed-read-renders-as-truth]] — no bare `catch { return [] }` on member-data reads, and tests must
assert rows EXIST rather than that nothing threw.

And three bugs in my own harnesses, which is its own lesson: `/pat/` matched "**pat**terns" and silently
skipped the most adversarial privacy probe; a dead-link check reused the failure counter and reported "all
reachable: NO" while printing no dead link; the Companion walk fired standalone questions, which is what
**hid the missing conversation memory for an entire build**. A harness that mislabels its own cases is worse
than no harness — and a harness that tests a surface which doesn't exist proves nothing at all.
