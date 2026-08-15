// THE PROSPECT READ MODEL — shape without words.
//
// Two things these tests hold. First the ranking, because it decides what an operator sees at the top of the
// list and therefore what actually gets acted on. Second, and more important, the PRIVACY property: this read
// model must never return a non-member's transcript, gap or Reclaim items. That is the whole reason it exists
// as a separate read rather than a thin wrapper over the diagnostic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import {
  listProspects, prospectStatus, sortProspects, summarizeProspects, dropOffLabel,
  STALLED_AFTER_HOURS, PROSPECT_WINDOW_DAYS, revealProspectTranscript, type Prospect,
} from '../lib/admin/prospects.ts';

async function db(): Promise<Db> {
  const d = new PGlite() as unknown as Db;
  await applySchema(d);
  return d;
}

async function seedSession(
  d: Db,
  email: string,
  opts: {
    stage?: string; turns?: number; agoHours?: number; gap?: string;
    reclaim?: string[]; doors?: string[]; identity?: string; crisis?: boolean;
  } = {},
) {
  const state = {
    stage: opts.stage ?? 'reclaim',
    collected: {
      identityNoun: opts.identity ?? null,
      gap: opts.gap ?? '',
      reclaimList: opts.reclaim ?? [],
      doors: opts.doors ?? [],
    },
  };
  const messages = Array.from({ length: opts.turns ?? 2 }, (_, i) => ({ role: 'member', text: `line ${i}` }));
  await d.query(
    `insert into onboarding_session (email, token, state, messages, updated_at, crisis_flagged_at)
     values ($1,'tok',$2::text::jsonb,$3::text::jsonb, now() - ($4 || ' hours')::interval, $5)`,
    [email, JSON.stringify(state), JSON.stringify(messages), String(opts.agoHours ?? 0),
     opts.crisis ? new Date().toISOString() : null],
  );
}

// ── the ranking (pure) ─────────────────────────────────────────────────────────────────────────────────────

test('status: crisis outranks everything, including a completed conversation', () => {
  assert.equal(prospectStatus({ stage: 'complete', crisisFlaggedAt: '2026-08-15T00:00:00Z' }, 0), 'crisis');
  assert.equal(prospectStatus({ stage: 'declined', crisisFlaggedAt: '2026-08-15T00:00:00Z' }, 99), 'crisis');
});

test('status: finishing the conversation without committing is its own state', () => {
  // The costliest drop-off there is — they did every turn and stopped one tap short. Lumping this in with
  // "stalled" would bury the single most actionable row in the list.
  assert.equal(prospectStatus({ stage: 'complete', crisisFlaggedAt: null }, 0), 'ready');
  assert.equal(prospectStatus({ stage: 'complete', crisisFlaggedAt: null }, 500), 'ready', 'age never demotes it');
});

test('status: declined is a correct outcome, not a loss', () => {
  // A no-Fade member turned away at the scope gate is the system working (CLAUDE.md). It must be visible but
  // must never sit at the top of the list looking like something to chase.
  assert.equal(prospectStatus({ stage: 'declined', crisisFlaggedAt: null }, 1), 'declined');
});

test('status: active becomes stalled at the threshold', () => {
  assert.equal(prospectStatus({ stage: 'gap', crisisFlaggedAt: null }, STALLED_AFTER_HOURS - 0.1), 'active');
  assert.equal(prospectStatus({ stage: 'gap', crisisFlaggedAt: null }, STALLED_AFTER_HOURS), 'stalled');
});

test('sort: crisis, then ready, then stalled, then active, then declined', () => {
  const p = (email: string, status: Prospect['status'], updatedAt: string) =>
    ({ email, status, updatedAt } as Prospect);
  const got = sortProspects([
    p('e', 'declined', '2026-08-15T05:00:00Z'),
    p('d', 'active', '2026-08-15T05:00:00Z'),
    p('c', 'stalled', '2026-08-15T05:00:00Z'),
    p('b', 'ready', '2026-08-15T05:00:00Z'),
    p('a', 'crisis', '2026-08-15T01:00:00Z'), // oldest, still first
  ]).map((x) => x.email);
  assert.deepEqual(got, ['a', 'b', 'c', 'd', 'e']);
});

// ── the query ──────────────────────────────────────────────────────────────────────────────────────────────

test('THE PRIVACY PROPERTY: no transcript, no gap text, no Reclaim items — ever', async () => {
  // These people are not members. They never finished, never got an account, and some walked away on purpose.
  // The console shows SHAPE; the words stay behind the logged reveal. If this assertion ever has to be relaxed,
  // that is a decision to make deliberately, not a field someone added to a select.
  const d = await db();
  await seedSession(d, 'p@real.com', {
    gap: 'I lost my job and it broke something in me',
    reclaim: ['Get back on the bike', 'Sunday dinners'],
    identity: 'Rider',
  });
  const [p] = await listProspects(d);
  const serialized = JSON.stringify(p);
  assert.doesNotMatch(serialized, /broke something in me/, 'the gap text must not be here');
  assert.doesNotMatch(serialized, /Get back on the bike/, 'their Reclaim items must not be here');
  assert.doesNotMatch(serialized, /line 0/, 'the transcript must not be here');
  // The SHAPE of it is fine, and is the point.
  assert.equal(p!.hasGap, true);
  assert.equal(p!.reclaimCount, 2);
});

test('a person who became a member is no longer a prospect', async () => {
  // Committing deletes the session, so this is belt-and-braces for the window where that delete failed and the
  // member exists anyway — which is exactly the half-created state that stranded a tester on 2026-08-15.
  const d = await db();
  await seedSession(d, 'joined@real.com');
  await d.query(`insert into member_profile (display_name, email) values ('J','joined@real.com')`);
  const list = await listProspects(d);
  assert.equal(list.length, 0, 'they are a member now — the roster owns them, not this list');
});

test('.test addresses are excluded, so seeded demos cannot corrupt the funnel', async () => {
  const d = await db();
  await seedSession(d, 'demo@grinta.test');
  await seedSession(d, 'real@example.com');
  const list = await listProspects(d);
  assert.deepEqual(list.map((p) => p.email), ['real@example.com']);
});

test('the window matches the purge — nothing is listed that is already gone', async () => {
  // purge_expired_auth() deletes these rows at 30 days. Listing an older one would offer an operator something
  // to open that no longer exists.
  const d = await db();
  await seedSession(d, 'old@real.com', { agoHours: (PROSPECT_WINDOW_DAYS + 1) * 24 });
  await seedSession(d, 'fresh@real.com', { agoHours: 1 });
  assert.deepEqual((await listProspects(d)).map((p) => p.email), ['fresh@real.com']);
});

test('a crisis-flagged prospect sorts to the top and is counted', async () => {
  const d = await db();
  await seedSession(d, 'ready@real.com', { stage: 'complete', agoHours: 0 });
  await seedSession(d, 'help@real.com', { stage: 'gap', agoHours: 3, crisis: true });
  const list = await listProspects(d);
  assert.equal(list[0]!.email, 'help@real.com', 'distress outranks a finished conversation');
  assert.equal(list[0]!.status, 'crisis');
  const sum = summarizeProspects(list);
  assert.equal(sum.crisis, 1);
  assert.equal(sum.ready, 1);
  assert.equal(sum.total, 2);
});

test('the drop-off label says where they stopped, in plain words', async () => {
  const d = await db();
  await seedSession(d, 'early@real.com', { stage: 'gap' });
  await seedSession(d, 'listing@real.com', { stage: 'reclaim', gap: 'the job ended', reclaim: ['ride'] });
  await seedSession(d, 'done@real.com', { stage: 'complete', gap: 'x', reclaim: ['a', 'b', 'c'] });
  const by = Object.fromEntries((await listProspects(d)).map((p) => [p.email, dropOffLabel(p)]));
  assert.match(by['early@real.com']!, /before they named what changed/);
  assert.match(by['listing@real.com']!, /1 so far/);
  assert.match(by['done@real.com']!, /never tapped/);
});

// ── break-glass ────────────────────────────────────────────────────────────────────────────────────────────

test('revealing a transcript writes the access log FIRST, and returns their words', async () => {
  const d = await db();
  await seedSession(d, 'seen@real.com', { turns: 3 });
  const t = await revealProspectTranscript(d, 'seen@real.com', { id: null, label: 'jay' });
  assert.equal(t.turns.length, 3, 'their actual words come back — that is the point of the exception');

  const { rows } = await d.query<{ prospect_email: string; member_id: string | null; surface: string; note: string }>(
    'select prospect_email, member_id, surface, note from member_access_log',
  );
  assert.equal(rows.length, 1, 'exactly one record of the open');
  assert.equal(rows[0]!.prospect_email, 'seen@real.com');
  assert.equal(rows[0]!.member_id, null, 'a prospect has no member_id — the constraint requires exactly one');
  assert.equal(rows[0]!.surface, 'admin_prospect_reveal');
});

test('IF THE LOG FAILS, THE TRANSCRIPT IS NOT RETURNED — the ordering is the whole control', async () => {
  // The failure mode this prevents: logging degrades, nobody notices, and the reveal quietly becomes the
  // ungoverned access it was built to replace — indistinguishable from working, from the outside.
  const d = await db();
  await seedSession(d, 'blocked@real.com', { turns: 4 });
  const real = d.query.bind(d);
  const broken = {
    query: async (sql: string, params?: unknown[]) =>
      /insert into member_access_log/i.test(sql) ? Promise.reject(new Error('log down')) : real(sql, params),
  } as unknown as Db;

  await assert.rejects(
    () => revealProspectTranscript(broken, 'blocked@real.com', { id: null, label: 'jay' }),
    /log down/,
    'it must fail loudly rather than open the door unrecorded',
  );
});

test('the log constraint refuses a row that names nobody', async () => {
  // A row with neither a member nor a prospect reads as diligence while recording nothing.
  const d = await db();
  await assert.rejects(
    () => d.query(
      `insert into member_access_log (operator_label, member_id, prospect_email, surface)
       values ('jay', null, null, 'admin_prospect_reveal')`,
    ),
    'unrepresentable, not merely discouraged',
  );
});

test('an email that has no session yields no words rather than an error', async () => {
  // The row can be purged between listing and clicking. That must read as "nothing here", not a crash — and
  // the access is still logged, because the intent to look is the thing worth recording.
  const d = await db();
  const t = await revealProspectTranscript(d, 'gone@real.com', { id: null, label: 'jay' });
  assert.deepEqual(t.turns, []);
  const { rows } = await d.query<{ n: number }>('select count(*)::int as n from member_access_log');
  assert.equal(rows[0]!.n, 1, 'the attempt is on the record even though there was nothing to show');
});
