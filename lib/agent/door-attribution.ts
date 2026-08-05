// WHOSE LIFE IS THIS? — a deterministic guard on Door tagging.
//
// A Door is an event in THE MEMBER'S OWN life. But a member's story is full of other people, and those people have
// divorces, layoffs and diagnoses of their own. Jennifer (2026-08-05) told us her father's second marriage fell
// apart while she was holding things together for him, and added, unprompted, "My marriage is fine." She was tagged
// with the Marriage Door anyway — and Doors are shown to her at intake, so the platform told her to her face that
// her marriage was the thing that opened her Fade. Adding the rule to the model's prompt did not hold: the walk
// re-ran and marriage was tagged again.
//
// So this is a deterministic read of what the member actually said, and it outranks the model's judgement — the
// recurring rule on this codebase (see the reclaim shape gate, the gap-confirm corroboration gate, revisionIsGrounded).
// It is deliberately NARROW: a tag is dropped only when the member's own words CONTRADICT it. Silence is not a
// contradiction, so a member who never uses the word "marriage" still keeps a Door the model inferred from context.
//
// Scope: only Doors naming an event that belongs to a specific person and can be confused for someone else's. Doors
// that are inherently about another person (loss, aging_parents) or about the household (full_house, empty_nest)
// are never filtered here — a death in the family IS the member's Loss.

export type SelfOwnedDoor = 'marriage' | 'career_cliff' | 'diagnosis';

type Rule = {
  /** The subject matter — if the member never raises it at all, we have nothing to contradict. */
  cue: RegExp;
  /** FIRST-PERSON evidence: the member placing this event in their own life. Any hit and the tag stands. */
  mine: RegExp;
  /** The member placing it in SOMEONE ELSE'S life. */
  theirs: RegExp;
  /** The member explicitly saying this part of their life is fine. Kills the tag on its own. */
  denied: RegExp;
};

// Anyone in the member's story who ISN'T the member. Covers both the possessive ("my father's divorce") and the
// subject ("my husband was laid off", "she was diagnosed") — the second shape is how people actually narrate, and
// matching only the first is what let Jennifer's Marriage tag through on the first pass.
const OTHER =
  String.raw`(?:his|her|their|they|he|she|my\s+(?:dad|father|mom|mother|brother|sister|son|daughter|friend|husband|wife|partner|parents?|in-laws?)(?:['’]s)?)`;
/** "<someone else> … <the event>" within a short window — a third-party attribution. */
const theirs = (event: string) => new RegExp(String.raw`\b${OTHER}\s+(?:\w+\s+){0,4}?(?:${event})`, 'i');

const RULES: Record<SelfOwnedDoor, Rule> = {
  marriage: {
    cue: /\b(marriage|marri(ed|age)|divorc\w*|separat(ed|ion|ing)|spouse|husband|wife|partner)\b/i,
    mine: /\b(my (marriage|divorce|separation|husband|wife|spouse|partner|ex)|our marriage|we (divorced|separated|split|drifted)|i (got |was )?(divorced|separated|remarried)|my ex[- ]?(husband|wife)?)\b/i,
    theirs: theirs(String.raw`marriage|divorce\w*|separat(?:ed|ion)|remarried`),
    denied: /\bmy marriage (?:is|was|'s|s) (?:fine|good|great|solid|strong|okay|ok|steady|happy)\b/i,
  },
  career_cliff: {
    cue: /\b(laid off|layoff|fired|redundan\w*|let go|lost (?:the |my |his |her )?job)\b/i,
    mine: /\b(i (?:was |got )?(?:laid off|fired|made redundant|let go)|my (?:job|role|position)|i lost (?:my|the) job|they let me go)\b/i,
    theirs: theirs(String.raw`laid off|layoff|fired|made redundant|redundancy|lost (?:his|her|their) job`),
    denied: /\bmy (?:job|work|career) (?:is|was|'s|s) (?:fine|good|great|solid|secure|steady|stable|okay|ok)\b/i,
  },
  diagnosis: {
    cue: /\b(diagnos\w*|cancer|tumou?r|stroke|heart attack|ms\b|parkinson\w*|alzheimer\w*|dementia)\b/i,
    mine: /\b(i (?:was |got |got a )?diagnos\w*|my (?:diagnosis|cancer|scan|biopsy|results?)|they (?:found|caught) (?:it|something) in me|i have \w+)\b/i,
    theirs: theirs(String.raw`diagnos\w*|cancer|tumou?r|stroke|dementia|alzheimer\w*|parkinson\w*`),
    denied: /\bmy health (?:is|was|'s|s) (?:fine|good|great|solid|okay|ok)\b/i,
  },
};

const isSelfOwned = (slug: string): slug is SelfOwnedDoor => slug in RULES;

/**
 * Does the member's own material CONTRADICT this Door? True only when they said it belongs to someone else and
 * never placed it in their own life, or they explicitly said that part of their life is fine.
 *
 * `material` should be everything the member has given us — their gap, plus the turn's message — not the model's
 * reflections. The model's words in the transcript are precisely what we are refusing to take as evidence.
 */
export function doorContradictedByMember(slug: string, material: string): boolean {
  if (!isSelfOwned(slug)) return false;
  const t = (material ?? '').trim();
  if (!t) return false;
  const rule = RULES[slug];
  if (rule.denied.test(t)) return true;          // "My marriage is fine." Nothing outranks that.
  if (!rule.cue.test(t)) return false;           // they never raised it — the model inferred it from elsewhere; leave it
  if (rule.mine.test(t)) return false;           // they placed it in their own life — the tag stands
  return rule.theirs.test(t);                    // it is explicitly someone else's, and never theirs
}

/** Drop Doors the member's own words contradict. Returns the surviving list, order preserved. */
export function filterDoorsByAttribution<T extends string>(doors: readonly T[], material: string): T[] {
  return doors.filter((d) => !doorContradictedByMember(d, material));
}
