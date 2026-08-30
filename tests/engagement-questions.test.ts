import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { mirrorEngageQuestion } from '../lib/agent/reconnect.ts';
import { ASSET_SUMMARIES } from '../lib/content/summaries.ts';

/**
 * THE DOORWAY INVARIANT — a Session's opening question must be answerable by someone who has not yet seen what it
 * opens onto.
 *
 * Donna, 2026-08-30, on R1: "Don't ask 'which part do you expect to read hardest'. The person doesn't know what's
 * coming up so there is no way to know how to answer it. And 'read hardest' isn't any kind of normal English."
 *
 * She was right, and the interesting part is that she was right about ONE of the five. B1, B2, the Checkpoint and
 * C2 all ask about the member's own past or present — answerable the moment they are read. R1 alone asked her to
 * forecast an instrument she had not been shown. So the formula was sound and a single instance had drifted out
 * of it, which is exactly the kind of thing that comes back when a sixth doorway is written next month.
 *
 * These tests are SOURCE-LEVEL by design. They discover every `*_ENGAGE_Q` in lib/agent rather than importing a
 * fixed list, so a doorway added later is covered without anyone remembering to add it here. A test that only
 * knows about today's five would pass forever while the rule quietly stopped applying — this repo's signature
 * fault, and the reason `scripts/unrun-rules.mjs` exists.
 */

const AGENT_SOURCES = ['reconnect.ts', 'rebuild.ts', 'reclaim.ts', 'rewire.ts', 'onboarding-staged.ts'].map((f) => ({
  file: f,
  text: readFileSync(new URL(`../lib/agent/${f}`, import.meta.url), 'utf8'),
}));

/** Every authored doorway question in the codebase: `NAME_ENGAGE_Q = '...'` or `= "..."`. */
function allEngageQuestions(): { file: string; name: string; text: string }[] {
  const found: { file: string; name: string; text: string }[] = [];
  for (const { file, text } of AGENT_SOURCES) {
    const re = /(\w*ENGAGE_Q)\s*(?::\s*string)?\s*=\s*\n?\s*(['"])([\s\S]*?)\2/g;
    for (const m of text.matchAll(re)) found.push({ file, name: m[1], text: m[3] });
  }
  return found;
}

test('every doorway question is discovered — the scan itself still works', () => {
  const qs = allEngageQuestions();
  // If this drops to zero the regex has rotted and every assertion below silently passes on an empty list.
  assert.ok(qs.length >= 4, `expected the authored doorway questions, found ${qs.length}`);
  const names = qs.map((q) => q.name);
  for (const required of ['B1_ENGAGE_Q', 'B2_ENGAGE_Q', 'C2_ENGAGE_Q', 'CHECKPOINT_ENGAGE_Q']) {
    assert.ok(names.includes(required), `${required} must be in the scan`);
  }
});

test('no doorway asks the member to forecast the instrument behind it', () => {
  // The tells from the phrasing Donna could not answer. Each is banned as a PHRASE, not a word, so ordinary uses
  // of "this" and "expect" stay legal — "what do you expect to be hardest" about their OWN list is fine.
  const banned = [
    /which part of this/i,
    /read hardest/i,
    /\bexpect (?:this|it) to (?:read|feel|go)\b/i,
    /before we start\b/i, // says nothing; every doorway is before we start
  ];
  const offenders: string[] = [];
  for (const q of allEngageQuestions()) {
    for (const b of banned) if (b.test(q.text)) offenders.push(`${q.name} (${q.file}) matches ${b}`);
  }
  assert.deepEqual(offenders, [], 'a doorway question asks about something the member has not seen yet');
});

test('every doorway question is a single question, ending in a question mark', () => {
  for (const q of allEngageQuestions()) {
    assert.ok(q.text.trim().endsWith('?'), `${q.name} must end in a question mark`);
    assert.ok(q.text.length < 160, `${q.name} is a question, not a paragraph`);
  }
});

test("R1's doorway names the member's own Reclaim List items", () => {
  const asked = mirrorEngageQuestion({ reclaimList: ['Play music again', 'Ride with my son', 'Sleep through'] });
  assert.match(asked, /Play music again, Ride with my son, Sleep through/);
  assert.match(asked, /which one do you expect to be the hardest\?$/);
});

test("R1's doorway caps the recital at three, and still scopes to the whole list", () => {
  const asked = mirrorEngageQuestion({ reclaimList: ['One', 'Two', 'Three', 'Four', 'Five'] });
  assert.ok(!asked.includes('Four'), 'names at most three, so the question stays a sentence');
  assert.match(asked, /Of everything on your Reclaim List/);
});

test("R1's doorway never opens onto a blank question", () => {
  // Unreachable in practice — the completion contract guarantees the list — but a doorway that renders an empty
  // question is worse than one that renders a general one.
  for (const c of [{}, { reclaimList: [] }, { reclaimList: ['', '   '] }]) {
    const asked = mirrorEngageQuestion(c);
    assert.match(asked, /^Of everything on your Reclaim List, which one do you expect to be the hardest\?$/);
  }
});

test('the measuring stick is said ONCE on the R1 opening screen, not twice', () => {
  // Donna's repetition note, locked. R1-41 lives in the "Why this matters" card; MIRROR_FRAME must not repeat it,
  // because the two render one above the other and a member reads them as one screen.
  const reconnect = AGENT_SOURCES.find((s) => s.file === 'reconnect.ts')!.text;
  const frame = /const MIRROR_FRAME =([\s\S]*?);\n/.exec(reconnect)?.[1] ?? '';
  assert.ok(frame.length > 0, 'MIRROR_FRAME must still be findable');
  assert.ok(!/measuring stick/i.test(frame), 'MIRROR_FRAME repeats the card directly above it');
  assert.match(ASSET_SUMMARIES.r1.full, /measuring stick/i, "R1-41 must still be said in the card");
});

test('the R1 card names the format plainly — a member knows questions are coming', () => {
  // Donna: "needs to explain that this is an assessment." Jay's ruling: say ANSWERING QUESTIONS, not "assessment".
  assert.match(ASSET_SUMMARIES.r1.full, /answer a set of questions/i);
  assert.ok(!/\bassessment\b/i.test(ASSET_SUMMARIES.r1.full), 'clinical register — say what happens instead');
});
