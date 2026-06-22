# Connect — design (Phase 1, async-first)

Status: **draft for review** (Jay + a senior-engineer pass on the data model / RLS / safety).
Owner: Jay. Supersedes the CLAUDE.md "Community: Circle" decision — Connect is built **native** on
our own stack (Supabase + Next). Circle is dropped (we don't need its full feature set, its
organization/UI, or its cost).

## What Connect is

The community feature. Members reach out to **other humans** — share wins and setbacks, inspire each
other, and hold each other accountable (while asking the same of them). The name plays off the 4Rs:
**Reconnect** (with yourself) → **Connect** (with others). It launches from a Dashboard panel into a
subpage.

This is the Member Agent's north star made into a place: the agent's quiet job is to **bridge members
toward real people, never to replace them.** Connect is where that bridge lands.

## Scope

- **Phase 1 (this doc):** async only — Share, Topics + replies, reactions, Your accountability, the
  safety model, and Member Agent wiring.
- **Phase 2 (later):** **Live now** — real-time presence + live rooms via **Supabase Realtime**
  (presence/broadcast; no new infrastructure). Held in the UI as a "coming soon" placeholder in
  Phase 1 so the layout already reserves its slot.
- **Phase 1.5 (planned next):** **member-created groups** — a member can branch off the global feed
  to start a focused group around a **practice or interest** (e.g. a Rewire group for *compassion
  meditation*), optionally tagged to an R and/or Door. Groups can grow out of a program asset/Beat the
  member just did — a hook the Companion can surface ("you've been doing the compassion practice —
  there's a group for it"). Anticipated in the data model now (a nullable `group_id`) so we don't have
  to refactor. Adds membership + per-group visibility + per-group moderation — see open questions.
- **Out of scope for v1 (deliberate, to keep the safety surface small):** 1:1 DMs, admin-predefined
  channels (one global feed + tags to begin), media uploads.

Structure decision: **one global feed + tags** to begin (avoids ghost-town empty channels at charter
scale); member-created groups follow in Phase 1.5.

## Layout

Subpage, top to bottom: **Share something** composer → **Live now** (Phase 2 placeholder) →
**Topics** (trending async threads + replies) → **Your accountability** (a commitment you made + one
asked of you). The launching **Dashboard panel** mirrors it: a live count (Phase 2), the top 1–2
topics, any pending accountability nudge, and a `Connect →` foot link (the `.see-more` "Label →"
convention, per `docs/dashboard-ui-standards.md`). Real build uses Barlow + the G4L palette.

## Data model (Supabase Postgres)

Built in migration `0035_connect.sql` (Phase 1). Isolation follows the app-wide model (migration
0013): **RLS enabled, no policies** — the owner connection bypasses RLS and `authorizeMember` enforces
access in app code. Per architecture principle 3, multi-tenant `org` columns are added **app-wide at
switch-on under senior review**, not bolted onto Connect alone, so the v1 tables carry no `org_id`
(consistent with the rest of the schema).

- `connect_post` — `id, author_id, group_id?, title?, body, reclaim_item_id?, category?, show_name, status, created_at, last_activity_at`
  - `reclaim_item_id` ties a post to a Reclaim List item; `category` is an optional IDQ-dimension / Door tag.
  - `group_id` is null in v1 (global feed); reserved for Phase 1.5 member-created groups.
  - `show_name` captures the author's reveal choice for *this* post (forward / retroactive / reversible).
  - `status`: `visible | hidden | removed` (moderation).
- `connect_reply` — `id, post_id, author_id, body, show_name, status, created_at`
- `connect_reaction` — `id, target_kind ('post'|'reply'), target_id, member_id, kind, created_at` (the "inspire / cheer" signal; unique per member+target+kind)
- `connect_pact` — `id, doer_id, partner_id, commitment, reclaim_item_id?, cadence?, status ('active'|'kept'|'ended'), created_at`
  - models both directions the member sees: a commitment they made (`doer_id = me`) and one they hold for someone else (`partner_id = me`).
- `connect_pact_checkin` — `id, pact_id, member_id, note, created_at`
- `connect_report` — `id, reporter_id, subject_kind ('post'|'reply'|'member'), subject_id, reason, concern_for_safety bool, status ('open'|'reviewed'|'actioned'), reviewed_by?, reviewed_at?, created_at`
- `connect_block` — `member_id, blocked_member_id, created_at` (pk on the pair)
- `connect_profile` — `member_id, handle, reveal_default, created_at, updated_at`
  - the member's Connect identity. `reveal_default` seeds new posts; per-post reveal lives on
    `connect_post.show_name` / `connect_reply.show_name`, so a real-name reveal can be forward,
    retroactive, or reversed. The platform **always** maps `handle → member_id` (pseudonymous to
    peers, identified to the platform — moderation + crisis routing intact).

(Presence / live-room tables are Phase 2.)

## Visibility & RLS

- One global community per tenant in v1.
- **Reads:** authenticated members in the same `org_id` see `status='visible'` content; authors
  always see their own (including hidden); admins see all.
- **Writes:** `author_id` / `member_id` must equal the caller's member id — enforced app-layer
  (`authorizeMember` / admin override) **and** by RLS, same Path-B model as the rest of the app.
- **Blocks:** a blocked member's content is filtered from the blocker's views (and vice-versa).
- The data model + RLS policies want a **senior-engineer review** before code — this is privacy-critical.

## Trust & safety (v1, not a later add-on)

Dropping Circle means we own what it was quietly handling. Required in Phase 1:

- **Report** any post/reply/member → `connect_report`. A distinct **"I'm worried about them"**
  (`concern_for_safety = true`) path jumps the moderation queue and surfaces resources.
- **Block / mute** → `connect_block`.
- **Moderation** — a Connect queue on `/admin`: triage open reports, hide/remove content, contact a
  member. Reuses the existing admin surface.
- **Rate limiting** — per-member post/reply caps to blunt spam and pile-ons.
- **Crisis routing extends to peer content** (AI Governance: crisis routing is always on). Member
  posts run the same distress detection as agent chat; on a trigger we surface 988 / locale-appropriate
  resources to the author and flag for human review. Never diagnose, never auto-act beyond routing.

Why this is lighter than public social: a **closed, paid, real-identity ~1,000-member** cohort with a
shared mission — the membership itself is the strongest moderator.

## Member Agent integration (part of "done")

- **Knows:** the agent can read the member's own Connect activity (their posts, replies, pacts,
  check-in status) and what's trending — no member-visible data is invisible to the agent.
- **Bridges:** surfaces relevant topics/people tied to the member's **Reclaim List** ("you wanted to
  coach a friend again — there's a live topic on exactly that") and nudges on lapsed pacts ("you've
  gone quiet on the ride you promised Maria").
- **Governance:** the agent **never auto-posts**. If it ever drafts a message in the member's name, a
  human-confirm gate applies (same posture as the Founder Agent review gate). Reflect-and-route, MI
  posture — it encourages connection, never pressures.

## Identity (anonymous by default, reveal when ready)

- Every member gets a **handle** and posts **pseudonymously by default**. They can switch
  `display_mode` to **real name** once comfortable — the gradient mirrors the program's "safe to be
  honest" principle: a handle lowers the stakes of the first hard share; revealing your name later is
  its own act of trust.
- **Pseudonymous to peers, identified to the platform.** The `handle → member_id` map is always known
  to the system, so safety (moderation, blocks, crisis routing) is unaffected by anonymity.
- Open sub-questions (below): does a real-name reveal apply **retroactively** to past posts or only
  forward, and is the switch **reversible** back to the handle?

## Privacy & consent

- Posting is **explicit and opt-in**; nothing is ever auto-posted on a member's behalf.
- **Hard wall:** nothing from the member's private agent journal, IDQ answers, or ID Score is ever
  surfaced into Connect. Connect holds only what the member chooses to share with peers.
- Members can edit/delete their own posts.

## Telemetry (internal QI; separate from research; consented)

`post_created, reply_created, reaction_added, pact_created, pact_checkin, report_filed` (Phase 2 adds
`live_join`). These are the implementation-outcome measures for Connect.

## Live rooms — delivery (Phase 2a / 2b)

Live rooms are persisted, moderatable, and crisis-routed exactly like posts/replies — delivery is the
only thing that changes between phases. Messages always go through the server (`postRoomMessage`, owner
connection) so the DB is the single source of truth; "real-time" is layered on top, never instead.

- **Phase 2a — polling (always available).** The room client polls `GET /api/connect/rooms/[roomId]`
  every 3s with an `after` cursor; a single `merge()` dedupes by id. This is the floor — it works with
  no extra infrastructure and is the fallback whenever Realtime isn't on or won't connect.
- **Phase 2b — Supabase Realtime (broadcast + presence).** When `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, the client joins a per-room channel `connect-room:<roomId>`:
  - **broadcast** delivers new messages instantly. The sender posts via the API (DB write + crisis
    routing), gets the saved message back, shows it locally, and broadcasts it to peers — no extra DB
    round-trip. `merge()` dedupes so poll + broadcast + own-send can't double-render.
  - **presence** gives the live "N here now" count.
  - **Why broadcast, not `postgres_changes`:** our tables are RLS-enabled with **no policies** (the app
    uses an owner connection; the anon key can't read them). `postgres_changes` would need readable
    tables. Broadcast/presence are ephemeral pub/sub that **never touch the DB**, so they work under our
    posture untouched.
  - **Backstop:** because broadcast is best-effort, polling doesn't stop when live — it drops to a slow
    15s reconciling poll so any dropped message still lands.

**The switch:** Realtime is gated entirely on the two `NEXT_PUBLIC_*` vars (Next inlines them at build
time). Absent → polling only. So 2b ships dark and is turned on per-deploy by setting the vars in Vercel
— no code change. `lib/connect/realtime-client.ts` returns `null` when they're unset.

**Security follow-up (before scale):** channels are currently **public** — reachable by anyone holding
the anon key *and* a room's UUID. Room UUIDs are unguessable and never exposed (Data API is RLS-blocked),
so this is acceptable for MVP. Harden with **private channels + RLS on `realtime.messages`** when we move
past charter scale.

## Decided

- **Identity:** anonymous handle by default; opt-in reveal to real name; pseudonymous to peers,
  identified to the platform.
- **Identity reveal:** member chooses **retroactive vs forward**, the switch is **reversible**, the
  platform always keeps the mapping (modeled per-post via `show_name`).
- **Structure:** one global feed + tags to begin; member-created groups in Phase 1.5.
- **Group visibility (1.5):** **discoverable + request-to-join**, content **members-only**; the
  **creator hosts/moderates** with **platform oversight always on** — reports, crisis routing, and
  admin reach don't stop at a group's edge.

## Open questions (for Jay / senior-eng)

1. **Accountability pairing:** member-initiated invite only, or can the Member Agent *suggest* a
   partner?
2. **Moderation staffing:** who works the `/admin` Connect queue at charter scale?
3. **Data model / RLS review:** senior-engineer pass on `0035_connect.sql` before it reaches real
   members.
4. **Decision Log:** add the "Connect native, drop Circle" entry in Notion (CLAUDE.md is already
   updated).
