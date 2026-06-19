# Dashboard & Companion UI Standards

Patterns settled during the Slice 1 reshuffle + live review (Jun 2026). Treat these as defaults — match
them rather than re-deriving. They live in `app/globals.css` + `app/dashboard/*`.

---

## Companion presence (the cornerstone — get this right)

- **No floating bot.** Never a corner bubble or a floating edge tab — that's the generic-chatbot pattern
  members ignore. The companion is woven into the dashboard, not bolted on.
- **The companion is the dashboard's hero**: a sticky navy panel titled **"The G4L Companion"** with one
  proactive message + a single teal **"Talk to me →"** CTA. It sticks to the top (`position: sticky`) and
  the rest of the dashboard scrolls beneath it.
- **Two hero states — full and condensed (a default, not a one-off).** At rest it's the **full** panel
  (label + message + CTA). Once scrolled to where the tall sticky panel would start covering the panels
  below, it collapses to a **condensed** slim bar — one row: mark + label + a compact **Talk to me →**
  (the CTA is load-bearing; never drop it). Scroll back to top → re-expands; transition is smooth. Purely
  a visual state of the hero — same companion, same rail, no new data. Driven by a zero-height sentinel +
  `IntersectionObserver` that flips `.is-condensed` the instant the hero would engage stickiness (so it
  never overlaps content); the message collapses via `max-height`/`opacity` to animate.
- **The conversation opens as a docked rail** (desktop) reusing the persisted check-in thread
  (`agent_message` / `lib/agent/conversation.ts`) — no new store. Below **1000px it's a full-screen
  overlay**. Opens from the hero CTA / `?chat=1`; closes via ✕, Esc, or clicking the dashboard.
- **Rail styling** (the "clean like iMessage" target): self-contained rounded panel (outline only when
  open — a zero-width bordered element leaves a hairline, so border lives on `.dock-open .companion-rail`);
  G4L bullseye avatar + teal "● here with you" status in the header; an avatar beside each companion
  message; **white soft-bordered** companion bubbles, navy member bubbles; **frosted** (translucent white
  `0.72` + `backdrop-filter: blur`) sticky header & input so the thread shows through.
- **Input**: `field-sizing: content` + `min-height` ≈ Send-button height + `max-height` cap. Rests at one
  line, grows as you type, never gets stuck tall. (Don't rely on JS auto-grow alone — it can leave a stale
  height after send.)

## Layout

- **Two-pane when open**: `.dock` is a flex row (`dock-main` + `companion-rail`). The page widens
  (`main:has(.dock-open){ max-width: 1240px }`) so panels reflow beside the rail instead of being crushed
  in the 720px column. Below 1000px → single column + full-screen companion overlay.
- **The nav bar stays full-width above the dock** (it's a sibling of `.dock`, not inside it) so opening the
  rail never squeezes/wraps the nav.
- **Top-edge alignment**: the rail and the first dashboard panel must start level. Cards carry
  `margin: 1rem 0`, so a non-card sibling (the rail) needs a matching `margin-top` to align.
- **Rail height**: a docked panel can be tall enough to fill from its rest position to the viewport
  bottom *without clipping the input* — that's `calc(100vh − headerOffset)`, not `100vh`. It can't be both
  full-height-when-pinned and non-clipping-at-rest; favor non-clipping.

## Panel → sub-page navigation (standard pattern)

Every panel that links to a fuller sub-page uses the **`.see-more`** treatment: a teal link reading
**"<Label> →"**, pinned to the **foot** of the panel. Examples: "See more →" (ID Score/Journey/Grinta),
"Full program →" (Program → `/program`), "Your full story →" (identity → `/story`). New panels follow suit.

## Cards & spacing

- Reset the browser's default `<h3>` top margin inside cards (`.card > h3:first-child { margin-top: 0 }`)
  — that default is the phantom whitespace above panel titles. Keep cards compact.
- Side-by-side panels meant to read as equal use grid `align-items: stretch` + bottom-pinned foot links
  (`margin-top: auto`) so their CTAs align. Equal size means the shorter panel pads out — accepted tradeoff.
- Equal-width metric columns need `min-width: 0` on the grid items, or a long non-wrapping line (dates,
  numbers) steals width and the columns drift unequal.

## Voice (already enforced in the agent prompts)

Declare what something *is*. Don't define/redirect by negation ("not X, that's Y" / "don't do X, do Y").
KEEP negation that lifts shame or a false fear ("a hundred reasonable decisions, not a failing", "no grade
here"). Lives in `system-prompt.ts`, `session-guide.ts`, `checkpoint-guide.ts`.

## Engineering gotchas (cost us real time — don't repeat)

- **Don't import a hook from a component module into another client component** — it creates a client↔client
  cycle that webpack-dev resolves to `undefined` ("Cannot read properties of undefined (reading 'call')").
  Put shared context/hooks in their **own module** (e.g. `companion-context.tsx`).
- **Run the dev server on Turbopack** (`next dev --turbopack`). The Next 15 webpack dev bundler has a
  client-component module-graph bug that throws the `reading 'call'` error even when the production build is
  clean. Turbopack avoids it and keeps hot-reload.
- After adding a new component or changing a context shape, **restart the dev server** — HMR mis-handles
  those and silently corrupts the module graph (the early sign is "Fast Refresh had to do a full reload").
