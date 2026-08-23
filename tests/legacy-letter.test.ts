// THE LEGACY LETTER — the letter that was never written.
//
// Two independent findings of the same gap: Greg walking the product on 2026-08-04 ("I never really wrote it"),
// and a note left during Donna's walk saying Reclaim's Legacy-revisit beat has nothing to revisit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import {
  LEGACY_PROMPTS, letterDateFor, remainingPrompts, readyToDraft, draftInstruction,
} from '../lib/reconnect/legacy-letter.ts';
import { getLegacyLetter, saveLegacyLetter, shareLegacyLine, updateLegacyLetterBody } from '../lib/reconnect/legacy-letter-store.ts';

async function member(): Promise<{ db: Db; id: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('D','d@x.test') returning member_id`,
  );
  return { db, id: rows[0]!.member_id };
}

test("Greg's six prompts are carried verbatim, in his order", () => {
  assert.equal(LEGACY_PROMPTS.length, 6);
  assert.equal(LEGACY_PROMPTS[0]!.key, 'tuesday');
  assert.equal(LEGACY_PROMPTS[5]!.key, 'unfinished');
  assert.match(LEGACY_PROMPTS[1]!.prompt, /adventure have you completed that you haven't started yet today/);
  assert.match(LEGACY_PROMPTS[4]!.prompt, /measuring stick/);
});

test('the letter is dated one year from THEIR today, not the server\'s', () => {
  assert.equal(letterDateFor('2026-08-16'), '2027-08-16');
  assert.equal(letterDateFor('2026-12-31'), '2027-12-31');
});

test('the Tuesday is not asked twice — the Window beat already drew it out', () => {
  const carried = { tuesday: 'Up at six, coffee on the porch, out on the bike before the house wakes up' };
  const left = remainingPrompts(carried);
  assert.equal(left.length, 5);
  assert.equal(left.some((p) => p.key === 'tuesday'), false, 'we do not re-ask what they just told us');
});

test('four honest answers are enough to draft — six forced ones are not the bar', () => {
  assert.equal(readyToDraft({ tuesday: 'a', adventure: 'b', relationship: 'c' }), false);
  assert.equal(readyToDraft({ tuesday: 'a', adventure: 'b', relationship: 'c', unfinished: 'd' }), true);
  assert.equal(readyToDraft({ tuesday: '   ', adventure: 'b', relationship: 'c', unfinished: 'd' }), false,
    'whitespace is not an answer');
});

test('the draft instruction carries their words and forbids ours', () => {
  const inst = draftInstruction(
    { tuesday: 'coffee on the porch before the house wakes up', unfinished: 'the ride I never finished' },
    'August 16, 2027',
  );
  assert.match(inst, /coffee on the porch/, 'their exact words go to the composer');
  assert.match(inst, /the ride I never finished/);
  assert.match(inst, /August 16, 2027/, 'and the date it is addressed to');
  assert.match(inst, /must sound like THEM/i);
  assert.match(inst, /NEVER: praise them/, 'no praise — the standing voice rule reaches the letter too');
  assert.match(inst, /END ON THE UNFINISHED BUSINESS/, "Greg: it is meant to stay open");
  assert.equal(/relationship has deepened/.test(inst), false, 'unanswered prompts are not smuggled in as prose');
});

test('it persists, and revision is the designed path rather than an edge case', async () => {
  const { db, id } = await member();
  const first = await saveLegacyLetter(db, id, {
    body: 'Dear me — you kept going.', answers: { tuesday: 'coffee on the porch' }, datedFor: '2027-08-16',
  });
  assert.equal(first.ok, true);
  const revised = await saveLegacyLetter(db, id, {
    body: 'Dear me — you kept going, and the bike is back under you.', datedFor: '2027-08-16',
  });
  assert.equal(revised.ok, true, 'a member revising their own letter is the point');
  const got = await getLegacyLetter(db, id);
  assert.match(got!.body, /the bike is back under you/);
  assert.equal(got!.datedFor, '2027-08-16');
});

test('their raw answers survive beside the composed letter', async () => {
  // The letter is a MODEL DRAFT. If it is ever regenerated, their own words must still be there to draft from.
  const { db, id } = await member();
  await saveLegacyLetter(db, id, {
    body: 'composed', answers: { tuesday: 'coffee on the porch', unfinished: 'the ride' }, datedFor: '2027-08-16',
  });
  const got = await getLegacyLetter(db, id);
  assert.equal(got!.answers.tuesday, 'coffee on the porch', 'jsonb read back in JS, never queried in SQL');
  assert.equal(got!.answers.unfinished, 'the ride');
});

test('a blank letter is refused — that is not a letter', async () => {
  const { db, id } = await member();
  assert.equal((await saveLegacyLetter(db, id, { body: '   ', datedFor: '2027-08-16' })).ok, false);
  assert.equal(await getLegacyLetter(db, id), null);
});

test('sharing stores ONE sentence — the letter itself never leaves', async () => {
  const { db, id } = await member();
  await saveLegacyLetter(db, id, { body: 'Line one.\nLine two.\nLine three.', datedFor: '2027-08-16' });
  await shareLegacyLine(db, id, 'In a year I want to be the person who planned the trip.');
  const got = await getLegacyLetter(db, id);
  assert.equal(got!.sharedLine, 'In a year I want to be the person who planned the trip.');
  assert.match(got!.body, /Line two/, 'the full letter stays private');
});

test('no letter yet reads as null, not as an empty letter', async () => {
  const { db, id } = await member();
  assert.equal(await getLegacyLetter(db, id), null);
});

// THE SEAM — the letter is reachable end to end. Each half of this has been correct and disconnected before
// (the store existed for a day with no importer at all), so what is asserted here is the WIRING.
test('the letter is written by the arc, dated by the action, and rendered in the Playbook', async () => {
  const { readFileSync } = await import('node:fs');

  // 1. The beat exists and sits between the Window and the Checkpoint.
  const arc = readFileSync('lib/agent/reconnect.ts', 'utf8');
  assert.match(arc, /stageOrder: \['entry', 'doors', 'measurement', 'drift', 'window', 'legacy', 'checkpoint', 'ceremony'\]/,
    'the legacy beat is in the sequence, after the Window');
  assert.match(arc, /name: 'record_legacy_letter'/, 'the model has a tool to draft with');
  assert.match(arc, /b\.stage = 'legacy'/, 'and the Window hands into it');

  // 2. The action persists it — and stamps the date in the MEMBER's timezone, not the engine's.
  const action = readFileSync('app/reconnect/actions.ts', 'utf8');
  assert.match(action, /saveLegacyLetter\(db, memberId, \{ body, datedFor: letterDateFor\(today\) \}\)/, 'persisted');
  assert.match(action, /const today = await memberToday\(db, memberId\)/, 'dated in THEIR timezone');

  // 3. It renders, on the Who you are tab, and is not gated on its own date.
  const view = readFileSync('app/playbook/[memberId]/redesign-playbook-view.tsx', 'utf8');
  // Matches `letterBody`, the local state the card renders from since the letter became editable (the prop seeds
  // it, and a successful save replaces it so her edit is on screen immediately). The title assertion is the
  // durable half — it survives the next rename, which this one did not.
  assert.match(view, /tab === 'who' && letterBody/, 'renders on Who you are');
  assert.match(view, /Your Legacy Letter/, 'the card is still titled');
  assert.match(view, /editLegacyLetterAction\(memberId/, 'and it is editable — the product promises this twice');
  assert.doesNotMatch(view, /legacyLetter[^\n]*(?:new Date\(\)|Date\.now)/, 'never gated on today — the date is a dedication, not a timer');
  const page = readFileSync('app/playbook/[memberId]/page.tsx', 'utf8');
  assert.match(page, /getLegacyLetter\(db, memberId\)/, 'the page loads it');
});


// EDITING THE LETTER KEEPS ITS DATE AND HER ANSWERS.
//
// The product promised this from the day the letter shipped -- "change it whenever it stops being true", said on
// save and repeated in the Member Agent's context -- with no way to do it. These pin the two things that made a
// naive edit path dangerous, both of which would have failed silently.
test('editing the letter does NOT move its date — the day it is addressed to is the promise', async () => {
  const { db, id } = await member();
  await saveLegacyLetter(db, id, {
    body: 'The first draft.',
    answers: { tuesday: 'up early, out on the bike', unfinished: 'the century ride' },
    datedFor: '2027-08-23',
  });

  const ok = await updateLegacyLetterBody(db, id, 'The version I actually meant.');
  assert.equal(ok.ok, true);

  const after = await getLegacyLetter(db, id);
  assert.equal(after!.body, 'The version I actually meant.');
  // If this ever re-stamps, the letter she opens "in a year" is always a year away.
  assert.equal(after!.datedFor, '2027-08-23', 'the edit moved the date the letter is addressed to');
});

test('editing the letter does NOT wipe the answers it was drafted from', async () => {
  const { db, id } = await member();
  await saveLegacyLetter(db, id, {
    body: 'Draft.',
    answers: { tuesday: 'up early, out on the bike', unfinished: 'the century ride' },
    datedFor: '2027-08-23',
  });

  await updateLegacyLetterBody(db, id, 'Revised.');

  const after = await getLegacyLetter(db, id);
  // saveLegacyLetter upserts `answers = excluded.answers`, so reusing it for an edit would blank these with no
  // error. That is why the edit path is its own function.
  assert.deepEqual(after!.answers, { tuesday: 'up early, out on the bike', unfinished: 'the century ride' });
});

test('an edit is not a creation path, and a blank letter is refused', async () => {
  const { db, id } = await member();
  const none = await updateLegacyLetterBody(db, id, 'Trying to edit a letter that was never written.');
  assert.equal(none.ok, false);
  assert.equal(none.reason, 'no_letter');
  assert.equal(await getLegacyLetter(db, id), null, 'an edit must never conjure a letter with no date or answers');

  await saveLegacyLetter(db, id, { body: 'Real.', answers: {}, datedFor: '2027-08-23' });
  const blank = await updateLegacyLetterBody(db, id, '   ');
  assert.equal(blank.ok, false);
  assert.equal(blank.reason, 'empty');
  assert.equal((await getLegacyLetter(db, id))!.body, 'Real.', 'a blank save must not destroy the letter');
});

// RECLAIM FINALLY REVISITS THE LETTER.
//
// This beat used to point at "the words you wrote near the start", with a note in the source explaining that the
// Legacy Letter "isn't wired into the live arc, so this beat pointed at something they never made". Closing this
// loop is the REASON Greg moved the letter into Reconnect: a member should leave the first R holding a
// destination, so Reclaim can be a reflection on what was accomplished.
test('the Reclaim ceremony revisits the actual letter when there is one', async () => {
  const { buildReclaimCeremonyBeats, RECLAIM_CEREMONY_COPY } = await import('../lib/ceremony/reclaim-ceremony-beats.ts');

  const beats = buildReclaimCeremonyBeats({
    grinta: null,
    keepers: ['Ride the century'],
    legacyLetter: { body: 'I hope you kept riding.', datedFor: '2027-08-23' },
  });

  const legacy = beats.find((b) => b.reveal?.kind === 'legacy');
  assert.ok(legacy, 'no legacy revisit beat was produced');
  assert.equal(legacy!.text, RECLAIM_CEREMONY_COPY.legacy);
  assert.equal((legacy!.reveal as { body: string }).body, 'I hope you kept riding.');

  // IT MUST NOT REPRODUCE THE LETTER IN THE SPOKEN BEAT. The Member Agent is told never to quote it unprompted —
  // "a letter someone wrote to themselves is not a lever". The beat names it; the reveal is behind her tap.
  assert.ok(!legacy!.text.includes('I hope you kept riding.'),
    'the ceremony read her private letter aloud instead of offering it');
});

test('a member with no letter still gets a Legacy beat — the old copy, not a blank', async () => {
  const { buildReclaimCeremonyBeats, RECLAIM_CEREMONY_COPY } = await import('../lib/ceremony/reclaim-ceremony-beats.ts');

  // Everyone who came through before the letter existed lands here, so this is the ORDINARY case, not an edge.
  const beats = buildReclaimCeremonyBeats({ grinta: null, keepers: [], legacyLetter: null });

  assert.ok(!beats.some((b) => b.reveal?.kind === 'legacy'), 'offered a letter that does not exist');
  assert.ok(beats.some((b) => b.text === RECLAIM_CEREMONY_COPY.legacyNone),
    'the Legacy beat vanished entirely for a member without a letter');
});
