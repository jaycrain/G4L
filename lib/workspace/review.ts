// Redesign — the read-only REVIEW index. A member (esp. across Cycles later) wants to revisit completed sessions to
// see their final state. This lists the member's COMPLETED sessions as reviewable workspace keys, driven by the
// forecast's done items and mapped to the redesign session model (so Reconnect's granular Atlas assets collapse to one
// 'reconnect'). Pure + testable. Checkpoints are excluded — they're a Grinta measurement, not a kept artifact to revisit.

import { keyFromForecast, type SessionKey } from './session-key.ts';
import { sessionById, type Phase } from './session-registry.ts';
import type { Forecast } from '../curriculum/view.ts';

export type ReviewSession = { key: SessionKey; label: string; phase: Phase };

export function completedReviewSessions(forecast: Forecast): ReviewSession[] {
  const seen = new Set<string>();
  const out: ReviewSession[] = [];
  for (const p of forecast.phases) {
    for (const it of p.items) {
      if (it.state !== 'done' || it.kind !== 'session') continue;
      const key = keyFromForecast(p.phase, { id: it.id, route: it.route, kind: it.kind });
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: sessionById(key)?.label ?? it.title, phase: p.phase as Phase });
    }
  }
  return out;
}
