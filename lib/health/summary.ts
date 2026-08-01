// What the health history MEANS — pure, so the judgement calls are testable without a database.
//
// The page could just list 600 probe results, but nobody reads that. The two questions an operator has are
// "has it been reliable?" and "when wasn't it?", and both are derived, not stored.

import type { HealthEvent } from './store.ts';

export type Incident = {
  status: string;        // what it went to
  detail: string | null; // why, if the probe said
  from: string;          // ISO — first bad probe
  to: string | null;     // ISO — first good probe after it; null = still bad at the end of the window
  probes: number;        // how many consecutive bad probes
};

export type HealthSummary = {
  probes: number;
  okPct: number | null;   // null when there is nothing to divide by — never 0, which reads as "totally down"
  medianLatencyMs: number | null;
  incidents: Incident[];  // newest first
  since: string | null;   // ISO of the oldest probe in the window
};

const isOk = (s: string) => s === 'ok';

export function summarizeHealth(events: HealthEvent[]): HealthSummary {
  if (events.length === 0) {
    // NOT "100% up". No data is no data — claiming perfect uptime from zero probes is the same lie as an
    // empty feed reading as "nothing happened".
    return { probes: 0, okPct: null, medianLatencyMs: null, incidents: [], since: null };
  }

  const ok = events.filter((e) => isOk(e.status)).length;

  // MEDIAN, not mean: one 30-second timeout would drag an average into fiction while the typical experience
  // was fine. Latency only counts on OK probes — a failed probe's duration measures the failure, not the
  // service.
  const lat = events
    .filter((e) => isOk(e.status) && typeof e.latency_ms === 'number')
    .map((e) => e.latency_ms as number)
    .sort((a, b) => a - b);
  const medianLatencyMs = lat.length ? lat[Math.floor(lat.length / 2)]! : null;

  // Group CONSECUTIVE bad probes into one incident. Ten probes failing over an hour is one outage, not ten —
  // reporting it as ten would make a single bad afternoon look like a collapsing service.
  const incidents: Incident[] = [];
  let open: Incident | null = null;
  for (const e of events) {
    if (!isOk(e.status)) {
      if (open && open.status === e.status) { open.probes++; continue; }
      if (open) { open.to = e.checked_at; incidents.push(open); } // status CHANGED — one ends, another starts
      open = { status: e.status, detail: e.detail, from: e.checked_at, to: null, probes: 1 };
    } else if (open) {
      open.to = e.checked_at;
      incidents.push(open);
      open = null;
    }
  }
  if (open) incidents.push(open); // still bad at the end of the window — `to` stays null, which means ongoing

  return {
    probes: events.length,
    okPct: Math.round((ok / events.length) * 1000) / 10, // one decimal: 99.4% and 100% are different stories
    medianLatencyMs,
    incidents: incidents.reverse(),
    since: events[0]!.checked_at,
  };
}

/** How long an incident lasted, in plain words. Ongoing incidents say so rather than guessing an end. */
export function incidentLength(i: Incident, now: number): string {
  const start = new Date(i.from).getTime();
  const end = i.to ? new Date(i.to).getTime() : now;
  const mins = Math.max(1, Math.round((end - start) / 60000));
  const span = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return i.to ? span : `${span} and counting`;
}
