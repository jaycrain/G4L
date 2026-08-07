import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSET_EXPLORE, exploreFor } from '../lib/content/explore.ts';
import { ASSET_SUMMARIES, type AssetId } from '../lib/content/summaries.ts';

// EXPLORE THE SCIENCE — all twelve, transformed from Greg's "Scientific scaffolding" sections.
//
// These tests exist because this is the ONE tier where a voice slip is also a science slip. It is the evidence
// claim, read by a member, and it carries his name behind it.

const ALL = Object.keys(ASSET_SUMMARIES) as AssetId[];

test('every gated asset has an Explore panel', () => {
  const missing = ALL.filter((a) => !exploreFor(a));
  assert.deepEqual(missing, [], `assets with no Explore: ${missing.join(', ')}`);
  assert.equal(Object.keys(ASSET_EXPLORE).length, 12);
});

test('NOTHING DETERMINISTIC — this tier is the evidence claim', () => {
  // Greg's own governance rule, and it binds hardest here. "Research suggests" / "tends to", never "proves".
  const banned = [/\bproves?\b/i, /\bguarantees?\b/i, /\bwill make you\b/i, /\bensures?\b/i, /\balways leads?\b/i, /\bcures?\b/i];
  for (const a of ALL) {
    const text = exploreFor(a)!.points.map((p) => `${p.head} ${p.body}`).join(' ');
    for (const re of banned) assert.doesNotMatch(text, re, `${a}: deterministic claim (${re})`);
  }
});

test('NO CONSTRUCT NAMES — they belong in his documents, not on a member’s screen', () => {
  // Each of these is lifted straight from his scaffolding. A member should never have to look a word up to read
  // their own screen; the ideas are all still here, in plain words.
  const jargon = [
    /self-discrepancy/i, /self-concordan/i, /self-concept clarity/i, /objective self-attention/i,
    /temporal self-comparison/i, /identity-based motivation/i, /locus of control/i, /metacogniti/i,
    /future self-continuity/i, /narrative identity/i, /expressive writing/i, /self-affirmation theory/i,
    /self-efficacy/i, /self-determination theory/i, /PRECEDE/i, /broaden-and-build/i, /psychological flexibility/i,
    /self-expansion/i, /health-related quality of life/i, /implementation intention/i, /relapse prevention/i,
    /predisposing/i, /reinforcing skills/i, /thought-action repertoire/i,
  ];
  for (const a of ALL) {
    const text = exploreFor(a)!.points.map((p) => `${p.head} ${p.body}`).join(' ');
    for (const re of jargon) assert.doesNotMatch(text, re, `${a}: untranslated construct name (${re})`);
  }
});

test('the four Rs are never camel-cased — his house style must not ride in', () => {
  // Every source document writes ReConnect / ReWire / ReBuild / ReClaim. That spelling is his to keep inside a
  // verbatim quote of his work; it must never reach a member.
  for (const a of ALL) {
    const text = `${exploreFor(a)!.lede} ${exploreFor(a)!.points.map((p) => `${p.head} ${p.body}`).join(' ')}`;
    assert.doesNotMatch(text, /\bRe(Connect|Wire|Build|Claim)\b/, `${a}: camel-cased R`);
  }
});

test('the counts match HIS documents — short ones were not padded', () => {
  // R1/R2/R3/B3/C2/C3 = 6, B2 = 5, W1/W2/W3/B1 = 4, C1 = 6. Padding a four to a six would mean inventing science.
  const expected: Record<string, number> = {
    r1: 6, r2: 6, r3: 6, w1: 4, w2: 4, w3: 4, b1: 4, b2: 5, b3: 6, c1: 6, c2: 6, c3: 6,
  };
  for (const [a, n] of Object.entries(expected)) {
    assert.equal(exploreFor(a as AssetId)!.points.length, n, `${a} should carry ${n} of his principles`);
  }
});

test('every panel is shaped for skimming — a lede, and heads that stand alone', () => {
  for (const a of ALL) {
    const e = exploreFor(a)!;
    assert.ok(e.lede.length > 20 && e.lede.length < 90, `${a}: lede should be one short line (${e.lede.length})`);
    for (const p of e.points) {
      assert.ok(p.head.length > 15, `${a}: a head that short can't carry the point — "${p.head}"`);
      assert.ok(!p.head.endsWith('.'), `${a}: heads are labels, not sentences — "${p.head}"`);
      assert.ok(p.body.length > 80, `${a}: body too thin to explain anything — "${p.head}"`);
    }
  }
});

test('no panel repeats its own headline twice', () => {
  for (const a of ALL) {
    const heads = exploreFor(a)!.points.map((p) => p.head.toLowerCase());
    assert.equal(new Set(heads).size, heads.length, `${a} has a duplicated headline`);
  }
});
