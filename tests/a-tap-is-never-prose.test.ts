// A TAP IS NEVER PROSE — the boundary, not another call site.
//
// Jay's stored fade story on production, read on 2026-08-25, contained this:
//
//     [gap-confirm] more keep:grind
//
// — the wire string his own chip serialized, sitting inside the account of how his life narrowed. It is the
// FOURTH instance of a wire string reaching a member-facing or member-stored field (member-display.ts exists
// because of the third), and the standing rule here is that the fourth patch is where brittleness is born.
//
// So this tests the BOUNDARY. `tidyGapProse` is the one function every gap write in the engine passes through,
// and it now refuses a machine line. The detector it uses (`looksLikeMachineLine`) already existed and was wired
// only into a guard test — a rule that never ran on the write path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tidyGapProse } from '../lib/agent/onboarding-staged.ts';
import { serializeGapConfirmChoice } from '../lib/agent/gap-confirm-choice.ts';
import { serializeBeatConfirm } from '../lib/agent/beat-confirm.ts';
import { readFileSync } from 'node:fs';

test('the exact string that reached Jay’s record is refused', () => {
  assert.equal(tidyGapProse('[gap-confirm] more keep:grind'), '');
});

test('every serializer we ship is refused — not just the one that leaked', () => {
  // Generated FROM the serializers rather than hand-copied, so a change to the wire format cannot quietly walk
  // past this test the way a literal would.
  const wire = [
    serializeGapConfirmChoice('more', ['grind']),
    serializeGapConfirmChoice('more', []),
    serializeGapConfirmChoice('done'),
    serializeBeatConfirm('done'),
    serializeBeatConfirm('addition', 'legacy'),
  ];
  for (const w of wire) assert.equal(tidyGapProse(w), '', `a tap reached the gap: ${w}`);
});

test('and it never eats the member’s actual words', () => {
  // The whole risk of a guard like this is over-reach. Prose that merely CONTAINS a bracket, or opens on one mid
  // sentence, is still their story.
  const real = 'The film took over. I stopped riding, put on weight [and I knew it], and the marriage got quiet.';
  assert.match(tidyGapProse(real), /film took over/);
  assert.match(tidyGapProse(real), /marriage got quiet/);
  assert.equal(tidyGapProse('I gave up everything for that job.'), 'I gave up everything for that job.');
});

test('a refused tap leaves an existing story untouched', () => {
  // The failure mode worse than the leak: a guard that blanks the gap instead of the tap. joinGapChapters treats
  // an empty chapter as nothing to append, so the member's prose survives a tap arriving after it.
  const story = tidyGapProse('I stopped riding.');
  const after = tidyGapProse([story, tidyGapProse('[gap-confirm] done')].filter(Boolean).join(' '));
  assert.equal(after, 'I stopped riding.');
});

// ── THE SECOND HALF OF THE BOUNDARY: THE STORED TRANSCRIPT ──────────────────────────────────────────────────
//
// memberDisplay has always run in the chat COMPONENTS, so a member watching the screen saw "There's more" where
// they tapped. What got WRITTEN was the raw wire string, because every arc action built its member turn straight
// from the message argument — a mapping that existed and did not run where it counted, for the third time.
//
// The stored copy is the one that matters more: it is what the Companion reads back, what a replay fixture
// rebuilds a bug from, what an operator reviews, and what a member can be shown.

test('memberTurn maps a tap to what the member actually saw', async () => {
  const { memberTurn } = await import('../lib/agent/member-display.ts');
  const turn = memberTurn(serializeGapConfirmChoice('more', ['grind']));
  assert.equal(turn.role, 'member');
  assert.ok(!/^\[/.test(turn.text), `a wire string reached the transcript: ${turn.text}`);
  assert.ok(turn.text.trim().length > 0, 'a tap must still leave a turn behind — never an empty bubble');
});

test('and it leaves real prose byte-identical', async () => {
  const { memberTurn } = await import('../lib/agent/member-display.ts');
  const said = 'The film took over and I stopped riding with intention.';
  assert.equal(memberTurn(said).text, said);
});

test('EVERY arc writes its member turn through the helper — no seventh site', () => {
  // The failure this guards is not a bug in the helper; it is a new writer that skips it. Six actions build a
  // stored transcript, and each one is a place someone could hand-roll { role: "member" } again.
  const WRITERS = [
    'app/rewire/actions.ts', 'app/reconnect/actions.ts', 'app/rebuild/actions.ts',
    'app/reclaim/actions.ts', 'app/onboarding/actions.ts', 'app/dashboard/checkin-actions.ts',
  ];
  const offenders: string[] = [];
  for (const f of WRITERS) {
    const src = readFileSync(f, 'utf8');
    if (/\{\s*role:\s*'member'\s*,\s*text:/.test(src)) offenders.push(f);
    if (!src.includes('memberTurn(')) offenders.push(`${f} (no memberTurn)`);
  }
  assert.deepEqual(offenders, [], `a member turn is being stored raw:\n${offenders.join('\n')}`);
});
