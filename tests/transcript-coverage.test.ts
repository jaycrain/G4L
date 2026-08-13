import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error — .mjs sibling, no types; the guard is deliberately plain JS like the rest of scripts/.
import { coverage, uncoveredFiles, readBacklog } from '../scripts/transcript-coverage.mjs';
// @ts-expect-error — see above.
import { SECTIONS } from '../scripts/transcript-sources.mjs';

// CAN A MEMBER-FACING FILE GO MISSING FROM THE COWORK BUNDLE WITHOUT ANYONE NOTICING?
//
// It could, and it did — twice in five days. On 2026-08-13, cutting v3.4.1, the source list turned out to be
// missing the onboarding welcome screen, the Threshold ceremony, the Opening Tour and the messaging ladder,
// through v3.2.1, v3.3 AND v3.4. That is the first day of membership — the most quotable copy in the product —
// absent from the artifact marketing and the book quote from, with nothing reporting it.
//
// The existing freshness guard cannot catch it: it diffs the files already in the list, so a NEW file is
// invisible. This is the inverse, and it is a ratchet — the known backlog is snapshotted and may only shrink.

test('no NEW member-facing file is missing from the transcript source list', () => {
  const { newlyMissing } = coverage();
  assert.deepEqual(
    newlyMissing.map((r: { file: string }) => r.file),
    [],
    'These files carry member-facing copy but are in no section, so the Cowork bundle cannot see them.\n' +
      'Add them to scripts/transcript-sources.mjs. If a file genuinely holds no member copy, exclude its AREA in\n' +
      'scripts/transcript-coverage.mjs — and be suspicious of doing that, since a wrong exclusion hides real copy.',
  );
});

test('the backlog SHRINKS or holds — it must never grow', () => {
  const { uncovered, backlog } = coverage();
  assert.ok(
    uncovered.length <= backlog.size,
    `the backlog grew: ${uncovered.length} uncovered files vs ${backlog.size} recorded. ` +
      'Debt is paid down by listing a file as a source, never by adding a line here.',
  );
});

test('every line in the backlog is still a real, uncovered file', () => {
  // A stale backlog is its own lie: a file that has since been listed (or deleted) leaves a line that makes the
  // debt look larger than it is, and a line nobody can act on is a line everybody stops reading.
  const backlog = readBacklog();
  const uncovered = new Set(uncoveredFiles().map((r: { file: string }) => r.file));
  const stale = [...backlog].filter((f) => !uncovered.has(f as string));
  assert.deepEqual(stale, [], 'these are recorded as debt but are no longer uncovered — delete the lines');
});

test('THE GUARD CAN ACTUALLY FAIL — drop a real source and it is detected', () => {
  // The trap this whole area keeps falling into is a check that reports green because it cannot see the failure.
  // So run the detector for real against a list with one source removed. The Threshold ceremony is the victim on
  // purpose: it is the copy that was missing for three versions, and it must never be missable quietly again.
  const listed: string[] = SECTIONS.flatMap((s: { files: string[] }) => s.files);
  const victim = listed.find((f) => f.startsWith('lib/ceremony/threshold-beats'));
  assert.ok(victim, 'expected the Threshold ceremony to be a listed source');

  const flagged = uncoveredFiles(listed.filter((f) => f !== victim)).map((r: { file: string }) => r.file);
  assert.ok(flagged.includes(victim!), `dropping ${victim} from the list must surface it as uncovered`);

  // ...and with the full list it is NOT flagged, so the detector is discriminating rather than always-on.
  assert.equal(uncoveredFiles(listed).map((r: { file: string }) => r.file).includes(victim!), false);
});
