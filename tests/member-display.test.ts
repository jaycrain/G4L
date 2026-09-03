// THE GUARD THAT MAKES memberDisplay THE FIX RATHER THAN THE THIRD PATCH.
//
// Three machine formats have leaked into member chat bubbles in six days (see lib/agent/member-display.ts). Each
// was fixed at the site it was found, so the next one leaked anyway. What was missing was never the mapping — it
// was anything that fails when a new format is added without one.
//
// So this file does two things. It asserts the three known formats render as something a person wrote. And it
// SCANS THE SOURCE for prefix/sentinel declarations, failing on any that memberDisplay does not handle — which is
// what catches format number four, written weeks from now by someone who never read this comment.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { memberDisplay, looksLikeMachineLine, handledFormats } from '../lib/agent/member-display.ts';
import { serializeBeatConfirm, beatConfirmChoices } from '../lib/agent/beat-confirm.ts';
import { serializeBoardSubmission } from '../lib/reconnect/doors-board-claim.ts';
import { serializeGapConfirmChoice } from '../lib/agent/gap-confirm-choice.ts';

// SUPERSEDED BY HER OWN RULING (Donna, 2026-08-28: "Remove it"). The receipt used to read "Marked the ones that
// are mine." and she called it unneeded inline feedback — the app narrating an action she had just watched
// herself take. It now renders to the EMPTY STRING and the chat paints no bubble.
//
// The test does NOT go away, and this is the important part: the format must still be CLAIMED. memberDisplay
// falls through to the raw text on an unhandled format, so a deletion that stopped claiming '[board]' would put
// `[board] door:body=2 …` back on screen — the exact leak this whole file exists to stop, reintroduced as a side
// effect of removing a line of copy. What is asserted is now the silence, and that it is deliberate.
test('memberDisplay — the Doors board renders as NOTHING, and never as internal state', () => {
  // Donna's exact submission, item 11.
  const raw = serializeBoardSubmission({
    doors: [
      { slug: 'body', relevance: 2 },
      { slug: 'aging_parents', relevance: 3 },
      { slug: 'career_cliff', relevance: 3 },
      { slug: 'autopilot', relevance: 2 },
    ],
    quietDrift: true,
    first: 'career_cliff',
    biggest: 'career_cliff',
    stillOpen: ['body'],
  });
  assert.ok(raw.startsWith('[board]'), 'precondition: the wire format is still a machine line');

  const shown = memberDisplay(raw);
  assert.ok(!looksLikeMachineLine(shown), `still machine syntax: ${shown}`);
  assert.doesNotMatch(shown, /door:|quiet_drift|first:|biggest:|open:/, 'no internal tokens survive');
  assert.equal(shown, '', 'her tap is acknowledged by the board itself, not narrated back at her');
});

test('memberDisplay — the gap confirm renders as the chip label she actually tapped', () => {
  const raw = serializeGapConfirmChoice('done', ['career_cliff', 'aging_parents']);
  const shown = memberDisplay(raw);
  assert.ok(!looksLikeMachineLine(shown), `still machine syntax: ${shown}`);
  assert.doesNotMatch(shown, /keep:|career_cliff/, 'no slugs survive into her bubble');
});

test('memberDisplay — the identity skip renders in her voice, not as a sentinel', () => {
  assert.equal(memberDisplay('__identity_skip__'), "I'm not sure yet.");
});

test('memberDisplay — an ordinary typed message passes through EXACTLY, never tidied', () => {
  // Her own words in her own bubble are the record she reads back. Formatting, casing and stray spacing are hers.
  for (const typed of [
    'i dont know. maybe the job thing',
    '• A creative job that pays the bills\n• Lose 20 lbs',
    'It was [mostly] the move, honestly',
  ]) {
    assert.equal(memberDisplay(typed), typed);
  }
});

// THE ONE THAT CATCHES FORMAT NUMBER FOUR.
//
// Every machine format so far was declared as `const PREFIX = '[thing]'` or a `__sentinel__` string literal. This
// walks lib/ and app/ for those declarations and asserts memberDisplay maps each one. A new format added without a
// display mapping fails here, at the moment it is written, rather than in a member's transcript at the moment she
// names her Fade.
test('every machine format declared in the source has a member-facing display', () => {
  const roots = ['lib', 'app'];
  const found = new Map<string, string>(); // literal -> where

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.tsx?$/.test(p)) continue;
      const src = readFileSync(p, 'utf8');
      // `[tag]` prefixes assigned to a const, and bare __sentinel__ literals.
      for (const m of src.matchAll(/=\s*'(\[[a-z][a-z0-9_-]*\])'/gi)) found.set(m[1], p);
      for (const m of src.matchAll(/'(__[a-z0-9_]+__)'/gi)) found.set(m[1], p);
    }
  };
  for (const r of roots) walk(r);

  assert.ok(found.size >= 3, `expected to find the known formats, found ${found.size}`);

  // MEMBERSHIP, NOT BEHAVIOUR. The first version of this synthesised a payload for each prefix and asserted the
  // result was prose — and failed on [gap-confirm], because the payload it invented was a Doors board's. That is
  // a broken probe reporting a broken product, the error I make most often; a format is registered or it is not,
  // and that question needs no payload at all.
  const handled = new Set(handledFormats());
  const unmapped = [...found.entries()]
    .filter(([literal]) => !handled.has(literal))
    .map(([literal, where]) => `${literal}  (declared in ${where})`);

  assert.deepEqual(unmapped, [],
    'these machine formats would print raw into a member\'s chat bubble.\n'
    + 'Add a FORMATS entry in lib/agent/member-display.ts saying what the member sees:\n  '
    + unmapped.join('\n  '));
});

// HER BUBBLE SHOWS THE WORDS THAT WERE ON THE BUTTON SHE PRESSED.
//
// This file's own rule, stated at the top: a display line "either comes from the same array the chips are built
// from (so a wording change moves both and they cannot drift), or it names the ACT she performed". The
// beat-confirm entry broke the first half — it read the DEFAULT set no matter which set the tap came from.
//
// The cost lands on the one beat whose labels were chosen most carefully. She writes a letter to herself a year
// out, taps "That's mine", and her bubble said "That's it" — a set of words we picked, standing where hers should
// be. And memberDisplay is what the stored transcript keeps, so it is also what the Companion reads back to her.
//
// beatConfirmDisplay had done this correctly since the sets existed, and nothing called it.
test('every named set renders in ITS OWN words, not the default set’s', () => {
  const cases: [string, string, string][] = [
    ['legacy', 'done', 'That’s mine'],
    ['legacy', 'addition', 'Change a line'],
    ['doors', 'addition', 'There’s more'],
    ['ruling', 'dispute', 'Not quite right'],
    ['default', 'done', 'That’s it'],
  ];
  for (const [set, intent, label] of cases) {
    const shown = memberDisplay(serializeBeatConfirm(intent as never, set as never));
    assert.equal(shown, label, `a ${set} tap rendered as "${shown}" — she never saw that word`);
  }
});

test('and no wire string survives into the bubble for any set', () => {
  for (const set of ['default', 'doors', 'ruling', 'legacy']) {
    for (const intent of beatConfirmChoices(set as never).map((c) => c.value)) {
      const shown = memberDisplay(serializeBeatConfirm(intent as never, set as never));
      assert.ok(!looksLikeMachineLine(shown), `machine syntax reached her bubble: ${shown}`);
    }
  }
});
