# Charter feedback — spec

A lightweight, in-product way for Charter Members (and operators, incl. Jay) to log **issues,
questions, and suggestions** during testing. Explicit and context-rich — deliberately **separate
from the Member Agent**, whose reflective-companion role we do not compromise. Drafted Jun 2026.

## Principles

- **The MA is untouched.** Feedback is its own affordance. The companion never becomes a helpdesk.
- **Explicit, not extracted.** The member knows they're filing feedback (vs. confiding in the MA).
- **Context for free.** We attach what they were doing automatically — page + their recent
  `member_event` trail — so a one-line report ("session wouldn't close") arrives with the evidence.
- **Behind the wall.** RLS on; minimum-necessary; product QI data, member-initiated.

## Data model — `member_feedback` (one migration)

```
create table member_feedback (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid references member_profile(member_id) on delete set null,  -- null = operator-filed,
                                                                              -- and survives a member wipe
  author      text,                       -- display name / email snapshot at file time (survives wipe)
  kind        text not null check (kind in ('issue','question','suggestion')),
  body        text not null,
  surface     text,                       -- the route they were on, e.g. /session/<id>/RWR-VIS
  context     jsonb not null default '{}',-- { path, recentEvents:[…last ~10 member_event…], buildId?, ua? }
  status      text not null default 'new' check (status in ('new','triaged','resolved')),
  admin_note  text,                       -- operator triage note
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index member_feedback_status_idx on member_feedback (status, created_at desc);
alter table member_feedback enable row level security;
```

Design note: `on delete set null` (not cascade) — a tester's bug reports **outlive** wiping their
account, which is what you want during testing. `author` snapshots who filed it so a nulled row is
still attributable. Nullable `member_id` also lets **operators (you) file** without a member account.

## Capture UI — "Send feedback" widget

- A small, persistent affordance on **every page** (a corner button or header link), present for any
  authenticated member and on `/admin`.
- Opens a compact panel:
  - **Type:** Issue · Question · Suggestion (one tap)
  - **What happened / what you'd want:** free text
  - Submit. Quiet "Thanks — the team will see this." No MA involvement.
- **Auto-captured invisibly:** `member_id`, `author`, current `path`, the member's **last ~10
  `member_event` rows**, timestamp, build id. The member types one line; you get the full picture.
- Server action `logFeedback(kind, body, surface)` → resolves member + recent events server-side →
  inserts. Never throws to the UI.

## Operator surface — Feedback queue on `/admin`

- A **Feedback** card on the FA dashboard (beside the review queue + roster): count of `new`, list
  newest-first, filterable by status.
- Each item shows: author (link to `/admin/member/<id>` when present), kind chip, body, the
  **surface + recent-event trail** (so you see what they were doing), and time.
- Actions: status toggle `new → triaged → resolved`, optional `admin_note`.
- This is the surface Claude reads/triages on request (and what a scheduled digest would summarize).

## Governance / privacy

- Disclosed and explicit; nothing here changes the MA's posture or its disclosure.
- RLS on; product telemetry is internal QI (CLAUDE.md), kept separate from research data.
- Only member-initiated product feedback is stored — no scraping of conversation or personal sharing.

## Reading & monitoring

- **Pull (default):** Claude reads/clusters/drafts from the queue on request, or at session start.
- **Scheduled digest (opt-in, fast-follow):** a daily cloud agent reads new feedback, clusters
  (bug/question/idea), flags urgent, and sends Jay a digest/push. Add only if volume justifies it.

## Deferred — MA as a safety net (v1.1, NOT in v1)

Later, the MA could *detect* product friction voiced in chat ("how do I…", "this isn't working")
and silently log it to this same queue with a light in-character ack — catching the member who
grumbles to their companion but never clicks the button. Requires careful classification so genuine
personal sharing is **never** logged as feedback. Tasteful follow-up, deliberately out of v1.

## Build outline (~half day)

1. Migration `00xx_member_feedback.sql` (+ register sentinel in `lib/db/schema.ts`).
2. `lib/feedback/store.ts` — `logFeedback`, `listFeedback`, `setFeedbackStatus` (+ pure-ish helpers).
3. Capture widget component + server action; mount in the shared layout.
4. Feedback card on `/admin` (+ status controls).
5. Tests (store + status transitions), verify gate, `db:migrate`, ship.
