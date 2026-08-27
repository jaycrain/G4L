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

/**
 * Which kinds a Session route actually opens, read from the code rather than from a list that can drift.
 *
 * IT USED TO READ THE WRONG ARGUMENT. The old pattern was `startPracticeWeek\([^)]*?'(\w+)'` — non-greedy, so it
 * stopped at the FIRST quoted token inside the parentheses. Rewire's call is
 * `startPracticeWeek(db, memberId, session === 'w3' ? 'w3_logging' : 'w2_image')`, so it extracted `w3` — the
 * ternary's condition, a SESSION KEY — and never saw either kind. The copy assertion above still passed, because
 * `w3` is not in NO_GRID so it went on to check the module anyway. A test passing for the wrong reason.
 *
 * Now it takes every quoted token in the call and keeps the ones shaped like a practice kind: kinds are snake_case
 * (`w3_logging`, `b2_noticing`), session keys are not (`w3`, `b2`). That is a real distinction in the type, not a
 * heuristic about this one line — and it means the ternary's `'w2_image'` branch is finally seen too.
 */
function kindsOpenedIn(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  return [...src.matchAll(/startPracticeWeek\(([^)]*)\)/g)]
    .flatMap((m) => [...m[1]!.matchAll(/'(\w+)'/g)].map((q) => q[1]!))
    .filter((t) => t.includes('_'));
}

// NOTHING IS EXEMPT ANY MORE (2026-08-26). w2_image was the one entry here, on the reasoning that its week had
// nothing countable — true until Jay counted five open weeks against four rendered grids and W2 got its row. The
// set is kept rather than deleted because the NEXT kind that genuinely has no grid should land here with its
// reason written down, not be quietly skipped somewhere else.
const NO_GRID = new Set<string>();

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

// EVERY WEEK A SESSION OPENS MUST ALSO BE ANNOUNCED ON THE END CARD.
//
// The two tests above check the Companion's closing COPY names the destination. That was necessary and not
// sufficient: Jay finished B2 on 2026-08-26 and found two skill rows on his Playbook he could not account for —
// "where did these come from? I didn't notice it getting teed up as a tracker." The copy existed. It was the last
// sentence of one unbroken five-sentence paragraph, arriving straight after twenty-four Likert items.
//
// So the close now also carries a visual block naming the tracker, previewing its rows and linking to it. This
// asserts the MAP behind that block against the same source of truth as the copy test — the startPracticeWeek
// calls in the routes — so a phase that starts opening a week and is not added to TRACKER_FOR fails here rather
// than shipping a silent tracker again.
test('EVERY SESSION THAT OPENS A WEEK DECLARES IT AS A TRACKER', async () => {
  const { TRACKER_FOR } = await import('../lib/content/session-tracker.ts');
  const declared = new Set(Object.values(TRACKER_FOR));

  const opened = new Set<string>();
  for (const route of walk('app').filter((f) => readFileSync(f, 'utf8').includes('startPracticeWeek('))) {
    for (const k of kindsOpenedIn(route)) if (!NO_GRID.has(k)) opened.add(k);
  }
  assert.ok(opened.size >= 3, `found the kinds the routes open (saw ${[...opened].join(', ') || 'none'})`);

  const undeclared = [...opened].filter((k) => !declared.has(k as never));
  assert.deepEqual(
    undeclared,
    [],
    `opened by a Session but never announced on its end card: ${undeclared.join(', ')}`,
  );
});

test('EVERY DECLARED TRACKER HAS COPY — INCLUDING W2, WHICH NOW HAS A GRID', async () => {
  const { TRACKER_FOR, trackerCopy, trackerKindFor } = await import('../lib/content/session-tracker.ts');
  for (const [key, kind] of Object.entries(TRACKER_FOR)) {
    const c = trackerCopy(kind!);
    assert.ok(c.title.trim(), `${key} declares ${kind} with no title`);
    assert.ok(c.blurb.trim(), `${key} declares ${kind} with no blurb`);
    assert.ok(c.cta.trim(), `${key} declares ${kind} with no cta`);
    // The whole point is that a member recognises the thing later. A title that does not say where it came from
    // is a label, not an orientation.
    assert.match(c.title, /built from/i, `${key}'s title should say where the tracker came from — got "${c.title}"`);
  }
  // REVERSED 2026-08-26, and this is the SECOND assertion in this suite that encoded "W2 has no grid". That one
  // sentence was written into four places — the grid dispatch, this map, a practice-grid test, and here — so
  // reversing it took four edits, and the last two only surfaced because the suite went red. A belief repeated
  // across files is a belief you cannot change in one place.
  //
  // W2 now opens a tickable week like the other four, so it must be announced like the other four. Leaving it out
  // would make W2 the one Session that hands a member a week and never mentions it.
  assert.equal(trackerKindFor('w2'), 'w2_image', 'W2 has a grid now — its close must hand the member to it');
});
