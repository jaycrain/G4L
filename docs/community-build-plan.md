# The Community build — plan for review

**Status:** DRAFT FOR JAY — **revision 2**, 2026-08-21 evening. Nothing here is built.
**Changed since r1:** the pact is no longer framed as the keystone (Jay's correction) · the Companion connection is now a
first-class slice (§8) · every slice has acceptance and an estimate (§6.2) · the current `/connect` page's fate is
stated (§6.3) · §6.1 folds in Proactive Outreach · a stitched quote in §1 is un-stitched.
**Input:** `~/g4l-handoffs/2026-08-21-Cowork-Community-rebuild-build-spec-for-CC.md` (Cowork with Jay)
**Clock:** Big Sugar, 17 October 2026 — about eight weeks.

---

## How to read this

The spec is the idea and the reasoning behind it. This is the build: what exists, what I'd make, in what
order, and what I think is wrong. **It is written to be disagreed with.** The sections that most need your eye
are §6 (what I'd cut), §7 (the data model calls) and §10 (decisions only you can make).

I have not written any code. That is deliberate — this plan exists so a wrong assumption costs half a day
instead of five weeks.

---

## 1 · What this is for

Jay, 2026-08-21 (two separate remarks, quoted apart because the first was nearly mis-read as the second):

> *"The Community has become a key feature in how the value of the G4L Program gets delivered and Members get
> desired outcomes from their Reclaim Lists."*

> *"If they win, I win. So that's the spirit, not building for the sake of building."*

The second is about **business alignment** — members succeed, the business succeeds — and not, as I first read
it, about pairing members with each other. Worth recording, because that misreading briefly produced a design.

So the organising question for every slice below is not *does the spec list it* but **does it make a member
more likely to get back something she said she wanted.** That is also our standing rule — every feature must
be known to the Companion and must move the member toward the Reclaim List, or we question why it exists.

Applied honestly, the Rooms do not score equally, and §6 says so.

---

## 2 · What already exists — the honest inventory

This matters more than usual, because **two of the primitives this build needs are already in the schema and
are completely dormant.** Neither was found by reading the spec; both were found by grepping.

### 2.1 `connect_pact` — built, read, known to the Companion, and impossible to create

`supabase/migrations/0035_connect.sql` defines `connect_pact` (`doer_id`, `partner_id`, `commitment`,
`reclaim_item_id`, `cadence`, `status`) and `connect_pact_checkin`. Downstream of it:

- `lib/connect/store.ts` reads pacts for the Community page
- `lib/connect/write.ts::checkInPact` records a check-in, wired to a real server action
- **`lib/connect/agent.ts` hands pacts to the Companion** — direction (`i_committed` / `holding`), the
  commitment, the other person's name, the linked Reclaim item, and last check-in

**The only `insert into connect_pact` in the entire repo is in `lib/connect/seed.ts`.** There is no UI, no
action, and no agent tool that creates one. So "Your Accountability — No commitments yet" is not an empty
state; it is a **permanent** state for every real member, and it has only ever shown content in seeded demo
accounts. Which is exactly why it looks fine when we look at it.

Same class as the failures of 2026-08-20: a surface that exists, reads correctly, is known to the Companion,
and has no write path. **One missing verb.**

### 2.2 `member_profile.membership_tier` — exists, constrained, referenced nowhere

```sql
membership_tier text not null default 'foundation'
  check (membership_tier in ('foundation','work','direct')),
```

From the original 0001 schema. **Zero references anywhere in `lib/`, `app/` or `scripts/`.** Nothing reads
it, nothing writes it, nothing branches on it. The Companion's system prompt does mention a "Direct tier"
(`Coaching questions: route to the Direct tier if the member is on it`) — so the *concept* has been quietly
live in the model's instructions while the *data* has never been populated.

This is a trap, not a gift. See §7.1.

### 2.3 What is genuinely built and working

- **Posts / topics** — `connect_post`, where a topic *is* a post that carries a `title`. It already has
  `reclaim_item_id` (tie a post to a Reclaim item) and an IDQ `category`.
- **`connect_post.group_id`** — nullable, indexed, `null` everywhere, commented *"Phase 1.5 groups."*
  The door was left open for exactly this build.
- **Replies, reactions, reports, blocks** — the moderation spine, including `reuse detectCrisis` on every
  post, reply and room message.
- **Live rooms** — `lib/connect/rooms.ts`, persisted messages, crisis-routed, realtime shipped in Phase 2b.
- **`ConnectPanel`** on the dashboard's right flank, second in the act column.
- **`getConnectSummaryForAgent` / `postSessionNudge`** — the Companion's existing, thin, connection to it.

### 2.4 What does not exist at all

**No billing.** Zero references to Stripe anywhere in the repo. Payments are a stack decision on paper and
nothing more. §10.3.

---

## 3 · The shape of the build

**Two things are load-bearing. A third is the mechanism this plan is most interested in, and it is not a
dependency of the others.**

1. **Entitlement** — who may see what. A security boundary, and genuinely first: nothing else can be built
   honestly on top of a fake one.
2. **Groups** — a bounded set of members who share a surface. Rooms are groups; a pact topic is a group of two.
3. **The Companion's connection to it** — the thing that turns a subpage into a delivery mechanism (§8).
4. **The pact verb** — a member making a commitment and naming who holds her to it (§9).

An earlier draft of this section said everything in the spec sat on top of these. **That was wrong, and Jay
said so:** *"I'm not sure the whole spec rests on it, because there are other features in Community independent
of it."* Topics, the Rooms shell, the Live Room and the story layer are all independent of the pact and of each
other. Only the entitlement and group layers are true prerequisites — and the reason to name that precisely is
that a plan which treats one mechanism as the keystone gets sequenced as though everything waits on it.

The spec's visible parts (three-column nav, Library, Live Room, What's-New) sit on top of 1 and 2, and all of
them demo well while the layer underneath is fake. **That is the sequencing risk**, and it is the argument for
building the invisible thing first.

---

## 4 · Entitlement — the security boundary

### 4.1 Access is SOURCED, not held

The most useful thing to come out of the competitor research. Circle separates *why* a member has access
from *whether* they have it: a member can hold the same space via an **invite** (granted, persistent) and via
a **paywall** (subscription-derived, revocable). Cancelling the subscription strips the paywall source and
leaves the invite intact.

**This answers "is Charter a tier or a flag" better than either option.** Charter is an *invite source*. Tier
is a *paywall source*. A comped Charter member holds Advisory rooms by invite; if she later pays she holds
them twice; if she stops paying she keeps what Charter gave her. No `isCharter` branching threaded through
every check.

    member_entitlement
      member_id     uuid    → member_profile
      room_key      text            -- or group_id; see §7.2
      source        text    check (source in ('tier','charter','invite','trial'))
      granted_at    timestamptz
      revoked_at    timestamptz     -- soft; never delete, so we can answer "why did she lose this?"
      primary key (member_id, room_key, source)

`canAccess(member, room) = any row with revoked_at is null`. One question, one index.

### 4.2 What it must do when things go wrong

The failure modes are the design, not the edge cases. From the research:

- **Circle delegates the grace period to Stripe's retry schedule** and I could not verify that it tells the
  member anything during dunning. "Your card failed — are you still a member?" is the most trust-sensitive
  moment in the lifecycle and they outsourced it. **We own it.**
- **Mighty Networks silently archives content** built with higher-tier features on downgrade. Hosts read it
  as data loss and their own support bot did not know it happened. **Nothing we do on downgrade may be
  silent or irreversible.**

Rules I would hold to:

1. **Losing access never destroys content.** A member who lapses loses the room, not her posts. Restoring the
   source restores the view.
2. **Every revocation is explained, in the member's own surface**, not only in an email.
3. **Revocation is soft and dated**, so "why can't I see this?" is answerable from the data.

### 4.3 How it gets tested

Adversarially, red first, before the UI exists:

- a free member hitting an Advisory room **by direct URL**
- the same, hitting the **server action** directly with a valid session
- a member whose tier was downgraded **mid-session** (stale render, live action)
- a Charter member whose *tier* lapsed — must **keep** charter-sourced rooms
- a member removed from a group — must lose the group's topics **from the global feed too** (§7.2)
- a member who never had access, guessing a `group_id`

This is the one area where I want the tests to be hostile rather than confirmatory. My measurement error rate
on 2026-08-20 was roughly seven in a day, and on access control a wrong probe means I *believe* gating works.

---

## 5 · Groups, and the leak they introduce

`connect_post.group_id` is nullable and **null in every row**. Nothing filters on it. The moment groups
exist, **every existing feed query becomes a potential leak** — any query that forgets the filter shows
private group topics in the global feed.

Mitigation, in order of strength:

1. **One reader.** All post reads go through a single function that takes the viewer and applies the group
   filter. No ad-hoc `select … from connect_post` anywhere else.
2. **A test that greps for direct queries** outside that module and fails — the same shape as the crisis-seam
   guard that already exists (`tests/crisis-escalation.test.ts` enumerates surfaces and fails on a new one).
3. **RLS** as the backstop, not the primary control.

`connect_post.group_id` is not `not null`-able, so the failure is silent by construction: a forgotten filter
returns *more* rows, never an error. That is the whole risk in one sentence.

---

## 6 · What I would cut from Day 1, and why

The spec's §13 lists as must-have: tier + Charter entitlement · Rooms nav + three-column layout · Topics,
Cohort, Ride · **the Live Room with RTC and recording→Library** · the Library · Welcome/orient + Movement
story pages · the Dashboard What's-New spotlight.

Against eight weeks, with no billing in the repo and entitlement unbuilt, that does not fit. What I would
ship on 17 October — **and there is a rendered mockup of exactly this cut**, shared in conversation on
2026-08-21, showing the three-column Rooms shell with the Live Room as an RSVP + join link and the deferred
Rooms greyed rather than hidden:

| Ships | Deferred | Why |
|---|---|---|
| Entitlement (tier + Charter sources) | Billing/Stripe | Entitlement can be set by hand for a comped Charter cohort. Billing is a separate, dangerous build. |
| Rooms nav + three columns | — | The shell is cheap and it is what makes it feel real. |
| Topics · The Cohort · The Ride | — | Discussion is the substance. |
| **Live Room as a scheduled room + join link** | Embedded RTC, auto-recording | **The single biggest cut.** The value is the call happening and members knowing about it. Embedding it is ~90% of the risk for ~10% of the experience, and it is reversible — the room exists, a provider drops in later. |
| The pact verb + joint topic (§9) | — | The mechanism the whole thesis rests on, and it is one missing verb. |
| Dashboard signal (conditional, §6.1) | — | Cheap, and it is what makes a member walk in. |
| Welcome/orient page | Movement/story, steward kit | Orientation is needed Day 1. The story layer is a copy project, not a build one, and it is downstream of the messaging work Jay has in flight. |
| — | Library as a course | Deferred on merit, not just time — see below. |
| — | Book Time (1:1) | No 1:1 tier members exist yet. |
| — | Seasons as a first-class object | Season one is hardcoded. **See §10.4 — this shortcut has a real expiry.** |

**The Library is the one I would question on merit.** As a course it is *information*, and information is the
thing this program is least short of. It earns its place if it answers "I am stuck on this specific item"
and does not if it is a shelf. I would rather ship nothing than ship a shelf, and add it when we know what
members actually get stuck on — which we will know by December.

### 6.1 The Dashboard signal — conditional, not a treatment

Community is already **second** in the dashboard's right-hand "What's Next" column (Jay moved it there on
2026-07-27). The spec asks for a prominent accented panel.

The examples it gives — *"🔴 Live call Thursday 5:00 — RSVP"*, *"Jay replied to your post"* — are **time-bound
events**. Everything else in that column is ambient state, true all week. A permanently accented flank panel
un-centres the Companion, which is the triptych's one load-bearing decision.

So: **accent only when something is time-bound and unhandled.** Silent otherwise, which is most days. The
accent keeps meaning something; it does not compete with the Companion when there is nothing on.

And the ranking must be a **deterministic ladder with a test** — live call today > direct reply > unread
posts — not a judgement. Every ranking problem in this product has failed the same way.

**It may not be a new panel at all.** The spec itself says this "ties into the existing 'For you' notifications
and nudge system" — and **Proactive Outreach is already built, dark behind `OUTREACH`**. If that is the right
home, this stops being a dashboard change and becomes the notification rail finally having something worth
saying, which is a materially smaller build and does not touch the triptych's hierarchy at all. I would look
there before drawing a new panel.

### 6.2 · Slices, acceptance, and what each one costs

An earlier draft asked Jay to define acceptance per slice and then supplied none — blank work handed over and
called a process. **These are proposals to correct, not questions to answer.** Same for the estimates: without
them, the Day-1 table above is a list of things I would *like* to fit rather than a claim anyone can check.

Estimates are calendar-days of my working time, and they are the least reliable numbers in this document —
see §12.

| # | Slice | Done when… | Est. |
|---|---|---|---|
| **1** | **Entitlement** | A free member cannot reach an Advisory room by URL, by server action, on a stale session, or after a downgrade — each proven by a test that failed first. A Charter member whose tier lapses keeps her charter-sourced rooms. | **6–8d** |
| **2** | **Groups + the one reader** | Every read of `connect_post` goes through a single viewer-aware function, a test fails if a direct query appears anywhere else, and a member removed from a group loses its topics from the global feed too. | **4–5d** |
| **3** | **Rooms shell** | The three-column layout renders, each Room has its own URL, locked Rooms show as locked rather than vanishing, and it works at mobile width. | **4–5d** |
| **4** | **Topics · Cohort · Ride** | A member can post, reply and react inside a Room she is entitled to; moderation and crisis routing behave exactly as on the global feed. | **3–4d** |
| **5** | **The pact verb + joint topic** | A member can commit from the Companion or the Community, the joint topic is created and visible to exactly two people, and "Your Accountability" shows a real row for a real member for the first time. | **4–5d** |
| **6** | **Companion connection** (§8) | The Companion can name a Room she has access to and never one she doesn't, and can propose a pact grounded in a Reclaim item. Nothing crosses between two members — proven by test. | **3–4d** |
| **7** | **Live Room as scheduled + link** | A call has a time, an RSVP and a join link; the dashboard says so when it's today. | **2d** |
| **8** | **Dashboard signal** | Accents only when something is time-bound and unhandled; the ranking is deterministic and tested. | **2–3d** |
| **9** | **Welcome / orient** | A member landing on Community for the first time is told what it is and what to do. | **2d** |

**Total: 30–38 working days.** Against eight weeks that is 40 working days, so it fits **only if nothing goes
wrong**, and something always does. Slices 1 and 2 are the ones I would protect; 7, 8 and 9 are the ones I
would cut further if the first two run long — which is the right order, because they are the cheapest to add
back after launch.

**Slice 1 is also the calibration.** If entitlement takes twelve days instead of seven, we know in week two
that the rest of this plan is wrong, and we still have six weeks to change it.

### 6.3 · What happens to the current Community while this is built

`/connect` is live and members use it. The build runs **behind a `COMMUNITY` flag on a branch**, so the current
page stays exactly as it is until we flip. The existing Topics feed, cheers, reports and blocks are kept, not
rebuilt — this is an extension, as the spec says. **No member loses a surface mid-build**, and the flip is
reversible by removing the flag, the same as `REDESIGN` and `DASH_TRIPTYCH`.

---

## 7 · Data model — the three calls I would make

### 7.1 Do NOT reuse `membership_tier`

It exists, it is constrained to `foundation | work | direct`, and the spec's tiers are *Start looking / The
Program / Advisory / 1:1*. The names do not match, the semantics do not match, and the CHECK constraint would
reject the new values.

More importantly: **an unused column with a stale constraint is not a head start, it is a trap.** Anyone
reading the schema will assume it is live. I would either migrate it to the new vocabulary with a comment
recording what it used to mean, or leave it and add a new column and mark the old one dead. **My preference
is to migrate it** — one truth, no ambiguity — but it needs a decision because the Companion's prompt still
says "the Direct tier."

### 7.2 Rooms as data, not as routes

Each Room should be a row (`key`, `title`, `type`, `access_group`) rather than a hardcoded route. Two reasons:
seeding a season's rooms becomes data, and the entitlement check has something to point at. The spec wants
each Room deep-linkable at its own URL — that still works; the URL resolves through the row.

### 7.3 The pact topic is a group of two

Jay, 2026-08-21: *"Just create a joint 'topic' for them with the Reclaim List item as the title. Only they
see it."*

That is a `connect_post` with a `title` (her Reclaim item text), a populated `reclaim_item_id`, and a
`group_id` pointing at a two-member group. It needs **no new post concept** — topics already are posts with
titles, and `reclaim_item_id` already exists and is unused.

The `connect_pact` row still holds the commitment, the cadence and the check-ins. The topic is where the two
of them talk. **Both surfaces, one shared object.**

---

## 8 · The Companion's connection — first-class, not a fast-follow

I told Jay I would write this in as a real slice rather than a nice-to-have, and the first draft did not. This
is the correction.

**Today the connection is one summary and one nudge.** `getConnectSummaryForAgent` hands the Companion a thin
read; `postSessionNudge` produces one line after a Session. That is all.

**Why it should be more than that.** Every platform we researched fails the same way at the same place: none of
them can tell a member where to go. Circle's documented answer to wayfinding is an operator-authored "Start
Here" space; its sidebar grows with the operator's content ambitions and tells the member nothing. Mighty
Networks ships a browsable directory and calls it matchmaking. Their nav is a filing cabinet.

**We have the one thing a filing cabinet cannot be.** The Companion knows her Reclaim List, her Doors, which
dimension is weakest, where she has stalled, and what she committed to. That is the difference between a
subpage a member visits and a mechanism that moves her list — and it is the direct answer to the organising
question in §1.

**What I would build, smallest useful version:**

1. **The Companion can see the Rooms she has access to, and what is live in them** — entitlement-aware, so it
   never points at a locked door. Reuses §4's `canAccess`; no new knowledge.
2. **It can make a grounded introduction to a conversation** — not "check out the Community", but naming the
   thing she said she wanted and the thread where it is being worked on. Cites its basis, like every other
   recommendation it makes.
3. **It can propose a pact** (§9), which it is already the natural place for: it knows the list, and the
   commitment is one sentence long.

**What it must NOT do**, and this is the boundary from §9 restated because it lives here: it may not carry
anything from one member's conversation into another's. Not a name, not a paraphrase, not "someone else is
working on that too" if the someone is identifiable. The pact and its topic are the only shared object.

**Deliberately not in scope:** matching, ranking members, or suggesting people. Every platform that tried it
built a directory and called it more. We are not better placed to do that, and it is not what moves a list.

---

## 9 · The pact — the missing verb

The whole of §2.1 reduces to: a member cannot make a commitment. Everything else is built.

**What I would add:**

1. **A way to make one.** Both a Community affordance and a Companion tool — the Companion already knows the
   Reclaim List and is the natural place to say "I'll walk four mornings this week." It must be
   propose → confirm, like every other thing that touches member data.
2. **The joint topic**, per §7.3, created with the pact.
3. **Nothing else.** No bespoke card, no notification model, no "nudge" button. It is a topic; it behaves
   like every other topic; it appears for both because both are in the group.

**The privacy boundary, which is a rule and not a judgement:**

> **The pact and its topic are the ONLY shared object. Nothing else crosses between two members** — not
> conversations, not Doors, not the ID Score, not the rest of the Reclaim List, and nothing the Companion
> knows. The Companion must never carry information from one member's conversation into another's.

That last clause is the same class of rule as never naming a real person, and should be enforced the same
way: a test, not an instruction.

**Partner is suggested, never required** (Jay, 2026-08-21). A member with no partner uses the Community as
the neutral place to share voluntarily. Nothing in the design may make a partnerless member feel lesser —
which specifically means no "you have no partner" empty state framed as a deficiency.

**What I do not know:** whether the partner should be notified, and how. The lightest thing that still means
someone noticed. §10.5.

---

## 10 · Decisions only you can make

Each has my recommendation and a default, so silence is a real answer.

**10.1 · Tier vocabulary and the dead column.** Migrate `membership_tier` to the new names, or leave it dead
and add a new one? The Companion's prompt references "the Direct tier" either way and needs updating.
*Recommend: migrate, one truth. **Default: I migrate it.***

**10.2 · Does a lapsed member lose the room or the content?** I propose: loses the view, keeps the content,
restoring the source restores the view. *Recommend as stated. **Default: I build it that way.***

**10.3 · Billing.** Not in the repo at all. For a comped Charter cohort we do not need it in October. But
"Advisory ~$500/mo" implies real payments, and that is a build with money and PCI in it. *Recommend: hand-set
entitlement for Charter, defer Stripe to November, and treat it as its own plan. **Default: I defer it and
raise it separately.*** **This is the one I would most like you to confirm rather than default.**

**10.4 · Seasons.** I want to hardcode season one. That is wrong if a second cohort starts before spring —
retrofitting a season object after real data exists is materially harder. *Needs your read on the cohort
calendar; I cannot infer it.*

**10.5 · What does the partner get when a pact is made?** A notification, a name on a card, or only the topic
appearing on their page? *Recommend: the topic appears, plus one notification at creation and none after —
the thread carries it from there. **Default: I build that.***

**10.6 · "Rooms" is confirmed canon** (Jay, 2026-08-21: *"Correct, Rooms is a new term for a new feature"*).
Recorded here so it reaches the next Cowork bundle as a naming decision.

---

## 11 · How I would work this, which is different from this week

This week was repair: a member reported something, I fixed it, pushed to `main`, verified live, repeated —
eight pushes in one day, several into the live conversational engine while a member was inside it. That mode
worked because the loop was minutes long and reality corrected me fast. It is the wrong mode for an
eight-week build with a launch date and no external corrector.

1. **A branch behind a flag** (`COMMUNITY`), not push-to-main. We have the pattern — `REDESIGN`,
   `DASH_TRIPTYCH`.
2. **Acceptance defined per slice, by Jay, in advance** — one sentence each, agreed before I start it.
3. **Entitlement tested adversarially** (§4.3), red first.
4. **A real walk at the halfway point**, not a demo of finished parts at the end.
5. **Fewer, larger checkpoints.** This week Jay made a decision every few minutes; that is right for triage
   and wrong for this.

**And the parts that are not mine.** RTC provider selection has cost and operational consequences I cannot
evaluate. Billing touches money and PCI. Both want a human decision and possibly a specialist, and I would
rather say so here than quietly pick.

---

## 12 · What I am most likely to have got wrong

- **The estimates in §6.2.** These are the least reliable numbers here. I have not built entitlement in this
  codebase, and 30–38 days against 40 available is not margin, it is a coin-flip that assumes nothing goes
  wrong. Slice 1 is the honest calibration and it should be read as a measurement, not a milestone.
- **That the Library is a shelf.** If you and Greg have a specific stuck-point it answers, I am wrong.
- **The Companion's role.** I keep reaching for it as the connective tissue. That is either the insight of
  this build or my bias, and I cannot tell which from inside.
