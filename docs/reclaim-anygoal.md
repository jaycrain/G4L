# Reclaim List — Any Goal (Coached vs Witnessed)

Status: **approved design, pre-build** · Owner: Jay · Drafted with Claude, 2026-06-12
Source: `G4L_Reclaim_List_AnyGoal_Spec_v1.0`.

**Decision:** the Reclaim List holds ANY goal important to the member — not just identity-evidence
markers. Reclaiming the identity is the engine; once a member acts as their true self they run the
table on everything, so the list is the visible proof the thesis pays off across a whole life. Member
experience is unchanged: one list, any goal, all checkable, add/refine by talking to the companion.

## The one change
A fifth, **internal** category `life` alongside the four IDQ dimensions (physical · self · social ·
outlook). Invisible to the member; it only tells the engine whether there's content to coach toward an
item. Life = goals that don't map to a dimension ("raise $250k", "$10k/month into savings"). Never
force-fit a life goal into a dimension.

## Binding rule
- **Identity items** (four dimensions) → goal-Beat binding: actively coached, real goal close, feed
  Journey + Reach as designed.
- **Life items** → tracked & witnessed, never coached: no Beat binds, so no goal close (and no fog
  close) ever fires. They advance by the member telling the companion, never by a Beat. (Reuses the
  vague-item lane: a non-bindable item routes elsewhere instead of producing a goal close.)

## Payoff preserved
Completing ANY item — life or identity — ticks the Journey "reclaimed" counter and feeds Grinta Reach.
The Journey tallies count ALL items. Shaping (specific-and-observable bar) applies to everything —
"raise $250k" is observable; "be more successful" gets sharpened. Only *binding* differs by category.

## Locked decisions (Q1–Q3)
1. **Companion-only marking.** No on-item "mark reclaimed" button (that would leak the category). The
   member tells the companion "I did X" → the MA marks it (with a confirm). Zero new list UI; category
   stays invisible; fits the existing "talk to your companion" affordance.
2. **`life` is agent-inferred (primary).** Onboarding shaping + the MA add tool gain `life` as an
   explicit option the agent picks. The keyword heuristic (`inferCategory`) adds `life` keywords
   (money/raise/fund/savings/revenue/launch/business/$) but **keeps the `self` default** — never
   force-fit, and err toward "coached" when unsure.
3. **Markable for any item on member say-so + confirm.** Life items: the companion's only path. Identity
   items: coached close stays primary, but a member's clear "it's done" is honored (agency). The MA
   never *pushes* identity items to self-mark, never reveals the category, and always confirms before
   marking ("Want me to mark that one reclaimed?").

## Build plan
1. **Data + types** — migration `0019`: extend `reclaim_item.category` check to include `life`; add
   `life` to the `Category` type. `inferCategory` gains `life` keywords (keeps `self` default).
   Apply to prod with `db:migrate` on ship.
2. **Binding** — `bindGoalItem` excludes `life` items (never bind, even to an "any" goal Beat). Helper
   `isCoachedCategory`. Tests.
3. **Agent category = `life`** — onboarding `ONBOARDING_SYSTEM` + `record_progress` enum gain `life`;
   the MA `add_reclaim_item` tool gains an optional agent-set category (falls back to heuristic).
4. **Mark-reclaimed tool** — a new MA tool `mark_reclaim_reclaimed`: matches the named item, sets
   `state='reclaimed'`, feeds Journey (counted by state) + Grinta Reach. Engineering wrinkle: a life
   item has no Beat, so feed Reach via a marker completion that's **excluded from Past Beats** (or
   extend the Reach calc) — confirm the cleanest in code. Confirm-before-mark in the prompt.
5. **MA posture** — system-prompt guidance: coach identity items, witness life items, honor a clear
   "it's done" with a confirm, never reveal categories. (MA context already carries category + state.)
6. Tests + tsc + build; `db:migrate`.

## Reconciliation (CLAUDE.md)
Member-facing (the list), so the MA must know it (it does — category + state in context) and it must
serve the Reclaim List: this makes the list the literal scoreboard of the member's whole life, coached
where we have content and witnessed where we don't.
