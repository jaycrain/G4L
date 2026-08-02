// THE OPERATOR SURFACE HAS ITS OWN GROUND — dark by default, light on request.
//
// Jay, 2026-08-01: "more of a contrast between the Member App and the Founder Console", pointing at Scott's
// Companion prototype. The member app is white; the console is charcoal. You know which app you're in from
// across the room, before reading a word — which matters because Jay switches between BEING a member and
// RUNNING the program several times a day.
//
// Then, on seeing it: "Maybe it should be the dark theme and I would like the option to switching back."
// Dark is the intent and the default; light is one tap away. The choice follows the PERSON (founder_state),
// not the browser, so it's the same on a MacBook, an iPad and a phone.
//
// READ SERVER-SIDE so the ground is correct in the FIRST paint. A client-side theme flashes the wrong one
// while the page hydrates, and a flash of white on a surface chosen for being dark is worse than no option.
//
// ONE SCOPE, so it cannot leak: every dark rule hangs off `.fc-dark`, and this is the only thing that sets
// it. A member surface can never inherit an operator colour, and the reverse holds too — that boundary is
// what makes a wholesale re-skin safe, and the console walk asserts it in both directions.

import { getDb } from '../../lib/db/index.ts';
import { getConsoleTheme } from '../../lib/founder/state.ts';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const theme = await getConsoleTheme(await getDb()).catch(() => 'dark' as const);
  // `fc-scope` is unconditional — the LIGHT theme needs a hook too, now that the console is viewport-locked
  // and this wrapper has to carry the height down from <main> to the shell. `fc-dark` only paints.
  return (
    <div className={`fc-scope${theme === 'dark' ? ' fc-dark' : ''}`} data-console-theme={theme}>
      {children}
    </div>
  );
}
