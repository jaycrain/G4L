// Donna's judgment, as checks that run without her. Imported by scripts/onboarding-eval.ts.
//
// A SEPARATE MODULE so it can be TESTED. The eval exits at import time when there is no API key — correct for a
// script that drives the real model, fatal for anything that wants to unit-test its logic. rita-criterion.ts was
// split out for the same reason. A detector nobody can test is the shape this repo keeps finding.
import type { Collected } from '../lib/agent/onboarding.ts';

/* DONNA'S JUDGMENT, RUNNING WITHOUT DONNA.
 *
 * She has caught the same four failures across three walks, and each time it cost her a session and us a release.
 * Two of them were already encoded — as PHRASES her persona is scripted to say ("that felt really rushed",
 * "didn't we just do that"). That has two holes: the persona model has to REMEMBER to say them, and they only
 * exist on her. A rush that happens to Rita fires nothing at all.
 *
 * These run for EVERY persona, off the transcript, deterministically. Where a complaint of hers is mechanically
 * checkable, it is checked — so her read scales past the sessions she personally sits through.
 *
 * Each one is deliberately CONSERVATIVE. A tripwire that cries wolf gets skimmed, and a report you skim is worth
 * less than no report — which is the lesson the harness itself taught this week.
 */
export type Tripwire = { id: string; hers: string; check: (agent: string[], member: string[], c: Collected, complete?: boolean) => string | null };

const words = (s: string) => (s.toLowerCase().match(/[a-z']+/g) ?? []);
const overlap = (a: string, b: string) => {
  const A = new Set(words(a)), B = new Set(words(b));
  if (A.size < 6 || B.size < 6) return 0;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / Math.max(A.size, B.size);
};

export const TRIPWIRES: Tripwire[] = [
  {
    id: 'RUSHED',
    hers: 'names the Reclaim List without saying what it is',
    // Her rule, verbatim from her persona: naming it AND saying what it is for in the same message — "even in the
    // same sentence" — counts as explained. So this only fires on the FIRST mention, and only if that same turn
    // carries no explanatory cue.
    check: (agent) => {
      const first = agent.find((t) => /reclaim list/i.test(t));
      if (!first) return null;
      const explains = /(goal|what you want|getting back|work toward|the list is|start with|points at)/i.test(first);
      return explains ? null : `RUSHED — named the Reclaim List with no explanation in the same message: "${first.slice(0, 70)}…"`;
    },
  },
  {
    id: 'REPEATED',
    hers: "didn't we just do that",
    // The SEMANTIC sibling of the verbatim check below. v3.5.55 fixed byte-identical repeats; she was complaining
    // about being asked the same thing in different words, which a string comparison cannot see.
    check: (agent) => {
      for (let i = 1; i < agent.length; i++) {
        const sim = overlap(agent[i]!, agent[i - 1]!);
        if (sim >= 0.82 && agent[i] !== agent[i - 1]) {
          return `REPEATED — consecutive turns ${Math.round(sim * 100)}% identical in wording: "${agent[i]!.slice(0, 60)}…"`;
        }
      }
      return null;
    },
  },
  {
    id: 'PROSE-AS-ITEM',
    hers: 'if you type something in conversationally it puts it down verbatim as an item on your list',
    // Her 2026-08-27 walk. A Reclaim item that is a whole conversational sentence is one of her turns captured
    // wholesale rather than a want she chose. Conservative: only long, sentence-shaped items count.
    check: (_agent, member, c) => {
      const bad = (c.reclaimList ?? []).find((item) => {
        if (words(item).length < 12) return false;                    // a real want can be long; require sentence-shaped
        if (!/[.!?]/.test(item) && !/\b(i|my|me)\b/i.test(item)) return false;
        return member.some((m) => !m.startsWith('•') && overlap(m, item) >= 0.7);
      });
      return bad ? `PROSE-AS-ITEM — a conversational sentence became a list item: "${bad.slice(0, 70)}…"` : null;
    },
  },
  {
    id: 'LEFT-HANGING',
    hers: 'it left me hanging on my first true line',
    // Her Rewire walk. The Companion says something and gives her nothing to answer — no question, no widget.
    // Checked on the LAST turn only, because mid-conversation a receipt with no question is often correct.
    check: (agent, _m, _c, complete) => {
      // A COMPLETED onboarding ends on a HANDOFF — "you are now officially into the first Phase of G4L" — and a
      // handoff has no question by design. Without this the tripwire fired on all six personas at once, which is
      // the exact failure mode it was written to catch in the product: a report that cries wolf gets skimmed, and
      // a skimmed report is worth less than none. Caught on its first live run.
      if (complete) return null;
      const last = agent.at(-1) ?? '';
      if (!last || /\?/.test(last)) return null;
      return `LEFT-HANGING — the conversation ended on a turn with nothing to answer: "${last.slice(-70)}"`;
    },
  },
];

