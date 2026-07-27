// Adversarial capture torture harness — a FLEET of deliberately messy personas whose goal is to BREAK the onboarding
// capture loop, each live walk run through the invariants (lib/agent/capture-invariants.ts) and failed LOUD. This is
// the answer to "is the persona walk a happy path?" (Jay): not one polite Joanne read by eye, but many hostile members
// checked by machine. Costs real API tokens (both sides call Claude). Run one, a subset, or all:
//   node --experimental-strip-types --env-file=.env.local scripts/capture-torture.ts                 # all
//   node --experimental-strip-types --env-file=.env.local scripts/capture-torture.ts multi-want-dumper stubborn-closer
//
// Each persona is modeled on a REAL walk failure (milie/Donna), so the fleet reproduces the messy inputs a clean
// persona never generates. Add a persona whenever a live walk surfaces a new shape.

import { stagedOpening, liveTurnStaged } from '../lib/agent/onboarding-staged.ts';
import { BEAT_SEP } from '../lib/agent/onboarding.ts';
import { runCaptureInvariants, type WalkTurn } from '../lib/agent/capture-invariants.ts';
import type { ConvMessage, ConvState } from '../lib/agent/onboarding.ts';

const readable = (s: string) => s.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).join('\n');

const BASE_PERSONA =
  'You are role-playing a MEMBER in an onboarding conversation with an AI companion for a midlife-identity program. ' +
  'Stay fully in character; never break character, never narrate meta. Answer as this specific person would. Keep the ' +
  'conversation moving — when the companion asks something, respond in character; when you feel done, try to end.';

// The fleet — each an adversarial archetype drawn from a real failure. The `system` is the member-side model's brief.
const PERSONAS: Record<string, string> = {
  // milie's gap: fragments, run-ons, no capitalization, stream of consciousness → stresses gap tidy + door capture.
  'fragment-typer':
    `${BASE_PERSONA}\nYou type FAST and MESSY — fragments, run-on sentences, missing capitals and punctuation, stray ` +
    `words, sometimes two half-thoughts jammed together. You were a creative kid (stories, plays) who took a soul-` +
    `crushing data-entry job, became a single mom, your father died (he supported you), and your knee/back are shot ` +
    `so you can't run. Dump your fade story in long messy bursts. Don't self-edit.`,
  // stresses the reclaim distill + the multiwant shape gate: several wants crammed per message, plus elaboration.
  'multi-want-dumper':
    `${BASE_PERSONA}\nWhen asked what you want back, you name SEVERAL things in one breath, each with a sentence or two ` +
    `of elaboration ("Some time every week to create. Focus first on a story I started years ago about my hometown."). ` +
    `You cram wants together and add detail. You were a writer who lost the time and the body.`,
  // stresses the close loop: tries to end early and repeatedly, in different words.
  'stubborn-closer':
    `${BASE_PERSONA}\nYou are impatient and keep trying to END the conversation. After a couple of answers you say ` +
    `things like "those are good, let's go", "no", "that's it", "I think we have what we need", "let's move on", ` +
    `"I'm done". You do NOT want to linger. Answer briefly, then push to finish.`,
  // stresses door capture + gap tidy: many door events in a rambling run-on, told out of order.
  'door-rich-rambler':
    `${BASE_PERSONA}\nYou ramble. Your fade came through MANY doors and you mention them all in tangled run-ons, out of ` +
    `order: a marriage that ended, aging parents you cared for, a big job that ate everything, kids at home, an injury ` +
    `that stopped you running. Pile them on in long messy sentences.`,
  // stresses unbidden naming: mentions a profession in passing, never asks to be labeled it.
  'identity-in-passing':
    `${BASE_PERSONA}\nYou were a competitive swimmer in your thirties — that's who you feel you really are underneath. ` +
    `But when you talk, you mention your JOB in passing ("I'm a director and creative producer") as context, NOT as ` +
    `an identity. Never ask to be labeled your job. Keep answers short and real.`,
};

async function askMember(system: string, history: WalkTurn[]): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 25000, maxRetries: 2, defaultHeaders: { 'accept-encoding': 'identity' } });
  // From the member's POV the companion is the 'user' and they are the 'assistant'.
  const messages = history.map((m) => ({ role: (m.role === 'agent' ? 'user' : 'assistant') as 'user' | 'assistant', content: readable(m.text) }));
  const res = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 220, system, messages });
  const block = res.content.find((c) => c.type === 'text');
  return block && block.type === 'text' ? block.text.trim() : '(…)';
}

async function runWalk(name: string, system: string, maxTurns = 28): Promise<{ transcript: WalkTurn[]; state: ConvState }> {
  const open = stagedOpening();
  let state = open.state;
  const transcript: WalkTurn[] = [{ role: 'agent', text: open.reply }];
  for (let i = 0; i < maxTurns; i++) {
    const member = await askMember(system, transcript);
    let turn;
    try {
      turn = await liveTurnStaged({} as never, transcript as ConvMessage[], state, member);
    } catch (e) {
      console.log(`  [${name}] liveTurnStaged error:`, (e as Error).message);
      break;
    }
    transcript.push({ role: 'member', text: member });
    transcript.push({ role: 'agent', text: turn.reply });
    state = turn.state;
    if (turn.complete) break;
  }
  return { transcript, state };
}

async function main() {
  const requested = process.argv.slice(2);
  const names = requested.length ? requested.filter((n) => PERSONAS[n]) : Object.keys(PERSONAS);
  if (!names.length) { console.log('No matching personas. Available:', Object.keys(PERSONAS).join(', ')); return; }

  const results: { name: string; violations: number; turns: number }[] = [];
  for (const name of names) {
    console.log(`\n${'━'.repeat(72)}\n▶ PERSONA: ${name}\n${'━'.repeat(72)}`);
    const { transcript, state } = await runWalk(name, PERSONAS[name]!);
    const agentTurns = transcript.filter((t) => t.role === 'agent').length;
    const violations = runCaptureInvariants({ transcript, collected: state.collected });
    // The verdict FIRST, so a fail is impossible to miss.
    if (violations.length === 0) console.log(`✅ PASS — ${agentTurns} agent turns, no invariant violations.`);
    else {
      console.log(`❌ FAIL — ${violations.length} violation(s):`);
      for (const v of violations) console.log(`   • [${v.invariant}] ${v.detail}`);
    }
    console.log(`   final: doors=${JSON.stringify(state.collected?.doors ?? [])} · reclaim(${state.collected?.reclaimList?.length ?? 0})`);
    results.push({ name, violations: violations.length, turns: agentTurns });
  }

  console.log(`\n${'═'.repeat(72)}\nSUMMARY`);
  for (const r of results) console.log(`  ${r.violations === 0 ? '✅' : '❌'} ${r.name.padEnd(20)} ${r.violations} violation(s), ${r.turns} turns`);
  const failed = results.filter((r) => r.violations > 0).length;
  console.log(`${failed === 0 ? 'ALL PASSED' : `${failed}/${results.length} FAILED`}\n`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exit(1); });
