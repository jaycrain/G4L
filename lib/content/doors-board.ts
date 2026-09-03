// THE DOORS BOARD — the recognition copy, and the order it is read in.
//
// The Doors-board decision, closed 2026-08-18 (docs/decisions/2026-08-18-doors-board.md). R2 shows a member every Door and lets her
// mark the ones that are hers. This file is the copy for that board and nothing else — the matcher lives in
// lib/doors.ts and must never read from here.
//
// WHY THE COPY IS NOT `descriptor`. lib/doors.ts already carries a one-line `descriptor` per Door, and Donna's
// live R2 walk showed the Companion reciting exactly those when she asked "what are all of the Doors?". They are
// taxonomy LABELS — they identify a Door to someone who already knows what Doors are. Recognition copy has a
// different job: a member reads it and sees herself. Compare, for the same Door:
//     descriptor:  "The role that ended, plateaued, or hollowed out."
//     recognition: "The work ended. Laid off, forced out, restructured… You didn't leave the work. It closed
//                   behind you."
// Both are correct. Only one of them is why somebody taps the card.
//
// THE REGISTER, and why it is worth protecting. Greg wrote recognition copy for seven of them in Gated Assets V4. Every
// one does the same four things: opens on a short flat declarative, lists specifics as fragments, grounds it in
// ordinary daily texture, and ends on the identity consequence — usually a reversal. "You didn't quit your sport.
// Your body quit it for you." The HARD STOP is the mechanism: the reader hits a wall and gets turned around, and
// that turn is the recognition. Cowork's draft smoothed his stops into commas, em-dashes and semicolons in
// every single card (measured: 84-88% similarity to source, edits all in one direction) — "Moved away. Got busy.
// Stopped calling." became one comma list, and three separate griefs became inventory. His stops are restored.
//
// BUT NOT MECHANICALLY. Cowork's refinement, accepted: Greg himself varies — "The startup, the promotion, the
// demanding role" is a comma list. The hammer lands because of contrast, so uniform staccato flattens it. Stops
// are restored where the stop does the TURN, not everywhere.
//
// PROVENANCE IS MARKED PER CARD so nothing is attributed to Greg that is not his.

import type { DoorSlug } from '../doors.ts';

export type DoorRecognition = {
  slug: DoorSlug;
  /** Who wrote it — kept in the data so a future edit can see what it is touching. */
  source: 'greg' | 'cc' | 'cowork';
  recognition: string;
};

// THE ORDER IS PART OF THE INSTRUMENT. Ranked by prevalence in U.S. midlife adults, from Cowork's research
// synthesis (G4L_Doors_Prevalence_Ranking, 2026-06-22 — sourced and confidence-flagged; NOT a Greg document, and
// Jay ruled to adopt it on its merits). Leading with the near-universal Doors makes the recognition moment land
// for the largest share of members; the rarer ones stay available, just not at the top.
//
// The Grind sits last under that ranking — burnout evidence peaks in young adulthood and declines with age, which
// is why the research flagged it as the weakest-fitting midlife Door and proposed merging it into the Load-Bearer.
// JAY RULED: KEEP THE GRIND. It stays a full Door with Greg's own copy; only its position moves.
export const BOARD_ORDER: readonly DoorSlug[] = [
  'body',
  'loss',
  'diagnosis',
  'aging_parents',
  'vanishing',
  'career_cliff',
  'load_bearer',
  'full_house',
  'empty_nest',
  'marriage',
  'grind',
  // AUTOPILOT SITS LAST, and its position is the one place the prevalence ranking cannot speak. That research
  // operationalizes every Door as a measurable life EVENT, so it does not contain Autopilot at all — absent, not
  // ranked low. Last is therefore not a claim about how common it is; it is the honest position for the only card
  // the ranking has nothing to say about, and it leaves the evidenced order above it undisturbed.
  'autopilot',
];

export const DOOR_RECOGNITION: readonly DoorRecognition[] = [
  {
    slug: 'body',
    source: 'greg',
    recognition:
      "Your body changed. The knees, the back, the shoulder that doesn't rotate like it used to. The physical " +
      "identity you'd carried since high school started to feel like a memory instead of a reality. You didn't " +
      'quit your sport. Your body quit it for you.',
  },
  {
    slug: 'loss',
    source: 'cc',
    recognition:
      'Someone died. A parent. A partner. The friend who knew you before you became whoever this is. You handled ' +
      'the arrangements and went back to work and everyone said how well you were doing. They held a version of ' +
      'you that nobody else was keeping. It went with them.',
  },
  {
    slug: 'diagnosis',
    source: 'cc',
    recognition:
      'A doctor gave it a name. What your body had been doing got a word, and the word came with rules — ' +
      'what to stop, what to watch for, what to take every morning now. You learned to say it out loud in waiting ' +
      'rooms. The person you were before that appointment is someone you describe in the past tense.',
  },
  {
    // Greg's Caregiver Door, first half. His "There was no time for you. No space for you." restored to two stops.
    slug: 'aging_parents',
    source: 'greg',
    recognition:
      'A parent got sick and needed you. Their care became the center of your days. Your own needs went to the ' +
      'back of the line. There was no time for you. No space for you.',
  },
  {
    slug: 'vanishing',
    source: 'greg',
    recognition:
      'Your friends faded. Moved away. Got busy. Stopped calling. The social circle that used to hold you up ' +
      "contracted until you realized you hadn't had a real conversation with someone outside your family in months.",
  },
  {
    // No Greg source: his Career Door is the OPPOSITE motion (work grew over you → The Grind). the Doors-board decision's open question
    // #4 asked Jay to approve new copy for Diagnosis/Loss/Full House and never mentioned this one, so the Door
    // Donna actually holds had unapproved copy nobody had flagged.
    slug: 'career_cliff',
    source: 'cc',
    recognition:
      'The work ended. Laid off, forced out, restructured, or passed over until there was nothing left to move ' +
      'toward. The title that answered "what do you do" stopped being true, and you still reach for it when ' +
      "someone asks. You didn't leave the work. It closed behind you.",
  },
  {
    // From the second half of Greg's Caregiver Door. Cowork's "set down / never picked back up" image kept — she
    // conceded the rest of the card to this version.
    slug: 'load_bearer',
    source: 'cc',
    recognition:
      'You became the one everyone leans on. The bills, the logistics, the call that comes when something goes ' +
      "wrong. You're the reason it holds together, and nobody asks how you're doing, because you're the one who's " +
      'fine. Somewhere under all that carrying you set yourself down. You never picked yourself back up.',
  },
  {
    // Cowork's, kept verbatim. CC drafted a replacement and it was worse: "Nothing wrong with it. But you
    // disappeared into it." is Greg's exact move — flat concession, hard stop, turn — arrived at independently.
    slug: 'full_house',
    source: 'cowork',
    recognition:
      'The family season swallowed you whole — young kids, the provider years, the relentless logistics. You’d ' +
      'give anything for them, and you did: your time, your body, the parts of you that used to be just yours. ' +
      'Nothing wrong with it. But you disappeared into it.',
  },
  {
    slug: 'empty_nest',
    source: 'greg',
    recognition:
      'The kids left. The role that consumed every morning and every weekend for twenty years just ended. And you ' +
      "stood somewhere on a Tuesday afternoon and realized you didn't know what to do with yourself when nobody " +
      'needed you to do anything.',
  },
  {
    slug: 'marriage',
    source: 'greg',
    recognition:
      "A relationship ended, or changed so fundamentally that the person you were inside it doesn't exist " +
      'anymore. Divorce, estrangement, the slow erosion of a marriage. Your identity as a partner came unmoored.',
  },
  {
    slug: 'grind',
    source: 'greg',
    recognition:
      'Your work consumed you. The startup, the promotion, the demanding role. Mornings that used to start with ' +
      'movement started with email. Evenings that used to end with stretching ended with spreadsheets. You built ' +
      'something impressive and lost yourself inside it.',
  },
  {
    // Greg's own copy, moved here verbatim from the retired QUIET_DRIFT_CARD — see the note above it.
    slug: 'autopilot',
    source: 'greg',
    recognition:
      "The one nobody talks about, because it's not dramatic enough for a diagnosis. Decades of routine without " +
      "reflection. Work, eat, sleep, repeat. You didn't choose to lose yourself. You just stopped paying attention. " +
      'And one day you woke up and realized you had no idea who you were beyond your obligations.',
  },
];

// THE QUIET-DRIFT CARD IS RETIRED — Autopilot is a Door (2026-08-22, Jay).
//
// It shipped on 2026-08-18 as a special card that was deliberately NOT a Door, on the reasoning that it was a
// stance in a taxonomy of events. Greg's R2 Gated Asset V4 says otherwise, in his own words: he names the
// Autopilot Door three times, puts it in the required minimum ("at minimum Relationship, Social, Autopilot"), and
// rates it for relevance like every other Door. Acceptance was a conclusion a member DREW; Autopilot is a pattern
// he groups with caregiving and career absorption. The copy below is unchanged and now lives in DOOR_RECOGNITION
// with the other eleven.
//
// ONE SENTENCE STAYS CUT FROM GREG'S COPY (Jay ruled, 2026-08-18, and it still holds). It opened "The most common
// one." The prevalence research does not contain Autopilot at all — absent, not ranked low — because it
// operationalizes every Door as a measurable life EVENT. The Body ranks first. "The one nobody talks about"
// normalizes without ranking, which is the part that was doing the work.
//
// THE RESIGNATION SIGNAL still rides on this claim — see quiet_drift_claimed_at in lib/reconnect/doors-board-claim.ts.
// It is written when she claims Autopilot, so nothing is lost, but it is now a WEAKER proxy than it was: claiming
// Autopilot says "this Door is mine", not "I have given up". Giving that signal its own home is open (Jay, 8/22).

// The board header. "Most people walk through several" is EVIDENCED, not asserted — ~86% of midlife women report
// medium-to-high lifetime exposure to major stressful events, and midlife concentrates more co-occurring stressors
// than any other life stage. Multi-select is the accurate design, not a convenience.
export const BOARD_HEADER =
  "Explore each Door and mark how familiar it feels. Mark every one that resonates — most people walk through " +
  "several. There's no hierarchy; the Fade doesn't care how you got here, only that you recognize the room.";


const BY_SLUG = new Map(DOOR_RECOGNITION.map((d) => [d.slug, d]));

/** Recognition copy for a Door, or null when it has none — never fall back to the taxonomy `descriptor`. */
export function doorRecognition(slug: DoorSlug): DoorRecognition | null {
  return BY_SLUG.get(slug) ?? null;
}

/** The board, in reading order. */
export function boardCards(): DoorRecognition[] {
  return BOARD_ORDER.map((s) => BY_SLUG.get(s)).filter((d): d is DoorRecognition => d !== undefined);
}
