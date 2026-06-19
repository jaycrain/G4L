// The Playbook synthesis — a living narrative the Member Agent maintains across Sessions: where you
// were → how the gap opened → where you are → the new intentions/habits forming → where you're headed.
// Woven from the member's own words (facets, kept Playbook lines, identity mirror) + journey data
// (their place on the 4Rs, Reclaim List movement). Refreshed on a Session close; surfaced at a
// Checkpoint as its richest material. Best-effort: never throws into a close. Live Claude only.

import type { Db } from '../db/schema.ts';
import { writeAsActor } from '../db/actor.ts';
import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import { listFacets } from '../curriculum/store.ts';
import { getJourney } from '../beats/store.ts';
import { getReclaimItems } from '../beats/store.ts';
import { playbookForAgent } from '../playbook/store.ts';

const SYNTH_SYSTEM = `${MEMBER_AGENT_SYSTEM_PROMPT}

OPERATING MOMENT: the Playbook synthesis — the living story the program keeps for this member.
Write it as ONE flowing narrative (no headers, no list), 5–8 short sentences, second person, in their
own spirit — warm, plain, never clinical, never praise. Move through five beats so it reads as an arc:
1) WHERE THEY WERE — the prior strong self, in their own proof/evidence.
2) THE FADE — what drifted and the Door it came through (backward-looking, their words).
3) WHERE THEY ARE NOW — the honest present, the hinge.
4) WHAT THEY'RE PUTTING BACK — the intentions and plays they've actually adopted (forward).
5) WHERE THEY'RE HEADED — the reclaimed self: back to who they were AND a fresh version of it.
RULES: weave THEIR words and facts — quote-adjacent, never invented; pull only from the material below.
Thin is fine early (you may only have beats 1–3); it gets richer as more accumulates. DIRECTION: the dig
looks backward (who life stripped away); the destination opens FORWARD — "the you you're reclaiming," a
fresh version — never "back to a frozen old self." Light touch, no wordplay drumbeat. Output ONLY the narrative.`;

/** Recompose + persist the member's Playbook synthesis. Returns it, or null if skipped/unavailable. */
export async function refreshPlaybookSynthesis(db: Db, memberId: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const [{ rows }, facets, journey, reclaim, playbook] = await Promise.all([
      db.query<{ display_name: string | null; identity_paragraph: string | null; agent_memory: string | null }>(
        'select display_name, identity_paragraph, agent_memory from member_profile where member_id=$1',
        [memberId],
      ),
      listFacets(db, memberId),
      getJourney(db, memberId),
      getReclaimItems(db, memberId),
      playbookForAgent(db, memberId),
    ]);
    const prof = rows[0];
    if (!prof) return null;

    const material = [
      `Member: ${prof.display_name ?? 'they'}`,
      facets.length ? `Selves they're reclaiming: ${facets.map((f) => f.text).join(', ')}` : null,
      prof.identity_paragraph ? `Their identity mirror: ${prof.identity_paragraph}` : null,
      `Where they are on the 4Rs: ${journey.currentRLabel ?? 'the start'} — ${journey.reclaim.reclaimed} reclaimed, ${journey.reclaim.moving} moving, ${journey.reclaim.notYet} still ahead.`,
      reclaim.length ? `Reclaim List:\n${reclaim.map((r) => `  • ${r.text} — ${r.state}`).join('\n')}` : null,
      playbook.keepers.length ? `Kept Playbook lines (their own words):\n${playbook.keepers.map((k) => `  • ${k.body}`).join('\n')}` : null,
      playbook.recentNotes.length ? `Recent journal:\n${playbook.recentNotes.map((n) => `  • ${n}`).join('\n')}` : null,
      prof.agent_memory ? `What you remember about them: ${prof.agent_memory}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 20000, maxRetries: 1 });
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 400,
      system: SYNTH_SYSTEM,
      messages: [{ role: 'user', content: `Here is everything the program knows about them. Write their synthesis.\n\n${material}` }],
    });
    const block = res.content.find((b) => b.type === 'text');
    const synthesis = block && block.type === 'text' ? block.text.trim() : '';
    if (!synthesis) return null;

    await writeAsActor(db, 'member_agent', (tx) =>
      tx.query('update member_profile set playbook_synthesis=$2 where member_id=$1', [memberId, synthesis]),
    );
    return synthesis;
  } catch {
    return null; // synthesis is enrichment — never break a close
  }
}

/** Read the stored synthesis (for the Playbook page + a Checkpoint's richest material). */
export async function getPlaybookSynthesis(db: Db, memberId: string): Promise<string | null> {
  try {
    const { rows } = await db.query<{ playbook_synthesis: string | null }>(
      'select playbook_synthesis from member_profile where member_id=$1',
      [memberId],
    );
    return rows[0]?.playbook_synthesis ?? null;
  } catch {
    return null;
  }
}
