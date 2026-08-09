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
//   · NEVER a verdict. A "growth edge" is a skill to practise, never a failing — the same posture the Companion
//     is held to when it reflects the identical data.
//   · The member's own answers, organised. We computed the ordering; we did not decide who they are.

import type { Db } from '../db/schema.ts';
import { latestSkillsReading } from '../rebuild/store.ts';
import { skillHighlights } from '../rebuild/skills-instrument.ts';
import { latestBiggerWorldReading } from '../reclaim/bigger-world-store.ts';
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
  // Each read is guarded independently: a drifted register hides ONE card rather than emptying the tab. Same
  // posture as the Companion's context, and for the same reason — partial truth beats a blank page.
  const skills = await latestSkillsReading(db, memberId).catch(() => null);
  // The DERIVATION is guarded too, not just the read. skillHighlights sorts score.perSkill and throws on a row
  // whose shape has drifted — which would have emptied the whole tab, exactly the thing the comment above says
  // cannot happen. Caught by its own test on the first run.
  const h = skills ? tryOr(() => skillHighlights(skills.scores), null) : null;
  if (h) {
    out.push({
      label: 'your map',
      from: 'Strengths & Weaknesses',
      lines: [
        `Where you're strongest: ${h.strongest.toLowerCase()}.`,
        `Where there's the most room: ${h.growthEdge.toLowerCase()}.`,
        'A skill with room is simply the next one to practise.',
      ],
    });
  }

  const bw = await latestBiggerWorldReading(db, memberId).catch(() => null);
  if (bw) {
    out.push({
      label: 'your bigger world',
      from: 'Bigger World Audit',
      lines: [
        `The area you chose to focus on: your ${AUDIT_DOMAIN_LABEL[bw.priorities.primary].toLowerCase()} life.`,
        `Where momentum comes easiest: your ${AUDIT_DOMAIN_LABEL[bw.priorities.momentumLever].toLowerCase()} life.`,
        'You chose these — they are where you decided the effort goes.',
      ],
    });
  }

  return out;
}
