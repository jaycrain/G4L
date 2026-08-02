// THE OPERATOR SURFACE IS DARK. Everything under /admin, nothing outside it.
//
// Jay, 2026-08-01: "I'm wondering if there can be more of a contrast between the Member App and the Founder
// Console." The member app stays white; the console sits on charcoal. You know which app you're in from
// across the room, before reading a word — which matters more than it sounds when the same person switches
// between being a member and running the program several times a day.
//
// ONE SCOPE, so it cannot leak. Every dark rule in globals.css hangs off `.fc-dark`, and this layout is the
// only thing that sets it. A member surface can never accidentally inherit an operator colour, and the
// reverse is true too — which is the property that makes a wholesale re-skin safe to do at all.
//
// The elevation language is Scott's, from the Companion prototype: charcoal ground, surfaces raised by
// white-at-opacity rather than by borders, radius growing with the surface. No new colours — every grey here
// is white over charcoal, so the nine stay nine.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="fc-dark">{children}</div>;
}
