// Rewire (v2.3, Phase 2 — Commitment/Mindfulness). Config #3 on the shared arc kernel (runArcTurn). Spec of record:
// G4L_Rewire_Build_Approach_v0.1.md (Jay-approved). Builds on the Reconnect engine (two-mode kernel, callback,
// administered checkpoint, earned ceremony, recalibration HH). THIS INCREMENT = SLICE 1: W1 — The Disinformation
// Audit, a draw-out Session. Structure (approved): opening story (Jay, third-person) → the frame → the FIVE domains
// walked one at a time (body · habits · time · who-you-are · what's-still-possible), surfacing a self-lie in each →
// the turn (each lie → its "true line") → close. The member writes true lines for "the ones that hit hardest" (a
// member-picked subset, not all five — lighter, right for Cycle 1). Each true line → a Playbook keeper. W2/W3/R4 are
// later slices. Flag-gated by REWIRE (Decision JJ) — OFF by default; prod keeps the v1 static Rewire until the flip.
//
// COPY: final, Jay-approved (G4L_Rewire_W1_Copy_v0.1.md). "Jay" stays third-person, named (founder presence).

import { runArcTurn, type ArcConfig, type StageDef } from './onboarding-staged.ts';
import { memberClosingReclaim } from './onboarding-intent.ts';
import { BEAT_SEP, type ConvMessage, type ConvState, type ModelTurn, type Turn } from './onboarding.ts';

// Is the Rewire arc selected? Own flag (Decision JJ) — defaults OFF, so prod keeps v1 static Rewire until the v2.3
// flip (ONBOARDING_ENGINE + RECONNECT + REWIRE flip in sequence). Mirrors reconnectEnabled()/stagedEngineEnabled().
export function rewireEnabled(): boolean {
  return process.env.REWIRE === 'staged';
}

// ── W1 · The Disinformation Audit — final approved copy ──────────────────────────────────────────────────────
const W1_STORY =
  `Jay ran a disinformation campaign on himself for eight years.\n\n` +
  `The lies didn't sound like lies. They sounded like reason. "I'm alright." "It's not that bad." "I'll deal with ` +
  `it next month." The whole time his body was telling the truth — the weight, the hives, the blood markers, three ` +
  `doctor's warnings — and his brain kept overriding the signal with the same comfortable story.\n\n` +
  `Everybody runs one. It's how the Fade keeps its hold — not with one big lie, but a hundred reasonable ones. So ` +
  `before we build anything in Rewire, let's catch yours.`;
const W1_FRAME =
  `I'm going to walk you through five places the lies like to hide. In each one, tell me the stories you actually ` +
  `tell yourself — the real ones, not the ones you think you're supposed to say. Nobody's grading them. We can't ` +
  `disarm a lie we won't say out loud.`;
// The five domains, walked one at a time (draw-out). Each surfaces a self-lie.
const W1_DOMAINS = [
  `Start here — your body. What do you tell yourself about your weight, your energy, how you feel in your body day ` +
    `to day? ("I eat pretty healthy." "I'll clean it up when things settle." "It's just age.") What's your version?`,
  `Now your habits — the patterns you already know aren't working: the extra drink, the skipped walk, the mindless ` +
    `eating after a hard day. What's the story that makes those feel okay in the moment?`,
  `Your time. What do you tell yourself about why there's no room for you? ("I'm too busy." "When work calms down." ` +
    `"The kids need me.") What's the reason you give?`,
  `Who you are. What do you tell yourself about who you are now versus who you used to be? ("That was a long time ` +
    `ago." "I'm not that person anymore." "It's too late.")`,
  `Last one — what's still possible. What do you tell yourself about whether any of this can actually change? ("This ` +
    `is just who I am now." "It probably wouldn't work." "I've tried before.")`,
];
const W1_DOMAIN_NUDGE = "No wrong answer here — just the story you actually run. What's the version in your head?";
// The turn — lie → true line (delivered when the five domains are walked).
const W1_TURN =
  `Look at what you just said. That's the campaign — the script that's kept you where you are.\n\n` +
  `Now we answer it. For each lie, write the true line — the honest counter.\n` +
  `- "It's just age" → "My body responds to what I ask of it — at any age."\n` +
  `- "I've tried before" → "I've started before. This time I'm not doing it alone."\n\n` +
  `Take the ones that hit hardest and write their true lines. These are yours to keep.`;
const W1_AFFIRM_ACK = "That's a true one — kept. Any others that hit hard, or is that your set?";
const W1_AFFIRM_NUDGE = "Even one is enough — take the lie that stung most and write the honest line back.";
const W1_CLOSE =
  `They're the first thing you'll reach for when the old voice gets loud. I've saved them to your Playbook.\n\n` +
  `Catching your own lies is the whole game in Rewire, and you just did the hard part: you said them out loud. ` +
  `That's grinta in its quietest, most useful form.`;

// The full arc opener (story · frame · first domain), as three bubbles.
function w1Opening(): string {
  return `${W1_STORY}${BEAT_SEP}${W1_FRAME}${BEAT_SEP}${W1_DOMAINS[0]}`;
}

// Beat 1 — walk the five domains as a guided sequence (draw-out, not a form): the model reflects each lie, the engine
// poses the next domain. Advances on the member's answer (a self-lie), one gentle nudge for a blank.
const domainsStage: StageDef = {
  id: 'domains',
  mode: 'drawout',
  opener: () => w1Opening(),
  offersSubstance: (message) => message.trim().length >= 4,
  gather(b) {
    const sc = b.scratch as { domainIdx?: number };
    const idx = sc.domainIdx ?? 0;
    if (b.memberMessage.trim().length < 4) {
      b.reply = W1_DOMAIN_NUDGE; // a blank/deflection — invite the real story once, don't advance
      return;
    }
    const reflected = (b.modelText ?? '').trim();
    const next = idx + 1;
    if (next < W1_DOMAINS.length) {
      sc.domainIdx = next;
      // reflection (one bubble) → the next domain ask (a separate bubble)
      b.reply = reflected ? `${reflected}${BEAT_SEP}${W1_DOMAINS[next]}` : W1_DOMAINS[next]!;
    } else {
      // all five walked → the TURN (reflect the last lie, then the turn copy as its own bubble)
      b.stage = 'affirm';
      b.reply = reflected ? `${reflected}${BEAT_SEP}${W1_TURN}` : W1_TURN;
    }
  },
  confirm(b) {
    domainsStage.gather(b); // the walk is a sequence, not a reflect-confirm loop
  },
};

// Beat 2 — the turn: the member writes the true line for each lie that hit hardest (a picked subset). Each is
// harvested as a Playbook keeper ('principle', default-emit, member-owned — propose/confirm on the Playbook).
const affirmStage: StageDef = {
  id: 'affirm',
  mode: 'drawout',
  opener: () => W1_TURN,
  offersSubstance: (message) => message.trim().length >= 6,
  gather(b) {
    const line = b.memberMessage.trim();
    const wroteAny = (b.pendingHarvest ?? []).some((h) => h.kind === 'affirmation');
    if (memberClosingReclaim(b.memberMessage) || line.length < 3) {
      if (wroteAny) {
        b.reply = W1_CLOSE;
        b.complete = true; // SLICE 1 terminal — W1 done; W2 (Visualization) is the next slice
      } else {
        b.reply = W1_AFFIRM_NUDGE; // nothing written yet — one nudge for at least one true line
      }
      return;
    }
    b.pendingHarvest.push({ kind: 'affirmation', keeperType: 'principle', destinationIntent: 'keeper', payloadRef: line, label: 'Your true line' });
    b.reply = W1_AFFIRM_ACK;
  },
  confirm(b) {
    affirmStage.gather(b);
  },
};

// The Rewire arc — config #3 on the generic kernel. SLICE 1 = W1 (domains → affirm → complete). Later slices add
// W2/W3/R4 to stageOrder + stages + a real ceremony onComplete, exactly as Reconnect's beats were added.
export const REWIRE_ARC: ArcConfig = {
  id: 'rewire',
  stageOrder: ['domains', 'affirm'],
  stages: { domains: domainsStage, affirm: affirmStage },
  onComplete: () => W1_CLOSE,
};

// The Rewire turn — public signature mirrors applyReconnectTurn / applyStagedTurn.
export function applyRewireTurn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn): Turn {
  return runArcTurn(REWIRE_ARC, state, history, memberMessage, model);
}

// The opening beat (W1 story · frame · first domain). The live wrapper (liveTurnRewire) + the dashboard entry live
// alongside; this is enough to replay + felt-walk the W1 structure offline.
export function rewireOpening(): Turn {
  return { reply: w1Opening(), state: { stage: 'domains', collected: {} }, complete: false };
}
