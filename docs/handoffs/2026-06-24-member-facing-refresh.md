<!--
STATUS: ✅ SHIPPED — commit 6f6dfae (Jun 24 2026). All 6 tasks live + verified; post-deploy smoke green.
Build notes / "shipped vs. spec" delta:
- ID Score & Grinta personal lines shipped DYNAMIC (live score + context / generated grinta line), not the
  literal example numbers ("62", "9 of 14 days"). The body example "74 of 120 reads as 62" kept LITERAL.
- Radar: axes scale 0–30 (raw 6–30 sub-scores); axis labels are NAMES ONLY (numbers in the legend beside
  the chart); previous-IDQ overlay = faint dashed polygon, only when a 2nd IDQ exists; dashboard mini =
  ~132px, no labels, current shape only. Identity-only (no behavior plotted).
This file is the as-built archive of the Cowork handoff. The original kept-flag tagging belongs in the
living copy (Platform Content). Verbatim handoff follows.
-->

# G4L — Handoff: Member-Facing Detail Pages + Fixes

**Date:** June 24, 2026
**From:** Jay (via Cowork synthesis)
**Scope:** Four member-facing copy rewrites, one new visual (the ID Score radar), and two small live-string fixes. All decisions below are **resolved** — safe to build. A "Do NOT touch" section at the end lists what's still open.

**Source of truth:** the living copy lives in `G4L Program/Platform Content/Member Experience/*.docx`. This file is the June 24 snapshot and is self-contained — you can build straight from it.

---

## Task summary

| # | Task | Type | Page / surface |
|---|------|------|----------------|
| 1 | ID Score detail — copy rewrite **+ radar** | copy + build | "More about your ID Score" |
| 2 | Grinta Index detail — copy rewrite | copy | "More about your Grinta Index" |
| 3 | Journey detail — copy swap | copy only | "More about your Journey" |
| 4 | Field Guide — full refresh | copy | Field Guide |
| 5 | Grinta card label: **"Choice" → "Control"** | string | Dashboard Grinta Index card |
| 6 | **"Member Agent" → "Companion"** (member-facing) | string | Account / Notifications page |

---

## 5. Quick string fix — Grinta card middle C (Register #7)

The live dashboard Grinta Index card labels the middle C **"Choice."** Change it to **"Control."** Final set, in order: **Commitment · Control · Challenge.** (Internal/data naming can stay whatever it is; this is the member-facing label.)

## 6. Quick string fix — "Member Agent" → "Companion" (Register #17)

The account/Notifications page leaks the internal term: "Let your **Member Agent** reach out…". Member-facing copy should always read **"Companion"** (e.g., "Let your **Companion** reach out…"). "Member Agent" may remain the internal/dev term and in the Beat Registry; just don't show it to members. (All naming is provisional pending a later branding sweep — make only this specific swap, no broader rename.)

---

## 1. ID Score detail page — copy rewrite + the radar

**Type:** copy + build. **Replaces:** the current text-only "More about your ID Score" page.

**The radar (build) — Register #4, resolved.** Add a radar/spider chart of the four PSSO dimensions to this page (and a small version on the dashboard ID Score card). Spec:
- Four axes: **Physical · Self · Social · Outlook**.
- The enclosed shape = the member's current identity profile; overlay the **previous IDQ** faintly so growth reads as the **area expanding**.
- Redraws each cycle (~60 days), in step with the ID Score.
- **Identity only** — do NOT plot Grinta/behavior on it (untether: identity and behavior are parallel, no causal arrow).
- This replaces the old "comeback map / 2×2." It's a *display* of the sub-scores already computed — no scoring change. Additive; the live page shows raw PSSO numbers today, nothing to unwind.

**Ship this copy:**

> Your ID Score right now is 62. This is your starting point — a baseline to grow from, not a grade.
>
> Your ID Score is the mirror — and like any mirror, it won't flatter you and it won't lie. It's a single 0–100 read of how close you are to the person you're reclaiming, drawn from four corners of a life.
>
> **The shape of you**
>
> Identity isn't one number — it's a shape. Your score is built from four dimensions, and seeing them together shows you where you're whole and where the distance runs widest.
>
> *[radar renders here]*

| Dimension | What it reads |
|---|---|
| Physical | Your body, your energy, how you move and feel in it. |
| Self | Who you are to yourself — identity, confidence, the inner story. |
| Social | Your people — connection, belonging, who's in your corner. |
| Outlook | How you see what's ahead — purpose, hope, the road in front of you. |

> Each is scored out of 30. Together they make the 0–100 number at the top (for example, 74 out of a possible 120 reads as 62). The big number is the whole picture; the four beneath it are the map — and a low one isn't a failing grade, it's a sign of where the work will pay off most.
>
> *How to use it:* when one dimension sits low, ask your Companion what to do about it — it'll point you toward the Sessions and goals that move that corner.
>
> **Why it moves slowly**
>
> It comes from the IDQ — twenty-four questions you answer about every 60 days. That pace is on purpose. Who you are doesn't lurch from week to week, so neither should this. The ID Score is built to move slowly, so that when it does move, you know you earned it — real change, not a good night's sleep.
>
> So don't chase it daily; you won't catch it moving, and that's the point. Do the reps, and let the next IDQ tell the truth. When the number climbs, that isn't a better score — it's more of you, back.
>
> **The mirror and the grit**
>
> Your ID Score moves slowly; your Grinta Index moves with the work. Watch them side by side: the grit is how hard you're working, the mirror is how reconnected you feel. They're two true pictures of the same comeback — we keep both honest and let you see them rise together.
>
> Sixty days from now, this number gets to tell a different story. The space in between is where you write it.

---

## 2. Grinta Index detail page — copy rewrite

**Type:** copy. **Replaces:** the current "More about your Grinta Index" page (out of date — it uses Consistency/Recovery/Reach and a daily-updating model).

**Key changes:**
- Components are the **three C's of hardiness: Commitment · Control · Challenge** (NOT Consistency/Recovery/Reach).
- Grinta is **measured at the Checkpoints**, not daily. Daily logs/Sessions are the *process* that builds it.
- **Remove the causal claim** that grit "moves the mirror" (untether — no arrow to the ID Score).
- Kept: "Italian for grit," the engine framing, the line-to-cross (now a Checkpoint threshold), the tough-love voice.

**Ship this copy:**

> You've put in the reps 9 of the last 14 days. That work is exactly what your next Checkpoint will measure — keep stacking it.
>
> Your ID Score tells you where you are. Your Grinta Index is your grit — the part that keeps you going when motivation runs out. Grinta is Italian for grit, and this is yours. It's the engine of the whole thing.
>
> **Three ways grit shows up**
>
> Grinta is built from three habits of a hardy person. You build them by doing the work; they're scored at your Checkpoints.
> - **Commitment** — you have a reason, and you show up for it.
> - **Control** — you run your life and your choices, instead of them running you.
> - **Challenge** — you move toward the hard, growthful thing on purpose, instead of away from it.
>
> **How it's built, and how it's measured**
>
> Every Session you finish and every day you log is a rep — that's the work that builds grit. You'll feel that daily effort as your own pulse: showing up, and clipping back in after a miss, always counts. A slip you notice and recover from is the muscle working, not a mark against you.
>
> The score itself updates at each Checkpoint — the look-back at the end of every R. Each of the three habits has a level you're building, and a line you're working to cross. Cross it, and you've earned that stretch of grit — sometimes a badge with it. The Checkpoint is where the reps you've banked get counted.
>
> **Grit and the mirror, side by side**
>
> Watch your Grinta and your ID Score move together over time. They're two true pictures of the same comeback — grit is how hard you're working, the ID Score is how reconnected you feel. We don't claim one mechanically drives the other; we just keep both honest, and let you see them rise alongside each other.
>
> It's the slightly tough-love number. It won't pretend you're further along than you are, and it won't let you coast. But it's also the most rewarding one to watch, because it answers to one thing only: the work you put in.
>
> Nobody reclaims themselves by waiting to feel ready. You build the grit; the grit does the work. That's the whole engine.

---

## 3. Journey detail page — copy swap only (Register #16)

**Type:** copy only. **No functional change** — the rings, the reclaimed/moving/to-go tally, and the lit-ring behavior all stay exactly as they are. This is purely a wording change so Reconnect reads as the **north star** (the center = the reclaimed you), consistent with the model and the Field Guide.

**Ship this copy:**

> You're in Rewire — 0 reclaimed, 3 moving, 3 to go.
>
> If the ID Score is the mirror, the Journey is the map — the whole arc of the comeback, and the dot that says you are here.
>
> **How to read it**
>
> The rings are the four movements — Reconnect, Rewire, Rebuild, Reclaim — nested from the outside in. The lit ring is where you're standing right now. At the very center is the reclaimed you — the person on the other side of the work. Beneath the rings, a plain tally of your Reclaim List: what you've already won back, what's moving, and what's still out ahead.
>
> The center is the reclaimed you — the same north star Reconnect helps you see. Reconnect (the outer ring) is where you first glimpse that person and find the spark; Rewire, Rebuild, and Reclaim are how you close the distance to them; Reclaim is living as them, out in the world. So you're moving toward Reconnect's star, not away from it.
>
> **How it fills**
>
> You travel outside-in, toward the center. As you finish a movement, the map fills; as you check things off your Reclaim List, "to go" becomes "moving" becomes "reclaimed." The map is always showing you two true things at once — how far you've come, and how far there is to go.
>
> **Where it sits among the rest**
>
> Each part of your dashboard answers a different question, and the Journey is the zoom-out that ties them together: the mirror (ID Score) — how reconnected you feel right now. The map (Journey) — where you are in the whole arc. The engine (Grinta) — the grit driving you forward. The Reclaim List — the concrete things you're coming back for, which is exactly what the Journey's tally counts.
>
> *How to use it:* come here when you need perspective — when the day-to-day feels small, the map shows the loop is actually turning.
>
> **Orientation and fuel**
>
> It's the "how far have I come, how far to go" view — equal parts orientation and fuel. Seeing the whole map is meant to do two things at once: reassure you that it's finite, and remind you that it's real.
>
> And when you reach the center, the map doesn't end — it re-forms. That's the Loop. That's why it's Grinta for Life.

---

## 4. Field Guide — full refresh

**Type:** copy. **Replaces:** the current Field Guide. Adds **Community**, a stronger "What this is," the Companion-as-the-product framing, and a what-it-is / how-to-use-it for every panel.

**Ship this copy:**

> **What this is**
>
> Somewhere along the way, a gap opened — between who you are right now and who you still are underneath. We call that gap the Fade. It didn't happen all at once. It happened through a hundred reasonable decisions, and most people are the last to notice it.
>
> Grinta for Life is where you close that gap and keep it closed. Not with a quick fix or a streak to chase — with a real practice that rebuilds the parts of you that faded, and the grit to hold the line when life pushes back.
>
> At the center of all of it is your Companion. It's who you talk to — the primary way you use Grinta for Life — and it remembers everything: your onboarding, what's on your dashboard, and every conversation you've had with it. Around the Companion sits a path you move through (the 4Rs) and the proof that you're actually changing (your scores, your Playbook, your Reclaim List). The Companion is how you reach all of it. You set the pace; it keeps the map.
>
> **How the work moves — the 4Rs**
>
> The work runs through four movements, as a loop. You clip back into them again and again, because identity slips and life keeps moving. That's why it's Grinta for Life.
> - **Reconnect** — your north star. See where you are, remember who you were before life talked you out of it, and find the spark worth chasing.
> - **Rewire** — the engine. Take apart the old stories your mind tells to keep you comfortable, and build new ones you can act on.
> - **Rebuild** — the movement. Put it into the body: how you move, eat, sleep, and recover, built back one small decision at a time.
> - **Reclaim** — the life. Go after the things that make you feel like you again, on purpose, out in the world.
>
> Underneath it all is Grinta — the grit you build to drive the work. Reconnect is the star you steer by; Grinta is the engine you keep developing; Rewire, Rebuild, and Reclaim are the gears that move you toward it.
>
> **The pieces, and how to use each**
>
> - **Your Companion** — this is the product, and the primary way you use everything here. It remembers your whole onboarding, knows what's on your dashboard, and carries every interaction you've had with it — so you never start over or re-explain yourself. It sees your Sessions, your scores, your Reclaim goals, your logs, and your Community activity, and brings the right one up at the right moment — a friend's reply, a weight you logged, a Session you're ready for. It talks like a person, not a form. *How to use it:* talk to it. Tap "Talk to me" to start a Session, think something through, set or refine a goal, or just say what's going on. Everything else on this page is something your Companion helps you see and do.
> - **The Program & Sessions** — the path itself, laid out start to finish, so you always know what you're walking into. Each step is a Session — a guided conversation, not a worksheet. *How to use it:* open the next lit Session when you have fifteen or twenty minutes. Do one at a time. Finishing one re-weaves your Playbook and moves you forward.
> - **Checkpoints** — the moment at the end of each R where you look back and we measure what you built. This is where your Grinta score updates. *How to use it:* treat it as a mile-marker, not a test. Answer honestly — a slip you noticed and came back from still counts as building.
> - **Daily Beat** — one thought to carry for the day, a small reframe or nudge tied to where you are. *How to use it:* read it once in the morning. If it lands, hit "Keep this" and it's saved to your Playbook.
> - **ID Score — the mirror** — an honest read on how connected you are to yourself, across four parts of identity: Physical, Self, Social, and Outlook. It comes from the IDQ. *How to use it:* check it to see the shape of where you're strong and where there's room. It updates when you retake the IDQ on schedule — a starting line, not a verdict.
> - **Journey — the path** — the big picture of your reclamation: what you've reclaimed, what's moving, and what's still ahead. *How to use it:* glance at it when you want perspective. It's the zoom-out that shows the loop is actually turning.
> - **Grinta Index — the grit** — your hardiness, the part that keeps you going when motivation fades. It's built from three habits: Commitment (you have a reason and you show up), Control (you run your life, not the other way around), and Challenge (you move toward growth). *How to use it:* don't aim at the number — do the work, and it follows. Your Checkpoints are where it's measured.
> - **Your Reclaim List** — the concrete things you're coming back for — your goals, in your words, with simple logging. *How to use it:* add or refine items just by talking to your Companion. Log progress when you have it. These are what the 4Rs are aiming at.
> - **Your Playbook** — your kept record — the story you're writing as you go, plus the best lines, reframes, and science that hold it up. It deepens every time you close a Session. *How to use it:* reach for it whenever you need a reminder of who you are and what works. Pin what matters, edit or remove what doesn't. Over time it becomes the raw material for your Legacy Letter and Success Story.
> - **Community** — the others doing this work alongside you — a place to share the wins and the hard parts, and keep each other honest. *How to use it:* post a topic, cheer someone on, reply, or start a live room. Post under your name or your handle — your call, every time. Report or block anything that doesn't belong.
> - **Badges** — the receipts — proof, in one place, of the real things you've actually done. *How to use it:* nothing to do but earn them. They mark the stretches of grit worth remembering.
> - **Movement** — a place to connect your activity so the work in Rebuild and Reclaim shows up automatically. *How to use it:* connect it when it's available — for now, log movement in your Reclaim List by hand.
> - **Field Guide** — this page — the map of the whole platform. *How to use it:* come back anytime you're not sure what something is or how to use it.
>
> **A simple rhythm**
>
> There's no wrong way to do this, but if you want a default: read your Daily Beat each morning, do a Session when you've got the time, log your Reclaim items as life happens, drop into Community when you want company, and revisit your Playbook whenever you need to remember who you are. Small and steady wins this.

---

## Do NOT touch (still open — not part of this handoff)

- **The 11 Doors are correct.** Onboarding maps to **11**. Do NOT regress to 8, and do NOT build from the old "G4L Onboarding VoiceRewrite" doc (it lists 8 with a picker — superseded).
- **V4 Rewire/Rebuild asset restructure + linear-vs-two-cycles (Register #15)** — OPEN. Don't reshape the program engine yet.
- **Beat Registry v1.4 audit** — pending #15.
- **Onboarding may orphan the old Reconnect beats (#18)** — open, needs Greg.
- **Naming is provisional** pending Jay's end-to-end branding sweep. Make only the two specific string changes above (#5, #6); no broader rename of panels/features/the Companion.

---

## Voice / framing guardrails (for any copy you touch)

- Use **"associated with," not "causes."** Don't call Midlife Identity Loss itself a measured "epidemic."
- Member-facing surfaces never show grim stats (despair, mortality).
- Recovery-first: a noticed slip counts as building; nothing penalizes the member.
- Tone: warm, direct, declarative; no "it's-not-this-it's-this" constructions.
