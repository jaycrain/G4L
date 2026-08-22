// THE CARRY-FORWARD SPINE — what each asset RETAINS, and which upstream assets each one READS.
//
// THE FINDING. Every one of Greg's twelve Guidance memos specifies `prior_module_context` as a named mechanism:
// each asset declares what it keeps and who consumes it. We had implemented ONE link (W1's affirmation and W2's
// image reaching W3 through the keeper-recall rail) and left the other eleven absent. He designed a spine; we
// built one vertebra. This is the general mechanism, so the remaining links are registry entries rather than
// eleven bespoke joins.
//
// IT IS CUMULATIVE, NOT A CHAIN AND NOT A WEB OF PAIRS. This header said "a web — ten one-to-one links plus two
// fan-ins" for exactly one day, because it was written from a table synthesized off the GUIDANCE memos. Reading
// all twelve ENGINEERING memos (2026-08-17) showed the real design: every asset loads essentially everything
// before it, and the load GROWS as the member moves through the program — R2 loads one asset, W3 loads five, B3
// loads six, C1 loads the summaries of all three prior phases. A `previousAsset` pointer was never close.
// The per-asset declarations are transcribed verbatim on UPSTREAM below; read those, not this paragraph.
//
// WHAT THE REAL PROBLEM TURNED OUT TO BE. Not that the upstream data is missing — I checked all twelve and every
// one is stored. It is that twelve assets store their output in ten different SHAPES behind ten different
// readers, so every link had to be hand-written against a different store. That is why we built one and stopped.
// This file is the uniform question — "what does asset X retain?" — asked once per asset.
//
// THREE RULES THIS FILE HOLDS:
//
//   1. SILENT WHEN ABSENT (Jay, 2026-08-17). Rewire and Rebuild run in PARALLEL, dosed per member, so B3 opening
//      with W3 never done is the program working as designed, not an error. A missing upstream returns null and
//      the Session simply connects to what does exist. Nothing may render "you haven't done W3 yet" — that is
//      exposing a data gap as a task, which the companion is already forbidden to do.
//
//   2. THEIR OWN WORDS WHERE WE HAVE THEM. Keepers, triggers, plan text and Reclaim items are stored as the
//      member wrote them and carry forward VERBATIM. Only the instrument readings (B1's motivation, B2's skills,
//      C2's audit) are summarized, because those are scores and there are no member words to preserve.
//
//   3. LIVE, NEVER SNAPSHOT. Each read runs at the moment the downstream Session opens. If a member redoes B2,
//      B3 must reflect the new map — a snapshot is how context ends up asserting something that stopped being
//      true (see the "named at onboarding" bug over a mutable set).

import type { Db } from '../db/schema.ts';
import { latestWhyReading, latestSkillsReading } from '../rebuild/store.ts';
import { relativeAutonomyRead } from '../rebuild/why-instrument.ts';
import { buildSkillsMap } from '../rebuild/skills-map.ts';
import { w3Triggers } from '../rewire/w3-triggers.ts';
import { activeCoachingPlan, type RebuildPilotPayload } from '../rebuild/plan-store.ts';
import { b3Entries } from '../rebuild/b3-entry.ts';
import { latestBiggerWorldReading, firstFocus } from '../reclaim/bigger-world-store.ts';
import { getReclaimItems } from '../beats/store.ts';
import { doorProfile, describeDoorProfile } from '../reconnect/door-profile.ts';
import { getLegacyLetter } from '../reconnect/legacy-letter-store.ts';
import { AUDIT_DOMAIN_LABEL } from '../reclaim/bigger-world-instrument.ts';

/** The assets that can be carried forward. */
export type RetainedAssetId = 'r2' | 'r3' | 'w1' | 'w2' | 'w3' | 'b1' | 'b2' | 'b3' | 'c1' | 'c2';

export type Retained = {
  asset: RetainedAssetId;
  /** How the Session names it to the member, e.g. "your why". Never the asset code. */
  label: string;
  /** One or more short lines. Member's words where we have them; a summary only for the instruments. */
  lines: string[];
};

/**
 * WHO READS WHOM — transcribed from each Engineering Memo's OWN `load prior module context` line, 2026-08-17.
 * All twelve read. TWO NORMALIZATIONS applied to these quotes, both flagged rather than silent: Greg's
 * camel-casing of the four Rs, and his retired two-word label for the Doors. The naming guard blocks both, and it
 * exists precisely because his house style leaks into our copy through transcriptions like these. Substance is
 * untouched — only those two spellings.
 *
 * IT IS CUMULATIVE, NOT A WEB OF PAIRWISE LINKS — and that is the correction that matters. I had modelled this
 * as ~15 one-to-one handoffs with two fan-ins. Wrong. Every asset loads essentially everything before it, and
 * the load grows as the member moves through the program:
 *
 *   R1  (nothing — it is first; its only input is the onboarding Book Quiz)
 *   R2  "load prior module context (R1 ratings, largest gap domain, captured values and remembered-self language)"
 *   R3  "...(R1 ratings, largest gap domain, remembered-self language; R2 door ratings, first/biggest/still-open doors)"
 *   W1  "...(R1 IDQ results, R2 Doors, R3 Legacy Letter)"
 *   W2  "...(R1 IDQ, R2 Doors, R3 Legacy Letter, W1 disinformation statements and captured values)"
 *   W3  "...(R1 IDQ, R2 Doors, R3 Legacy Letter, W1 disinformation statements and captured values,
 *        W2 visualization text and anchor element)"
 *   B1  "...(identity descriptors, motivational anchors from Reconnect; self-talk and drift insights from Rewire)"
 *   B2  "...(B1 motivational baseline; Rewire self-talk and drift insights; Reconnect identity descriptors)"
 *   B3  "...(identity, motivation from B1, self-management appraisal from B2, disinformation awareness from W1,
 *        visualization from W2, false-start protocol from W3)"
 *   C1  no load line; instead "load the Member's original Reclaim List as the object of reflection".
 *       Inputs: "prior_module_context (summaries from Reconnect, Rewire, Rebuild where available)"
 *   C2  "load the Member's prior module context (identity descriptors, motivational anchors, self-management
 *        reflections, behavior insights, revised Reclaim List) for reflective reference"
 *   C3  "...(identity, motivation, self-management, revised Reclaim List, Bigger World Audit assessment)"
 *
 * TWO DIFFERENT THINGS, AND CONFLATING THEM IS HOW I GOT B3 WRONG TWICE. The `load` line is the CONTEXT the
 * Companion is given — wide. The authored "Connect to prior learning" STEP is what the member is actually asked
 * about — narrow (B3's is one bullet naming B1, B2, W3). This registry feeds the model's context, so it follows
 * the LOAD line. The narrow step is a conversation-design question, not a data question.
 *
 * PHASE-LEVEL TERMS ARE RESOLVED TO THE ASSETS THAT HOLD THEM: "self-talk and drift insights from Rewire" → W1
 * (the disinformation statements) + W2 (the image); "summaries from Rebuild" → B1, B2, B3. Where a term names no
 * asset at all, see the note on `identity` below.
 *
 * `identity` IS RESOLVED — Greg, 2026-08-22 (docs/decisions/2026-08-22-greg-four-defaults.md).
 *
 * Four memos load it (B1, B3, C2, C3) and none says what it is. It was left deliberately unread rather than
 * guessed, because guessing would put a wrong claim about a member in front of her in a later Session.
 *
 * IT IS THE IDENTITY SHE NAMED, plus HER REMEMBERED-SELF LANGUAGE from R1. It is NOT her IDQ scores or her
 * largest gap domain: R2 and R3's memos name "R1 ratings, largest gap domain, remembered-self language" as
 * separate items, which is how he writes it when he means both, and B1's memo says "identity DESCRIPTORS", not
 * scores. No score crosses into a later Session — B1's "nothing renders as a number" holds here too.
 *
 * STILL NOT WIRED, deliberately. Giving `identity` a reader changes what the Companion says about a member in a
 * later Session — the surface where being wrong is worst — so it gets its own pass rather than riding along with
 * a decision record. Four Sessions are reading one fewer piece of context than his memos specify; absent has
 * always been the safe side of that.
 */
export const UPSTREAM: Partial<Record<string, RetainedAssetId[]>> = {
  // Reconnect's three beats live in ONE arc, so R2/R3 already hold R1 in the live thread. Listed for
  // completeness of the map; wiring them is a separate question from whether the data is reachable.
  r3: ['r2'],
  w1: ['r2', 'r3'],
  w2: ['r2', 'r3', 'w1'],
  w3: ['r2', 'r3', 'w1', 'w2'],
  b1: ['r2', 'r3', 'w1', 'w2'],
  b2: ['b1', 'w1', 'w2'],
  b3: ['b1', 'b2', 'w1', 'w2', 'w3'],
  c1: ['r2', 'r3', 'w1', 'w2', 'w3', 'b1', 'b2', 'b3'],
  c2: ['b1', 'b2', 'c1'],
  // B3 is NOT in C3's load line, and is included anyway on the strength of the rest of the memo: "B3 monitoring
  // experience available as a parallel reference" (State and memory requirements → Preferred) and, at Stage 7,
  // "Reference the parallel to B3 (activity tracking for fitness)". Following one line over the document would
  // have dropped the comparison C3's closing is built around.
  c3: ['b1', 'b2', 'c1', 'c2', 'b3'],
};

/**
 * Kept keepers of one type, newest-relevant first, capped at two.
 *
 * Guarded like every other reader: a drifted `playbook_entry` costs this one line, not the Session. The cap is
 * the point — a member deep in the program can hold a dozen true lines, and pouring all of them into a later
 * Session's context is how "the program remembers you" turns into the program reciting you at yourself.
 */
async function keepersOfType(db: Db, memberId: string, keeperType: string): Promise<string[]> {
  try {
    const { rows } = await db.query<{ body: string }>(
      `select body from playbook_entry
        where member_id=$1 and state='kept' and keeper_type=$2
        order by pinned desc, sort_order, created_at limit 2`,
      [memberId, keeperType],
    );
    return rows.map((r) => (r.body ?? '').trim()).filter(Boolean);
  } catch (err) {
    console.error(`keepersOfType(${keeperType}) failed for member=${memberId}:`, err);
    return [];
  }
}

/** Which assets are INSTRUMENT readings rather than the member's own words. See describeCarryForward. */
const COMPUTED = new Set<RetainedAssetId>(['b1', 'b2', 'c2']);

/** Trim, drop empties, cap. A carry-forward that dumps six lines stops being context and becomes a recital. */
const lines = (...xs: (string | null | undefined)[]): string[] =>
  xs.map((s) => (s ?? '').trim()).filter(Boolean).slice(0, 3);

/**
 * Every reader is individually guarded. One drifted or missing register must cost ONE upstream line, never the
 * whole Session — the same degrade-not-crash posture the companion context uses, for the same reason: this runs
 * on a surface the member is already looking at.
 */
const READERS: Record<RetainedAssetId, (db: Db, memberId: string) => Promise<Retained | null>> = {
  // R2 — "door ratings, first/biggest/still-open doors" (R3's memo, verbatim). This is exactly the profile added
  // in migration 0085 the day before this was written, so the field Greg names now exists. describeDoorProfile
  // returns null when they've said nothing, which is what keeps an unasked profile out of the context entirely.
  async r2(db, memberId) {
    const line = describeDoorProfile(await doorProfile(db, memberId).catch(() => []));
    return line ? { asset: 'r2', label: 'their Doors', lines: [line] } : null;
  },

  // R3 — the Legacy Letter. VERBATIM and UNSUMMARIZED: it is the single most personal artifact in the program,
  // written in their own voice to their future self. Capped hard, because carrying the whole letter into every
  // later Session would crowd out everything else — the opening is what makes it recognizable to them.
  async r3(db, memberId) {
    const letter = await getLegacyLetter(db, memberId).catch(() => null);
    const body = (letter?.body ?? '').trim();
    if (!body) return null;
    const opening = body.length > 240 ? `${body.slice(0, 240).trimEnd()}…` : body;
    return { asset: 'r3', label: 'their Legacy Letter', lines: [`In their own words: "${opening}"`] };
  },

  // W1 — the true lines they wrote against their own disinformation. Stored as keepers with keeper_type
  // 'principle' (lib/agent/rewire.ts). VERBATIM: hearing their OWN line back is the entire mechanism, and a
  // paraphrase of it is worth nothing.
  async w1(db, memberId) {
    const ks = await keepersOfType(db, memberId, 'principle');
    return ks.length ? { asset: 'w1', label: 'their true lines', lines: [`Lines they wrote to answer their own: ${ks.map((k) => `“${k}”`).join(' · ')}`] } : null;
  },

  // W2 — the visualization. Same store, keeper_type 'lights_you_up'. Also verbatim, same reasoning.
  async w2(db, memberId) {
    const ks = await keepersOfType(db, memberId, 'lights_you_up');
    return ks.length ? { asset: 'w2', label: 'the picture they built', lines: [`How they described where they're headed: “${ks[0]}”`] } : null;
  },

  // B1 — the motivational baseline. SUMMARIZED, never scored: B1's own spec forbids showing a number, gauge or
  // verdict (RB-1), and that rule does not weaken just because the reader is another Session.
  async b1(db, memberId) {
    const r = await latestWhyReading(db, memberId).catch(() => null);
    if (!r) return null;
    // TWO DOMAINS, NOT ONE. Greg scores relative autonomy SEPARATELY for movement and eating, and B3 plans a
    // change in each — so collapsing them would hand B3 one verdict for two different motivations. (My first
    // draft read a `scores.ram` that does not exist, which made this link silently return null forever; the test
    // below is unconditional so that cannot recur.)
    const act = r.scores?.activity?.relativeAutonomous;
    const diet = r.scores?.diet?.relativeAutonomous;
    // THIRD PERSON, DELIBERATELY. relativeAutonomyRead returns MEMBER-FACING second person ("mostly your own
    // reasons") because it is also rendered on their own surfaces. Dropped into a sentence about them, it
    // produced "what pulls THEM is mostly YOUR own reasons" — incoherent, and a live eval showed the model
    // resolving the muddle by attributing the reading to the member's own speech ("since you said…"). They said
    // no such thing; they answered twelve Likert items and we computed it.
    const third = (v: number) => relativeAutonomyRead(v).replace(/\byour\b/g, 'their');
    const body = lines(
      typeof act === 'number' ? `On movement, what pulls them is ${third(act)}.` : null,
      typeof diet === 'number' ? `On eating, ${third(diet)}.` : null,
    );
    return body.length ? { asset: 'b1', label: 'their why', lines: body } : null;
  },

  // B2 — the development map. The lead names their strongest skill and the thinnest family; no number crosses.
  async b2(db, memberId) {
    const r = await latestSkillsReading(db, memberId).catch(() => null);
    if (!r) return null;
    try {
      const m = buildSkillsMap(r.scores);
      const body = lines(
        m.strongest ? `Their strongest skill is ${m.strongest.toLowerCase()}.` : null,
        m.thinnest ? `The thinnest family for them is ${m.thinnest}.` : null,
      );
      return body.length ? { asset: 'b2', label: 'their map', lines: body } : null;
    } catch {
      return null;
    }
  },

  // W3 — the False Start Protocol. VERBATIM: these are the trigger names the member wrote, and the whole value of
  // carrying them is that B3 can use their words rather than a paraphrase of their words.
  async w3(db, memberId) {
    const t = await w3Triggers(db, memberId).catch(() => []);
    const labels = t.map((x) => x.label).filter(Boolean);
    if (!labels.length) return null;
    return { asset: 'w3', label: 'their False Start Protocol', lines: [`The triggers they named: ${labels.join('; ')}.`] };
  },

  // B3 — the pilot plan and what the week taught. Both halves matter to C3: the plan is what they intended, the
  // entries are what actually happened, and Greg's C3 step is explicitly about the gap between those two.
  async b3(db, memberId) {
    const plan = await activeCoachingPlan<RebuildPilotPayload>(db, memberId, 'rebuild').catch(() => null);
    const week = await b3Entries(db, memberId, 7).catch(() => []);
    const p = plan?.payload;
    const learned = week.find((e) => e.contributed)?.contributed ?? week.find((e) => e.reflection)?.reflection ?? null;
    const body = lines(
      p?.activityChange ? `Their movement change: ${p.activityChange}.` : null,
      p?.dietChange ? `Their eating change: ${p.dietChange}.` : null,
      learned ? `From their week, in their words: "${learned}"` : null,
    );
    return body.length ? { asset: 'b3', label: 'their Lifestyle Pilot', lines: body } : null;
  },

  // C1 — the REFINED Reclaim List. Their words, exactly: this is the list they rewrote to be self-concordant, and
  // C3 defines a Quality Day against it. Capped at three because the block is context, not a recital — and the
  // list is theirs to read in full on their own dashboard.
  async c1(db, memberId) {
    const items = await getReclaimItems(db, memberId).catch(() => []);
    const texts = items.map((i) => (i.text ?? '').trim()).filter(Boolean).slice(0, 3);
    if (!texts.length) return null;
    return { asset: 'c1', label: 'their Reclaim List', lines: [`What they want back: ${texts.join('; ')}.`] };
  },

  // C2 — where life is opening and where it is still narrow. FIRST FOCUS, not the computed primary: the member's
  // CHOICE leads (Jay, 2026-08-09). Reading the ranking here would repeat the bug that told a member who chose
  // Social that they had chosen Physical.
  async c2(db, memberId) {
    const bw = await latestBiggerWorldReading(db, memberId).catch(() => null);
    if (!bw) return null;
    const focus = firstFocus(bw);
    const primary = AUDIT_DOMAIN_LABEL[focus.domain];
    if (!primary) return null;
    return {
      asset: 'c2',
      label: 'their Bigger World Audit',
      lines: [`The area they chose to open up: ${primary.toLowerCase()}.`],
    };
  },
};

/**
 * Everything the given Session carries forward, in the order its upstreams are declared.
 *
 * Returns only what EXISTS. A member who has done none of the upstream work gets an empty array, and the caller
 * must render nothing at all rather than a "nothing yet" line — see rule 1 at the top of this file.
 */
export async function carryForward(db: Db, memberId: string, sessionKey: string): Promise<Retained[]> {
  const ups = UPSTREAM[sessionKey];
  if (!ups?.length) return [];
  const all = await Promise.all(ups.map((a) => READERS[a](db, memberId).catch(() => null)));
  return all.filter((r): r is Retained => r !== null);
}

/**
 * The carry-forward as one context block for the Session's model turn — or null when there is nothing.
 *
 * NULL IS THE POINT. Handing the model an empty or "none on file" block invites it to narrate the absence, and a
 * member hearing "you haven't done your Rewire work yet" at the top of a Rebuild Session is being told they are
 * behind on a program that was explicitly designed to let them run these in either order.
 */
export function describeCarryForward(retained: Retained[]): string | null {
  if (!retained.length) return null;
  // COMPUTED vs THEIR OWN WORDS is marked per line, because the model cannot tell them apart and a live eval
  // caught it saying "since you said movement comes from your own reasons" about a Likert result. Quoting a
  // member's own line back is the feature; telling them they said something they never said corrodes the exact
  // trust the memory is meant to build.
  const body = retained
    .map((r) => `- ${r.label} (${COMPUTED.has(r.asset) ? 'computed from an assessment — NOT their words' : 'their own words'}): ${r.lines.join(' ')}`)
    .join('\n');
  return (
    'WHAT THEY ALREADY DID, AND WHAT IT SAID — connect this Session to it in your own words, early and briefly.\n' +
    `${body}\n` +
    'Use it to show the program remembers them: refer back to ONE of these where it genuinely bears on what they ' +
    'are doing now, in their words, not all of them and not as a recap. Do NOT list these back, do not mention ' +
    'any prior Session they have not done, and never imply they are behind — these run in the order that suits ' +
    'them, and an absent one is a choice, not a gap.\n' +
    'NAME ONE SPECIFICALLY OR SAY NOTHING. A vague gesture at their history ("both of those connect to real ' +
    'things for you", "this ties into what you have worked on") is worse than silence: it claims to know them ' +
    'and shows nothing, which is the sound of a system that has a file open rather than a memory. If nothing ' +
    'here genuinely bears on this moment, say nothing about their prior work at all.\n' +
    'For anything marked COMPUTED, never say they "said" or "told you" it — it came from an assessment they ' +
    'completed, not from their mouth. Attribute it to the assessment and then USE it. Like this: "When you ' +
    'looked at what drives your movement, it came out as mostly your own reasons — so this one gets to be ' +
    'fully yours." Never as a number, and never as a verdict about them.'
  );
}
