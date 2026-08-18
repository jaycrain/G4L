import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { SESSION_KEYS } from '../lib/workspace/session-key.ts';
import { teachingFor } from '../lib/content/teaching.ts';
import { keepSessionScience } from '../lib/content/teaching-keep.ts';
import { tabFor } from '../lib/playbook/tabs.ts';

// IS EVERY SESSION ACTUALLY WIRED? — the check Jay asked for after a walk found two things a walk should not
// have had to find (2026-08-18: "I don't want walks to necessarily be the way those get uncovered").
//
// The bugs this generalises were BOTH invisible to every other test we have. Reconnect's "Got it" was
// `onAcknowledge={() => {}}` under a card promising the takeaway would be kept: the component rendered, the
// button existed, the handler ran, and nothing happened. And the science read keyed its idempotency on the
// session, so Reconnect's three cards would have collided into one silent write.
//
// So these assert the SEAMS rather than the parts. A component that renders is not a feature; a handler that runs
// is not a promise kept.

const ARCS = ['reconnect', 'rewire', 'rebuild', 'reclaim'] as const;
const chat = (a: string) => readFileSync(`app/${a}/${a}-chat.tsx`, 'utf8');
const actions = (a: string) => readFileSync(`app/${a}/actions.ts`, 'utf8');

test('no arc hands a NO-OP to a card that promises something', () => {
  // The exact shape of the Reconnect bug. A handler wired to `() => {}` beneath copy that says "we'll keep the
  // takeaway in your Playbook" is a lie the type system is happy with.
  // COMMENT LINES ARE SKIPPED. A comment explaining why the no-op was removed necessarily QUOTES the no-op, and
  // a plain-text scan cannot tell the explanation from the offence. This is the third guard today to trip on its
  // own documentation — worth expecting rather than rediscovering each time.
  const codeLines = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l));
  for (const a of ARCS) {
    for (const line of codeLines(chat(a))) {
      assert.doesNotMatch(line, /onAcknowledge=\{\(\)\s*=>\s*\{\s*\}\}/, `${a}: onAcknowledge is a no-op`);
      assert.doesNotMatch(line, /onClipIn=\{\(\)\s*=>\s*\{\s*\}\}/, `${a}: onClipIn is a no-op`);
    }
  }
});

test('every arc that shows the Understand card also FILES the read', () => {
  for (const a of ARCS) {
    const src = chat(a);
    if (!src.includes('TeachingUnderstand')) continue;
    const files = /useTeaching\(/.test(src) || /keepScienceAction\(/.test(src);
    assert.ok(files, `${a}: renders the card but has no path that files the read`);
  }
});

test('every arc persists its keepers, closes its session, and can resume', () => {
  // Four arcs file keepers through four different entry points (emitHarvestMoment / drainHarvest / harvestSignal
  // / a direct write). That heterogeneity is the risk — one way to do a thing cannot drift, four can — so this
  // asserts the OUTCOME is wired in each rather than that they agree on the mechanism.
  for (const a of ARCS) {
    const src = actions(a);
    const keeps = /harvestSignal|emitHarvestMoment|drainHarvest|commitKeeper|playbook_entry/.test(src);
    assert.ok(keeps, `${a}: nothing in its actions files a keeper — the Playbook would never build`);
    assert.match(src, /markSessionClosed|markCheckpointClosed/, `${a}: never marks a Session closed`);
    assert.match(src, /saveArcSession/, `${a}: cannot resume — a refresh mid-Session would restart it`);
  }
});

test('the science read files for EVERY teaching Session, and always lands under "What you\'ve learned"', async () => {
  // Runtime, not structural: the read is actually written and actually routed, for all ten. Routing is the one
  // that silently blurs — a keeperType would send a science read to "What worked", mixing Reads with Moves.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('W','w@x.test') returning member_id`,
  );
  const m = rows[0]!.member_id;

  const teaching = SESSION_KEYS.filter((k) => teachingFor(k).understand && k !== 'reconnect');
  assert.ok(teaching.length >= 9, `expected the nine 1:1 Sessions to teach, got ${teaching.length}`);

  for (const k of teaching) {
    const r = await keepSessionScience(db, m, k, 'label');
    assert.equal(r.ok, true, `${k}: the science read did not file`);
  }
  const kept = await db.query<{ section: string; keeper_type: string | null }>(
    `select section, keeper_type from playbook_entry where member_id=$1 and source_kind='science'`, [m],
  );
  assert.equal(kept.rows.length, teaching.length, 'one read per teaching Session');
  for (const row of kept.rows) {
    assert.equal(tabFor({ keeperType: row.keeper_type, section: row.section }), 'learned',
      'a science read must land under "What you\'ve learned", never "What worked"');
  }
});

test('a GATE teaches nothing and files nothing — and must not strand the member', async () => {
  // The inverse failure: a checkpoint has no Understand card, so a gate that waits on an acknowledgment would
  // trap someone at a finished Session with no way out. `taught` starts TRUE when there is nothing to teach.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('G','g@x.test') returning member_id`,
  );
  const m = rows[0]!.member_id;
  for (const k of SESSION_KEYS.filter((k) => k.endsWith('checkpoint') || k === 'b4' || k === 'c4')) {
    assert.equal(teachingFor(k).teaches, false, `${k} is a gate`);
    const r = await keepSessionScience(db, m, k, 'label');
    assert.equal(r.ok, false, `${k}: a gate must file nothing`);
  }
  assert.match(readFileSync('app/workspace/use-teaching.ts', 'utf8'), /useState\(\(\) => !teaches\)/,
    'a Session with nothing to teach must start ALREADY taught, or the hand-home waits on a card that never renders');
});
