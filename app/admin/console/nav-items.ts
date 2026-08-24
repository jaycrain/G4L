// THE CONSOLE'S NAVIGATION, AS DATA.
//
// Its own module on purpose. The nav is rendered by a CLIENT component (the panes switch in place below the
// fold), and it used to live in subpage.tsx alongside an async SERVER component — importing that from a client
// file is the exact client↔server tangle the project standards warn about. Data goes in a data module.

export type NavItem = { label: string; href: string };

/** The console's peer sections. One list, so a new subpage appears in every nav at once. */
export const CONSOLE_NAV: NavItem[] = [
  { label: 'Console', href: '/admin' },
  { label: 'Members', href: '/admin/members' },
  // Next to Members on purpose: the two halves of one question — who made it in, and who is still at the door.
  { label: 'Prospects', href: '/admin/prospects' },
  { label: 'Attention', href: '/admin/attention' },
  { label: 'Activity', href: '/admin/activity' },
  { label: 'Review queue', href: '/admin/review' },
  { label: 'Moderation', href: '/admin/moderation' },
  // Added 2026-08-22 with the page itself. Two server actions had been revalidating '/admin/connect' since 8/21
  // and the route did not exist — so the Founders could not post, and the Session topics could not be created,
  // while both actions sat in the codebase looking finished.
  { label: 'Community', href: '/admin/connect' },
  { label: 'AI surfaces', href: '/admin/health' },
  { label: 'Feedback', href: '/admin/feedback' },
  { label: 'Operators', href: '/admin/operators' },
  { label: 'Data policy', href: '/admin/policy' },
];

/** The console's three columns. BELOW THE FOLD these join the same row as the sections above.
 *
 *  Jay, 2026-08-01: one merged segmented row, because on a phone the difference between "a pane of the
 *  console" and "a separate page" is an implementation detail he shouldn't have to hold. Everything is one
 *  tap; the row just gets longer as surfaces are added. Above the fold they're hidden — all three columns are
 *  on screen at once, so there is nothing to switch between. */
export type PaneKey = 'left' | 'centre' | 'right';
export const CONSOLE_PANES: Array<{ key: PaneKey; label: string }> = [
  { key: 'left', label: 'Cohort' },
  { key: 'centre', label: 'Companion' },
  { key: 'right', label: 'Needs you' },
];

export const isPaneKey = (v: unknown): v is PaneKey =>
  v === 'left' || v === 'centre' || v === 'right';
