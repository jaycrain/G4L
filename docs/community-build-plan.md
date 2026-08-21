# The Community build — plan for review

**Status:** DRAFT FOR JAY. Nothing here is built. **2026-08-21.**
**Input:** `~/g4l-handoffs/2026-08-21-Cowork-Community-rebuild-build-spec-for-CC.md` (Cowork with Jay)
**Clock:** Big Sugar, 17 October 2026 — about eight weeks.

---

## How to read this

The spec is the idea and the reasoning behind it. This is the build: what exists, what I'd make, in what
order, and what I think is wrong. **It is written to be disagreed with.** The sections that most need your eye
are §6 (what I'd cut), §7 (the data model calls) and §9 (decisions only you can make).

I have not written any code. That is deliberate — this plan exists so a wrong assumption costs half a day
instead of five weeks.

---

## 1 · What this is for

Jay, 2026-08-21:

> *"The Community has become a key feature in how the value of the G4L Program gets delivered and Members get
> desired outcomes from their Reclaim Lists. So, if they win, I win. So that's the spirit, not building for the
> sake of building."*

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
nothing more. §9.3.

---

## 3 · The shape of the build

Three things, in dependency order. Everything in the spec sits on top of one of them.

1. **Entitlement** — who may see what. A security boundary. Nothing else can be built honestly first.
2. **Groups** — a bounded set of members who share a surface. Rooms are groups; a pact topic is a group of two.
3. **The verb** — a member making a commitment and naming who holds her to it.

The spec's visible parts (three-column nav, Library, Live Room, What's-New) are all downstream of these, and
all of them demo well while the layer underneath is fake. That is the sequencing risk.

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
ship on 17 October:

| Ships | Deferred | Why |
|---|---|---|
| Entitlement (tier + Charter sources) | Billing/Stripe | Entitlement can be set by hand for a comped Charter cohort. Billing is a separate, dangerous build. |
| Rooms nav + three columns | — | The shell is cheap and it is what makes it feel real. |
| Topics · The Cohort · The Ride | — | Discussion is the substance. |
| **Live Room as a scheduled room + join link** | Embedded RTC, auto-recording | **The single biggest cut.** The value is the call happening and members knowing about it. Embedding it is ~90% of the risk for ~10% of the experience, and it is reversible — the room exists, a provider drops in later. |
| The pact verb + joint topic (§8) | — | The mechanism the whole thesis rests on, and it is one missing verb. |
| Dashboard signal (conditional, §6.1) | — | Cheap, and it is what makes a member walk in. |
| Welcome/orient page | Movement/story, steward kit | Orientation is needed Day 1. The story layer is a copy project, not a build one, and it is downstream of the messaging work Jay has in flight. |
| — | Library as a course | Deferred on merit, not just time — see below. |
| — | Book Time (1:1) | No 1:1 tier members exist yet. |
| — | Seasons as a first-class object | Season one is hardcoded. **See §9.4 — this shortcut has a real expiry.** |

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

## 8 · The pact — the missing verb

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
someone noticed. §9.5.

---

## 9 · Decisions only you can make

Each has my recommendation and a default, so silence is a real answer.

**9.1 · Tier vocabulary and the dead column.** Migrate `membership_tier` to the new names, or leave it dead
and add a new one? The Companion's prompt references "the Direct tier" either way and needs updating.
*Recommend: migrate, one truth. **Default: I migrate it.***

**9.2 · Does a lapsed member lose the room or the content?** I propose: loses the view, keeps the content,
restoring the source restores the view. *Recommend as stated. **Default: I build it that way.***

**9.3 · Billing.** Not in the repo at all. For a comped Charter cohort we do not need it in October. But
"Advisory ~$500/mo" implies real payments, and that is a build with money and PCI in it. *Recommend: hand-set
entitlement for Charter, defer Stripe to November, and treat it as its own plan. **Default: I defer it and
raise it separately.*** **This is the one I would most like you to confirm rather than default.**

**9.4 · Seasons.** I want to hardcode season one. That is wrong if a second cohort starts before spring —
retrofitting a season object after real data exists is materially harder. *Needs your read on the cohort
calendar; I cannot infer it.*

**9.5 · What does the partner get when a pact is made?** A notification, a name on a card, or only the topic
appearing on their page? *Recommend: the topic appears, plus one notification at creation and none after —
the thread carries it from there. **Default: I build that.***

**9.6 · "Rooms" is confirmed canon** (Jay, 2026-08-21: *"Correct, Rooms is a new term for a new feature"*).
Recorded here so it reaches the next Cowork bundle as a naming decision.

---

## 10 · How I would work this, which is different from this week

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

## 11 · What I am most likely to have got wrong

- **The eight-week estimate.** I have never built this and my cut may still be too big. The first slice
  (entitlement) will tell us, and it is the right first slice partly *because* it is the honest calibration.
- **That the Library is a shelf.** If you and Greg have a specific stuck-point it answers, I am wrong.
- **The Companion's role.** I keep reaching for it as the connective tissue. That is either the insight of
  this build or my bias, and I cannot tell which from inside.
