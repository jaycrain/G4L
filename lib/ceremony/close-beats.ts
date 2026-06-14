// Session-close ceremony content (Give-Back Model v0.4 — "significance lives in the ceremony"). A
// milestone close fires the Companion Ceremony: the felt weight, paced, the facet + badge revealed.
// Pure + testable; copy lives here as config. The CeremonySurface renders these.

export type CloseReveal = { kind: 'facet'; text: string } | { kind: 'badge'; badgeId: string; name: string };

export type CloseBeat = { text: string; small?: boolean; reveal?: CloseReveal };

export const CLOSE_RESOLVE_LABEL = 'Back to your dashboard →';

export function buildCloseBeats(input: { facet: string; badgeId: string | null; badgeName: string | null }): CloseBeat[] {
  const beats: CloseBeat[] = [
    { text: 'Stay with this for a second.', small: true },
    { text: 'You went digging for who you were — and you put a name to it. Most people never stop long enough to do that.' },
    { text: 'This is the self you’re reclaiming:', reveal: { kind: 'facet', text: input.facet } },
    { text: 'It isn’t gone. It’s on your dashboard now, where you’ll see it every day — and everything else builds around it.' },
  ];
  if (input.badgeId && input.badgeName) {
    beats.push({ text: 'And you earned this — for a real thing you did, not for showing up:', reveal: { kind: 'badge', badgeId: input.badgeId, name: input.badgeName } });
  }
  beats.push({ text: 'That’s the work. Let’s keep going.' });
  return beats;
}
