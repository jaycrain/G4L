import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreSkills } from '../lib/rebuild/skills-instrument.ts';
import { buildSkillsMap, mapLead, FAMILY_LABEL } from '../lib/rebuild/skills-map.ts';

// B2's map — the read Greg asked for on 2026-08-08 ("displayed as a development map") and which no surface showed.
// These hold the properties that make a profile safe to put in front of a member.

// 24 responses: 12 activity (skills 1-12), then 12 diet.
const mk = (activity: number[], diet: number[]) => scoreSkills([...activity, ...diet]);
const flatAt = (n: number) => mk(Array(12).fill(n), Array(12).fill(n));

test('nothing in the map is a number, a percentage or a rank', () => {
  const map = buildSkillsMap(mk([5,4,5,4,3,5,5,3,2,2,2,5], [5,4,5,4,3,5,5,3,2,2,4,5]));
  const blob = JSON.stringify(map) + mapLead(map);
  assert.ok(!/\d+%/.test(blob), 'no percentages');
  assert.ok(!/\b(score|scored|rating|rated|out of|rank)\b/i.test(blob), `no scoring vocabulary — got: ${blob.slice(0, 200)}`);
  // The only numbers allowed are the skill ids, which are structural and never rendered.
  const rendered = map.families.flatMap((f) => [f.name, f.gloss, ...f.rows.map((r) => `${r.label} ${r.divergence ?? ''}`)]).join(' ');
  assert.ok(!/\d/.test(rendered), `no digits reach the member — got: ${rendered}`);
});

test('the copy DECLARES — it never reassures the member about the instrument', () => {
  // Jay, 2026-08-17. Telling an accomplished adult they are not being graded implies they feared it.
  const blob = mapLead(buildSkillsMap(mk([5,5,5,4,4,4,3,3,2,2,2,1], [5,5,5,4,4,4,3,3,2,2,2,1])));
  assert.ok(
    !/not a (score|grade|test|verdict|judgement|judgment)|no wrong answers|isn't a/i.test(blob),
    `the lead line must declare, not disclaim — got: ${blob}`,
  );
});

test('steady is relative to the member, not to the scale', () => {
  // THE PROPERTY THAT MAKES THIS A MAP RATHER THAN A MARK. A uniformly modest profile must not render as twelve
  // failures, and a uniformly confident one must not render as nothing to work on. A fixed cutoff would do both.
  for (const n of [1, 3, 5]) {
    const map = buildSkillsMap(flatAt(n));
    const rows = map.families.flatMap((f) => f.rows);
    assert.ok(rows.every((r) => r.steady), `a flat profile at ${n} has no growing edges — every row is steady`);
    assert.equal(map.thinnest, null, `a flat profile at ${n} names no thinnest family`);
  }
});

test('the same answer reads differently in two different profiles', () => {
  // A 3 among 5s is a growing edge; a 3 among 1s is steady. That is the whole point of ranking within self.
  const high = buildSkillsMap(mk([5,5,5,5,5,3,5,5,5,5,5,5], [5,5,5,5,5,3,5,5,5,5,5,5]));
  const low = buildSkillsMap(mk([1,1,1,1,1,3,1,1,1,1,1,1], [1,1,1,1,1,3,1,1,1,1,1,1]));
  const skill6 = (m: ReturnType<typeof buildSkillsMap>) => m.families.flatMap((f) => f.rows).find((r) => r.no === 6)!;
  assert.equal(skill6(high).steady, false, 'a 3 among 5s is a growing edge');
  assert.equal(skill6(low).steady, true, 'a 3 among 1s is steady');
});

test('the thinnest family is share-based, so the six-skill family does not always win', () => {
  // Taking action has 6 skills; the other two have 3. Counting raw growing edges would name it thinnest almost
  // every time purely for being twice the size.
  // Staying with it (2,9,10) all weak; Taking action (1,3,4,5,8,11) half weak.
  const r = mk([5,1,5,5,3,5,5,3,1,1,3,5], [5,1,5,5,3,5,5,3,1,1,3,5]);
  const map = buildSkillsMap(r);
  assert.equal(map.thinnest, 'reinforcing', `3-of-3 must beat 3-of-6 — got ${map.thinnest}`);
  assert.ok(mapLead(map).includes(FAMILY_LABEL.reinforcing.name), 'the lead names the thin family');
});

test('a domain split is surfaced only where it is real', () => {
  // Skill 11 diverges by 3; everything else is level. Printing the split on all twelve would bury the one that means something.
  const map = buildSkillsMap(mk([4,4,4,4,4,4,4,4,4,4,5,4], [4,4,4,4,4,4,4,4,4,4,2,4]));
  const withSplit = map.families.flatMap((f) => f.rows).filter((r) => r.divergence);
  assert.equal(withSplit.length, 1, 'exactly one row carries a split');
  assert.equal(withSplit[0]!.no, 11);
  assert.equal(withSplit[0]!.divergence, 'movement more than eating');
});

test('growing edges sort to the top of their family', () => {
  const map = buildSkillsMap(mk([5,1,5,5,5,5,5,5,1,1,5,5], [5,1,5,5,5,5,5,5,1,1,5,5]));
  for (const f of map.families) {
    const firstSteady = f.rows.findIndex((r) => r.steady);
    if (firstSteady === -1) continue;
    assert.ok(f.rows.slice(firstSteady).every((r) => r.steady), `${f.name}: growing edges must lead`);
  }
});

test('the lead line names the thin family once, not twice', () => {
  // The first version interpolated it twice — "Staying with it is the thinnest of the three, staying with it is
  // where practice would pay most." Every assertion passed; the screenshot caught it. Read what you ship.
  const lead = mapLead(buildSkillsMap(scoreSkills([...Array(12).fill(5).map((v, i) => ([1, 8, 9].includes(i) ? 1 : v)), ...Array(12).fill(5).map((v, i) => ([1, 8, 9].includes(i) ? 1 : v))])));
  const name = FAMILY_LABEL.reinforcing.name.toLowerCase();
  const hits = lead.toLowerCase().split(name).length - 1;
  assert.equal(hits, 1, `the family should be named once — got ${hits} in: ${lead}`);
});
