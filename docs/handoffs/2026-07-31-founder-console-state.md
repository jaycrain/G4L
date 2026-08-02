# Founder Console — where we stopped, 2026-07-31

Written at the end of the day so the morning starts from state, not from memory.
**Prod is at `a5f51fc`.** Five ships today, all live, all behind `FOUNDER_CONSOLE=staged`.

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

**4. The member table is back on `/admin`** (`3546c6e`). Jay, last thing tonight: *"I need to see the detail I
could see before on the Member panel."* Moving the roster behind a click was a real loss — the console answers
"who needs me", but he also just wants to SEE everyone. Full table below the triptych, same component
`/admin/members` renders (MembersSection was split into tiles + `MembersTable`). Deliberately WITHOUT the six
summary tiles: under the Cohort panel they'd disagree with it about the cohort size. **Placement is provisional
and he knows it** — "even if we ultimately redesign where it lives".

**5. The console is LIVE** (`a5f51fc`). Jay: *"And it's live and self-refreshes."* It wasn't — `AdminAutoRefresh`
was mounted only on the long `?view=roster` page, so the console and every new subpage never ticked. Second,
quieter consequence: that component is what calls `renewAdminSessionAction`, so **the sliding admin session was
never sliding on the console**. Both fixed. The browser walk now types into the Companion, forces a tick, and
asserts the text survives — `router.refresh()` is *documented* to preserve client state, but eating a
half-written question mid-sentence would be worse than a stale panel, so it is checked rather than assumed.

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

Last run: 1,022 offline tests · 9/9 surfaces · 9/9 links · thread survives the refresh tick · no privacy crossings · 0 drafts sent.

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

---

## Deferred — the "real" fixes behind the 2026-08-02 cheap ones

Two Companion behaviours Jay caught by eye in a live thread. The cheap halves shipped that day and are proven
in `scripts/founder-companion-walk.ts`; these are what they defer.

### 1. Checkpoint proximity — a tool that does not exist

**Shipped:** the model now says it cannot see distance-to-a-gate, answers the neighbouring question, and names
the substitution. Verified live.

**Deferred:** there is still no way to answer *"who is closest to a Checkpoint?"* — the concept is absent from
the tool surface entirely (`cohort_stats`, `find_members`, `member_detail`, `recent_activity`,
`operations_status`).

**Blocked on a definition, not on engineering.** "Closest" could mean steps remaining in the current Session,
Sessions remaining before the gate, or time-since-last-move against a typical pace. Those rank people
differently and only one of them is what Jay means by "who should I encourage today". That is a Greg + Jay
call, and it is the same question the Loop work needs answered — worth deciding once.

### 2. Naming — the prompt half holds, the structural half is partial

**Shipped:** a prompt rule (answers about a member name them) plus `memberIdentityCard` — `member_detail` now
emits a card carrying name/phase/last-active, built from the tool RESULT rather than from the model's prose.
Operational fields only; their own words stay in prose under the existing governance.

**Deferred / worth watching:** the card guarantees the name is on SCREEN. It does not guarantee the name is in
the THREAD TEXT, which is what a later turn ("draft him a note") actually binds against — cards are not
replayed into the model's context. So the pronoun-binding risk is reduced, not closed. The live walk shows the
model asking who Jay means when a referent is ambiguous, which is the behaviour we want; if that ever drifts,
the durable fix is to include the resolved member name in the persisted turn record, not to write a firmer
prompt rule.
