import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkinSystem, type CheckinContext } from '../lib/agent/checkin.ts';
import type { Outcome } from '../lib/dashboard/outcomes.ts';

// THE COMPANION KNOWS THE THREE OUTCOME CARDS.
//
// CLAUDE.md: "no data the member can see should be invisible to the agent." The cards sit at the head of the
// Playbook, so a member can ask "what does it mean that mindfulness isn't built yet?" and the agent has to know
// what they are looking at.
//
// But visibility is the easy half. Three cards with ticks on them are ONE careless sentence away from becoming a
// progress report — "you're two of three" — which is the exact posture this product refuses. So most of what is
// asserted here is what the prompt FORBIDS, not what it says.

const base = {
  displayName: 'Greg',
  identityNoun: 'Athlete',
  doorDisplayNames: ['The Body'],
  idScore: 61,
  reclaimList: ['ride again'],
} as unknown as CheckinContext;

const card = (over: Partial<Outcome> & Pick<Outcome, 'phase' | 'product'>): Outcome => ({
  blurb: 'x',
  parts: [
    { label: 'Your true lines', sub: 'what you know', done: false },
    { label: 'Your picture', sub: 'what you hold', done: false },
    { label: 'Mindful Monitoring', sub: 'what you practise', done: false },
  ],
  built: false,
  ...over,
});

const withCards = (o: Outcome[]): CheckinContext => ({ ...base, outcomes: o }) as CheckinContext;

test('the cards reach the agent by name, with what the member actually holds', () => {
  const p = checkinSystem(
    withCards([
      card({
        phase: 'rewire',
        product: 'Mindfulness',
        parts: [
          { label: 'Your true lines', sub: 'what you know', done: true },
          { label: 'Your picture', sub: 'what you hold', done: true },
          { label: 'Mindful Monitoring', sub: 'what you practise', done: false, running: 'day 3 of 7' },
        ],
      }),
      card({ phase: 'rebuild', product: 'Fitness' }),
    ]),
  );
  assert.match(p, /mindfulness — they have Your true lines, Your picture/);
  assert.match(p, /fitness — nothing yet/);
  assert.match(p, /Running right now: Mindful Monitoring \(day 3 of 7\)/);
});

test('no cards, no line — a member with no outcomes read is not told about an empty scoreboard', () => {
  // outcomes() returns [] when its read fails. Silence is the correct degrade: inventing "nothing built yet" out
  // of a database hiccup would be a confident false claim about a member's own work.
  const p = checkinSystem(base);
  assert.doesNotMatch(p, /three outcomes on their Playbook/i);
});

test('the prompt forbids the tally — "two of three" is the sentence to avoid', () => {
  const p = checkinSystem(withCards([card({ phase: 'rewire', product: 'Mindfulness', built: true })]));
  assert.match(p, /NEVER count it, rank the three, or say how many are left/);
  assert.match(p, /not a score/);
});

test('even with all three built, the agent may not tell them they ARE mindful, fit or well', () => {
  // Greg's line, and the whole reason the cards can exist at all: the cycle builds the skill, you practise the
  // shot, not the winning. A card that reads "built" is the moment this rule is most likely to be broken.
  const p = checkinSystem(
    withCards([
      card({
        phase: 'rewire',
        product: 'Mindfulness',
        built: true,
        parts: [
          { label: 'Your true lines', sub: 'what you know', done: true },
          { label: 'Your picture', sub: 'what you hold', done: true },
          { label: 'Mindful Monitoring', sub: 'what you practise', done: true },
        ],
      }),
    ]),
  );
  assert.match(p, /NEVER tell them they ARE mindful, fit or well, even when all three are built/);
  assert.match(p, /does not hand anyone the outcome/);
});

test('what is unbuilt is road ahead — the agent may not chase them through it', () => {
  const p = checkinSystem(withCards([card({ phase: 'reclaim', product: 'Wellness', fedByOthers: true })]));
  assert.match(p, /road ahead, not debt/);
  assert.match(p, /never open a conversation with what is missing/);
});
