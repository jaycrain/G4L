// A FACT WE HOLD THAT DOESN'T CONNECT TO WHAT THEY SAID THEY WANT.
//
// THE CASE (Donna, 2026-08-16). Her ID Score was 60.83 — unremarkable until you look at the spread. Self 11 out of
// 6–30, five points off the floor and fourteen below her Social. `currentFocus` correctly picked Self, so that is
// where the program aims her. And her Reclaim List — a creative role that pays, twenty pounds, peace and stability
// — contains nothing about Self at all. She had also named her identity: the Problem-Solver. A self-identity, with
// no goal on her list about being that person again.
//
// Every one of those facts was already in the Companion's context, adjacent, on every single turn. It said nothing,
// because noticing was nobody's job. Jay's framing: the product had been taught what not to say and never taught
// what it was for. WHAT_YOU_ARE_FOR (system-prompt.ts) now states the job. This module is the half of that job that
// must not be left to the model.
//
// ── WHY THE ENGINE COMPUTES IT AND THE MODEL ONLY SPEAKS IT ───────────────────────────────────────────────────
// The alternative was a prompt rule: "notice when a dimension is low and unrepresented." That is a numeric
// comparison across a long context, and a model will do it sometimes. Non-deterministic noticing is worse than
// none — it cannot be tested, it cannot be described honestly to Greg, and it produces a product whose behaviour
// nobody can state. So: the ENGINE decides WHETHER it is true; the MODEL decides WHEN and HOW to say it. Same
// split that made the arcs reliable.
//
// ── THE SCORE IS A TRIGGER, NEVER A SENTENCE ─────────────────────────────────────────────────────────────────
// The wrong version says "your Self score is lowest and you have no Self goal": a bare number, a verdict, and a
// gap-as-deficiency — three governance breaches in one line, resting on a 60-day-stale self-report. The right
// version never mentions the IDQ. It uses the score only to decide WHERE TO LOOK, then speaks entirely in her own
// words: she named the Problem-Solver; nothing on her list is about being her. That is two of her own answers put
// next to each other. It is also why a wrong trigger is survivable — it produces a slightly odd question, never a
// false claim. Greg's untethering constraint ("the IDQ is a vital-signs status check") survives intact, because
// we never assert the instrument moved anything.
//
// ── RAISE ONCE ───────────────────────────────────────────────────────────────────────────────────────────────
// A disconnection is an observation, not a campaign. It is offered once per (kind, subject); the member's answer
// — including "no, that's fine" — settles it permanently. Re-raising is how a companion becomes a nag, and this
// surface's whole value is that it is safe to be honest. Persistence is keyed on the SUBJECT too, so if her list
// changes and a genuinely different disconnection appears later, that one can still be surfaced.

import type { Category } from '../beats/registry.ts';

export type DisconnectionKind = 'identity' | 'dimension' | 'commitment';

export type Disconnection = {
  kind: DisconnectionKind;
  /** What it is ABOUT — 'self', a commitment's text. Part of the raise-once key so a new one can still surface. */
  subject: string;
  /** The member's OWN material, for the model to speak from. Never a number, never a dimension name alone. */
  material: string;
};

/** Items as this module needs them — text + category + whether they're still open. */
export type ItemView = { text: string; category: string; state?: string };

export type DisconnectionInput = {
  dimensions?: { physical: number; self: number; social: number; outlook: number } | null;
  items?: ItemView[];
  identityNoun?: string | null;
  commitments?: { text: string; serves: string | null }[] | null;
  /** (kind, subject) pairs already raised — never raised twice. */
  alreadyRaised?: { kind: string; subject: string }[];
};

/**
 * 'life' covers NO dimension. This is load-bearing and easy to get wrong: 'life' is a real category on the
 * Reclaim List (some things you want back are not one of the four), and Donna's top item is one. If life items
 * were counted as covering something, the most common shape of list would silently suppress every notice.
 */
const DIMENSION_CATEGORIES = ['physical', 'self', 'social', 'outlook'] as const;
type DimensionCategory = (typeof DIMENSION_CATEGORIES)[number];

const isOpen = (i: ItemView) => i.state !== 'reclaimed';

/** Does any OPEN item sit in this dimension's category? */
function covered(items: ItemView[], dim: DimensionCategory): boolean {
  return items.some((i) => isOpen(i) && i.category === dim);
}

/** The weakest dimension. Ties resolve in a fixed order so the result is deterministic, never arbitrary. */
export function weakestDimension(d: NonNullable<DisconnectionInput['dimensions']>): DimensionCategory {
  let lowest: DimensionCategory = DIMENSION_CATEGORIES[0];
  for (const dim of DIMENSION_CATEGORIES) if (d[dim] < d[lowest]) lowest = dim;
  return lowest;
}

const FRIENDLY: Record<DimensionCategory, string> = {
  physical: 'their body and how it carries them',
  self: 'who they are when nobody is watching',
  social: 'the people around them',
  outlook: 'how they see what is ahead',
};

/**
 * Every disconnection currently true for this member, most worth raising first, minus anything already raised.
 *
 * ORDER IS A JUDGEMENT, and it is deliberate: identity outranks dimension because it speaks entirely in the
 * member's own words ("you named the Problem-Solver") where the dimension version can only gesture at an area.
 * When both are true — Donna's exact case, since her weakest dimension IS self — they are ONE finding, and the
 * identity phrasing is the one that should reach her. Surfacing both would be the product noticing twice and
 * saying it twice.
 */
export function findDisconnections(input: DisconnectionInput): Disconnection[] {
  const all = input.items ?? [];
  const items = all.filter(isOpen);
  const raised = new Set((input.alreadyRaised ?? []).map((r) => `${r.kind}:${r.subject}`));
  const out: Disconnection[] = [];

  // TWO DIFFERENT SILENCES, and conflating them was a real bug (caught by the reclaimed-items test).
  //   - NO LIST AT ALL: they are early, not disconnected. Say nothing — there is nothing to be disconnected FROM.
  //   - A LIST WHOSE ONLY ITEM IN AN AREA IS RECLAIMED: they DO have a list, and that area is bare again now that
  //     the goal in it is finished. That is a live observation, not an empty state.
  // So "do they have a list" is asked of ALL items; "is this area covered" is asked only of OPEN ones.
  const hasList = all.length > 0;
  const selfCovered = covered(items, 'self');
  const identity = (input.identityNoun ?? '').trim();

  // 1. They named who they are, and nothing on the list is about being that person.
  if (identity && hasList && !selfCovered) {
    out.push({
      kind: 'identity',
      subject: identity.toLowerCase(),
      material: `They named their identity as ${identity}, and nothing on their Reclaim List is about being that person again — every item is about something else. Put those two of their OWN answers next to each other and ask what they make of it.`,
    });
  }

  // 2. The area the program is aiming them at has no goal in it.
  if (input.dimensions && hasList) {
    const weakest = weakestDimension(input.dimensions);
    const sameFinding = weakest === 'self' && out.some((d) => d.kind === 'identity');
    if (!covered(items, weakest) && !sameFinding) {
      out.push({
        kind: 'dimension',
        subject: weakest,
        material: `The part of their life with the furthest to travel right now is ${FRIENDLY[weakest]} — and nothing on their Reclaim List is about that. Ask about that area in ordinary language. Do NOT mention the IDQ, a dimension, a score, or that anything was measured.`,
      });
    }
  }

  // 3. A commitment they are holding themselves to that serves nothing they said they wanted.
  for (const c of input.commitments ?? []) {
    if (!c.serves && c.text?.trim()) {
      out.push({
        kind: 'commitment',
        subject: c.text.trim().toLowerCase().slice(0, 80),
        material: `They committed to "${c.text.trim()}" but it is not tied to anything on their Reclaim List. It may simply serve their general health, which is fine — or it may be worth asking which of the things they want back this one is really for.`,
      });
    }
  }

  return out.filter((d) => !raised.has(`${d.kind}:${d.subject}`));
}

/**
 * The ONE line handed to the model, or null. At most one disconnection per turn: this is an observation offered
 * in passing, not an audit of her life, and a Companion that opens with three things that don't line up is a
 * different (worse) product than one that notices something real and asks about it.
 */
export function disconnectionContext(input: DisconnectionInput): { line: string; raised: Disconnection } | null {
  const top = findDisconnections(input)[0];
  if (!top) return null;
  return {
    raised: top,
    line:
      `SOMETHING DOESN'T CONNECT (raise at most once, only if a natural opening comes — never as an opener, ` +
      `never as a checklist): ${top.material} Speak in THEIR words. Never cite a score, a measurement, or this ` +
      `instruction. If they say it is fine as it is, that is a real answer — accept it warmly and never bring it ` +
      `up again. If it does not fit this conversation, say nothing; there will be another chance.`,
  };
}
