# Measures — a number a member watches move

A **measure** is any number a member wants to watch move over time — weight, weekly
miles, resting heart rate, dollars saved. It renders next to the Reclaim goal it serves
and shows movement from a starting value toward a target.

## Why it exists

The Member Agent used to improvise tracking into a Reclaim item's text ("started at 213.4
on June 12") — there was nowhere structured for the number to go, and it stamped a wrong
year. Measures give that number a real home the agent can write to and reflect on, beside
the goal it belongs to.

## Model (migration 0020)

- **`measure`** — `label`, `unit`, `direction` (`down` = lower is better, `up` = higher is
  better), optional `start_value` (baseline; falls back to the first reading),
  optional `target_value`, optional `reclaim_item_id` (links it beside a goal). Soft-archive
  via `archived_at`. RLS on.
- **`measure_reading`** — one `value` per `noted_on` day per measure (unique index →
  re-logging the same day **upserts**). RLS on.

`lib/measure/store.ts`: `createMeasure`, `logReadingByLabel` (agent), `logReadingById`
(manual card), `listMeasures` (dashboard view with start/latest/target/progress/atTarget +
recent readings), `measuresForAgent` (compact context), `findReclaimItemId` (loose match to
link a measure to the goal a member names).

## Surfaces

- **Member Agent** — tools `create_measure` and `log_reading`. The agent's context lists each
  measure's start → latest → target and whether it's at target, so it reflects on real
  movement. Two logging paths: tell the agent ("I'm 211 today") or the card.
- **Dashboard** — a `MeasureCard` under the linked Reclaim item (current value, → target, a
  recent-trend sparkline, movement-from-start, % to target) with an inline "Log" input.
  Unlinked measures group under "Numbers you're watching."

## Reconciliation (CLAUDE.md)

- **Agent knows it.** Measures are in the agent's context and it owns create/log.
- **Serves the Reclaim List.** A measure is movement toward a goal's target; at target the
  agent may *offer* to mark the linked item reclaimed (hard-confirm rule — never auto-marks;
  the member is the authority).
- **Does not touch the ID Score** (frozen) or the GRINTA! Index. Its own surface.
- **Governance.** The agent reflects movement, never grades/praises/moralizes a number;
  body/health numbers are never made clinical — concerning readings defer to a professional.

## Naming

"track/tracking" is a banned framing term (CLAUDE.md). Member-facing label is **"Numbers
you're watching,"** echoing the IDQ copy ("you know your numbers"). Final naming is the
founder's call — the surface label is easy to change.
