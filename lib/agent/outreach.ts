// The governed outreach GENERATOR — the `generate` half of the outreach engine's deps (lib/outreach/engine.ts).
// Turns a grounded source into ONE reflective proactive message, in the G4L Member-Agent voice, per Governance VV:
// reflect the member back in THEIR words · one open question at most · no advice/plan/verdict/praise · causal humility.
//
// Two backends, same contract (mirrors lib/agent/provider.ts): a deterministic SCRIPTED generator (offline, always
// validator-clean — used with no API key, and as the live fallback) and the live Claude path (used when
// ANTHROPIC_API_KEY is set). Whatever it returns still passes through the PURE §10 validator before any send —
// this module is the drafter, not the gate.
//
// detectCrisis inheritance (crisis-routing-in-kernel): distress-laden source material is DROPPED here, never
// reflected back in an upbeat nudge; if nothing safe remains, we emit an ungrounded shell → the validator holds it.
// Active distress in a member's live REPLY to a nudge routes to 988 at the surface (the reply is live input).

import type { OutreachDraft, Provenance, Tense, OutreachTrigger } from '../outreach/config.ts';
import type { GenerateInput } from '../outreach/engine.ts';
import { detectCrisis } from './governance.ts';

const countQuestions = (t: string): number => (t.match(/\?/g) ?? []).length;
const HAS_EASY_OUT = /\b(no pressure|no rush|no need to|your call|if you want|up to you|whenever you)\b/i;

// A reflection that points at one of the member's goals is a light pull toward action, so it must carry an autonomy
// tag (§6, matches the validator). Appended as a separate clause — never adds a second question.
function ensureAutonomy(text: string, trigger: OutreachTrigger): string {
  if (trigger === 'reclaim_milestone' && !HAS_EASY_OUT.test(text)) return `${text} No pressure either way.`;
  return text;
}

// ── Scripted (offline) — deterministic, grounded, and clean against every §10 rule (proven in tests) ──
function scriptedText(a: Provenance, tense: Tense, trigger: OutreachTrigger): string {
  const q = (a.quote ?? '').trim();
  let base: string;
  if (a.stream === 'reclaim') {
    base = `"${q}" is on your Reclaim List. What's alive in that for you right now?`;
  } else if (a.stream === 'pattern') {
    base = `You logged ${q}. Looking back, what do you notice?`;
  } else {
    // words — the member's own language; the tense sets where we meet them (§5), never a prescribed step.
    const tail =
      tense === 'horizon' ? "where does that sit with who you're moving toward?"
      : tense === 'practice' ? 'what is that looking like for you lately?'
      : "what's here in that for you today?";
    base = `You mentioned "${q}." ${tail.charAt(0).toUpperCase()}${tail.slice(1)}`;
  }
  return ensureAutonomy(base, trigger);
}

// ── Live (Claude) — the VV posture as a system prompt; the validator is still the floor downstream ──
const OUTREACH_SYSTEM = [
  'You are the G4L Member Agent composing ONE brief PROACTIVE check-in — a message that reaches out to a member',
  'between sessions. It is not a reply; the member did not just write to you. Non-negotiable rules:',
  "- Reflect the member back to themselves in THEIR OWN words, grounded ONLY in the source provided. Invent nothing —",
  '  no facts, plans, or feelings they did not express.',
  '- Ask AT MOST ONE open question. Never advise, instruct, prescribe a step, or tell them what to do.',
  '- No praise, no grading, no verdict, no metrics, no diagnosis, no identity labels.',
  '- Only probabilistic language about change — never "this will / proves / fixes / guarantees." Change is never certain.',
  '- Warm, plain, measured G4L voice. One to two short sentences, second person. No hype.',
  '- The member is free to ignore it. If the message points toward one of their goals, include a light no-pressure phrase.',
].join('\n');

const TENSE_NOTE: Record<Tense, string> = {
  present: 'Voice: PRESENT — meet them where they are right now.',
  practice: 'Voice: PRACTICE — connect to what they are building, WITHOUT prescribing a step.',
  horizon: 'Voice: HORIZON — connect to who they are becoming.',
};

function stripWrappingQuotes(s: string): string {
  const t = s.trim();
  return t.length >= 2 && /^["'].*["']$/.test(t) ? t.slice(1, -1).trim() : t;
}

async function composeLive(a: Provenance, tense: Tense, trigger: OutreachTrigger): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 9000, maxRetries: 1 });
  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 160,
    system: OUTREACH_SYSTEM,
    messages: [
      {
        role: 'user',
        content:
          `${TENSE_NOTE[tense]}\n` +
          `Source stream: ${a.stream}. The member's own material: "${a.quote ?? ''}".\n\n` +
          'Compose the check-in now. Output ONLY the message text — no preamble, no heading, no labels, no markdown, ' +
          'no surrounding quotation marks.',
      },
    ],
  });
  const block = msg.content.find((b) => b.type === 'text');
  const text = block && block.type === 'text' ? stripWrappingQuotes(block.text) : '';
  return text ? ensureAutonomy(text, trigger) : '';
}

/**
 * Draft one proactive message from the gathered sources. Matches OutreachDeps.generate, so it drops straight into
 * the engine. Never throws: the live path falls back to the scripted generator; no safe source → an ungrounded
 * shell the validator will hold.
 */
export async function generateOutreach(input: GenerateInput): Promise<OutreachDraft> {
  const { trigger, tense, sources } = input;
  const anchor = sources.find((s) => !detectCrisis(s.quote ?? '').flagged) ?? null;
  const shell = (text: string, provenance: Provenance | null): OutreachDraft => ({
    trigger, tense, text, provenance, hasPlan: false, questionCount: countQuestions(text),
  });

  // No groundable, non-distress source → return ungrounded; the engine/validator holds it (§8), nothing ships.
  if (!anchor) return shell('', null);

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const live = await composeLive(anchor, tense, trigger);
      if (live) return shell(live, anchor);
    } catch (e) {
      console.warn('outreach generate: live agent unavailable, using scripted —', (e as Error).message);
    }
  }
  return shell(scriptedText(anchor, tense, trigger), anchor);
}
