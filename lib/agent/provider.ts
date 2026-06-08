// Member Agent provider abstraction (the tech spec's provider-hedge, doing double duty).
// Two backends behind one interface:
//   - anthropic: the real Claude client (used when ANTHROPIC_API_KEY is set)
//   - scripted:  deterministic, offline responses for local dev with no key
// getProvider() picks automatically, so the same flow code runs locally today and switches
// to live Claude the moment a key is present — zero code change.

import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import { cleanIdentityNoun } from '../member/identity.ts';
import type { DoorSlug } from '../doors.ts';

export type OnboardingInput = {
  displayName: string;
  door: DoorSlug;
  doorDisplayName: string;
  identityNoun: string;
  athleticPast: string;
  gap: string;
  rightNow: string;
};

export interface AgentProvider {
  readonly name: 'anthropic' | 'scripted';
  /** Synthesize the member identity paragraph (G4L voice) that becomes the dashboard hero. */
  composeIdentityParagraph(input: OnboardingInput): Promise<string>;
}

// --- Scripted (offline) -----------------------------------------------------------------
// Deterministic, governance-clean prose. No banned words ("journey", "I hear you",
// "amazing"), short sentences, member-paced, reflective — a stand-in for live Claude.
export const scriptedProvider: AgentProvider = {
  name: 'scripted',
  async composeIdentityParagraph(i) {
    const noun = cleanIdentityNoun(i.identityNoun).toUpperCase();
    return [
      `You were ${article(i.athleticPast)} ${i.athleticPast.trim()}.`,
      `Then ${i.doorDisplayName} changed that, and lately ${lower(i.rightNow.trim())}.`,
      `What you want back is THE ${noun}.`,
      `That is where we start. One step at a time.`,
    ].join(' ');
  },
};

function lower(s: string) { return s.charAt(0).toLowerCase() + s.slice(1); }
function article(s: string) { return /^[aeiou]/i.test(s.trim()) ? 'an' : 'a'; }

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
              `from this intake. Name their Door and propose THE ${cleanIdentityNoun(i.identityNoun).toUpperCase()} ` +
              'as the identity to reclaim (whatever kind of person that is — do not assume it is athletic). No metrics, no praise.\n\n' +
              `Past self: ${i.athleticPast}\nThe gap (${i.doorDisplayName}): ${i.gap}\n` +
              `Right now: ${i.rightNow}\n\n` +
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
  };
}

export function getProvider(): AgentProvider {
  return process.env.ANTHROPIC_API_KEY ? anthropicProvider() : scriptedProvider;
}
