# G4L Platform — Brand & UI Standards

**Source of truth for visual + UX design.** Extracted from the live production build (`app/globals.css`,
`app/layout.tsx`, `docs/dashboard-ui-standards.md`, CLAUDE.md). Every value here is what actually ships — not
aspirational. Prod is **v2.4.1**. Owner: Jay Crain. Prepared for **Scott Runkel** (UX / Visual Design) and **Cowork**.

Two parts:
- **Part A — The Standards** (brand, type, color, components, voice, the guardrails that constrain UI). Lift into slides.
- **Part B — The Handoff** (how Scott turns over visual/UX changes so they land cleanly in the build).

---

# PART A — THE STANDARDS

## 0. First principles (the non-negotiables a designer must know up front)

1. **Palette is locked.** Nine brand colors, no off-palette hues. Translucent versions of palette colors (e.g. navy at
   5–55% for subtle fills/outlines) are allowed; **new colors, tints as new swatches, or gradients are not.**
2. **The companion is never a floating bot.** No corner bubble, no floating edge tab. It's the dashboard's hero panel
   + a docked rail. This is the cornerstone of the product and the one pattern most likely to be "improved" wrongly.
3. **Names are real; scaffolding is not.** The lexicon (§6) is a product vocabulary, not placeholder copy. Don't
   introduce invented framing terms ("Horizon," "pillar," "track").
4. **Some UI is governance, not taste.** AI disclosure, crisis routing, "never a bare number/verdict" (§7) are hard
   rules. They can be restyled but not removed or hidden.
5. **Voice is plain, measured, normalizing.** No hype, no motivational-pep, no corrective tone (§5).

---

## 1. Logo & product identity

- **Wordmark + bullseye mark** sit in a quiet, persistent **brand bar** at the top of every page (`.brand-bar`).
- Wordmark height **2.45rem**; bullseye mark **39×39px**, fully round (`border-radius: 50%`).
- The bullseye also serves as the **companion avatar** in the rail and beside companion messages.
- Identity is quiet and persistent — product presence, not a splashy header.

## 2. Typography

- **Typeface: Barlow** (Google Fonts, loaded via `next/font`). Single family across the whole product.
- **Weights in use: 400 (regular), 600 (semibold), 700 (bold), 800 (heavy).** 600 and 700 carry most of the UI.
- Base size **16px** (`1rem`). Body line-height **1.5**; headings **1.2**.
- Headings are **navy**, weight 600 by default.

**Type ramp (as built):**

| Role | Size | Weight | Notes |
| :-- | :-- | :-- | :-- |
| H1 (page title) | 2rem | 600 | navy |
| Hero / phase-cross title | 1.35rem | 800 | navy |
| Section sub-head (`h3`) | ~1.08rem | 600 | navy; reset default top margin inside cards |
| Panel title (`h4`) | ~1.02rem | 600 | navy |
| Body / beat text | 0.95–1.05rem | 400 | charcoal, line-height 1.5–1.6 |
| Eyebrow / tag | 0.72rem | 700 | UPPERCASE, letter-spacing 0.04–0.08em |
| Small / foot / legend | 0.8–0.85rem | 400–600 | navy at 70–75% opacity |

## 3. Color palette

**The nine (locked — `:root` in `globals.css`):**

| Token | Hex | CSS var | Primary role |
| :-- | :-- | :-- | :-- |
| Navy | `#374F63` | `--navy` | Primary text-on-light, headings, member chat bubbles, structure |
| Orange | `#EC6233` | `--orange` | Accent — phase-cross left border, eyebrows, "next step" energy |
| Teal | `#3B9495` | `--teal` | Primary action — buttons, links, CTAs, "here with you" status, scale chips |
| Olive | `#919536` | `--olive` | Secondary accent — "kept"/saved states, origin quotes |
| Indigo | `#101045` | `--indigo` | Deep accent (sparingly) |
| Deep Red | `#BB2127` | `--deep-red` | Reserved — genuine alerts only. **Never for a "down"/low score** (down renders grey, never red) |
| Charcoal | `#2A2A2A` | `--charcoal` | Default body text |
| Light grey | `#E8E6E6` | `--grey` | Companion (agent) bubble fill, quiet backgrounds |
| White | `#FFFFFF` | `--white` | Page background, rail bubbles, cards |

**Derived / systematized tokens (one knob each — don't hardcode these values elsewhere):**
- `--panel-line: rgba(55,79,99,0.55)` — the main panel/card outline (navy-tinted).
- `--field-line: var(--navy)` — the standard data-entry field outline (solid navy).
- Subtle fills use **translucent palette colors** (e.g. `rgba(59,148,149,0.07)` teal wash for disclosures,
  `rgba(55,79,99,0.05)` navy wash for "you're here"). Reuse these levels; don't invent new washes.

**Semantic color rules:**
- **Teal = do this** (action). **Orange = look here / what's next** (accent, not action). **Olive = you kept this.**
- **A score that drops renders neutral grey, never red.** Red is a false alarm in a non-judging product. (Governance.)

## 4. Shape, spacing, layout

- **Corner radii (as built):** 6px (inputs/small), 8px (buttons, standard blocks), 10–12px (cards/panels),
  14px (chat bubbles), 20–22px (large surfaces), 999px (pills/tags). **Chips are rounded squares (8px), not circles.**
- **Buttons:** teal fill, white text, `border-radius: 8px`, padding `0.7rem 1.4rem`, weight 600; **hover → navy fill.**
- **Inputs:** solid navy outline (`--field-line`), `border-radius: 6px`.
- **Cards/panels:** white, `1px solid var(--panel-line)`, radius 10–12px; reset the default `<h3>` top margin inside.
- **Page column:** `max-width: 720px`, centered, generous bottom runway (4rem) so the Talk dock never traps content.
  **When the companion rail is open the page widens to 1240px** (2-pane); below 1000px → single column + full-screen rail.
- **Panel → sub-page link:** the `.see-more` treatment — a teal **"<Label> →"** pinned to the panel foot
  ("See more →", "Full program →", "Your full story →"). Every panel that opens a fuller page uses this.

## 5. Voice & copy

- **Plain, measured, no hype.** Call things what they are. Member-facing copy is **normalizing and reflective**, not
  motivational-pep, not corrective.
- **Declare what something *is*.** Don't define or reassure by negation — the "it's not X, it's Y" cadence is cringe
  we're actively thinning out (same family as the retired "That's ___ done" cadence and the "honest" AI-tell). The
  **only** negation to keep is the rare one that removes a genuinely *harmful belief* — the Fade normalization ("a
  hundred reasonable decisions, not a failing"). **Cut the reassurance-tics** — "no grade here", "not a grade", "never
  a scold", "not a test", "not about a perfect score" — and say the thing plainly. (Enforced in the model voice rules:
  `session-guide.ts`, `checkpoint-guide.ts`.)
- **"Honest" is a PROTECTED word — be protective of it (Jay, Jul 2026).** Keep it for one meaning: the member being
  **honest with themselves** — the vulnerable conversational admission, and the self-assessments (it's essential there,
  and it's a heavily-used marketing word in that context). Trimming the idle uses everywhere else only *elevates* this
  one. So: cut "an honest look/read/take of X" and "honestly" as an adverb; **keep** every "be honest with yourself /
  an honest read of where YOU are / honest stock of your own skills."
- **The north star: safe to be honest with yourself.** Never judge, grade, fix, or pathologize. Normalize, don't praise.
- **Encouragement is not praise — and "don't praise" must never be read as "be flat."** (Jay, 2026-08-14: "let's not
  take the soul out of the Companion. I like the vibe and feel of the conversations right now.") The line is:
  **acknowledge the moment, never appraise the person or their answer.** "Great." and "Good — keep going." are
  receipts, meaning *I heard you, carry on*. "Great answer.", "That's a great list.", "Well done" are verdicts — and a
  member who senses they are being marked starts performing instead of being honest, which is the failure this
  surface exists to prevent. Warmth is not a governance risk; a scorer is.
- **Reflect before asking; one question at a time; the member sets the depth.** Never extract.
- **A member's reclaimed identity renders in natural case** ("the Athlete"), never all-caps.

## 6. Lexicon (real names — never invent framing terms)

**Use, capitalized, as product terms:** 4Rs · IDQ · ID Score · Grinta Index · the Journey · the Atlas · the Beat ·
the close · the Door · the Fade · the Reclaim List · the Loop · Member Agent · Founder Agent · Connect.

- **The Fade** = the identity distance the IDQ measures. **The Door** = the life event that opened it.
- **Three feedbacks:** the **ID Score** (the mirror) · the **Grinta Index** (grit, its own /5 scale) · the **Journey**
  (place on the 4Rs + Reclaim List movement — *never a score*).
- The **4Rs:** Reconnect (gateway) → Rewire (mind) + Rebuild (body, in parallel) → Reclaim (the outcome state).
- **NEVER camel-case the four Rs.** It is **Reconnect · Rewire · Rebuild · Reclaim** — one capital, the ordinary
  capitalisation of a word. Not ReConnect, ReWire, ReBuild, ReClaim; not Re-Build or Re-Claim. (Jay's call as brand
  owner, 2026-08-06.) Greg's science documents camel-case them throughout — that is HIS house style. Preserve it
  inside verbatim quotations of his work; everywhere else ours wins. Enforced by `tests/naming-guard.test.ts`, so a
  camel-cased R cannot reach `lib/` or `app/`.
- **Do not introduce** invented terms: no "Horizon," "pillar," "track." "Journey" capitalized is a real feature; avoid
  lowercase "journey" as filler.

## 7. Governance guardrails that constrain the UI (hard rules — restyle, never remove)

- **AI is always disclosed** before the first conversation (the `.ai-disclosure` / `.disclosure` block — teal
  left-border wash). It can move or restyle; it cannot disappear.
- **Crisis routing is always on** — distress routes to 988 / local resources. Any conversational surface must keep it.
- **Never a bare number, never a verdict.** Scores are always wrapped in meaning; the product helps a member understand
  themselves, it never grades them. (Drives the "down = grey" rule and the "no leaderboard" posture.)
- **Never names an identity label without member confirmation.**

## 8. The companion — presence pattern (the cornerstone)

- **No floating bot. Ever.** Not a corner bubble, not a floating tab.
- **Hero:** a sticky navy panel titled **"The G4L Companion"** — one proactive message + a single teal **"Talk to me →"**
  CTA. Two states: **full** (label + message + CTA) and **condensed** (slim one-row bar on scroll; the CTA is
  load-bearing and never dropped). Same companion, same rail — purely a visual state.
- **Rail:** opens as a **docked rail** (desktop) / **full-screen overlay below 1000px**, reusing the persisted check-in
  thread. "Clean like iMessage": bullseye avatar + teal "● here with you" status; **white soft-bordered companion
  bubbles, navy member bubbles**; frosted sticky header + input.
- **Input:** rests at one line, grows as you type, capped — never stuck tall.

## 9. Reusable component inventory (name them; don't re-derive)

| Component | Class / location | Spec |
| :-- | :-- | :-- |
| Primary button / CTA | `button, .btn` | teal fill → navy hover, radius 8px, weight 600 |
| Text field | `input, textarea, select` | navy outline, radius 6px |
| Card / panel | `.card` + `--panel-line` | white, radius 10–12px, foot `.see-more` link |
| Phase-cross callout | `.phase-cross` | orange left-border (5px), radius 12px, uppercase eyebrow |
| Chat bubbles | `.bubble.agent` / `.bubble.member` | grey agent / navy member; rail = white agent bubbles |
| Scale chips | `.scale-chip` (`app/components/scale-chips.tsx`) | rounded-square (8px), teal outline, picked fills teal; pole anchors beneath |
| Pill / tag | `border-radius: 999px` | uppercase, 0.72rem, weight 700 |
| Disclosure | `.ai-disclosure` / `.disclosure` | teal left-border + teal wash |
| Companion hero + rail | `app/dashboard/*`, `companion-context.tsx` | see §8 |

---

# PART B — THE DESIGN-CHANGE HANDOFF

**Goal:** let Scott work in his own visual medium (Figma / annotated screenshots) and have his changes land in the
build fast, correctly, and without accidentally breaking a load-bearing pattern.

## B1. What's free to change vs. load-bearing

**Free to redesign (visual/UX latitude — bring ideas):**
- Spacing, layout, hierarchy, alignment, density, responsive behavior.
- Type ramp (sizes/weights within Barlow), within the scale above.
- Component shape/anatomy — button/card/chip/bubble styling, radii, iconography, motion & transitions.
- Color *application* within the locked palette (which of the nine goes where), and translucent-wash levels.
- Empty states, loading states, micro-interactions, screen flow and information architecture.

**Load-bearing — propose changes, but flag them; they need a Jay/governance nod before build:**
- The **palette lock** (adding any color/hue/gradient).
- The **companion-is-not-a-floating-bot** pattern (§8).
- **AI disclosure**, **crisis routing**, **never-a-bare-number**, **down=grey-never-red** (§7).
- The **lexicon** (§6) — renaming or introducing product terms.
- Anything that changes **what data means** or what's shown vs. stored.

## B2. The format that lands cleanest

Per change, give us:
1. **Screen + element** — the page (e.g. "Dashboard hero") and the component name/class from §9 if known.
2. **Current → Proposed** — an annotated screenshot or Figma frame. Redlines/specs welcome but not required; a clear
   before/after picture is enough for us to translate to tokens.
3. **The why** — one line. (Design intent helps us preserve it if we hit a constraint.)
4. **Any exact values you care about** — hex (must be palette), px/rem, radius, weight. If you don't specify, we map to
   the nearest existing token so the system stays coherent.
5. **Load-bearing?** — flag if it touches anything in B1's second list, so we route it right.

A tiny per-item template (copy/paste):

```
Screen:        Dashboard hero / condensed state
Element:       "Talk to me →" CTA (.companion-cta)
Current:       teal text link, right-aligned
Proposed:      teal filled pill, full-width on mobile   [screenshot attached]
Why:           the CTA gets missed in the condensed bar
Values:        radius 999px, weight 600, teal fill
Load-bearing?  No (CTA must remain present — that part is load-bearing)
```

## B3. The loop (how it flows)

1. **Scott** → annotated Figma/screens + notes (the template above), batched by screen.
2. **Jay / Cowork** → package + prioritize; flag any load-bearing items for a quick governance nod.
3. **Claude Code** → builds against `globals.css` tokens + these standards; keeps the palette/voice/governance intact;
   **one screen at a time**, full test suite + tsc green.
4. **CC → back to Scott** → a live preview screenshot of the built change for eyeball + iterate. (We can screenshot any
   state — full/condensed, mobile/desktop, light/dark — on request.)
5. Ship via git push → prod; verify live.

## B4. Working notes for the visual pass

- Tokens live in **one place** (`:root` in `globals.css`) — changing a token cascades everywhere, which is the clean way
  to reskin. Prefer token changes over per-component overrides.
- We can produce **before/after screenshots on demand** from the running app for any screen — a fast feedback medium for
  Scott without him needing to run the code.
- Motion is currently minimal (smooth hero condense, chip transitions). Motion is open territory if Scott wants to
  bring a considered system — just keep it calm (matches the voice).

---

*Companion doc: `docs/dashboard-ui-standards.md` (the settled companion/dashboard patterns, engineering gotchas). Brand
+ voice + lexicon source: CLAUDE.md.*
