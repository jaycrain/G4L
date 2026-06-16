// The companion at the Reconnect Checkpoint (Give-Back Model v0.4 §4) — the one firm gate. It asks
// the existential questions, reflects the member's OWN material back, and either affirms the milestone
// (on a declared reconnection) or holds warmly ("not yet" loops back; it does not advance). Live Claude
// when available; authored fallbacks keep the gate working if a call is slow/fails.

export type CheckpointCtx = {
  displayName: string;
  facets: string[]; // the selves they've named
  doors: string[]; // how the Fade got in
  memory?: string | null;
  reflection?: string; // what the member wrote at the gate
  synthesis?: string | null; // the living Playbook synthesis — a Checkpoint's richest material
};

async function say(system: string, user: string, fallback: string, maxTokens = 280): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 16000, maxRetries: 1 });
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
    const res = await client.messages.create({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] });
    const b = res.content.find((x) => x.type === 'text');
    const t = b && b.type === 'text' ? b.text.trim() : '';
    return t || fallback;
  } catch {
    return fallback;
  }
}

const VOICE =
  'You are the G4L Member Agent at the Reconnect Checkpoint — a milestone, the one firm gate in the program. ' +
  'Voice: warm, plain, second-person; tough love that RESPECTS; never hype, never grading, never clinical. ' +
  'This gates on FOUNDATION, not performance: have they found themselves again? Speak briefly and with weight.';

function material(c: CheckpointCtx): string {
  return (
    `Member: ${c.displayName}\n` +
    (c.facets.length ? `Who they've named reclaiming: ${c.facets.join(', ')}\n` : '') +
    (c.doors.length ? `How the Fade got in (their Doors): ${c.doors.join(', ')}\n` : '') +
    (c.synthesis ? `Their story so far (the richest read — lean on this):\n${c.synthesis}\n` : '') +
    (c.memory ? `What you remember about them:\n${c.memory}\n` : '')
  );
}

/** Open the gate: pose the existential questions, grounded in their own reconnect material. */
export function checkpointOpening(c: CheckpointCtx): Promise<string> {
  const fallback =
    `You've done the excavation — you named who you're reclaiming. Before Rewire, the real question, and it's yours to answer: ` +
    `have you found yourself again? Not all the way back — but have you remembered who that is? Let that land. What surfaced for you, and what does it mean?`;
  return say(
    VOICE +
      ' Ask the existential questions — have you found yourself? what surfaced? what does it mean? — reflecting their own material so it lands personally. 2–4 sentences. End by inviting them to answer in their own words. Output only what you say.',
    material(c) + '\nSpeak your opening to them now.',
    fallback,
  );
}

/** They declared they've reconnected — affirm the milestone from their own words, channel into Rewire. */
export function checkpointAffirmation(c: CheckpointCtx, firstRewireTitle: string): Promise<string> {
  const facetLine = c.facets.length ? c.facets.join(', ') : 'the self you named';
  const fallback =
    `Then it's real. You've reconnected — ${facetLine} isn't gone; you found the way back to it. ` +
    `That's the foundation everything else stands on. Rewire is open now — we start with ${firstRewireTitle}. Let's go.`;
  return say(
    VOICE +
      ` They have DECLARED they've reconnected (member is the authority on this). Reflect their OWN words/epiphany back, affirm the milestone with real weight (not hype), and channel them into Rewire — name that the first Session is "${firstRewireTitle}". 2–4 sentences. Output only what you say.`,
    material(c) + (c.reflection ? `\nWhat they just said at the gate:\n${c.reflection}\n` : '') + '\nSpeak your affirmation now.',
    fallback,
  );
}

/** They said "not yet" — hold warmly, stay transparent about why, offer the next move + the human valve. */
export function checkpointHold(c: CheckpointCtx): Promise<string> {
  const fallback =
    `Not yet — and that honest answer matters more than a fast one. Here's the why, plainly: if you front this, nothing in Rewire sticks — you'd be building on sand and sleepwalking through it. ` +
    `So stay in Reconnect a little longer: sit with the excavation, write more, answer in more detail. You don't have to do it alone — if you're genuinely stuck, someone can step in. I'm right here.`;
  return say(
    VOICE +
      ' They said "not yet." Do NOT advance them. Hold warmly: validate the honesty, explain transparently why the gate holds (front it and nothing in Rewire sticks), offer a concrete next move back into Reconnect, and let them know a person can step in if they\'re genuinely stuck. 3–4 sentences. Output only what you say.',
    material(c) + (c.reflection ? `\nWhat they wrote:\n${c.reflection}\n` : '') + '\nSpeak your hold now.',
    fallback,
  );
}
