import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { FOUNDER_TOOLS, runFounderTool, newTurnBudget } from '../lib/founder/companion-tools.ts';

// WHAT THESE TESTS ARE PROTECTING.
//
// The Founder Companion is the one agent with a view across every member, talking to someone who is not in a
// conversation with any of them. Jay drew the line himself: "I don't want to pry into Member's info any more
// than I could see before." That line is not a prompt instruction — a prompt instruction is a wish. It has to
// be a property of the DATA THE TOOLS RETURN, because a model asked "who's stuck?" will helpfully reach for
// whatever colour is within reach, and the most vivid thing within reach is the worst thing to volunteer:
// a member's gap, in their own words, told to a Companion they were promised was a safe place to be honest.
//
// So: the search tools cannot leak that text even if the model asks them to. The one tool that returns it
// requires naming a person, which is parity with opening their page.

const NOW = Date.UTC(2026, 7, 1, 12, 0, 0);
const ago = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

const GAP = 'After the divorce I stopped swimming and I never started again.';
const WANT = 'Swim a mile without stopping';

async function seed(): Promise<Db> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const donna = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email, intake_gap, identity_noun)
       values ('Donna Crain','donna@x.com',$1,'the Swimmer') returning member_id`,
      [GAP],
    )
  ).rows[0]!.member_id;
  await db.query(`insert into member_credential (member_id, email, password_hash) values ($1,'donna@x.com','x')`, [donna]);
  await db.query(`insert into reclaim_item (member_id, text, sort_order) values ($1,$2,0)`, [donna, WANT]);
  await db.query(`insert into reclaim_item (member_id, text, sort_order, state) values ($1,'Ride to the coast',1,'reclaimed')`, [donna]);
  await db.query(
    `insert into door (slug, display_name, descriptor, sort_order)
     values ('divorce','The Divorce','a marriage ended',1) on conflict do nothing`,
  );
  await db.query(`insert into member_door (member_id, door_slug, is_primary) values ($1,'divorce',true)`, [donna]);
  // A Session opened and never closed, nothing since — the "stalled" shape.
  await db.query(
    `insert into session_progress (member_id, session_id, current_step, status, updated_at)
     values ($1,'RCN-VAL',2,'in_progress',$2)`,
    [donna, ago(4)],
  );
  // A demo persona, which must never appear anywhere.
  await db.query(`insert into member_profile (display_name, email, intake_gap) values ('Demo','demo@grintaforlife.test','seeded gap')`);
  return db;
}

/** Every string anywhere in a tool result, however deeply nested. */
function allText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(allText).join(' ');
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).map(allText).join(' ');
  return String(v);
}

test('NO search tool can return a member\'s gap or Reclaim List — not for any filter', async () => {
  const db = await seed();
  // Sweep every search tool and every filter, including the ones a model would reach for when asked
  // something vague. If a future edit widens `operational()` to "be more helpful", this fails.
  const calls: Array<[string, Record<string, unknown>]> = [
    ['cohort_stats', {}],
    ['find_members', { filter: 'all' }],
    ['find_members', { filter: 'stalled' }],
    ['find_members', { filter: 'quiet', days: 1 }],
    ['find_members', { filter: 'by_phase', phase: 'Reconnect' }],
    ['find_members', { filter: 'no_idq' }],
    ['find_members', { filter: 'recent' }],
    ['recent_activity', { hours: 24 * 60 }],
    ['operations_status', {}],
  ];
  for (const [name, input] of calls) {
    const text = allText(await runFounderTool(db, name, input, NOW));
    assert.ok(!text.includes(GAP), `${name}(${JSON.stringify(input)}) leaked the member's gap`);
    assert.ok(!text.includes(WANT), `${name}(${JSON.stringify(input)}) leaked a Reclaim List item`);
    assert.ok(!text.includes('divorce'), `${name}(${JSON.stringify(input)}) leaked the Door`);
  }
});

test('member_detail DOES return their words — that is the parity Jay asked for', async () => {
  const db = await seed();
  const r = await runFounderTool(db, 'member_detail', { name: 'donna' }, NOW);
  assert.equal(r.found, true);
  assert.equal((r as { howTheDistanceOpened: string }).howTheDistanceOpened, GAP);
  assert.deepEqual((r as { reclaimList: unknown[] }).reclaimList, [
    { want: WANT, reclaimed: false },
    { want: 'Ride to the coast', reclaimed: true },
  ]);
  assert.deepEqual((r as { doors: string[] }).doors, ['divorce']);
  assert.equal((r as { identityWord: string }).identityWord, 'the Swimmer');
  // It carries its own handling instruction, so the rule travels WITH the data rather than living only in a
  // system prompt the model saw several thousand tokens ago.
  assert.match(String(r.handleWithCare), /never repeat them into a cohort answer/);
});

test('member_detail on an unknown name returns found:false, never the nearest member', async () => {
  const db = await seed();
  // A near-miss is the dangerous case: "tell me about Dave" must not quietly serve Donna's story.
  const r = await runFounderTool(db, 'member_detail', { name: 'Dave' }, NOW);
  assert.equal(r.found, false);
  assert.ok(!allText(r).includes(GAP));
});

test('a demo persona is invisible to every tool, including its seeded gap', async () => {
  const db = await seed();
  const stats = await runFounderTool(db, 'cohort_stats', {}, NOW);
  assert.equal(stats.members, 1, 'the .test account is not a member');
  const detail = await runFounderTool(db, 'member_detail', { name: 'Demo' }, NOW);
  assert.equal(detail.found, false, 'and cannot be opened by name either');
});

test('find_members honours the stalled definition and returns operational fields only', async () => {
  const db = await seed();
  const r = await runFounderTool(db, 'find_members', { filter: 'stalled' }, NOW);
  const members = (r as { members: Array<Record<string, unknown>> }).members;
  assert.equal(members.length, 1);
  // The exact field set is the boundary. Asserting the KEYS (not just the absence of known-bad strings)
  // is what catches a future field added without thinking about who reads it.
  assert.deepEqual(Object.keys(members[0]!).sort(), [
    'badges', 'daysSinceActive', 'idDirection', 'idScore', 'joinedDaysAgo',
    'memberId', 'name', 'phase', 'sessionsClosed', 'sessionsOpen',
  ]);
});

test('every tool is read-only — no tool description or schema offers a write', () => {
  // The no-auto-send rule is upheld by there being nothing to call, not by asking the model nicely.
  for (const t of FOUNDER_TOOLS) {
    assert.ok(
      !/send|draft|approve|delete|update|write|remove/i.test(t.name),
      `${t.name} reads like a mutation — the Founder Companion must have no write path`,
    );
  }
});

test('an unknown tool name is refused, not guessed at', async () => {
  const db = await seed();
  const r = await runFounderTool(db, 'send_email', { to: 'donna' }, NOW);
  assert.match(String(r.error), /Unknown tool/);
});

test('the fan-out cap stops a sweep of the whole cohort — third member is refused', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  for (const n of ['Ann A', 'Bob B', 'Cal C']) {
    const id = (
      await db.query<{ member_id: string }>(
        `insert into member_profile (display_name, email, intake_gap) values ($1,$2,'private words') returning member_id`,
        [n, `${n.split(' ')[0]!.toLowerCase()}@x.com`],
      )
    ).rows[0]!.member_id;
    await db.query(`insert into member_credential (member_id, email, password_hash) values ($1,$2,'x')`, [
      id, `${n.split(' ')[0]!.toLowerCase()}@x.com`,
    ]);
  }
  const budget = newTurnBudget();
  const a = await runFounderTool(db, 'member_detail', { name: 'Ann' }, NOW, budget);
  const b = await runFounderTool(db, 'member_detail', { name: 'Bob' }, NOW, budget);
  const c = await runFounderTool(db, 'member_detail', { name: 'Cal' }, NOW, budget);

  assert.equal(a.found, true, 'one named member is fine');
  assert.equal(b.found, true, '"compare Donna and Marcus" is a real question — two is allowed');
  assert.equal(c.refused, true, 'the third is a sweep, not a question about a person');
  assert.ok(!allText(c).includes('private words'), 'and a refusal returns nothing private');

  // Re-opening someone already opened costs nothing — a follow-up about the same person must still work.
  const again = await runFounderTool(db, 'member_detail', { name: 'Ann' }, NOW, budget);
  assert.equal(again.found, true);
});

test('with no budget passed the cap is inert — callers opt in, existing reads do not break', async () => {
  const db = await seed();
  const r = await runFounderTool(db, 'member_detail', { name: 'donna' }, NOW);
  assert.equal(r.found, true);
});
