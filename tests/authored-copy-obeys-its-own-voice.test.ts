// THE VOICE RULES APPLY TO US, NOT JUST TO THE COMPANION.
//
// `system-prompt.ts` forbids the model from saying "the shape of it" ("says nothing. Name the thing") and
// `applyVoiceGate` strips "quiet/quietly" from model output at runtime. Neither has ever run over the copy WE
// write, so both appeared repeatedly in authored strings — including in the graceful-degradation fallback the
// Companion falls back to when the model returns nothing.
//
// Donna hit them on 2026-08-27 and asked directly: "What would happen if we just eliminated the word quiet
// completely?" She was reading OUR words, not the model's, which is why the gate we shipped for this did nothing.
//
// SCOPE IS DELIBERATE. This covers member-facing authored strings. It does NOT cover model prompts, whose text is
// instruction rather than copy and whose output the runtime gate already cleans — banning the word there would
// make it impossible to TELL the model what not to say.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/** Files that are member-facing copy end to end. Prompt modules are excluded and listed separately below. */
const COPY_FILES = [
  'lib/content/summaries.ts',
  'lib/content/explore.ts',
  'lib/content/doors-board.ts',
  'lib/content/where-it-lives.ts',
  'lib/content/session-tracker.ts',
  'lib/curriculum/content/reconnect.ts',
  'lib/curriculum/content/rewire.ts',
  'lib/curriculum/content/rebuild.ts',
  'lib/curriculum/content/reclaim.ts',
];

// THE WHOLE BAN LIST, not two of it. This carried only `quiet` and `shape of it` while system-prompt.ts bans ten
// things, so a sweep on 2026-08-28 found "I hear you", "does that land" and "sitting with" sitting in live
// member-facing strings — including the line that asks a member to rule on their own fade story. A guard that
// enforces a fifth of a rule reads, from the outside, exactly like a guard. [[one-fact-many-sites]]
const BANNED: Array<[RegExp, string]> = [
  [/\bquiet(ly)?\b/i, '"quiet/quietly" — the gate deletes it from the model; we may not write it either'],
  [/shape of it|put a shape on|\bits shape\b/i, '"the shape of it" — says nothing. Name the thing.'],
  [/\bI hear you\b/i, '"I hear you" — named in the voice rules as filler'],
  [/\bsitting with\b|\bholding space\b/i, '"sitting with" / "holding space" — cut'],
  [/\b(does|did) that land\b|\bthat lands\b/i, '"does that land" — ask "is that right" instead'],
  [/earned, not given/i, '"earned, not given" — a slogan, and slogans are the opposite of talking to someone'],
  [/\bno scor(es|ing)\b/i, '"no scores" — never reassure a member about our instruments'],
  [/not a (score|grade|test|judgment)\b|no wrong answers/i, 'reassurance about an instrument — say what it IS'],
  [/\b(it'?s|they'?re) yours to \w+/i, '"it\'s yours to ___" — say the thing plainly'],
  // THE BURDEN SENSE ONLY. The ban is on "what you've been carrying" as a paraphrase of their life in our words;
  // "are you carrying it yet" (carrying the reclaimed identity forward) is a different verb doing a different
  // job, and my first pass flagged it. A rule that fires on the wrong sense trains people to ignore it.
  [/\b(been|be) carrying\b(?!\s+it\b)|\bcarrying (all of )?(that|this)\b/i, '"carrying" — use their words, or say what happened'],
];

/** A comment may quote the banned copy to explain why it went — that is the record, not a violation. */
const isComment = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line);

/**
 * PER-TURN STEERING is instruction, not copy. These modules build the model's next-turn note inline rather than in
 * a top-of-file constant, so the position rule below cannot see them; they are marked by "RIGHT NOW", which is the
 * convention this codebase already uses for them.
 */
const isSteering = (line: string) => /RIGHT NOW/.test(line);

/**
 * KNOWN AND KEPT, with the reason. Adding a line here is a claim that someone looked and decided.
 */
const ALLOWED: Array<[RegExp, string]> = [
  // (Empty. The one entry here — the Reclaim invitation anecdote — was resolved rather than exempted: Jay had it
  // attributed to him, which fixed a governance problem the voice rule had only incidentally surfaced. An
  // allowlist that stays empty is the goal; an entry in it should feel like a debt.)
];
const isAllowed = (line: string) => ALLOWED.some(([re]) => re.test(line));

test('no member-facing copy file uses a word the Companion is forbidden to say', () => {
  const hits: string[] = [];
  for (const f of COPY_FILES) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (isComment(line) || isSteering(line) || isAllowed(line)) return;
      for (const [re, why] of BANNED) if (re.test(line)) hits.push(`${f}:${i + 1} — ${why}\n    ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(hits, [], `authored copy breaks our own voice rules:\n${hits.join('\n')}`);
});

/**
 * The agent modules that hold BOTH authored copy and model prompts. Everything from the first prompt constant to
 * the end of the file is instruction, not copy — telling a model what not to say requires saying it.
 */
const MIXED: Array<[string, RegExp[]]> = [
  ['lib/agent/reconnect.ts', [/^export const RECONNECT_TOOLS/m, /^const RECONNECT_SYSTEM/m]],
  ['lib/agent/onboarding-staged.ts', [/^export const STAGED_SYSTEM/m, /^const STAGED_SYSTEM/m, /^export const STAGED_TOOLS/m]],
  ['lib/agent/rewire.ts', [/^const REWIRE_SYSTEM/m, /^export const REWIRE_TOOLS/m]],
];

test('nor the copy a member reads in any mixed module', () => {
  // reconnect.ts had its own test; the same fault was live in onboarding-staged.ts and unguarded, which is where
  // the gap confirm and the "I hear you" follow-up both sat.
  const hits: string[] = [];
  for (const [file, markers] of MIXED) {
    const raw = readFileSync(file, 'utf8');
    const starts = markers.map((re) => raw.search(re)).filter((i) => i >= 0);
    const src = (starts.length ? raw.slice(0, Math.min(...starts)) : raw).split('\n');
    src.forEach((line, i) => {
      if (isComment(line) || isSteering(line) || isAllowed(line)) return;
      for (const [re, why] of BANNED) if (re.test(line)) hits.push(`${file}:${i + 1} — ${why}\n    ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(hits, [], `member-facing copy breaks our own voice rules:\n${hits.join('\n')}`);
});

test('and neither does the copy a member reads inside Reconnect', () => {
  // reconnect.ts holds both prompts and authored member strings. Only the authored ones are checked: a line that
  // is part of a model instruction is exempt, because telling the model what not to say requires saying it.
  const raw = readFileSync('lib/agent/reconnect.ts', 'utf8');
  // EXEMPT BY POSITION, NOT BY KEYWORD. The model prompts in this file are the RECONNECT_TOOLS and
  // RECONNECT_SYSTEM constants; from the first of them to the end of the file is instruction, not copy. A
  // keyword heuristic ("skip lines containing NEVER") was the first attempt and it leaked both ways — it let
  // prompt lines through and would have exempted member copy that happened to contain the word.
  const promptStart = Math.min(
    ...[/^export const RECONNECT_TOOLS/m, /^const RECONNECT_SYSTEM/m]
      .map((re) => raw.search(re)).filter((i) => i >= 0),
  );
  const src = raw.slice(0, promptStart).split('\n');
  const hits: string[] = [];
  src.forEach((line, i) => {
    if (isComment(line)) return;
    for (const [re, why] of BANNED) if (re.test(line)) hits.push(`reconnect.ts:${i + 1} — ${why}\n    ${line.trim().slice(0, 100)}`);
  });
  assert.deepEqual(hits, [], `member-facing Reconnect copy breaks our own rules:\n${hits.join('\n')}`);
});

test('the rule itself still exists to be broken', () => {
  // If someone deletes the ban from the system prompt, these tests would pass for the wrong reason.
  const prompt = readFileSync('lib/agent/system-prompt.ts', 'utf8');
  assert.match(prompt, /shape of it/, 'the system prompt no longer bans "the shape of it"');
  const gate = readFileSync('lib/agent/voice-gate.ts', 'utf8');
  assert.match(gate, /quiet/i, 'the voice gate no longer strips "quiet"');
});
