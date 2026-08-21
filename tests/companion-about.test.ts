// WHAT THE COMPANION KNOWS ABOUT US — and what it must never say.
//
// Asked "who built this", "which company", "does anyone read my conversations", the Companion had NOTHING in its
// context and improvised. The answers were warm, fluent and invented; the worst of them told a member "this is
// between us" — a privacy promise made by something with no knowledge of how her data is held, and one the
// architecture does not keep (the Founders can see her Reclaim List, her Doors, her story and her Playbook on an
// internal view).
//
// These assert the PROMPT, not the model: that the facts are present and no name is. What the model does with
// them is checked by a live probe, not here — but a prompt missing these cannot possibly get it right.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEMBER_AGENT_SYSTEM_PROMPT as PROMPT } from '../lib/agent/system-prompt.ts';
import { CRISIS_RESPONSE_US } from '../lib/agent/governance.ts';

test('NO NAMES. Not the founder, not the science advisor, not anyone', () => {
  // Jay, 2026-08-21: "Let's not name Greg or Jay, ever. Make it Founder(s) only."
  //
  // The prompt itself must not carry a name either. Naming someone in the course of forbidding the name is how
  // the leak happened in the first place: the word was in context, and the model passed it through.
  // MEMBERS' NAMES TOO. Two of the three leaks found when this test was written were a member's — she is a real
  // person whose walk produced those rules, and there is no reason for the Companion to carry her around while
  // talking to somebody else.
  for (const name of ['Greg', 'Welk', 'Jay', 'Crain', 'Donna', 'Jennifer', 'Scott']) {
    assert.doesNotMatch(PROMPT, new RegExp(`\\b${name}\\b`), `"${name}" must not appear in the member prompt`);
  }
});

test('the collective form IS there — it needs something to say instead', () => {
  // A ban with no replacement produces evasion. "That's a founder question" is the answer we want.
  assert.match(PROMPT, /\bFounders\b/, 'the Companion must have a collective term to use');
});

test('PRIVACY is answered from fact, and the promise it cannot keep is named', () => {
  assert.match(PROMPT, /not read as a matter of routine/i, 'must state what is true about reading conversations');
  assert.match(PROMPT, /Founders can see on an internal view/i, 'must state what the Founders CAN see');
  assert.match(PROMPT, /logged/i, 'must state that access is logged');
  // The specific sentence a member most wants to hear, and the one we cannot say.
  assert.match(PROMPT, /between the two of you/i, 'must forbid the "just between us" promise explicitly');
});

test('"I do not know" has somewhere to go', () => {
  assert.match(PROMPT, /message_founder/, 'the escape hatch must be named where the facts run out');
});

test('the CRISIS line names no one — it is the worst possible place for a stranger\'s name', () => {
  // It read "I've also let Jay know". For a charter member who has met him that is reassuring; for everyone after
  // it is an unknown first name arriving in the worst moment of their week, promising that one specific person is
  // now watching. The escalation itself is unchanged and still disclosed.
  assert.match(CRISIS_RESPONSE_US, /988/, '988 stays first — it is the actual help');
  assert.match(CRISIS_RESPONSE_US, /someone here/i, 'the escalation is still disclosed, without a name');
  for (const n of ['Jay', 'Greg']) assert.doesNotMatch(CRISIS_RESPONSE_US, new RegExp(`\\b${n}\\b`));
});

// ── message_founder — the one outbound channel ─────────────────────────────────────────────────────────────────

import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { logFeedback, listFeedback } from '../lib/feedback/store.ts';
import { readFileSync } from 'node:fs';

test('SEAM — the tool is in the array that actually ships to the model', () => {
  // A tool that exists, is unit-tested, and was never wired is a failure this codebase has shipped before: the
  // propose and resolve halves of a gate both existed, both passed, and nothing connected them. Reads the source
  // rather than the export, because the array is module-private.
  const s = readFileSync('lib/agent/checkin.ts', 'utf8');
  const at = s.indexOf("name: 'message_founder'");
  const start = s.lastIndexOf('const REFINE_TOOLS = [', at);
  const end = s.indexOf('\n];', start);
  assert.ok(at > 0, 'the tool must exist');
  assert.ok(at > start && at < end, 'and must sit INSIDE REFINE_TOOLS, which is what reaches the model');
});

test('a member question reaches the queue a person already works down', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = (await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Pat','ask@x.test') returning member_id`,
  )).rows[0]!.member_id;

  const ok = await logFeedback(db, {
    memberId: m,
    author: 'Pat',
    kind: 'question',
    body: 'Who actually reads what I write in here?',
    surface: 'companion',
    context: { context: 'asked mid-Reconnect, before answering the Doors board' },
  });
  assert.equal(ok, true);

  const rows = await listFeedback(db);
  const sent = rows.find((r) => r.surface === 'companion');
  assert.ok(sent, 'it must land in the same queue as the Send Feedback button');
  // WHO asked, WHAT they asked, and the context — the three things Jay asked for.
  assert.equal(sent!.author, 'Pat', 'the founder sees who is asking before reading what is asked');
  assert.match(sent!.body, /Who actually reads/, 'her question, in her words');
  assert.equal(sent!.status, 'new', 'and it enters the workflow unresolved');
});

test('an empty ask is refused rather than filed as a blank question', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  assert.equal(await logFeedback(db, { memberId: null, author: null, kind: 'question', body: '   ' }), false);
});
