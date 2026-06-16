import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import {
  listCurriculum,
  getAsset,
  getSession,
  phaseColumns,
  dailyLayer,
  listBadges,
  getBadge,
  kindProfile,
  CATEGORY_COLOR,
} from '../lib/curriculum/registry.ts';
import {
  saveAnswer,
  getSessionProgress,
  closeSession,
  isSessionClosed,
  closedSessionIds,
  listFacets,
  addFacet,
  earnBadge,
  earnedBadgeIds,
  setGate,
  hasGate,
  listGates,
} from '../lib/curriculum/store.ts';

// ---------- registry (data-driven) ----------
test('Identity Excavation is fully authored: 4 steps, reflect close, earns Named Yourself, last step yields a facet', () => {
  const s = getSession('RCN-EXC');
  assert.ok(s);
  assert.equal(s!.steps?.length, 4);
  assert.equal(s!.close_type, 'reflect');
  assert.equal(s!.earns, 'named-yourself');
  assert.equal(s!.steps![3]!.contributes, 'facet');
  assert.ok(s!.steps![1]!.companion_frame.length > 0 && s!.steps![1]!.probe.length > 0);
});

test('getSession returns null for a non-session asset (a checkpoint)', () => {
  assert.equal(getSession('RCN-CHK'), null);
  assert.equal(getAsset('RCN-CHK')!.kind, 'checkpoint');
});

test('the Reconnect phase is fully authored — every Session has steps; key artifacts are wired', () => {
  for (const id of ['RCN-BKQ', 'RCN-FDR', 'RCN-EXC', 'RCN-DFT', 'RCN-WIN', 'RCN-WIN-LIST']) {
    const s = getSession(id);
    assert.ok(s, `missing ${id}`);
    assert.ok((s!.steps?.length ?? 0) >= 1, `${id} has no steps`);
  }
  assert.ok(getSession('RCN-FDR')!.steps!.some((st) => st.contributes === 'your_doors'));
  assert.ok(getSession('RCN-WIN-LIST')!.steps!.some((st) => st.contributes === 'reclaim_list'));
  assert.equal(getAsset('RCN-IDQ')!.kind, 'measurement'); // the IDQ stays an instrument, not a Session
});

test('the forecast is derived purely from registry rows — every non-daily asset, order-sorted', () => {
  const cols = phaseColumns();
  assert.deepEqual(cols.map((c) => c.phase), ['reconnect', 'rewire', 'rebuild', 'reclaim']);
  // reconnect column: 8 items in order, ending in the Checkpoint
  const recon = cols[0]!.items;
  assert.equal(recon.length, 8);
  assert.deepEqual(recon.map((a) => a.order), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(recon[recon.length - 1]!.kind, 'checkpoint');
  // every non-daily asset appears exactly once across the columns (proves no hardcoding)
  const inColumns = cols.flatMap((c) => c.items).length;
  const nonDaily = listCurriculum().filter((a) => a.layer !== 'Daily').length;
  assert.equal(inColumns, nonDaily);
});

test('the whole program is authored — all four phases, every Session has steps, one checkpoint each', () => {
  const cols = phaseColumns();
  const counts = Object.fromEntries(cols.map((c) => [c.phase, c.items.length]));
  assert.deepEqual(counts, { reconnect: 8, rewire: 7, rebuild: 6, reclaim: 8 });
  for (const c of cols) {
    assert.equal(c.items.filter((i) => i.kind === 'checkpoint').length, 1, `${c.phase} needs one checkpoint`);
    for (const s of c.items.filter((i) => i.kind === 'session')) {
      assert.ok((s.steps?.length ?? 0) >= 1, `${s.id} should be authored`);
    }
  }
  // every phase checkpoint earns its milestone badge
  for (const id of ['RCN-CHK', 'RWR-CHK', 'RBD-CHK', 'RCL-CHK']) assert.ok(getAsset(id)!.earns, `${id} earns a badge`);
});

test('every Checkpoint is crossable (openable) — so each phase resolves to its OWN checkpoint', async () => {
  const { getForecast } = await import('../lib/curriculum/view.ts');
  const { db, memberId } = await seed();
  const f = await getForecast(db, memberId);
  const cps = f.phases.flatMap((p) => p.items).filter((i) => i.kind === 'checkpoint');
  assert.equal(cps.length, 4); // one per phase
  for (const c of cps) assert.equal(c.openable, true, `${c.id} should be crossable`);
});

test('the daily layer runs across, separate from the phase columns', () => {
  const daily = dailyLayer();
  assert.ok(daily.length >= 5);
  assert.ok(daily.every((a) => a.layer === 'Daily'));
  // daily ids never leak into the phase columns
  const colIds = new Set(phaseColumns().flatMap((c) => c.items).map((a) => a.id));
  assert.ok(daily.every((a) => !colIds.has(a.id)));
});

test('adding a 25th Session is a data row — the loaders pick it up with no renderer change', () => {
  // Simulate by checking the generic path: a hypothetical row would flow through phaseColumns purely by
  // phase/order/layer. Here we assert the contract the renderer relies on: items are sorted by order
  // and typed by kind, so a new row needs only those fields.
  for (const col of phaseColumns()) {
    for (let i = 1; i < col.items.length; i++) assert.ok(col.items[i]!.order >= col.items[i - 1]!.order);
    for (const a of col.items) assert.ok(['session', 'checkpoint', 'measurement', 'pulse', 'tracker'].includes(a.kind));
  }
});

test('badges carry category color; profiles exist for every kind', () => {
  const named = getBadge('named-yourself');
  assert.equal(named!.color, CATEGORY_COLOR.milestone);
  assert.equal(named!.ceremony, true);
  assert.equal(listBadges().find((b) => b.id === 'onboarding-courage')!.ceremony, false);
  assert.equal(kindProfile('session').scoreWeight, 'high');
  assert.equal(kindProfile('pulse').scoreWeight, 'low');
});

// ---------- store ----------
async function seed(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Tom Miller','tom@x.com') returning member_id`,
    )
  ).rows[0]!.member_id;
  return { db, memberId };
}

test('session progress: save answers, advance, close', async () => {
  const { db, memberId } = await seed();
  await saveAnswer(db, memberId, 'RCN-EXC', 1, 'Racing at dawn', 2);
  await saveAnswer(db, memberId, 'RCN-EXC', 2, 'The racer they drafted off', 3);
  let p = await getSessionProgress(db, memberId, 'RCN-EXC');
  assert.equal(p!.currentStep, 3);
  assert.equal(p!.answers['1'], 'Racing at dawn');
  assert.equal(p!.answers['2'], 'The racer they drafted off');
  assert.equal(p!.status, 'in_progress');
  assert.equal(await isSessionClosed(db, memberId, 'RCN-EXC'), false);
  assert.equal(await closeSession(db, memberId, 'RCN-EXC'), true);
  assert.equal(await isSessionClosed(db, memberId, 'RCN-EXC'), true);
  assert.deepEqual(await closedSessionIds(db, memberId), ['RCN-EXC']);
  // closing keeps answers, and a later save doesn't reopen a closed session
  await saveAnswer(db, memberId, 'RCN-EXC', 4, 'the Elite Cyclist');
  p = await getSessionProgress(db, memberId, 'RCN-EXC');
  assert.equal(p!.status, 'closed');
  assert.equal(p!.answers['4'], 'the Elite Cyclist');
});

test('facets: append + case-insensitive dedupe, ordered', async () => {
  const { db, memberId } = await seed();
  assert.equal((await addFacet(db, memberId, 'the Elite Cyclist', 'RCN-EXC')).ok, true);
  assert.equal((await addFacet(db, memberId, 'the elite cyclist')).ok, false); // dupe
  assert.equal((await addFacet(db, memberId, '  ')).ok, false); // empty
  await addFacet(db, memberId, 'the Builder');
  const f = await listFacets(db, memberId);
  assert.deepEqual(f.map((x) => x.text), ['the Elite Cyclist', 'the Builder']);
  assert.equal(f[0]!.sourceSession, 'RCN-EXC');
});

test('cleanFacet normalizes a member phrase into a wearable natural-case self', async () => {
  const { cleanFacet } = await import('../lib/agent/session-guide.ts');
  assert.equal(cleanFacet('An Elite Cyclist'), 'the Elite Cyclist');
  assert.equal(cleanFacet('Builder'), 'the Builder');
  assert.equal(cleanFacet('the Climber.'), 'the Climber');
  assert.equal(cleanFacet('  my Writer  '), 'the Writer');
  assert.equal(cleanFacet(''), '');
});

test('extractFacets (no-API fallback) strips a self already named, so the strip never repeats', async () => {
  const { extractFacets } = await import('../lib/agent/session-guide.ts');
  const key = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY; // force the deterministic path
  try {
    // restates the seeded self verbatim → nothing new to add
    assert.deepEqual(await extractFacets('the Elite Cyclist', ['the Elite Cyclist']), []);
    // a brand-new self → cleaned + kept
    assert.deepEqual(await extractFacets('Entrepreneur', ['the Elite Cyclist']), ['the Entrepreneur']);
  } finally {
    if (key !== undefined) process.env.ANTHROPIC_API_KEY = key;
  }
});

test('the dashboard mirror re-sharpens after a Session, names the selves, and persists', async () => {
  const { refreshIdentityNarrative } = await import('../lib/agent/identity-narrative.ts');
  const key = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY; // deterministic scripted narrative
  try {
    const { db, memberId } = await seed();
    const exc = getSession('RCN-EXC')!;
    for (const s of exc.steps!) await saveAnswer(db, memberId, exc.id, s.n, `their words for step ${s.n}`, s.n + 1);
    await addFacet(db, memberId, 'the Builder', exc.id);

    const out = await refreshIdentityNarrative(db, memberId, exc);
    assert.ok(out && out.includes('the Builder'), 'mirror reflects the named self');

    const stored = (
      await db.query<{ identity_paragraph: string | null }>('select identity_paragraph from member_profile where member_id=$1', [memberId])
    ).rows[0]!.identity_paragraph;
    assert.equal(stored, out, 'the sharpened mirror is persisted');
  } finally {
    if (key !== undefined) process.env.ANTHROPIC_API_KEY = key;
  }
});

test('the mirror refresh is a no-op for a Session with no reflections (nothing to dial in)', async () => {
  const { refreshIdentityNarrative } = await import('../lib/agent/identity-narrative.ts');
  const { db, memberId } = await seed();
  const exc = getSession('RCN-EXC')!;
  const out = await refreshIdentityNarrative(db, memberId, exc); // no answers saved
  assert.equal(out, null);
});

test('Session→Playbook harvest is safe + a no-op with no API key (proposals come from live curation)', async () => {
  const { harvestSessionToPlaybook } = await import('../lib/agent/session-harvest.ts');
  const { listPlaybook } = await import('../lib/playbook/store.ts');
  const key = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const { db, memberId } = await seed();
    const exc = getSession('RCN-EXC')!;
    const answers = { '1': 'the dig scene', '2': 'who I was', '3': 'my story', '4': 'the Builder' };
    const filed = await harvestSessionToPlaybook(db, memberId, exc, answers);
    assert.equal(filed, 0); // no live curation without a key — never throws, never fabricates
    assert.equal((await listPlaybook(db, memberId)).length, 0);
  } finally {
    if (key !== undefined) process.env.ANTHROPIC_API_KEY = key;
  }
});

test('badges earn idempotently (newly-earned signal fires once)', async () => {
  const { db, memberId } = await seed();
  assert.equal(await earnBadge(db, memberId, 'named-yourself'), true);
  assert.equal(await earnBadge(db, memberId, 'named-yourself'), false); // already earned
  assert.deepEqual(await earnedBadgeIds(db, memberId), ['named-yourself']);
});

test('forecast progression: Identity Excavation → Checkpoint → Rewire unlocks', async () => {
  const { getForecast } = await import('../lib/curriculum/view.ts');
  const { db, memberId } = await seed();

  // Fresh: Reconnect is "You're here", the lit asset is the first built Session by order.
  let f = await getForecast(db, memberId);
  assert.equal(f.phases.find((p) => p.phase === 'reconnect')!.status, "You're here");
  assert.equal(f.current!.id, 'RCN-BKQ');

  // Close every built Reconnect Session → the Checkpoint becomes the lit asset (the IDQ measurement is skipped).
  for (const id of ['RCN-BKQ', 'RCN-FDR', 'RCN-EXC', 'RCN-DFT', 'RCN-WIN', 'RCN-WIN-LIST']) {
    await saveAnswer(db, memberId, id, 1, 'x', 1);
    await closeSession(db, memberId, id);
  }
  f = await getForecast(db, memberId);
  assert.equal(f.current!.id, 'RCN-CHK');
  assert.equal(f.phases[0]!.items.find((i) => i.id === 'RCN-EXC')!.state, 'done');

  // Pass the Checkpoint → Reconnect Complete, Rewire active, the checkpoint reads done.
  await setGate(db, memberId, 'reconnect_checkpoint_passed');
  await setGate(db, memberId, 'rewire_unlocked');
  f = await getForecast(db, memberId);
  assert.equal(f.phases.find((p) => p.phase === 'reconnect')!.status, 'Complete');
  assert.equal(f.phases.find((p) => p.phase === 'rewire')!.status, "You're here");
  assert.equal(f.phases[0]!.items.find((i) => i.id === 'RCN-CHK')!.state, 'done');
  // the next stop is Rewire's first authored Session, now openable
  assert.equal(f.current!.id, 'RWR-DIS');
  assert.equal(f.current!.openable, true);
});

test('phase gates: set + check', async () => {
  const { db, memberId } = await seed();
  assert.equal(await hasGate(db, memberId, 'rewire_unlocked'), false);
  await setGate(db, memberId, 'reconnect_core_complete');
  await setGate(db, memberId, 'rewire_unlocked');
  await setGate(db, memberId, 'rewire_unlocked'); // idempotent
  assert.equal(await hasGate(db, memberId, 'rewire_unlocked'), true);
  assert.deepEqual((await listGates(db, memberId)).sort(), ['reconnect_core_complete', 'rewire_unlocked']);
});
