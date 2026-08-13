// YOUR READS — the Playbook's Reads tab.
//
// THE PROBLEM THIS FIXES. Reads was the weak tab, and Jay named it before I did: he could not say what it was
// for. The reason is structural, not cosmetic. It held two things — the member's *tells* and a `why_works`
// section for science that landed — and every harvest prompt in the codebase describes that second one as
// "rare; only if real". So half the tab was designed to stay empty, and the half that filled was a handful of
// drift signals. A tab is not a category just because two things both loosely "inform which play to call".
//
// WHAT IT BECOMES. The same word the outcome cards landed on: **a read** — what you know. The cards already say
// "A read — your why", "A read — your map", "A read — your list, refined". Those reads EXIST as real member data,
// in the assessment registers, and until now they were visible only to the Companion. The member could not see
// what their own assessments said about them. This tab is that.
//
// GOVERNANCE — the reason this is a read and not a report card:
//   · NEVER a number. B1's motivation reading is explicitly "stored, deliberately NOT scored or shown as a
//     number"; B2's skills are "never a grade or a number". These render as plain language or not at all.
//   · NEVER a verdict. A "growth edge" is a skill to practice, never a failing — the same posture the Companion
//     is held to when it reflects the identical data.
//   · The member's own answers, organized. We computed the ordering; we did not decide who they are.

import type { Db } from '../db/schema.ts';
import { latestSkillsReading, latestWhyReading } from '../rebuild/store.ts';
import { relativeAutonomyRead } from '../rebuild/why-instrument.ts';
import { skillHighlights } from '../rebuild/skills-instrument.ts';
import { latestBiggerWorldReading, firstFocus } from '../reclaim/bigger-world-store.ts';
import { AUDIT_DOMAIN_LABEL } from '../reclaim/bigger-world-instrument.ts';

export type Read = {
  /** The card's name, matching the outcome cards word-for-word ("your map"). One vocabulary or none. */
  label: string;
  /** Which Session produced it — provenance, so it reads as their record rather than our assertion. */
  from: string;
  /** What it says, in plain language. Never a score. */
  lines: string[];
};

/** The member's reads, in program order. Empty until they've done the Session that produces one — an absent read
 *  is simply not yet, and the tab says so rather than inventing a placeholder. */
/** Lower-case a label that MIGHT be missing. A read is prose; a hole in it is better than a crash. */
const lower = (v: string | undefined | null): string => (v ?? '').toLowerCase();

/** Run a derivation over stored data without letting a drifted row take the surface down. */
function tryOr<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (e) {
    console.warn('read derivation failed, hiding one card:', (e as Error).message);
    return fallback;
  }
}

export async function memberReads(db: Db, memberId: string): Promise<Read[]> {
  const out: Read[] = [];

  // EVERY read is BUILT inside the guard, not just its DB call. The first version guarded the query and the
  // skills derivation but left the bigger-world card's copy outside — and `AUDIT_DOMAIN_LABEL[key]` returns
  // undefined for any key not in the map, so `.toLowerCase()` threw and took the whole Playbook route down with
  // it. Jay hit the error page on his own account within minutes of the deploy.
  //
  // Guarding the read but not the RENDERING of it is the same half-measure twice in one file. The lesson is the
  // shape, not the line: a surface built from stored data has to treat the DERIVATION as untrusted too, because
  // that is where an unexpected value actually lands.

  // YOUR WHY (B1) — first, because Rebuild runs B1 before B2. This is Greg's Relative Autonomous Motivation,
  // computed from responses we have always stored and never used: what actually PULLS them, their own reasons or
  // outside pressure. Rendered as a sentence, never the number — B1 is explicitly "stored, not scored or shown".
  const why = await latestWhyReading(db, memberId).catch(() => null);
  if (why) {
    const read = tryOr<Read | null>(() => {
      const a = why.scores.activity.relativeAutonomous;
      const d = why.scores.diet.relativeAutonomous;
      if (typeof a !== 'number' || typeof d !== 'number') return null; // an older reading, stored before RAM existed
      return {
        label: 'your why',
        from: 'What’s Your Why?',
        lines: [
          `Moving your body: ${relativeAutonomyRead(a)}.`,
          `Eating well: ${relativeAutonomyRead(d)}.`,
          'Reasons that are yours tend to hold when nobody is watching.',
        ],
      };
    }, null);
    if (read) out.push(read);
  }

  const skills = await latestSkillsReading(db, memberId).catch(() => null);
  if (skills) {
    const read = tryOr<Read | null>(() => {
      const h = skillHighlights(skills.scores);
      return {
        label: 'your map',
        from: 'Strengths & Weaknesses',
        lines: [
          `Where you're strongest: ${lower(h.strongest)}.`,
          `Where there's the most room: ${lower(h.growthEdge)}.`,
          'A skill with room is simply the next one to practice.',
        ],
      };
    }, null);
    if (read) out.push(read);
  }

  const bw = await latestBiggerWorldReading(db, memberId).catch(() => null);
  if (bw) {
    const read = tryOr<Read | null>(() => {
      // An unknown domain key yields no card rather than "your undefined life" — and never a throw.
      //
      // FIRST FOCUS, NOT THE COMPUTED PRIMARY. This card said "the area you chose to focus on" and then printed the
      // domain the RATINGS ranked first — so a member who chose Social read a card telling them they'd chosen
      // Physical. The one rule C2 has is that the member's choice leads (Jay, 2026-08-09); it was honoured in the
      // close and in the Companion's context and dropped here. One fact, three sites, one of them wrong.
      const focus = firstFocus(bw);
      const primary = AUDIT_DOMAIN_LABEL[focus.domain];
      const lever = AUDIT_DOMAIN_LABEL[bw.priorities.momentumLever];
      if (!primary || !lever) return null;
      return {
        label: 'your bigger world',
        from: 'Bigger World Audit',
        lines: [
          focus.chosenByMember
            ? `The area you chose to focus on: your ${lower(primary)} life.`
            : `Where your ratings point: your ${lower(primary)} life.`,
          `Where momentum comes easiest: your ${lower(lever)} life.`,
          focus.chosenByMember
            ? 'You chose this — it is where you decided the effort goes.'
            : 'You did not name a single area, so this is the ratings’ read, not your call.',
        ],
      };
    }, null);
    if (read) out.push(read);
  }

  return out;
}
