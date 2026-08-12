import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A SESSION THAT OPENS A PRACTICE WEEK MUST SAY SO, AND SAY WHERE.
//
// Jay finished Quality Days and reported "no tracker was set up". The tracker WAS set up — but nothing in the
// close mentioned it, and the two closes that DID point somewhere pointed at the Dashboard, which stopped being
// where practice weeks live on 2026-08-08 when they moved to the Playbook's This week tab. A member who follows
// the instruction and finds nothing concludes the tool is broken, and they are not wrong.
//
// This is a CLASS test, not three assertions about three sessions: a new practice week added next year gets the
// same requirement for free, which is the only way "we forgot the hand-off" stops recurring.

const DESTINATION = /This week in your Playbook/;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Which kinds a Session route actually opens, read from the code rather than from a list that can drift. */
function kindsOpenedIn(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  return [...src.matchAll(/startPracticeWeek\([^)]*?'(\w+)'/g)].map((m) => m[1]!);
}

// w2_image is EXEMPT and that is deliberate, not an oversight: its week has nothing countable, so weekGrids
// filters it out and there is no grid to hand anyone to. Pointing at a tab that will not show their week would
// be worse than saying nothing.
const NO_GRID = new Set(['w2_image']);

test('EVERY SESSION THAT OPENS A WEEK NAMES WHERE THAT WEEK LIVES', () => {
  const routes = walk('app').filter((f) => readFileSync(f, 'utf8').includes('startPracticeWeek('));
  assert.ok(routes.length >= 3, `found the routes that open weeks (saw ${routes.length})`);

  const missing: string[] = [];
  for (const route of routes) {
    const kinds = kindsOpenedIn(route).filter((k) => !NO_GRID.has(k));
    if (!kinds.length) continue;
    // The close copy lives in the phase's agent module, beside the arc — check the whole module, since a close is
    // assembled from several constants and asserting on one by name would rot the moment it is renamed.
    const phase = route.includes('rewire') ? 'rewire' : route.includes('rebuild') ? 'rebuild' : 'reclaim';
    const copy = readFileSync(`lib/agent/${phase}.ts`, 'utf8');
    if (!DESTINATION.test(copy)) missing.push(`${phase} opens ${kinds.join(', ')} and never names This week`);
  }
  assert.deepEqual(missing, [], missing.join('\n'));
});

test('NO CLOSE STILL SENDS THEM TO THE DASHBOARD FOR A PRACTICE WEEK', () => {
  // The specific rot: copy written before the move, left pointing at a surface that no longer carries the log.
  const offenders: string[] = [];
  for (const f of ['lib/agent/rewire.ts', 'lib/agent/rebuild.ts', 'lib/agent/reclaim.ts']) {
    for (const [i, line] of readFileSync(f, 'utf8').split('\n').entries()) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // a comment may describe the old copy to explain the change
      if (/log (each day|it|them)?\s*(from|on|in) your dashboard/i.test(line)) offenders.push(`${f}:${i + 1}`);
      if (/find it at the top of your Dashboard/i.test(line)) offenders.push(`${f}:${i + 1}`);
    }
  }
  assert.deepEqual(offenders, [], `still pointing at the Dashboard for a practice week:\n${offenders.join('\n')}`);
});
