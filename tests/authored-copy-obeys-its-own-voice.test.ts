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

const BANNED: Array<[RegExp, string]> = [
  [/\bquiet(ly)?\b/i, '"quiet/quietly" — the gate deletes it from the model; we may not write it either'],
  [/shape of it|put a shape on|\bits shape\b/i, '"the shape of it" — says nothing. Name the thing.'],
];

/** A comment may quote the banned copy to explain why it went — that is the record, not a violation. */
const isComment = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line);

test('no member-facing copy file uses a word the Companion is forbidden to say', () => {
  const hits: string[] = [];
  for (const f of COPY_FILES) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (isComment(line)) return;
      for (const [re, why] of BANNED) if (re.test(line)) hits.push(`${f}:${i + 1} — ${why}\n    ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(hits, [], `authored copy breaks our own voice rules:\n${hits.join('\n')}`);
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
