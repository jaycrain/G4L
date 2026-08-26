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
