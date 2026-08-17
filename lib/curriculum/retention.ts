// THE CARRY-FORWARD SPINE — what each asset RETAINS, and which upstream assets each one READS.
//
// THE FINDING. Every one of Greg's twelve Guidance memos specifies `prior_module_context` as a named mechanism:
// each asset declares what it keeps and who consumes it. We had implemented ONE link (W1's affirmation and W2's
// image reaching W3 through the keeper-recall rail) and left the other eleven absent. He designed a spine; we
// built one vertebra. This is the general mechanism, so the remaining links are registry entries rather than
// eleven bespoke joins.
//
// IT IS A WEB, NOT A CHAIN — which is the whole reason a `previousAsset` pointer cannot express it. Ten of the
// twelve links are one-to-one, but the two CULMINATING assets fan in: B3 reads B1 + B2 + W3 simultaneously, and
// C3 reads B3 + C2. Those two are built here first, deliberately: they are the hard case, and they are where a
// member most feels the program forgetting them.
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
import { AUDIT_DOMAIN_LABEL } from '../reclaim/bigger-world-instrument.ts';

/** The assets that can be carried forward. Grows as the remaining links are built. */
export type RetainedAssetId = 'b1' | 'b2' | 'w3' | 'b3' | 'c1' | 'c2';

export type Retained = {
  asset: RetainedAssetId;
  /** How the Session names it to the member, e.g. "your why". Never the asset code. */
  label: string;
  /** One or more short lines. Member's words where we have them; a summary only for the instruments. */
  lines: string[];
};

/**
 * WHO READS WHOM — taken from the ENGINEERING memos' own `load prior module context` lines, not from a summary.
 *
 * B3, verbatim from its authored Step 6 ("Connect to prior learning"), which asks three questions naming B1's
 * why, B2's skills and W3's False Start Protocol.
 *
 * C3, from its memo (his camel-casing of the four Rs normalized to ours — the naming guard blocks it, and that
 * guard exists precisely because his house style leaks in through quotes like this one): "load prior module
 * context (identity, motivation, self-management, revised Reclaim List, Bigger World Audit assessment)"
 * — i.e. R1 · B1 · B2 · C1 · C2. This shipped as `['b3','c2']` on 2026-08-17, which was
 * TWO OF FIVE. The error came from working off a table I had synthesized from the GUIDANCE memos rather than
 * reading the Engineering memos' declarations, and it is exactly why the remaining links must be read from the
 * documents. B3 stays in the list: C3's memo keeps it as an explicit parallel reference ("Reference the parallel
 * to B3", "B3 monitoring experience available as a parallel reference"), which is the same job.
 *
 * STILL MISSING FROM C3: `identity` (R1). Held back deliberately — "identity" is the one vague term in that line
 * and could mean the IDQ, the reclaimed identity noun, or the onboarding self-description. Guessing which would
 * put a wrong claim about a member in front of them; it needs R1's own memo read first.
 */
export const UPSTREAM: Partial<Record<string, RetainedAssetId[]>> = {
  b3: ['b1', 'b2', 'w3'],
  c3: ['b1', 'b2', 'c1', 'c2', 'b3'],
};

/** Trim, drop empties, cap. A carry-forward that dumps six lines stops being context and becomes a recital. */
const lines = (...xs: (string | null | undefined)[]): string[] =>
  xs.map((s) => (s ?? '').trim()).filter(Boolean).slice(0, 3);

/**
 * Every reader is individually guarded. One drifted or missing register must cost ONE upstream line, never the
 * whole Session — the same degrade-not-crash posture the companion context uses, for the same reason: this runs
 * on a surface the member is already looking at.
 */
const READERS: Record<RetainedAssetId, (db: Db, memberId: string) => Promise<Retained | null>> = {
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
    const body = lines(
      typeof act === 'number' ? `On movement, what pulls them is ${relativeAutonomyRead(act)}.` : null,
      typeof diet === 'number' ? `On eating, ${relativeAutonomyRead(diet)}.` : null,
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
  const body = retained.map((r) => `- ${r.label}: ${r.lines.join(' ')}`).join('\n');
  return (
    'WHAT THEY ALREADY DID, AND WHAT IT SAID — connect this Session to it in your own words, early and briefly.\n' +
    `${body}\n` +
    'Use it to show the program remembers them: refer back to ONE of these where it genuinely bears on what they ' +
    'are doing now, in their words, not all of them and not as a recap. Do NOT list these back, do not mention ' +
    'any prior Session they have not done, and never imply they are behind — these run in the order that suits ' +
    'them, and an absent one is a choice, not a gap.'
  );
}
