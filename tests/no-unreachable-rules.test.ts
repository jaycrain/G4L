// AUTHORED COPY AND ENGINE BOUNDS MUST BE REACHABLE.
//
// Jay, 2026-08-28, after the third one in two days: "are there other rules written incorrectly and not shipped
// or reachable?" This test is the answer, kept running.
//
// THE CLASS. A rule gets written, reviewed, and committed — and never executes. Nothing errors, nothing is
// missing, no test fails, and the only way anyone finds out is a founder on a walk noticing the product doesn't
// do the thing the code plainly says it does. The instances so far:
//   · gapOpen's Doors de-dup, reading a `history` parameter no caller passed        → the paragraph twice
//   · IDENTITY_PICK_OFFER behind `modelText || …`, so it showed only if the model was silent → chips unframed
//   · W3_PROTOCOL_INTRO, declared with no readers                                    → the three moves unannounced
//   · the CTA's own flex-shrink absorbing overflow                                   → the button that kept moving
//   · GAP_MORE_MAX, a cap that was "a comment, not code" (found earlier, same shape)
//
// WHAT THIS CATCHES is the cheapest and most common signature: a module-level constant that is declared and then
// never read. That is what W3_PROTOCOL_INTRO looked like, and what GAP_MORE_MAX looked like.
//
// WHAT IT DELIBERATELY DOES NOT DO is fail on every unused export. Plenty of exported constants are legitimately
// consumed only by other packages, tests, or not yet — the allowlist below records each one WITH THE REASON,
// which is the actual value here: an unreferenced constant becomes a decision someone wrote down instead of a
// thing nobody noticed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const AGENT = join(ROOT, 'lib/agent');

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return tsFiles(p);
    return p.endsWith('.ts') ? [p] : [];
  });
}
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/**
 * KNOWN-UNREFERENCED, each with the reason it is allowed to be. Adding a name here is a claim that you looked.
 */
const ALLOWED = new Map<string, string>([
  // 988 is hard-coded in CRISIS_REPLY itself, so crisis routing works — this constant is a second copy of the
  // same fact rather than a dead guard. Left in place deliberately; folding the string onto it would be the
  // right cleanup but it is a governance path and not one to refactor casually.
  ['CRISIS_HOTLINE_US', 'duplicate of the number already inline in CRISIS_REPLY; routing verified working'],
  // The conversational Reclaim draw-out was RETIRED on 2026-08-22 when the list became a structured builder
  // ("the conversation in front of it is gone"). These are its remnants — dead by design, not unreachable
  // guards. Wiring them back would restore a flow we deliberately removed.
  ['RECLAIM_DRAWOUT_MAX', 'remnant of the retired conversational reclaim draw-out (widget-first, 2026-08-22)'],
  ['RECLAIM_MORE', 'remnant of the retired conversational reclaim draw-out'],
  ['RECLAIM_SOFT_HOLD', 'remnant of the retired conversational reclaim draw-out'],
  ['SKIP_OFFER', 'superseded by SKIP_OFFER_VARIANTS + skipOffer(), which rotate it'],
  ['GAP_LABEL', 'contract-layer label, not member-facing; kept for the artifact schema'],
]);

test('no member-facing constant in the agent engine is declared and never read', () => {
  const files = tsFiles(AGENT);
  // DECLARED in lib/agent, but READ from anywhere — the first version of this scanned only lib/agent for
  // readers and reported the four Reconnect arcs as orphans, when app/reconnect/actions.ts imports every one of
  // them. A guard against unreachable code that cannot see half the callers invents its own false positives,
  // and a test that cries wolf is how the real hit gets waved through.
  const corpus = [...tsFiles(AGENT), ...tsFiles(join(ROOT, 'lib')), ...tsFiles(join(ROOT, 'app'))]
    .map((f) => strip(readFileSync(f, 'utf8'))).join('\n');

  const orphans: string[] = [];
  for (const file of files) {
    const src = strip(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/^(?:export )?const ([A-Z][A-Z0-9_]{3,})\s*[:=]/gm)) {
      const name = m[1]!;
      if (ALLOWED.has(name)) continue;
      const reads = (corpus.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length;
      if (reads <= 1) orphans.push(`${file.slice(ROOT.length)} — ${name}`);
    }
  }

  assert.deepEqual(
    orphans,
    [],
    'declared and never read. Either wire it to the moment it was written for, or add it to ALLOWED with the ' +
      `reason it is dead:\n  ${orphans.join('\n  ')}`,
  );
});

test('the W3 protocol announces itself before the first move', () => {
  // The instance that prompted the sweep. The member finishes the trigger draw-out and the next thing they read
  // should say a plan is starting and that it has three parts — not open mid-plan on "First, Redirect —".
  const src = readFileSync(join(AGENT, 'rewire.ts'), 'utf8');
  assert.match(strip(src), /W3_PROTOCOL_INTRO\}\$\{BEAT_SEP\}/,
    'the frame leads the protocol step, as its own beat before the model poses the first move');
});
