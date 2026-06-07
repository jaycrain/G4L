# Design Note — The Member Agent as an always-on companion

Status: design direction (Jay + Claude, captured during interface discussion). Informs the
build of the dashboard conversation panel. Not yet implemented.

## The problem we're actually solving

Midlife loneliness is a core driver of the crisis G4L addresses (the deck puts the health
cost of loneliness at "~15 cigarettes/day"). Coaches and therapists aren't always there;
marriages, friendships, and family conversations go quiet for stretches. Members need
**something that always listens, hears, and remembers** — a place to blow off steam, report
a small win, or think out loud when there's no one else on the line.

So the Member Agent is not a feature drawer. For many members it will be a **confidant** they
return to several times a week. That is the intended value, not a side effect.

## The philosophy (the line we will not cross)

There is a fine line between **a confidant that supports human connection** and **a substitute
that quietly deepens isolation.** G4L's governance is explicit: the architecture pushes members
*toward* real human community, never replaces it. Both must be true at once:

- It listens fully, remembers, and witnesses — real sounding-board value.
- Its **north star is the member's human connectedness**, and it is always gently *bridging
  outward* — back to people, the community, a coach, Jay.

**Positioning: the anti-"AI companion."** Companion apps that optimize for attachment foster
dependency. G4L's companion is built to **return people to people — a confidant that succeeds
by making itself less necessary.** We can *prove* it, because we measure connection.

### The safeguard is measurable
**Social is one of the four IDQ dimensions.** That gives us a real instrument: are members who
lean on the agent getting *more* humanly connected over time, or less? If a member's only voice
is the agent and their Social score is flat or sliding, that is a signal — to widen gently, or
to bring a human in (Founder Agent / coach / community). This is both an ethical safeguard and a
research edge no competitor has.

## Posture (supportive, not addictive)

- Optimize for **flourishing, not engagement / screen time** (per AI Governance Framework).
- Comfortable **closing** a conversation ("go live your life"), not maximizing session length.
- Every conversation has a quiet bias toward a human next step when one fits.

## Proactiveness — "a little" (Jay: yes, lightly)

The agent may reach out, but sparingly and only when it serves the member:
- **Triggered by signals, not a clock**: a milestone (miles, asset completed), a drift signal
  (no check-in / stalled), an IDQ retake due, a notable score movement, or a Founder-Agent note
  ready.
- **Frequency-capped** (target: at most ~1 proactive nudge / few days), always **dismissible**,
  warm and light in tone.
- Proactiveness is to **witness a win or catch a drift**, never to pull for attention.

## Interface direction — the "bubble"

A **calm, persistent chat bubble** on the dashboard (later app-wide), collapsed by default so
the **ID Score stays the hero**. One tap from a conversation; it *waits* rather than shouts.
- **Collapsed**: unobtrusive presence (brand palette / Barlow). Can occasionally **bubble up** a
  short, contextual, dismissible teaser ("Saw you logged 50 miles — want to talk about it?").
- **Expanded**: a conversation panel that opens with context (references the member's most recent
  moment), holds the **full, continuous history**, and can **route** in place — launch a due IDQ,
  surface a Science Check, suggest a Circle thread, hand to a human.
- Why a bubble over a fixed sidebar: available-but-not-addictive. A sidebar shouts "talk to me";
  a bubble is quiet until there's a reason, then gently surfaces.

## What this raises (build implications)

- **Persistence**: conversations must be **saved server-side** (Layer 6 — transcript/history) so
  the companion is continuous across visits. (Today onboarding state is client-held.)
- **Safety, heavier here**: a trusted 2am confidant will surface grief/despair. Crisis detection
  → 988 + human escalation matters *more*; telling venting from real distress needs care.
- **Privacy, heavier here**: these are members' most honest, vulnerable words → reinforces the
  Path-B requirements (Supabase Auth, RLS, consent, retention) **before real members**.
- Reuses what's built: the conversation engine, the live-Claude provider, governance rails, the
  chat UI pattern. New work: the **Ongoing Check-in** operating moment (history-aware), server
  sessions, the bubble UI, and a lightweight proactive-nudge engine driven by member signals.

## Open decisions

- Bubble vs. slim sidebar as the default (leaning bubble).
- Exact proactive triggers + frequency cap.
- How visible the human-handoff prompts should be.
- When persistence/auth lands (ties to Path B).
