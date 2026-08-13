# Marketing Alignment Brief — v3.4.1

**Stamp:** `3.4.1 · app @ 4d9800a · 2026-08-13` · prod is live at this commit.

A record of decisions, not a request for options. Everything below has shipped. Where the glossary or existing
marketing copy disagrees, **the app is correct and canon gets corrected** — the sole exception being a factual or
legal error in the app, which we'd fix at the source.

**What v3.4.1 is:** a readiness/quality pass, not a phase flip. Nothing changed about the 4Rs, the program model,
or what a member does. It is about the first hours of membership — what the product says to someone who has just
finished onboarding, and whether it says it once or four different ways.

**Read §0 first.** The ADDED list in `CHANGES.md` is 106 lines, and most of them are not new copy.

---

## 0 · ⚠️ THE BUNDLE HAS BEEN UNDER-REPORTING. Four surfaces were never in it.

The transcript is built from a hand-maintained list of source files. While cutting this version I found that list
was missing four member-facing surfaces — and had been missing them through **v3.2.1, v3.3 and v3.4**:

| Surface | What it is | Lines |
| :-- | :-- | --: |
| The **onboarding welcome screen** | the four-part map read before the first question — "Four phases. Your pace.", the vocabulary primer, "Here's how" | ~35 |
| The **Threshold ceremony** | the seven beats the moment onboarding ends — *"Stop for a second."* … *"Clip in →"* | ~12 |
| The **Opening Tour** | the twelve stops that introduce the dashboard | ~14 |
| The **messaging ladder** | the source for every subpage title, sub and intro | ~29 |

Between them these are the **most quotable copy in the product** — the first words the program says to someone
who has just admitted, often for the first time, what they lost. You have been working without them and could
not have known: a missing surface reads as "no copy there," not as an error.

**So when you read `CHANGES.md`: of the 106 added lines, 78 are copy that has been live for weeks and is only now
disclosed, and 28 are genuinely new or changed in this version.** (Measured, not estimated: building the
transcript from the old file list gives 28 added; from the corrected list, 106.) The sections below cover only
the second kind — if a line appears in ADDED and isn't discussed below, it is pre-existing copy you are seeing
for the first time, and it is quotable as-is.

The source list now names the missing files and carries its maintenance contract in writing. This one is mine;
you had no way to check it.

---

## 1 · NAMING — three changes, all narrowing to one word

- **"plays" → "Moves."** The items a member keeps in their Playbook are **Moves**. `Your plays` → `Your Moves`;
  *"your go-to plays, in your words"* → *"your go-to **Moves**, in your words."*
- **"G4L Community" → "Community."** The product prefix was doing nothing inside the product. (The name
  "Connect" remains retired and never shipped — no change there.)
- **"Account Settings" → "Your Account."** Consistent with every other subpage title (see §2).

Also **British → American spelling**, product-wide and now checked on commit: *practise* → **practice**. Worth
flagging because it had drifted into a Rebuild line that canon may already carry.

---

## 2 · VOICE — the messaging ladder: one idea, said four times, each time doing one more job

The governing pattern for every feature a member can see. One idea runs down four layers:

- **tour** — the anchor line, said once during the Opening Tour
- **panel** — the dashboard card: the idea **plus live state**
- **header** — the subpage title: the idea **plus its purpose**
- **intro** — how it works, and *only* where the header doesn't already carry it

The repetition is the point — it cements the vocabulary. What must not repeat is the *job* of each layer.

**Subpage titles are now "Name — what it's for."** New, authored, quotable:

| | |
| :-- | :-- |
| ID Score | **ID Score — the distance you're closing.** How close you are to the person you're reclaiming, 0–100. |
| Grinta Index | **Grinta Index — the grit you're building.** Your resilience, measured — and it grows with every phase. |
| Badges | **Badges — proof of what you've actually done.** Passport stamps, not trophies — the count is the point. |
| Momentum | **Momentum — your rhythm, one call at a time.** The small daily choices, and the pattern they make. |
| Reclaim List | **Reclaim List — what you're taking back.** The goals where your Comeback is aimed. |
| Movement | **Movement — the work, showing up in your body.** Connect a source and your activity lands here. |
| Community | **Community — others walking the same road.** Give and get support from people who get it. |
| The Program | **The Program — your way back.** Four phases, your pace. |
| Your Account | **Your Account — yours to set.** Your details, your reminders, and your privacy, in one place. |

**Five page ledes were cut** because they restated the header now sitting above them — the "More about your ID
Score" / "More about Momentum" pattern is gone. If canon quotes those, they are retired.

---

## 3 · FUNCTION — every Opening Tour line now comes from the ladder

The tour used to hold its own hand-written copy of each panel's description, so the two drifted: the panels
carried current wording and the tour went on saying an older version. **The tour line is now composed from the
ladder** (title + sub), so an edit reaches both and there is no second place to remember.

Consequence for you: **every tour line's wording changed.** They now read exactly as the table in §2, with two
carrying one extra tour-only sentence — *"You start the next one right here."* (Program) and *"It starts empty
and fills as you go."* (Playbook).

**A twelfth stop exists that never did: the Account.** It had been silently dropped, so reminders and privacy
were things a member had to go looking for.

---

## 4 · STORY — the empty state is now honest

Two pages described a number the member does not have yet. On day one they now say:

- **ID Score** — *"You don't have an ID Score yet. Your first one lands when you take the IDQ, in Reconnect."*
- **Grinta** — *"Your Grinta baseline lands when you finish the intro conversation."*

Small, but it is the difference between a product that greets a new member and one that shows them a blank
number and lets them wonder. The Playbook does the same: *"It starts empty and fills as you go."*

---

## 5 · Smaller, still member-visible

- **The version is in the footer** — `© 2026 Adjacent Lab, LLC … · v3.4.1 · 4d9800a`. Charter Members are about
  to start reporting things, and "it looked wrong on my screen" is unactionable without knowing which build.
- **The Playbook opens on its tabs**, and has a **"Who you are"** tab again.
- **The Quality Day hand-off** points at the Playbook rather than a stale dashboard: *"open This week in your
  Playbook and log each day."*

---

## Not settled — do not treat as canon

- **Playbook positioning.** The Playbook's title and sub in §2 are **DRAFT**. Jay: *"the endpoint framing is the
  direction, but the copy isn't locked."* Don't build marketing on those two lines yet.
- **Rebuild B4's Foundation Check** is with Greg and unresolved. Nothing about B4 changed here.

## Extraction artifacts — not copy, ignore

The transcript builder splits some templated strings badly. These appear in ADDED and are **not** member-facing
lines: `S day, not the server` · `More about X` · `N of 3 built` · `Program › Reclaim › …`. One more is real but
mis-escaped: `This is home base — I&apos;m right here.` renders with a normal apostrophe.

## What to reconcile

1. **Glossary:** *plays* → **Moves**. *G4L Community* → **Community**. *Account Settings* → **Your Account**.
   *practise* → **practice**.
2. **Retire** the five "More about …" ledes and the older tour wording wherever canon carries them.
3. **Add** the nine subpage title/sub pairs in §2 as authored, quotable copy.
4. **Read the four newly-disclosed surfaces in §0 in full.** They have never been in front of you, and the
   Threshold ceremony in particular is the emotional centre of the first day.
