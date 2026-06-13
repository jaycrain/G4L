// Ongoing Check-in — the Member Agent's always-on companion mode (Member Agent Tech Spec
// v1.1 §4.4 + docs/design/member-agent-companion.md). The member opens the dashboard bubble to
// share a win, vent, or think out loud. The agent is present, reflective, grounded in the
// member's context, and quietly biases toward human connection. Governance: crisis → 988.
//
// Live Claude when ANTHROPIC_API_KEY is set; deterministic scripted fallback otherwise.

import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import { detectCrisis, CRISIS_RESPONSE_US } from './governance.ts';
import type { Direction } from '../idq/scoring.ts';

export type CheckinContext = {
  displayName: string;
  identityNoun: string | null;
  doorDisplayNames: string[];
  idScore: number | null;
  direction: Direction | null;
  currentFocus: string | null;
  lastCompletedAsset: string | null;
  reclaimList: string[];
  grintaScore?: number | null; // the daily GRINTA! Index — for awareness, not to pitch
  grintaTrend?: 'up' | 'down' | 'flat' | null;
  consumedBites?: string[]; // titles of recently read bites
  pastSelf?: string | null; // their own words on who they were (from onboarding)
  gapStory?: string | null; // their own words on how the gap opened (from onboarding)
  identityParagraph?: string | null; // the synthesized identity paragraph
  // Full member data — the dashboard and the MA are one surface, so the agent knows everything
  // represented about the member and can answer specifically (within the governance rules).
  dimensions?: { physical: number; self: number; social: number; outlook: number } | null; // each /30
  idScoreHistory?: number[]; // ID Score across retakes, oldest→newest (the trend)
  idqAnswers?: { dimension: string; stem: string; score: number }[]; // the 24 answers, 1–5
  reclaimDetail?: { text: string; category: string; state: string }[]; // Reclaim items + progress
  beatsDone?: number; // Beats worked so far
  // The Playbook (the two-way loop): kept keepers + recent journal notes. Used to help — never
  // quoted back coldly or weaponized. Capped/summarized upstream.
  playbookKeepers?: { section: string; body: string }[];
  playbookNotes?: string[];
};

export type CheckinMessage = { role: 'agent' | 'member'; text: string };
export type CheckinTurn = { reply: string; crisis?: boolean };

const firstName = (n: string) => (n || '').trim().split(/\s+/)[0] ?? '';

export function contextBlock(c: CheckinContext): string {
  const dims = c.dimensions
    ? `ID Score dimensions (each out of 30): Physical ${c.dimensions.physical}, Self ${c.dimensions.self}, Social ${c.dimensions.social}, Outlook ${c.dimensions.outlook}`
    : null;
  const trend =
    c.idScoreHistory && c.idScoreHistory.length > 1
      ? `ID Score trend (oldest→newest): ${c.idScoreHistory.join(' → ')}`
      : null;
  const reclaim =
    c.reclaimDetail && c.reclaimDetail.length
      ? `Reclaim List with progress:\n${c.reclaimDetail.map((r) => `  • ${r.text} [${r.category}] — ${r.state}`).join('\n')}`
      : c.reclaimList && c.reclaimList.length
        ? `Reclaim List (what they want back): ${c.reclaimList.join('; ')}`
        : null;
  const idq =
    c.idqAnswers && c.idqAnswers.length
      ? `IDQ answers (their most recent, 1–5 where 5 = most true):\n${c.idqAnswers
          .map((a) => `  • [${a.dimension}] ${a.stem} — ${a.score}`)
          .join('\n')}`
      : null;
  return [
    `Member: ${c.displayName}`,
    c.identityNoun ? `Reclaiming: the ${c.identityNoun}` : null,
    c.doorDisplayNames.length ? `Door${c.doorDisplayNames.length > 1 ? 's' : ''}: ${c.doorDisplayNames.join(', ')}` : null,
    c.idScore !== null ? `Latest ID Score: ${c.idScore}${c.direction ? ` (${c.direction})` : ''}` : 'No IDQ yet',
    dims,
    trend,
    c.currentFocus ? `Current focus: ${c.currentFocus}` : null,
    c.grintaScore != null ? `GRINTA! Index: ${c.grintaScore}${c.grintaTrend ? ` (${c.grintaTrend} lately)` : ''}` : null,
    c.beatsDone != null ? `Beats worked so far: ${c.beatsDone}` : null,
    c.consumedBites && c.consumedBites.length ? `Recently read: ${c.consumedBites.join('; ')}` : null,
    reclaim,
    c.pastSelf ? `Who they were, in their own words: "${c.pastSelf}"` : null,
    c.gapStory ? `How the gap opened, in their own words: "${c.gapStory}"` : null,
    c.identityParagraph ? `Their story, synthesized: ${c.identityParagraph}` : null,
    idq,
    c.playbookKeepers && c.playbookKeepers.length
      ? `Their Playbook — what's working for them (kept):\n${c.playbookKeepers.map((k) => `  • [${k.section}] ${k.body}`).join('\n')}`
      : null,
    c.playbookNotes && c.playbookNotes.length
      ? `Recent Playbook journal entries (their own private writing):\n${c.playbookNotes.map((n) => `  • ${n}`).join('\n')}`
      : null,
  ].filter(Boolean).join('\n');
}

function checkinSystem(c: CheckinContext): string {
  return `${MEMBER_AGENT_SYSTEM_PROMPT}

OPERATING MOMENT: Ongoing Check-in.
The member opened the companion to check in — maybe to share a win, vent, or think out loud, maybe because there is no one else to talk to right now. Be present. Open warmly and, when natural, reference their most recent moment. Listen and reflect more than you advise. One question at a time.
Your quiet north star is their human connectedness: when it fits, gently bridge them toward people — the G4L community, a friend, a coach, or Jay — rather than keeping the conversation only with you. Be comfortable letting a short conversation end. Never pull for engagement or screen time.
You are aware of their GRINTA! Index (their daily showing-up), its trend, and what they have recently read — reference these naturally if they help the conversation (e.g. "your GRINTA! has been climbing"). Do NOT pitch content or hand out tasks; the daily bite lives on their dashboard, not in this chat.

YOU KNOW THEIR DATA. The dashboard and you are one surface — you hold everything represented about this member: their ID Score and its four dimensions, their full IDQ answers and trend, their GRINTA! Index, and their Reclaim List with progress (all in MEMBER CONTEXT below). If they ask about any score, dimension, index, answer, or trend, give a specific, accurate, informed answer — never deflect to "check your dashboard." Handle it strictly by the rules above: never a bare number (always with plain-language context), a low score or answer is honest information and never a verdict or diagnosis, and you use it to help them understand themselves, never to grade them.

NEVER RE-ONBOARD, AND NEVER EXPOSE A DATA GAP AS A TASK. You are the companion, not intake. Do NOT ask the member to supply profile data that belongs to onboarding — who they were ("who were you, at your best…"), their reclaimed identity, their Reclaim List, or their Door(s). You already know them. If a detail is simply absent from MEMBER CONTEXT, work with what you have — never announce the gap ("one thing I don't have yet is…", "I don't have your…") and never hand them a form-fill question. Above all, never say or imply you don't already know them. (If, much later, a specific memory would genuinely help the conversation, you may gently invite it in passing — but as reflection between people who know each other, never as data collection.)

TENDING THEIR RECORDS (add-only). A member sometimes wasn't fully focused during onboarding, or surfaces something new later. When they clearly want to add to or sharpen their Reclaim List, or name another way the gap opened, you can record it with your tools:
- add_reclaim_item — for something specific they want back. ANY goal that matters to them belongs on the list — not only identity work, but money, a venture, a milestone (e.g. "raise $250k", "$10k a month into savings"). It MUST be observable, something you could both witness; if they offer a feeling ("be happier", "more confident"), sharpen it WITH them first, then save the observable version. Pass the category you infer — use 'life' for goals that don't map to body/self/people/outlook. (The category is internal — never name it to the member.)
- add_door — when they genuinely name another Fade Door (another way the gap opened), not when they're simply venting.
- mark_reclaim_reclaimed — when the member clearly says they've achieved an item ("I raised the round", "that one's done"). Confirm first ("Want me to mark that one reclaimed?"); a passing mention isn't a completion.
COACH vs WITNESS (never named to the member): identity goals (body/self/people/outlook) advance through the Beats — that's the coached work, and you don't push those toward self-marking. Life goals (money/venture/etc.) have no Beats coaching them — they advance only when the member tells you they're done. Either way, if a member plainly declares any goal reclaimed, honor it (with the confirm). Never reveal that some goals are categorized differently — to them it's one list.
HOW SAVING WORKS — READ CAREFULLY. The ONLY way anything is saved is by calling the tool. Writing "I've added that" or "it's on your list now" in your reply saves NOTHING — it is just text. So whenever you intend to add an item or a Door, you MUST emit the tool call (add_reclaim_item / add_door) in that turn. Reflect the wording back so they recognize it, and — once it is specific and observable — call the tool in the same turn; do not wait for a separate "yes" and do not promise to add it "later". After the tool returns success, then (and only then) acknowledge it's on their dashboard.
Rules: only when they clearly want it, never unprompted; you can ADD only — you cannot delete or rename here, so if they want to remove or change something, acknowledge it warmly and say you'll note it, do not pretend to delete; keep it conversational, never data-entry.
CRITICAL: never tell the member something was added / is on their list unless you actually called the tool and it returned success THIS turn. If you didn't call it, or it refused (fog, duplicate, no match), do NOT claim it was saved — instead do the next real thing (call the tool now, or ask them to sharpen the wording). Never describe a save you didn't make.

THE PLAYBOOK (their kept record of what's working). When a genuine keeper surfaces in conversation — a reframe that's working for them, a piece of science that actually convinced THEM, or a line of theirs worth holding onto — you may add it with propose_playbook_entry (phrased tight, in their voice). Default is a PROPOSAL they confirm on their Playbook page; set confirmed=true only if they've clearly asked to keep/save it now. Mention at most one or two in a conversation — never turn the chat into a list — and you can ADD only. Same save rule as everything else: only say it's in their Playbook after the tool confirms it.
Their Playbook (kept keepers + recent journal entries) appears in MEMBER CONTEXT. It is the member's most personal writing. Use it to understand and help them, and fold it in naturally — but NEVER quote their journal back coldly ("you wrote on Tuesday…"), never use it to pressure or guilt ("but you said you would…"), and only respond to a journal entry if they ask. It is theirs; hold it with care.

ANY GOAL, AND MARKING IT DONE. The Reclaim List can hold ANY goal that matters to them — not just identity work, but life goals too (money, a venture, savings, a fundraise). When you add one, set its category; use 'life' for goals that don't map to body/self/people/outlook. Categories are INTERNAL — never name a category to the member, never imply some goals are treated differently.
A goal is reclaimed when the real-world thing actually happened — the member is the authority on that (the same standard the close already uses). So when they clearly declare one done, you can mark it reclaimed with mark_reclaim_reclaimed — but ONLY after you confirm it this turn ("Want me to mark that one reclaimed?") and pass confirmed=true; a passing mention is never enough. For LIFE goals this is the path, so honor a clear "done" readily. For IDENTITY goals the coached Beats are the real path — never suggest marking one done; only honor an unambiguous, member-initiated "that one's genuinely done." If the member says a mark was premature, use unmark_reclaim_reclaimed to set it back. And when they want to RESTATE an item — they phrased it off, or want it sharper — refine its wording with refine_reclaim_item (keep it specific and observable; this keeps the item's progress). "Add or refine" means both.

MEMBER CONTEXT (facts — do not invent beyond these):
${contextBlock(c)}`;
}

// --- Scripted (offline) — brand-voice safe (no "journey" / "I hear you" / "amazing") --------
function scriptedOpening(c: CheckinContext): string {
  const hi = `Good to see you${firstName(c.displayName) ? `, ${firstName(c.displayName)}` : ''}.`;
  const noun = c.identityNoun ? `the ${c.identityNoun}` : 'the person you’re reclaiming';
  const item = c.reclaimList?.[0];
  let knew = `${hi} I’ve been sitting with what you told me — you’re reclaiming ${noun}`;
  if (item) knew += `, and part of what you want back is ${item.charAt(0).toLowerCase() + item.slice(1)}`;
  knew += '.';
  if (c.doorDisplayNames.length) knew += ` ${c.doorDisplayNames[0]} is a real one to come through.`;
  const compact =
    'There’s a lot on your dashboard now — that’s your program, made specific to you. I’ll help those numbers make sense, and we’ll work that list together, one step at a time. Everything here stays between us, and the more honest you can be with yourself, the better this tends to go. I’m here, I’m listening, and we’ll keep refining it as we both learn what’s really going on.';
  return `${knew}\n\n${compact}\n\nWhere do you want to start?`;
}

function scriptedReply(memberMessage: string): string {
  const m = memberMessage.toLowerCase();
  if (/(win|did it|finished|proud|good day|great|achieved|hit|nailed)/.test(m)) {
    return `That's worth marking. Who else in your life would want to hear it?`;
  }
  if (/(tired|hard|rough|stuck|down|lonely|alone|sad|stress)/.test(m)) {
    return `That sounds heavy. What's underneath it for you right now?`;
  }
  return `Thank you for telling me. What feels most true about that today?`;
}

// --- Live (Claude) --------------------------------------------------------------------------

// The member can ask the agent to tend their own records (add a Reclaim List item, name another
// Door). The action layer supplies an executor with DB access; checkin.ts stays DB-agnostic. Tools
// are additive only — there is intentionally no delete/overwrite here.
export type ToolResult = { ok: boolean; message: string };
export type ToolExecutor = (name: string, input: Record<string, unknown>) => Promise<ToolResult>;

const REFINE_TOOLS = [
  {
    name: 'add_reclaim_item',
    description:
      "Add ONE new item to the member's Reclaim List — only when they clearly want to add something they want back. ANY goal that matters to them belongs here, not just identity work. The text must be SPECIFIC and OBSERVABLE (something you could both witness — 'raise $250k' is observable; 'be more successful' is not). Confirm the wording first; if they give a feeling, sharpen it with them before calling this.",
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'the specific, observable item, in the member’s spirit' },
        category: {
          type: 'string',
          enum: ['physical', 'self', 'social', 'outlook', 'life'],
          description:
            "the area it belongs to. Use 'life' for goals that don't map to body/self/people/outlook — money, business, fundraising, savings, ventures. (Internal; never shown to the member.)",
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'mark_reclaim_reclaimed',
    description:
      "Mark a Reclaim List item reclaimed — when the member clearly declares they've achieved it ('I raised the round'; 'I'm riding Carter Lake every week now, that one's done'). A goal is done when the real-world thing happened — the member is the authority on that. You MUST confirm first ('Want me to mark that one reclaimed?') and only then call this with confirmed=true; a passing mention is not a declaration. This is the path for life goals; for identity goals the coached Beats are the default — never suggest marking one done, only honor an unambiguous member-initiated 'that one's genuinely done.'",
    input_schema: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'the member’s reference to the Reclaim List item they’ve completed' },
        confirmed: { type: 'boolean', description: 'true ONLY after the member explicitly says yes to marking it reclaimed this turn' },
      },
      required: ['item', 'confirmed'],
    },
  },
  {
    name: 'refine_reclaim_item',
    description:
      "Refine the WORDING of an existing Reclaim List item when the member wants to restate it (they phrased it off, or want it sharper). Pass their reference to the current item and the new wording. Keeps its progress and category — only the text changes. The new wording must stay SPECIFIC and OBSERVABLE; if they drift to a feeling, sharpen it with them first. Set category only if the goal's area genuinely changed.",
    input_schema: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'reference to the current Reclaim List item' },
        text: { type: 'string', description: 'the new wording, specific and observable, in their voice' },
        category: { type: 'string', enum: ['physical', 'self', 'social', 'outlook', 'life'], description: 'only if the area genuinely changed' },
      },
      required: ['item', 'text'],
    },
  },
  {
    name: 'unmark_reclaim_reclaimed',
    description:
      "Reverse a reclaimed mark when the member says it was premature ('actually that's not done', 'undo that'). Only reverses a member self-mark — a goal earned through the Beats can't be undone here. Pass their reference to the item.",
    input_schema: {
      type: 'object',
      properties: { item: { type: 'string', description: 'the Reclaim List item to set back to in-progress' } },
      required: ['item'],
    },
  },
  {
    name: 'add_door',
    description:
      'Record an additional Fade Door the member surfaces — another way the gap opened. Pass their description in their own words; it is mapped to the canonical Doors. Only when they are genuinely naming another Door, not just venting.',
    input_schema: {
      type: 'object',
      properties: { description: { type: 'string', description: 'how that part of the gap opened, in their words' } },
      required: ['description'],
    },
  },
  {
    name: 'propose_playbook_entry',
    description:
      "Add an entry to the member's Playbook — their kept record of what's working. Use it when a real keeper surfaces in conversation: a reframe/tactic that's clearly working for them (what_works), a piece of science that genuinely convinced THEM (why_works), or a line they said that's worth holding onto (in_words). Phrase it tight, in their voice. By default it's a PROPOSAL they confirm later; set confirmed=true only if they've clearly asked to save/keep it now.",
    input_schema: {
      type: 'object',
      properties: {
        section: { type: 'string', enum: ['what_works', 'why_works', 'own_words'], description: 'which section it belongs in' },
        body: { type: 'string', description: 'the keeper, tight and in the member’s own voice' },
        source_label: { type: 'string', description: 'optional short provenance chip, e.g. "Rewire · Food as fuel"' },
        confirmed: { type: 'boolean', description: 'true only if the member explicitly asked to keep/save it now' },
      },
      required: ['section', 'body'],
    },
  },
];

async function liveReply(
  system: string,
  history: CheckinMessage[],
  userText: string,
  executor?: ToolExecutor,
): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 20000, maxRetries: 2 });
  const messages: any[] = [
    ...history.map((m) => ({ role: (m.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text })),
    { role: 'user' as const, content: userText },
  ];

  // Tool loop: let the model call a refine tool, run it, feed the result back, continue. Capped.
  for (let i = 0; i < 4; i++) {
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 500,
      system,
      messages,
      ...(executor ? { tools: REFINE_TOOLS as any } : {}),
    });
    const toolUses = res.content.filter((b) => b.type === 'tool_use');
    if (!executor || res.stop_reason !== 'tool_use' || toolUses.length === 0) {
      const block = res.content.find((b) => b.type === 'text');
      return block && block.type === 'text' ? block.text.trim() : '';
    }
    messages.push({ role: 'assistant', content: res.content });
    const results = [];
    for (const tu of toolUses) {
      const out = await executor((tu as any).name, ((tu as any).input ?? {}) as Record<string, unknown>);
      results.push({ type: 'tool_result', tool_use_id: (tu as any).id, content: out.message });
    }
    messages.push({ role: 'user', content: results });
  }
  // Loop exhausted: one final text-only turn so we never return empty.
  const fin = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 400,
    system,
    messages,
  });
  const block = fin.content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text.trim() : '';
}

export async function checkinOpening(c: CheckinContext): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await liveReply(
        checkinSystem(c),
        [],
        'This is the member\'s VERY FIRST conversation with you — moments after a personal onboarding, now looking at a dashboard full of new numbers and panels for the first time. In your own warm voice (a short paragraph, never a script or a bulleted list), do three things:\n' +
          'NEVER open with a number, score, or metric — "your GRINTA went up", "your ID Score is 62" is exactly the wrong first thing; a stat is not a welcome, and on day one the numbers are meaningless to them. Lead with the person. (Their data is for later, when they ask.)\n' +
          '1) SHOW YOU KNOW THEM — reflect back something specific they told you (their reclaimed identity, a concrete Reclaim List item, or how their Door opened), in their own words and spirit, so they feel heard. Do not restate the dashboard at them.\n' +
          '2) EASE THEM IN — let them know the dashboard is their program made specific to them, and that you\'ll help those cold numbers make sense and work the Reclaim List together, a step at a time. Do NOT explain each panel (the Field Guide does that) — just reassure them you\'ll make sense of it WITH them.\n' +
          '3) SET THE COMPACT, lightly — you\'re here and listening, this space is confidential, the more honest they can be with themselves the better and faster this tends to go, and you\'ll both keep refining as you learn what\'s really going on. You care, and you\'re here to help.\n' +
          'Keep it human and unhurried, end with one gentle open invitation, and never promise outcomes or imply you\'ll do the work for them — they do the work; you guide, witness, and stay beside them.',
      );
    } catch (e) {
      console.warn('check-in opening: live agent unavailable, using scripted —', (e as Error).message);
    }
  }
  return scriptedOpening(c);
}

export async function checkinReply(
  c: CheckinContext,
  history: CheckinMessage[],
  memberMessage: string,
  executor?: ToolExecutor,
): Promise<CheckinTurn> {
  if (detectCrisis(memberMessage).flagged) return { reply: CRISIS_RESPONSE_US, crisis: true };
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return { reply: await liveReply(checkinSystem(c), history, memberMessage, executor) };
    } catch (e) {
      console.warn('check-in reply: live agent unavailable, using scripted —', (e as Error).message);
    }
  }
  return { reply: scriptedReply(memberMessage) };
}

/** A short, dismissible proactive teaser for the resting bubble (or null). Signal-driven. */
export function proactiveTeaser(c: CheckinContext): string | null {
  if (c.idScore === null) return 'Ready for your IDQ when you are.';
  if (c.lastCompletedAsset) return `How did ${c.lastCompletedAsset} land?`;
  if (c.direction === 'up') return 'Your score moved up — want to talk about what is working?';
  if (c.direction === 'down') return 'Checking in — how are you landing this week?';
  return 'How are you landing this week?';
}
