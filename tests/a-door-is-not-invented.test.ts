// HIS OWN WORDS OUTRANK OUR INFERENCE ABOUT HIM.
//
// Found by the live persona eval, 2026-08-29 — the ONE real failure left once the harness was made faithful:
//   ### no-fade — doors: ["body","marriage"]
//   ⚠ forced a Door onto a no-Fade member (invented a fade)
//
// Theo is the thriving optimizer we deliberately do not serve. He said "there's no gap, nothing pulled me away"
// and we filed him under The Body and The Marriage anyway — because `matchDoors` reads TOPIC, not loss. A man
// describing the best shape of his life earns the Door for it.
//
// Three harms, not one: a false claim about his life on his profile; a thriving decline made permanently
// unreachable (a Door clears `noFade` for good); and a loop he could not leave — he wrote "four times!" because
// we kept fishing for a fade he had already told us did not exist.
//
// The fix is NOT valence detection. Nothing here separates "body as strength" from "body as loss", and writing
// that is the better-classifier-is-a-better-guess road. The discrimination available without guessing is whose
// claim it is: his about himself, or ours about him. [[member-words-outrank-model-guess]]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchDoors } from '../lib/doors.ts';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import type { ConvMessage, ConvState } from '../lib/agent/onboarding.ts';

// Doors are recorded UPSTREAM of this stage (the model tags them as the story comes out), so they are seeded here
// rather than captured — what is under test is what the gap stage then does with them, which is what changed.
const gapState = (doors: string[]): ConvState =>
  ({
    stage: 'gap',
    collected: { athleticPast: 'I have always been the one who goes further', doors },
    doorAsked: true,
  }) as never;

const run = (doors: string[], msg: string, history: ConvMessage[] = []) =>
  applyStagedTurn(gapState(doors), history, msg, { text: 'Say more about that.' } as never);

test('the underlying fact: Door matching reads topic, not loss', () => {
  // Documented rather than fixed. The matcher is RIGHT to be topical — for a real Fade the Door is correct even
  // when the sentence is upbeat. What was wrong was treating a topical match as evidence that a Fade exists.
  assert.deepEqual(matchDoors("a body that's actually well-trained, best shape of my life"), ['body']);
  assert.deepEqual(matchDoors('my marriage is genuinely strong, better than ever'), ['marriage']);
  assert.deepEqual(matchDoors('my knee blew out and I stopped running'), ['body'], 'still catches the real one');
});

test('a member who declares no Fade keeps no invented Doors', () => {
  const history: ConvMessage[] = [
    { role: 'agent', text: 'What pulled you away?' },
    { role: 'member', text: "Nothing did. There's no gap, no drift — I just want more." },
  ];
  const turn = run(
    ['body', 'marriage'], // what the topical matcher handed us while he was saying there was nothing to find
    "Honestly my marriage is genuinely strong and I'm in the best shape of my life. I just want more.",
    history,
  );
  assert.deepEqual(turn.state.collected.doors ?? [], [], 'no Door is kept on a man who says he has no Fade');
});

test('THE GUARD ON THE GUARD: a terse real Fade keeps his Door and is never turned away', () => {
  // Sam is why this fix is scoped the way it is. He never declares himself fine — he just answers in fragments,
  // and his Door is the ONLY evidence he offers. If this fix ever starts keying on something he trips, the
  // expensive lesson comes back: "never turn away a real one." (CAT-01/05)
  const turn = run(['body', 'marriage'], 'Knee. Then divorce.');
  assert.ok((turn.state.collected.doors ?? []).length > 0, 'his Doors survive — he made no declaration to outrank');
});

test('a real Fade that happens to say a cheerful thing keeps its Doors', () => {
  // The nightmare regression: a member with a genuine loss who also says "life is good" somewhere. Loss language
  // anywhere in the corpus restores the Door's full force, so only a member with NO fade evidence at all reaches
  // the new branch.
  const history: ConvMessage[] = [
    { role: 'agent', text: 'What changed?' },
    { role: 'member', text: 'I lost my job and I stopped running after the knee went.' },
  ];
  const turn = run(['body', 'career_cliff'], "Life is good now, but I'm not who I was.", history);
  assert.ok((turn.state.collected.doors ?? []).length > 0, 'genuine loss anywhere outranks the cheerful sentence');
});
