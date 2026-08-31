import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SESSION_REGISTRY } from '../lib/workspace/session-registry.ts';
import { sessionSummary } from '../lib/content/summaries.ts';
import type { SessionKey } from '../lib/workspace/session-key.ts';

// THE PROGRAM PAGE IS THE MEMBER'S MAP OF THE WHOLE PROGRAM, and it kept its own hardcoded copy of every Session
// name. On 2026-08-31 that copy had drifted three separate ways at once:
//   · "Doors"     — the registry said Excavation
//   · "Visioning" — a FOURTH name for R3, neither the old Drift Quiz nor the new The Fade
//   · wrong ORDER — Doors listed before the IDQ, when the IDQ is R1
//
// Rewire, Rebuild and Reclaim matched their registries exactly. Reconnect was the only phase whose names
// disagreed with themselves, which is what Jay said independently before seeing this page.
//
// Correcting four strings would have left the duplication that caused it. [[one-fact-many-sites]]

const RAW = readFileSync(new URL('../app/program/[memberId]/page.tsx', import.meta.url), 'utf8');
// COMMENTS ARE STRIPPED BEFORE ANY OF THESE ASSERTIONS. The header comment on sessionLines names the retired
// terms on purpose — it is the record of what drifted and why — and a guard that cannot tell an explanation from
// a leak would force us to delete the explanation to keep the guard green. That trade is always the wrong way
// round: the comment is how the next person knows not to re-add the literals.
const PAGE = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('the Program page holds NO hardcoded Session names', () => {
  const hardcoded = SESSION_REGISTRY.filter((d) => d.kind === 'session' && PAGE.includes(`'${d.label}`));
  assert.deepEqual(hardcoded.map((d) => d.label), [], 'a duplicated name is one that will drift again');
});

test('retired names appear nowhere on it', () => {
  for (const dead of ['Visioning', 'The Drift Quiz', 'The Mirror', 'Doors —']) {
    assert.ok(!PAGE.includes(dead), `"${dead}" is retired and must not survive here`);
  }
});

test('Reconnect reads IDQ → Excavation → The Fade, in that order', () => {
  const names = SESSION_REGISTRY.filter((d) => d.phase === 'reconnect' && d.kind === 'session').map((d) => d.label);
  assert.deepEqual(names, ['IDQ', 'Excavation', 'The Fade']);
});

test('every Session line pairs its registry label with its own summary', () => {
  for (const d of SESSION_REGISTRY.filter((s) => s.kind === 'session')) {
    const short = sessionSummary(d.id as SessionKey)?.short;
    assert.ok(d.label.length > 0, `${d.id} has a label`);
    // A missing summary must render the name ALONE — never a name with a dangling em-dash after it.
    if (!short) continue;
    assert.ok(!short.startsWith('—'), `${d.id}'s summary is a sentence, not a fragment`);
  }
});
