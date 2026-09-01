// THE DASHBOARD SAYS HELLO TO EVERY MEMBER, INCLUDING THE ONES IT CANNOT NAME.
//
// The bug this locks out, found 2026-09-01 on the founder's own account: the member strip was written as
//
//   {identitySelves && (
//     <div className="tri-member">
//       <span className="tri-member-name">Hi {firstName}!</span>
//       <span className="tri-member-reclaim">Reclaiming {identitySelves}</span>
//
// so a member who never named an Identity handle got a dashboard with no greeting at all. Nobody decided that.
// The greeting was written inside a conditional that existed for the Identity, and the two rode together because
// they shared a container.
//
// They are independent facts and the asymmetry is the whole point: we ALWAYS know their name — it is on the
// account — and we do NOT always know who they are reclaiming, because naming the handle can be skipped and there
// is currently no route back to it. So the one member who most needs the product to feel like it knows him is the
// one it greets with silence.
//
// WHY A SOURCE TEST AND NOT A RENDER TEST. There is no React render harness in this suite (383 tests, all
// source-level invariants) and adding testing-library for one assertion is a heavier dependency than the bug
// warrants. What actually failed here was STRUCTURAL — a nesting relationship between two pieces of JSX — and
// that is exactly what a source assertion can hold. It does not prove the page renders; the dev preview does
// that. It proves the greeting can never be re-parented under the Identity guard again.
//
// Related: the other half of this is giving a skipper a route to claim the handle inside a Reconnect Session
// (Jay's Option B ruling, 2026-08-31), which is a build, not a guard.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('app/dashboard/dashboard-triptych.tsx', 'utf8');

test('the member strip itself is rendered unguarded', () => {
  // The strip must not be wrapped in a conditional. `{x && (` immediately before the container is the
  // exact shape that caused the bug.
  const strip = SRC.indexOf('<div className="tri-member">');
  assert.ok(strip > -1, 'the member strip should still exist');

  const before = SRC.slice(Math.max(0, strip - 240), strip);
  assert.equal(
    /&&\s*\(\s*$/.test(before),
    false,
    'the member strip is wrapped in a conditional — a member with no Identity gets no greeting',
  );
});

// HONEST NOTE, because I checked and it matters: this one does NOT catch the original bug. Run against the
// buggy version it passes, because there the guard sat OUTSIDE the container — so nothing lay between the
// container and the greeting. The test above is the one that fails on the real defect.
//
// It is kept because it closes the OTHER way in: someone re-wrapping just the greeting, inside the strip that
// now renders unconditionally. Same outcome for the member, different shape in the source. Both doors, not one.
test('the greeting is not re-wrapped inside the strip either', () => {
  const strip = SRC.indexOf('<div className="tri-member">');
  const greeting = SRC.indexOf('tri-member-name', strip);
  assert.ok(greeting > -1, 'the greeting should still exist');

  const between = SRC.slice(strip, greeting);
  assert.equal(
    between.includes('&&'),
    false,
    'a conditional sits between the strip and the greeting — the greeting is guarded again',
  );
});

test('the Identity line itself stays guarded, because it genuinely may not exist', () => {
  // Asserted on the greeting's OWN line rather than a byte window. The first draft of this looked backwards
  // through 160 characters, which made it report "unguarded" on the pre-fix code purely because the wrapper
  // sat further away than the window reached — a right answer for a wrong reason, which is the kind of test
  // that later gets believed about something it never measured.
  const line = SRC.split('\n').find((l) => l.includes('tri-member-reclaim'));
  assert.ok(line, 'the Reclaiming line should still exist');

  // This one SHOULD be conditional — the opposite failure ("Reclaiming undefined") is also a bug.
  assert.ok(
    line.includes('identitySelves &&'),
    'the Reclaiming line must carry its own guard — without a handle it would render an empty claim',
  );
});
