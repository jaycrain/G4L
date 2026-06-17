// Member Agent provider abstraction (the tech spec's provider-hedge, doing double duty).
// Two backends behind one interface:
//   - anthropic: the real Claude client (used when ANTHROPIC_API_KEY is set)
//   - scripted:  deterministic, offline responses for local dev with no key
// getProvider() picks automatically, so the same flow code runs locally today and switches
// to live Claude the moment a key is present — zero code change.

import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import { identityLabel } from '../member/identity.ts';
import type { DoorSlug } from '../doors.ts';

export type OnboardingInput = {
  displayName: string;
  door: DoorSlug | null; // null = the Fade routed to no canonical Door (Taxonomy Spec §1); recognition lives in the gap
  doorDisplayName: string | null;
  identityNoun: string; // may be empty when the member chose to name their identity later (identitySkipped)
  athleticPast: string;
  gap: string;
};

/** Material for re-sharpening the dashboard mirror after the member does identity work in a Session. */
export type NarrativeInput = {
  displayName: string;
  facets: string[]; // the clean reclaimed selves, natural case
  priorParagraph: string | null; // what the mirror said before — build on it, don't contradict
  sessionTitle: string;
  reflections: { prompt: string; answer: string }[]; // the member's own words from this Session
};

export interface AgentProvider {
  readonly name: 'anthropic' | 'scripted';
  /** Synthesize the member identity paragraph (G4L voice) that becomes the dashboard hero. */
  composeIdentityParagraph(input: OnboardingInput): Promise<string>;
  /** Re-sharpen the dashboard mirror from deeper Session work — in the member's own words. */
  composeIdentityNarrative(input: NarrativeInput): Promise<string>;
}

/** "a and b" / "a, b and c" — for naming the selves in prose. */
function joinSelves(facets: string[]): string {
  if (facets.length <= 1) return facets[0] ?? 'the self you named';
  return `${facets.slice(0, -1).join(', ')} and ${facets[facets.length - 1]}`;
}

// --- Scripted (offline) -----------------------------------------------------------------
// Deterministic, governance-clean prose. No banned words ("journey", "I hear you",
// "amazing"), short sentences, member-paced, reflective — a stand-in for live Claude.
export const scriptedProvider: AgentProvider = {
  name: 'scripted',
  async composeIdentityParagraph(i) {
    const label = identityLabel(i.identityNoun); // "the Athlete", or "" if they chose to name it later
    return [
      `You told me who you were, before the gap.`,
      // Door is optional (Taxonomy Spec §1): if it routed to a Door, name it; otherwise reflect that
      // the gap opened in their own words rather than reaching for a label they wouldn't claim.
      i.doorDisplayName ? `Then ${i.doorDisplayName} changed that.` : `Then, in the way you described, the gap opened.`,
      // Identity is optional (they may name it later at Excavation): name it if we have it.
      label ? `What you want back is ${label}.` : `What you want back is the person underneath — we'll name them together as you go.`,
      `That is where we start. One step at a time.`,
    ].join(' ');
  },
  async composeIdentityNarrative(i) {
    const selves = joinSelves(i.facets);
    return [
      `You went back to the version of you that felt most alive, and you named it: ${selves}.`,
      `Not a role anyone handed you — the self you are choosing to wear again.`,
      `We start from your own words, and we sharpen it from here.`,
      `One step at a time.`,
    ].join(' ');
  },
};

// --- Anthropic (live) -------------------------------------------------------------------
function anthropicProvider(): AgentProvider {
  return {
    name: 'anthropic',
    async composeIdentityParagraph(i) {
     try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 9000, maxRetries: 1 });
      const msg = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
        max_tokens: 300,
        system: MEMBER_AGENT_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content:
              'Write the member identity paragraph (3–5 short sentences, G4L Member-facing voice) ' +
              'from this intake. ' +
              (i.doorDisplayName ? `Name their Door (${i.doorDisplayName}). ` : 'Their fade did not map to a named Door — reflect how the gap opened in their OWN words; do NOT invent or force a Door label. ') +
              (identityLabel(i.identityNoun)
                ? `Propose ${identityLabel(i.identityNoun)} as the identity to reclaim (whatever kind of person that is — do not assume it is athletic). Use natural case for the identity ("the Athlete", never all-caps). `
                : "They haven't named the identity yet — they'll find it through the work; frame it as a person they're reclaiming, without putting a single word to it. ") +
              'No metrics, no praise.\n\n' +
              `Past self: ${i.athleticPast}\nThe gap${i.doorDisplayName ? ` (${i.doorDisplayName})` : ''}: ${i.gap}\n\n` +
              'Output ONLY the paragraph itself — plain text, second person ("you"). ' +
              'No preamble, no heading, no labels, no markdown, no quotation marks.',
          },
        ],
      });
      const text = msg.content.find((b) => b.type === 'text');
      const out = text && text.type === 'text' ? text.text.trim() : '';
      return out || scriptedProvider.composeIdentityParagraph(i);
     } catch (e) {
      console.warn('identity paragraph: live agent unavailable, using scripted —', (e as Error).message);
      return scriptedProvider.composeIdentityParagraph(i);
     }
    },
    async composeIdentityNarrative(i) {
     try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 12000, maxRetries: 1 });
      const reflections = i.reflections.map((r) => `- ${r.prompt}\n  ${r.answer}`).join('\n');
      const msg = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
        max_tokens: 320,
        system: MEMBER_AGENT_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content:
              "Rewrite the short identity reflection on the member's dashboard — the mirror of who they are reclaiming. " +
              'They have just done deeper identity work, so make it SHARPER and more personal than before, in THEIR OWN words and scenes — ' +
              'relate it back to what they actually said. 3–5 short sentences, second person, plain G4L voice. ' +
              'Name the self or selves they are reclaiming in natural case (e.g. "the Elite Cyclist"). ' +
              'No metrics, no praise, no diagnosis, no quotation marks.\n\n' +
              `Selves they have named: ${i.facets.join(', ') || '(none yet)'}\n` +
              (i.priorParagraph ? `Their earlier reflection (build on it, do not contradict):\n${i.priorParagraph}\n\n` : '\n') +
              `What they said in ${i.sessionTitle}:\n${reflections}\n\n` +
              'Output ONLY the paragraph — plain text, second person, no preamble, heading, labels, markdown, or quotation marks.',
          },
        ],
      });
      const text = msg.content.find((b) => b.type === 'text');
      const out = text && text.type === 'text' ? text.text.trim() : '';
      return out || scriptedProvider.composeIdentityNarrative(i);
     } catch (e) {
      console.warn('identity narrative: live agent unavailable, keeping prior —', (e as Error).message);
      // Never regress to a generic line when we already have a real paragraph.
      return (i.priorParagraph ?? '').trim() || scriptedProvider.composeIdentityNarrative(i);
     }
    },
  };
}

export function getProvider(): AgentProvider {
  return process.env.ANTHROPIC_API_KEY ? anthropicProvider() : scriptedProvider;
}
