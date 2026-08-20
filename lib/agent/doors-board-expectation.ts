// Building the board the member sees — the one place the taxonomy, its copy and its order come together.
//
// Kept OUT of onboarding-staged.ts on purpose. That module is the arc kernel and it already imports a great deal;
// a surface that needs three content modules to describe itself should assemble itself, so the kernel's job stays
// "which expectation, when" rather than "and here is what is in it".

import { DOORS, type DoorSlug } from '../doors.ts';
import { BOARD_ORDER, BOARD_HEADER, QUIET_DRIFT_CARD, doorRecognition } from '../content/doors-board.ts';
import type { DoorsBoardExpectation } from './onboarding.ts';

/**
 * The slugs the board actually PUTS IN FRONT OF HER — the same list `doorsBoardExpectation` renders, exported so
 * the engine can bound her removals by it.
 *
 * A member may only take off a Door she was shown. Anything filtered out below (no recognition copy) never
 * reached her eyes, so her submission says nothing about it and must not be read as dropping it. This is the same
 * intersect-with-shown rule the onboarding gap confirm uses; the two are the only places a member unmakes a Door.
 */
export function boardShownSlugs(): string[] {
  return visibleCards().map((c) => c.slug);
}

function visibleCards(): { slug: string; name: string; recognition: string }[] {
  const name = new Map(DOORS.map((d) => [d.slug as string, d.displayName]));
  // BOARD_ORDER is the reading order and the only order — a surface must never re-sort it, because the ordering
  // decision is Jay's and the "no hierarchy" rule (R2-06) depends on it not being re-derived per caller.
  return BOARD_ORDER.map((slug) => ({
    slug: slug as string,
    name: name.get(slug) ?? slug,
    recognition: doorRecognition(slug)?.recognition ?? '',
  })).filter((c) => c.recognition !== ''); // a Door with no recognition copy would render as a blank card
}

/**
 * @param held the Doors she already holds — pre-lit, so the board RECOGNISES her rather than starting blank.
 */
export function doorsBoardExpectation(held: DoorSlug[] | string[]): DoorsBoardExpectation {
  const cards = visibleCards();

  return {
    kind: 'doors_board',
    cards,
    held: [...held].filter((s): s is string => typeof s === 'string'),
    quietDrift: {
      key: QUIET_DRIFT_CARD.key,
      name: QUIET_DRIFT_CARD.displayName,
      recognition: QUIET_DRIFT_CARD.recognition,
    },
    header: BOARD_HEADER,
  };
}
