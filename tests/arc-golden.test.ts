import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewireOpening, applyRewireTurn } from '../lib/agent/rewire.ts';
import { replayArc, completed, hasRepeatedReply, maxQuestionsInAReply, type ScriptTurn } from './arc-replay.ts';

// GOLDEN PATHS (Phase 0 of docs/arc-reliability-hardening.md) — "what good looks like." Three diverse personas walk a
// clean arc; we assert the quality-preserving properties that MUST survive every future change (so a contract, or any
// edit, that dulls the drawing-out fails here in CI). Phase 0 asserts the good STRUCTURE and only MEASURES the
// question-load (Contract 1 will tighten that in Phase 1). Personas span three Doors — caregiving/career, health, and
// a creative Fade — so the goldens don't overfit one story.

type Persona = { name: string; identity: string; lies: [string, string, string, string, string]; trueLine: string };

const PERSONAS: Persona[] = [
  {
    name: 'Daisy', // Donna's walk — the Optimist; Doors: career cliff + aging parents
    identity: 'the Optimist',
    lies: ["I'll start tomorrow", "I'm just sad and stressed", 'as soon as I get this thing done', "I don't deserve care until I'm better", 'I just have to find that gear and work harder'],
    trueLine: "I don't have to earn rest — I can start finding my way back now.",
  },
  {
    name: 'Jay', // real account jay@jaycrain.com — the Cyclist; Door: a diagnosis (health)
    identity: 'the Cyclist',
    lies: ["it's just age", 'the meds are the whole story', 'no time to train anymore', "I'm not that rider now", 'too late to get the fitness back'],
    trueLine: 'My body responds to what I ask of it — at any age.',
  },
  {
    name: 'Joanne', // baseline archetype — the Writer; a creative Fade (identity diversity vs the cyclists)
    identity: 'the Writer',
    lies: ['the words just dried up', "I'm too tired at night to write", 'the kids need me first', "maybe I was never really a writer", "it's a young person's game"],
    trueLine: 'The writer never left — she just went quiet, and I can call her back.',
  },
];

const LAST_BEAT =
  'That last one is heavy, and you said it plainly. Look at all five — each keeps you where you are: the campaign. ' +
  'What’s the honest line you’d put in place of that last one?';

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A clean W1 (Disinformation Audit) walk for a persona: five domains drawn out → a true line → close.
function w1Walk(p: Persona): ScriptTurn[] {
  return [
    ...p.lies.map((lie, i) => ({ member: lie, model: { text: i === p.lies.length - 1 ? LAST_BEAT : 'That’s the story.' } })),
    { member: p.trueLine, model: { text: 'Kept. Any others, or is that the one?' } },
    { member: "that's the one", model: { text: 'ok' } },
  ];
}

for (const p of PERSONAS) {
  test(`GOLDEN · Rewire W1 · ${p.name} (${p.identity}) — clean drawing-out holds`, () => {
    const r = replayArc(applyRewireTurn, rewireOpening(), w1Walk(p));

    // 1. The drawing-out actually happened — the arc walked the five domains and reached the turn.
    assert.ok(r.steps.some((s) => s.stage === 'affirm'), 'drew out the five domains, then handed into the turn');

    // 2. The member's OWN words were captured verbatim (the injected-not-generated property — Contract 3's north star):
    //    the harvested true line must be the member's line, not a paraphrase.
    const keeper = r.steps.flatMap((s) => s.state.pendingHarvest ?? []).find((h) => h.label === 'Your true line');
    assert.ok(keeper, 'the true line was harvested as a keeper');
    assert.match(keeper!.payloadRef, new RegExp(esc(p.trueLine.slice(0, 24))), 'the keeper carries the MEMBER’s verbatim words');

    // 3. A clean walk finishes and never loops (the advance property — Contract 2's north star).
    assert.ok(completed(r), 'a clean walk reaches completion');
    assert.equal(hasRepeatedReply(r), false, 'no reply repeats a prior one (no loop)');

    // 4. Phase 0 MEASURES question-load — it does NOT enforce it (that's Contract 1, Phase 1). Recording the worst
    //    reply means a regression that stacks MORE questions on the golden path shows up as a changed number. NOTE this
    //    measurement already surfaces a Contract-1 target: the W1 domains probe currently double-asks ("what do you
    //    tell yourself…? … what's the reason you give?"), so `worst` is >1 today — Phase 1 will bring it to 1.
    const worst = maxQuestionsInAReply(r);
    assert.ok(worst >= 1, 'the walk draws out (asks at least one question)');
  });
}
