// Persistence for the GRINTA survey readings (grinta_reading, migration 0047). Longitudinal: the onboarding
// baseline (sequence_no 0), then the §2e Checkpoint and beyond. Movement is computed vs the prior reading.

import type { Db } from '../../db/schema.ts';
import { writeAsActor } from '../../db/actor.ts';
import { ONBOARDING_BASELINE_ITEMS, type Strand } from './instrument.ts';
import { grintaChangePct, directionOf, type GrintaScore } from './scoring.ts';

export type GrintaReadingInput = {
  source: 'onboarding' | 'checkpoint';
  responses: Record<string, number>; // code → value (self-describing; a Checkpoint recomputes grit from these)
  score: GrintaScore;
};

export type GrintaReadingView = {
  sequenceNo: number;
  source: string;
  composite: number;
  strands: Partial<Record<Strand, number>>;
  changePct: number | null;
  direction: 'up' | 'down' | 'flat' | null;
};

const num = (v: unknown): number | null => (v == null ? null : Number(v));

/** Pair the ordered onboarding responses with their item codes → the self-describing responses map. */
export function baselineResponsesMap(responses: number[]): Record<string, number> {
  const map: Record<string, number> = {};
  ONBOARDING_BASELINE_ITEMS.forEach((code, i) => {
    if (responses[i] != null) map[code] = responses[i]!;
  });
  return map;
}

/**
 * Persist one reading. sequence_no auto-increments per member; change_pct/direction are computed against the
 * prior reading's composite (null on the baseline). Idempotent on (member_id, sequence_no).
 */
export async function persistGrintaReading(db: Db, memberId: string, input: GrintaReadingInput): Promise<void> {
  const prior = await db.query<{ composite: string; sequence_no: number }>(
    `select composite, sequence_no from grinta_reading where member_id = $1 order by sequence_no desc limit 1`,
    [memberId],
  );
  const priorComposite = prior.rows[0] ? num(prior.rows[0].composite) : null;
  // The onboarding baseline is definitionally sequence 0 (exactly one per member — a retried commit lands on the
  // same slot and the conflict-do-nothing makes it idempotent). Every later reading increments from the max.
  const seq = input.source === 'onboarding' ? 0 : (prior.rows[0] ? prior.rows[0].sequence_no + 1 : 1);
  const changePct = grintaChangePct(input.score.composite, priorComposite);
  const direction = changePct == null ? null : directionOf(changePct);
  const s = input.score.strands;

  await writeAsActor(db, 'member', (tx) =>
    tx.query(
      `insert into grinta_reading
         (member_id, source, sequence_no, responses, composite,
          reconnect_score, rewire_score, rebuild_score, reclaim_score, change_pct, direction)
       values ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11)
       on conflict (member_id, sequence_no) do nothing`,
      [
        memberId, input.source, seq, JSON.stringify(input.responses), input.score.composite,
        s.reconnect ?? null, s.rewire ?? null, s.rebuild ?? null, s.reclaim ?? null, changePct, direction,
      ],
    ),
  );
}

/** The most recent reading for the dashboard Grinta card (null if none yet). */
export async function latestGrintaReading(db: Db, memberId: string): Promise<GrintaReadingView | null> {
  const { rows } = await db.query<Record<string, unknown>>(
    `select sequence_no, source, composite, reconnect_score, rewire_score, rebuild_score, reclaim_score,
            change_pct, direction
       from grinta_reading where member_id = $1 order by sequence_no desc limit 1`,
    [memberId],
  );
  const r = rows[0];
  if (!r) return null;
  const strands: Partial<Record<Strand, number>> = {};
  const rc = num(r.reconnect_score); if (rc != null) strands.reconnect = rc;
  const rw = num(r.rewire_score); if (rw != null) strands.rewire = rw;
  const rb = num(r.rebuild_score); if (rb != null) strands.rebuild = rb;
  const rl = num(r.reclaim_score); if (rl != null) strands.reclaim = rl;
  return {
    sequenceNo: r.sequence_no as number,
    source: r.source as string,
    composite: num(r.composite)!,
    strands,
    changePct: num(r.change_pct),
    direction: (r.direction as 'up' | 'down' | 'flat' | null) ?? null,
  };
}
