import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { nextOutreach, pickTense, type OutreachDeps, type Phase } from '../lib/outreach/engine.ts';
import { getPref, setPref, markResponded, recordReady } from '../lib/outreach/store.ts';
import type { OutreachDraft } from '../lib/outreach/config.ts';

async function member(): Promise<{ db: Db; id: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Nudge QA','nudge.qa@x.com') returning member_id`,
  );
  return { db, id: rows[0]!.member_id };
}

const goodDraft: OutreachDraft = {
  trigger: 'morning_presence', tense: 'present',
  text: "You mentioned Tuesdays feel heavy — what's here for you today?",
  provenance: { stream: 'words', ref: 'chat:1', quote: 'Tuesdays feel heavy' }, hasPlan: false, questionCount: 1,
};

const deps = (over: Partial<OutreachDeps> = {}, phase: Phase = 'reconnect'): OutreachDeps => ({
  loadContext: async () => ({ phase, sessionsInPhase: 0 }),
  gatherSources: async () => [{ stream: 'words', ref: 'chat:1', quote: 'Tuesdays feel heavy' }],
  generate: async () => goodDraft,
  ...over,
});

const NOW = new Date('2026-07-19T18:00:00Z'); // daytime; in-app is exempt from quiet hours anyway

test('happy path: gate → gather → generate → validate → records a ready outreach', async () => {
  const { db, id } = await member();
  const r = await nextOutreach(db, id, 'morning_presence', NOW, deps());
  assert.equal(r.status, 'ready');
  const { rows } = await db.query<{ status: string; provenance: unknown; message: string }>(
    `select status, provenance, message from outreach_log where member_id=$1`, [id],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.status, 'ready');
  assert.ok(rows[0]!.provenance, 'ready row carries provenance (§8)');
});

test('no groundable source → held, nothing shown', async () => {
  const { db, id } = await member();
  const r = await nextOutreach(db, id, 'morning_presence', NOW, deps({ gatherSources: async () => [] }));
  assert.equal(r.status, 'held');
  assert.match((r as { reason: string }).reason, /no groundable source/);
});

test('a governance-violating draft is HELD by the validator (never shown)', async () => {
  const { db, id } = await member();
  const bad = { ...goodDraft, text: 'This will fix your life and reveal your true self.' };
  const r = await nextOutreach(db, id, 'morning_presence', NOW, deps({ generate: async () => bad }));
  assert.equal(r.status, 'held');
  assert.match((r as { reason: string }).reason, /science-check|overclaim/);
  const { rows } = await db.query<{ status: string }>(`select status from outreach_log where member_id=$1`, [id]);
  assert.equal(rows[0]!.status, 'held');
});

test('no double-nudge: an open thread holds the next one', async () => {
  const { db, id } = await member();
  await recordReady(db, id, { trigger: 'morning_presence', tense: 'present', message: goodDraft.text, provenance: goodDraft.provenance! });
  const r = await nextOutreach(db, id, 'post_log', NOW, deps());
  assert.equal(r.status, 'held');
  assert.match((r as { reason: string }).reason, /double-nudge/);
});

test('dismiss feeds back-off (ignored_streak++); a reply resets it', async () => {
  const { db, id } = await member();
  const r = await nextOutreach(db, id, 'morning_presence', NOW, deps());
  const openId = (r as { id: string }).id;
  await markResponded(db, id, openId, 'dismissed');
  assert.equal((await getPref(db, id)).ignoredStreak, 1);
  await setPref(db, id, {}); // no-op upsert keeps the row
  const r2 = await nextOutreach(db, id, 'morning_presence', NOW, deps());
  await markResponded(db, id, (r2 as { id: string }).id, 'replied');
  assert.equal((await getPref(db, id)).ignoredStreak, 0);
});

test('in-app cooldown: a recently-surfaced (then dismissed) nudge cannot regenerate until the cooldown clears', async () => {
  const { db, id } = await member();
  // The treadmill scenario: a nudge was surfaced + DISMISSED 2h ago (so it's not an open thread anymore).
  await db.query(
    `insert into outreach_log (member_id, trigger, tense, channel, status, message, provenance, created_at)
     values ($1,'morning_presence','present','in_app','dismissed',$2,$3, now() - interval '2 hours')`,
    [id, goodDraft.text, JSON.stringify(goodDraft.provenance)],
  );
  const held = await nextOutreach(db, id, 'morning_presence', new Date(), deps());
  assert.equal(held.status, 'held', 'within the cooldown → no regeneration');
  assert.match((held as { reason: string }).reason, /cooldown/);

  // Age the surfaced time past the 20h floor → the channel reopens, a fresh nudge generates.
  await db.query(`update outreach_log set created_at = now() - interval '21 hours' where member_id=$1`, [id]);
  const ready = await nextOutreach(db, id, 'morning_presence', new Date(), deps());
  assert.equal(ready.status, 'ready', 'past the cooldown → clear');
});

test('pickTense encodes the voice-dial + earned-plan threshold', () => {
  assert.deepEqual(pickTense('reconnect', 5), { tense: 'present', planEarned: false });
  assert.deepEqual(pickTense('rewire', 0), { tense: 'present', planEarned: false }, 'not earned yet → reflective');
  assert.deepEqual(pickTense('rewire', 1), { tense: 'practice', planEarned: true }, 'earned at ≥1 in-phase session');
  assert.deepEqual(pickTense('reclaim', 3), { tense: 'horizon', planEarned: false });
});
