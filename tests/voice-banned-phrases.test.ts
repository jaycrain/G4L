// THE RULE EXISTS; NOTHING CHECKED IT.
//
// "Don't say 'sit with'" has been in the member-agent system prompt for weeks, and again in session-guide's HARD
// VOICE RULES. It governs what the MODEL generates. Nothing governed what WE authored — so on 2026-08-19 there
// were EIGHT live instances of it in our own hand-written copy, across six files, including the line the
// Companion says at a Rewire practice close and the one it says when a member is held back at a Checkpoint.
//
// Donna found two of them by walking the product. That is the expensive way to find a rule you already wrote
// down, and it is the second time this shape has cost a walk: a rule stated in prose, restated in a second
// prompt, and enforced nowhere. See [[one-fact-many-sites]] — a rule with N statements and no test has N places
// to drift and no place to fail.
//
// SCOPE: our AUTHORED strings in the live agent layer. Not the prompts that DEFINE the rules (they must quote the
// banned phrase in order to ban it), not comments, and not parked//data content — a guard that fires on things we
// are not shipping gets muted, and a muted guard is worse than none.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// The files that DECLARE the voice rules. They must contain the banned phrases; that is their job.
const RULE_FILES = new Set(['system-prompt.ts', 'session-guide.ts']);

/** Every authored string in the live agent modules, comments stripped. */
function authoredCopy(): { file: string; text: string }[] {
  const dir = 'lib/agent';
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !RULE_FILES.has(f))
    .map((f) => {
      const raw = readFileSync(join(dir, f), 'utf8');
      const text = raw
        .replace(/\/\*[\s\S]*?\*\//g, '')      // block comments
        .replace(/^\s*\/\/.*$/gm, '')           // whole-line comments (the `m` FLAG — `(?m)` is Python, not JS)
        .replace(/\s\/\/[^\n]*/g, '')           // trailing comments
        // ESCAPE SEQUENCES BECOME SPACES, and this line is why the guard works at all.
        //
        // In the source a bubble reads `…\n\nSit with that a second…`, so "Sit" is preceded by the LETTER n of
        // the \n escape. `\bsit` needs a word boundary and n→S is not one, so the pattern missed it. I proved
        // this by reintroducing a real violation and watching the guard stay green — which is the only reason it
        // was caught, and the reason a source-scanning test has to be shown failing before it is trusted. Nearly
        // every member-facing string in this codebase follows a \n, so the guard was blind to almost all of them.
        .replace(/\\[nrt]/g, ' ');
      return { file: f, text };
    });
}

// Each entry: the banned pattern, and what to do instead — the replacement is part of the rule, because a rule
// written without its alternative gets implemented as a ban and the copy goes flat.
const BANNED: { re: RegExp; why: string }[] = [
  { re: /\bsit with\b/i, why: 'use "let that land" / "give it a minute" / "stay with"' },
  { re: /\bwhat comes up\b/i, why: 'ask "how does that feel" or "what does that make you think about" (Donna, 2026-08-19)' },
  { re: /\bno passing score\b/i, why: 'never reassure about our instruments — say what the reading IS' },
  { re: /\bthis one is yours\b/i, why: 'the "it\'s yours to ___" construction is retired' },
  { re: /\byours to own\b/i, why: 'the "it\'s yours to ___" construction is retired' },
  { re: /\bearned,? not given\b/i, why: 'a slogan, and slogans are the opposite of talking to someone' },
];

test('our AUTHORED copy obeys the voice rules we wrote for the model', () => {
  const hits: string[] = [];
  for (const { file, text } of authoredCopy()) {
    for (const { re, why } of BANNED) {
      const m = text.match(re);
      if (!m) continue;
      const at = text.indexOf(m[0]);
      hits.push(`lib/agent/${file}: "${m[0]}" — ${why}\n    …${text.slice(Math.max(0, at - 50), at + 60).replace(/\s+/g, ' ').trim()}…`);
    }
  }
  assert.deepEqual(hits, [], `authored copy breaking a rule the prompt already states:\n  ${hits.join('\n  ')}`);
});

test('THE GUARD CAN ACTUALLY FAIL — it is not passing because the scan found nothing', () => {
  // The failure mode of a source-scanning test: a wrong path or an over-eager comment strip leaves it scanning an
  // empty string forever, green and useless. Prove there is real copy in front of it.
  const all = authoredCopy();
  assert.ok(all.length > 8, `expected the live agent modules, found ${all.length}`);
  const total = all.reduce((n, f) => n + f.text.length, 0);
  assert.ok(total > 200_000, `expected substantial authored copy, scanned ${total} chars`);
  // And that the patterns match when the phrase IS present.
  assert.ok(BANNED.some((b) => b.re.test('please sit with that for a second')), 'the patterns match real prose');
});

test('the RULE files are exempt, because they must quote what they ban', () => {
  const sp = readFileSync('lib/agent/system-prompt.ts', 'utf8');
  assert.match(sp, /sit with/i, 'the prompt still states the rule');
  assert.ok(RULE_FILES.has('system-prompt.ts'), 'and the scan skips it, or the rule could never be written down');
});
