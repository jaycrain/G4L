# Momentum & the GRINTA! Index

## The principle (Jay, Jun 2026)
Help people make **incremental progress daily** — and **see it move the needle.** Daily effort has
to feel like it's accumulating into the thing that matters, or people quit in the dark between the
slow signals.

This maps onto Greg's science: *focus on the process; the product follows.* First 1,000 Miles
already encodes it ("days active vs. inactive — the ratio matters more than volume").

## The two metrics (process vs. product)
| | ID Score | GRINTA! Index |
|---|---|---|
| What | Who you are — the reclaimed identity | How you're showing up |
| Cadence | Longitudinal, every 60 days (frozen) | **Daily** (rolling 14-day window) |
| Source | Self-reported IDQ (24 items) | Behavioral signals (activity, program, check-ins) |
| Role | The *product* | The *process* that feeds it |

### What GRINTA! is
**GRINTA!** is Jay & Donna's documentary — Italian Tour de France champion **Eros Poli's** solo
breakaway over Mont Ventoux (1994) and his life in midlife today. **Official selection at the Banff
Mountain Film Festival**, screened to thousands; it's the film that named the program ("a film
became a book became a movement"). It's *about* identity, grit, and **hardiness** in midlife — so
the GRINTA! Index is that battle cry made measurable: the needle that **moves daily** as you show up.
(Not the Italian title of *True Grit* — that was my mistake.)

**Greg equates GRINTA! to Hardiness** — a real, *developable* psychological construct (commitment,
control, challenge). The more GRINTA! you build, the more you close the gap on your **Identity**.
Greg will author program content that develops it, and the Index should evolve toward the hardiness
dimensions over time — the v0 consistency formula is a placeholder standing in for that.

It also names the whole arc: **Grinta _for Life_** — there's always another loop, another cycle, and
the work is to keep your Grinta intact through it.

## v0 formula (in `lib/grinta/index.ts` — Greg to refine)
Over a rolling 14-day window, 0–100, consistency-dominant:
- **Consistency (0.60):** distinct days active / 14 (any of: logged activity, an asset step, IDQ, a check-in).
- **Movement (0.25):** workouts logged, capped at 8.
- **Program (0.15):** asset steps/completions, capped at 4.
- **Trend:** this 14-day window vs. the prior one → ↑/↓/→.

Reflective copy, never a grade or a breakable streak (per the voice + governance).

## Hard rule
The GRINTA! Index is a **companion metric** — like the activity panel, it informs the dashboard
and the agent but **never alters the frozen ID Score**.

## Open for Greg / next
- **Map the Index to hardiness** (commitment / control / challenge) as Greg's hardiness content
  lands — evolve it from the v0 consistency proxy toward the developable construct it represents.
- Validate/refine the weights and window; is consistency the right dominant term?
- Should it feed the agent's nudges ("your GRINTA! dipped — what got in the way?") and the
  Founder Agent's milestones?
- A small daily "one step" prompt that feeds the Index (incremental action → visible movement).
