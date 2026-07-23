# Dashboard triptych — design + spec (mobile-first)

*Proposal for review, 2026-07-22. Origin: Scott's `G4L_Companion_Dashboard_Prototype.html` + Jay. Prototype content is
placeholder; the design pattern is the point. Written mobile-first on purpose — the phone answer is decided BEFORE the
desktop build, so we don't repeat the v3.1 mobile tangle.*

## 1. The idea, in one line
The **Companion conversation is the center of the dashboard**, flanked by two quiet columns: **reflect ← relate → act**.
It corrects a real dishonesty in today's layout — the Companion is currently a right *rail* (visually "secondary") when
it's supposed to be the product. Centering it makes the layout tell the truth, and it rhymes with the Sessions/subpages,
which are already single-column conversations (and already earning positive feedback).

## 2. The three regions (LOCKED — Jay, 2026-07-22)
| Region (segment label) | Role | Holds |
|---|---|---|
| **"Where You Are"** (left) | reflect / the mirrors | **ID Score** ring · **Grinta Index** · **Badges** |
| **"G4L Companion"** (center) | relate / the relationship | the **Companion conversation** + composer + inline nudge, AND the **hero messaging** — the resume/**next Session** state lives HERE, as the hero's CTA (Jay, 2026-07-22: next Session belongs to the Companion, not the flank; one place for "what do I do next") |
| **"What's Next"** (right) | act / forward motion | **Momentum** · **Reclaim List** · **Movement** · **Community** — in that order (Jay, 2026-07-22). NOT next-Session (that's the center hero). A lot for one column, but it's **moving existing panel content as-is**, each with its **`See more →`** foot link to its (now premium) subpage. **Reclaim List:** the flank shows just the intentions (compact); the **trackers** (a linked measure + the "turn on a tracker" offer) move to the new `/reclaim-list/[memberId]` subpage where they have room (Jay, 2026-07-22) — a real See-more, not a fake. |

The Companion sits between your self-image and your next move — that's the whole point of the arrangement. Note the
center carries the **hero/resume messaging** too (the resolveHero state — "you just finished X" / "your next step is
lit"), above/around the conversation. **Theme: light.**

## 3. MOBILE FIRST — how the triptych folds (decide this before anything)
A triptych has no phone form as three columns. The collapse principle: **the Companion is the phone's home; the flanks
become peers you flip to, never a stack piled on top of the conversation.**

**The pattern: three panes, one at a time, via a top segmented control. Companion is the default and the middle.**

```
┌─────────────────────────────┐
│  ◎ GRINTA        Sat · Jul   │  top bar (56px)
├─────────────────────────────┤
│   [ You ] [ Companion ] [Next]│  segmented control (Companion selected)
├─────────────────────────────┤
│                             │
│   the Companion conversation │  the selected pane fills the screen,
│   (thread, scrolls)          │  scrolls internally
│                             │
├─────────────────────────────┤
│  Tell me what's going on…  ▸ │  composer pinned (Companion pane only)
└─────────────────────────────┘
```

- **Default = Companion.** Land in the conversation, same as a Session. Swipe or tap left → **You** (the mirrors), right
  → **Next** (Reclaim + Momentum + Start a Session).
- Each pane is a full-screen internal scroll; the composer is pinned only in the Companion pane.
- **Why a TOP segmented control, not a bottom tab bar:** the composer lives at the bottom of the Companion pane — a
  bottom tab bar would fight it. Top control keeps the thumb-zone clear for typing.
- This is the *same three regions* as desktop, folded — not a different information architecture. One mental model both
  ways: "three panes, side-by-side on desktop, swipeable on a phone."

**Rejected alternatives (and why):** a single vertical scroll (mirrors → Companion → actions) buries the composer and
recreates the billboard-cover feeling; a bottom tab bar collides with the composer.

## 4. Desktop
- Fixed full-viewport (`overflow:hidden`); top bar (56px) + a 3-column main. Flanks ~280px, center `flex:1`, elevated.
- Flanks scroll internally; center = thread scrolls with the composer pinned.
- Below ~1000px the three columns collapse to the mobile 3-pane control above. (One breakpoint, one behavior.)

## 5. Two decisions to keep SEPARATE from the layout
1. **Theme.** Scott's prototype is a dark charcoal ground. The **triptych pattern works on our current light theme too**
   (a navy Companion still stands out on white). Recommend: ship the *layout* on the current light theme first; treat the
   **dark reskin as its own later proposal** — it's every panel + color restyled and re-verified, and it shouldn't ride
   in by accident on a layout change.
2. **Content.** All copy/numbers in the prototype are placeholder; the region *contents* above map to components we
   already have.

## 6. This is a re-arrangement, not a rebuild
Most of the pieces exist and get *moved into the triptych*, not rewritten:
- Center = the existing persisted check-in thread + composer (`redesign-shell.tsx`) + the proactive nudge (already wired).
- Left = the merged ring (`redesign-ring.tsx`, just fixed) + the Grinta reading.
- Right = the resume-hero next-step (`resume-hero.ts`), the Reclaim List panel, the Momentum panel — all existing.
The new work is the **shell/layout** (3 columns ⇄ 3 panes) + wiring the panels into their regions. The docked right rail
goes away (the Companion is the center now).

## 7. Build plan (flag-gated, verify, flip — the way that works)
New flag: **`DASH_TRIPTYCH`** (off on prod; the current dashboard is untouched until we flip).
1. **Shell** — the triptych container: 3 columns on desktop, the 3-pane segmented control ≤1000px. Empty regions first,
   to prove the layout + the fold + no page-scroll on both breakpoints.
2. **Center** — drop the existing Companion thread + composer + nudge into the center pane.
3. **Left** — ring + Grinta into the "You" pane.
4. **Right** — Momentum + Reclaim List + Movement + Community into the "Next" pane (in that order; next-Session is the
   center hero's CTA, not here). Move the panel content as it exists; give EVERY panel a consistent, clearly-tappable
   **`See more →`** foot link to its subpage (subpages are now premium — the See-More nav is load-bearing, must read as
   tappable, not a faint afterthought). Left flank likewise (ID Score → /story, Grinta, Badges → passport).
5. **Verify** desktop (1280) AND mobile (375) on the preview — the fold, the scrolls, the composer, no clipping — then flip.
Light theme throughout. Ceremonies + Sessions + subpages untouched (they're already single-column conversations).

## 8. Open questions for Jay
- **Left flank contents:** ID Score ring + Grinta — anything else (Movement? the Journey)? Or keep it to the two mirrors?
- **Right flank order:** Reclaim first, then Momentum, then Community? (Forward-motion priority; next-Session is the center hero, not here.)
- **Segmented labels:** "You / Companion / Next" — or your words (sweep-provisional)?
- **Theme:** confirm light-first, dark as a separate call?
