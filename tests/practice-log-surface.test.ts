import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { isTappable, logSurfaceFor } from '../lib/practice/mark.ts';
import type { PracticeKind } from '../lib/practice/store.ts';

// A MIRROR WEEK MUST TELL THE MEMBER WHERE TO WRITE.
//
// The C3 daily log (/quality-day/<id>) shipped with v2.5 and was live for weeks with NOTHING in the app linking to
// it — the only occurrence of that path outside its own directory was the route redirecting to itself. So C3 opened
// a tracking week, told the member "we'll track it for a week", and left them on a read-only grid with no way in.
// Jay found it by tapping the grid on his own account and having nothing happen (2026-08-09).
//
// Tests are cheap; a surface with no caller is expensive. These pin BOTH halves of the rule in mark.ts: a cell the
// member can't write here must say where they can, and the route it names has to actually exist.

const ALL: PracticeKind[] = ['w2_image', 'w3_logging', 'b2_noticing', 'b3_pilot', 'c3_quality'];
const MEMBER = '11111111-1111-4111-8111-111111111111';

test('every kind is EITHER tappable OR has a stated write-surface — except the ones that own their record elsewhere', () => {
  for (const kind of ALL) {
    const tappable = isTappable(kind);
    const surface = logSurfaceFor(kind, MEMBER);
    assert.ok(!(tappable && surface), `${kind}: tappable AND redirecting is contradictory — pick one`);
  }
});

test('C3 — the one that broke — points at its daily log', () => {
  const s = logSurfaceFor('c3_quality', MEMBER);
  assert.ok(s, 'c3_quality is a mirror week; without a surface the member has nowhere to log');
  assert.equal(s!.href, `/quality-day/${MEMBER}`);
  assert.ok(s!.label.trim().length > 0, 'the link needs a name a member can read');
});

test('the route C3 points at EXISTS on disk — a link to a 404 is worse than no link', () => {
  // The original bug was a real page nobody linked to. The mirror-image failure is a link to a page nobody built,
  // so check the filesystem rather than trusting the string.
  const files = readdirSync(new URL('../app/quality-day/', import.meta.url));
  assert.ok(files.includes('[memberId]'), 'app/quality-day/[memberId] must exist to serve /quality-day/<id>');
});

test('W3 returning null is still a DECISION — but a different one since 2026-08-12', () => {
  // THE ASSERTION SURVIVED A REVERSAL OF ITS OWN REASONING, so the reasoning is rewritten rather than left to
  // mislead. It used to be "the Companion owns this record, so there is no page to link". W3's grid is now
  // TAPPABLE: the cell writes the entry, which is why there is nothing to point at. Same null, opposite cause.
  //
  // The rule underneath is what actually holds: a cell either WRITES the record or SAYS WHERE it is written.
  // Never neither — that is the dead checkbox Jay hit three times.
  assert.equal(logSurfaceFor('w3_logging', MEMBER), null);
  assert.equal(isTappable('w3_logging'), true, 'and it is null because the grid writes it');
  // The conversation still writes the richer day. If that ever stops, W3 needs a form the way C3 has one.
  const checkin = readFileSync(new URL('../app/dashboard/checkin-actions.ts', import.meta.url), 'utf8');
  assert.match(checkin, /recordW3Entry/, 'the Companion remains a door, not the only one');
});

test('THE RULE ITSELF: every kind either writes from the grid or names where to write', () => {
  // Stated once, over all kinds, so a new practice week cannot ship as a checkbox that does nothing.
  for (const kind of ALL) {
    const writes = isTappable(kind);
    const points = logSurfaceFor(kind, MEMBER) !== null;
    if (kind === 'w2_image') continue; // no countable rows, so no grid renders at all
    assert.ok(writes || points, `${kind} offers a cell that neither writes nor points anywhere`);
    assert.ok(!(writes && points), `${kind} both writes and redirects — a cell must do one thing`);
  }
});

test('tappable kinds get no redirect — the grid IS their surface', () => {
  assert.equal(logSurfaceFor('b3_pilot', MEMBER), null);
  assert.equal(logSurfaceFor('b2_noticing', MEMBER), null);
});

test('THE REGRESSION GUARD: the quality-day route is reachable from the grid component', () => {
  // The specific thing that was missing. If someone strips the link out of the grid, this fails rather than the
  // feature quietly becoming unreachable again for another few weeks.
  const grid = readFileSync(new URL('../app/momentum/week-grid.tsx', import.meta.url), 'utf8');
  assert.match(grid, /logSurfaceFor/, 'the grid must ask where the log lives');
  // ASSERT THE AFFORDANCE, NOT ITS CLASS. This used to match /wk-log/, and it failed on 2026-08-14 when the link
  // moved from the header to the foot and adopted the house `.see-more` style — the feature was fine, the test
  // was pinned to a styling hook. What must hold is that the grid renders logTo's LABEL as a link, so the log is
  // reachable by name and not only by guessing that a cell is tappable.
  assert.match(
    grid,
    /<Link[^>]*href=\{logTo\.href\}[^>]*>\{logTo\.label\}/,
    'the grid must render the named log affordance as a link, wherever it is placed',
  );
});
