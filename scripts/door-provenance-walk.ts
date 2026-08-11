// DOES THE MODEL ACTUALLY HONOUR IT? — the live half of the provenance fix.
//
// Unit + seam tests prove the STRING is honest. They cannot prove the model reads it that way, and the whole point
// of this fix is that a member is told the truth about his own life. So: build the real system prompt for a member
// whose Session surfaced a Door he did NOT walk in with, ask for the summary that broke, and read what comes back.
//
// Reproduces Jay's 2026-08-11 walk exactly: carried Doors at intake, The Vanishing drawn out mid-Session, then the
// close. The sentence he was shown — "you named all four of these yourself at the start" — must not come back.
//
//   node --experimental-strip-types --env-file=.env.local scripts/door-provenance-walk.ts
// Costs real API tokens. NO DB — nothing is written, and no member's record is touched.
import { reconnectContext } from '../lib/agent/reconnect.ts';
import type { Collected } from '../lib/agent/onboarding.ts';

const MEMBER: Collected = {
  identityNoun: 'Racer',
  doors: ['career_cliff', 'marriage', 'load_bearer', 'vanishing'],
  gap: 'the miles stayed high but the racing stopped — riding turned from training into escape',
  reclaimList: ['race again', 'ride with the group without hiding'],
} as Collected;
const AT_ENTRY = ['career_cliff', 'marriage', 'load_bearer'] as const;

const { default: Anthropic } = await import('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30000, maxRetries: 2,
  // The gzip stream closes early against this endpoint under node-fetch; the other live walks pin identity too.
  defaultHeaders: { 'accept-encoding': 'identity' } });

// The ask that produced the false line: summarise the Doors and close the beat.
const ASK =
  'Close the Doors beat: in two short paragraphs, reflect back the shape of how the distance opened, name their ' +
  'Doors, and hand forward to the next beat. Speak to them directly.';

async function run(label: string, snapshot: readonly string[] | undefined) {
  const system = 'You are the G4L Member Agent closing the Reconnect Doors beat.' + reconnectContext(MEMBER, snapshot as never);
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 500, system,
    messages: [{ role: 'user', content: ASK }],
  });
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();

  // The failure is a CLAIM, so match on claim-shapes rather than one sentence — the model paraphrases.
  const claimsAllAtStart =
    /(all (four|of these|of them)[^.]{0,40}(you named|named (them|these)|at the start|from the start|yourself))/i.test(text) ||
    /(you|they) named[^.]{0,60}(at the (very )?start|at onboarding|from the beginning)[^.]{0,80}vanishing/i.test(text) ||
    /vanishing[^.]{0,80}(you|they) named[^.]{0,40}(at the (very )?start|at onboarding)/i.test(text);

  console.log(`\n${'─'.repeat(100)}\n${label}\n${'─'.repeat(100)}\n${text}\n`);
  return { text, claimsAllAtStart };
}

const withSnapshot = await run('WITH the entry snapshot — must credit the Session for The Vanishing', AT_ENTRY);
const noSnapshot = await run('WITHOUT a snapshot (a session resumed from before the fix) — must attribute NOTHING', undefined);

let bad = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? '✓' : '✖'}  ${msg}`); if (!ok) bad++; };

check(!withSnapshot.claimsAllAtStart, 'does not claim they named all of them at the start');
check(
  /vanishing/i.test(withSnapshot.text),
  'still names The Vanishing (the fix must not make the Companion forget it)',
);
check(!noSnapshot.claimsAllAtStart, 'un-snapshotted session also refuses the false claim');
check(/vanishing/i.test(noSnapshot.text), 'un-snapshotted session still recalls every Door');

console.log(bad ? `\n✖  ${bad} check(s) failed.` : '\n✓  the model honours the provenance split.');
process.exit(bad ? 1 : 0);
