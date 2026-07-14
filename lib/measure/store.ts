// Measures — a number a member watches move over time (weight, weekly miles, resting HR, savings).
// Framework-free (takes a Db). A measure can link to a Reclaim item; it tracks movement from a
// starting value toward a target. The Member Agent creates measures and logs readings; the dashboard
// renders them. Measures never touch the ID Score or GRINTA! Index — their own surface.
import type { Db } from '../db/schema.ts';

export type MeasureDirection = 'down' | 'up';

export type MeasureReading = { value: number; notedOn: string }; // notedOn = YYYY-MM-DD

export type MeasureView = {
  id: string;
  reclaimItemId: string | null;
  label: string;
  unit: string;
  direction: MeasureDirection;
  startValue: number | null; // explicit baseline, else first reading
  targetValue: number | null;
  latestValue: number | null; // most recent reading, else startValue
  latestOn: string | null;
  readings: MeasureReading[]; // oldest → newest, recent slice (for the trend line)
  count: number; // total readings logged
  progressPct: number | null; // 0..100 toward target (null if not computable)
  atTarget: boolean;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const isDir = (d: unknown): d is MeasureDirection => d === 'down' || d === 'up';

// Deterministic "does this goal have a measurable target?" backstop for the proactive tracker offer
// (the agent adds nuance; this catches the obvious numeric/target goals — same belt-and-suspenders as
// the categorizer and the vague-item guard). Tuned to avoid bare dates ("(June 28)") and name lists.
const TRACKABLE_PATTERNS: RegExp[] = [
  /\$\s?\d/, // currency: $250, $10k
  /\d[\d,.]*\s?%/, // percent: 20%
  /\b(?:to|under|over|below|above|reach|hit)\s+\$?\d/i, // "down to 190", "under 200"
  /\b\d[\d,.]*\s?\+?\s?(?:lbs?|kg|kgs|miles?|mi|km|bpm|reps?|hrs?|hours?|min|mins?|minutes?|words?|steps?|k)\b/i, // 115 miles, 10k
  /\b\d[\d,.]*\s?\+/, // 115+
];

/** True when a goal's wording carries a measurable target worth offering a tracker for. */
export function looksTrackable(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  return TRACKABLE_PATTERNS.some((re) => re.test(t));
}

export type TrackerSuggestion = {
  label: string;
  unit: string;
  direction: MeasureDirection;
  target: number | null;
  delta: number | null; // a "lose/gain N" amount — the finish line is current ∓ delta, derived once Current is entered
  accumulation: boolean; // a "raise/save toward N" goal — baseline at 0 so the amount logged is progress
};

/** Pre-fill guesses for the "Track this" affordance, parsed from a goal's wording. All editable. */
export function suggestTracker(text: string): TrackerSuggestion {
  const t = (text ?? '').trim();
  const low = t.toLowerCase();

  // DELTA goal: "lose/gain N <weight unit>" — the finish line depends on where they START (target = current ∓ N),
  // so we carry N as `delta` and derive the target from their Current value at entry. This is how people actually
  // track weight, and it's distinct from an ABSOLUTE target ("down to 190", "under 200" — keeps its explicit
  // number) and from an ACCUMULATION goal ("save/raise $N" — counts up from 0).
  // Allow a filler word between the verb and the number — "lose ABOUT 35 lbs", "losing AROUND 35 lbs" — which
  // members write naturally and which otherwise defeats the delta match (dropping it to an absolute target of N).
  const deltaM = low.match(/\b(lose|losing|lost|drop|dropping|shed|shedding|cut|cutting|gain|gaining|gained|add|put on)\s+(?:about|around|roughly|approximately|approx|some|~)?\s*([\d,.]+)\s*(?:lbs?|kg|kgs|pounds?)\b/);
  const absoluteCue = /\b(?:to|under|below|above|over|reach|hit|down to)\s+\$?\d/.test(low) || /\$/.test(t);
  let delta: number | null = deltaM && !absoluteCue ? parseFloat(deltaM[2]!.replace(/,/g, '')) : null;
  if (delta != null && !Number.isFinite(delta)) delta = null;

  // target: absolute only ($ amount → "to/under/…" N → N% → N+ → N <unit>). A delta goal has NO absolute target
  // yet — it's derived from Current at entry, so we leave it null here.
  let target: number | null = null;
  if (delta == null) {
    let m = low.match(/\$\s?([\d,.]+)\s?(k|m)?/);
    if (m) {
      let n = parseFloat(m[1]!.replace(/,/g, ''));
      if (/k/.test(m[2] ?? '')) n *= 1000;
      if (/m/.test(m[2] ?? '')) n *= 1_000_000;
      target = n;
    } else if ((m = low.match(/\b(?:to|under|below|above|over|reach|hit)\s+([\d,.]+)/))) {
      target = parseFloat(m[1]!.replace(/,/g, ''));
    } else if ((m = low.match(/([\d,.]+)\s?%/))) {
      target = parseFloat(m[1]!);
    } else if ((m = low.match(/([\d,.]+)\s?\+/))) {
      target = parseFloat(m[1]!.replace(/,/g, ''));
    } else if ((m = low.match(/\b([\d,.]+)\s?(?:lbs?|kg|miles?|mi|km|bpm)\b/))) {
      target = parseFloat(m[1]!.replace(/,/g, ''));
    }
    if (target != null && !Number.isFinite(target)) target = null;
  }

  const unit = /\$/.test(t)
    ? '$'
    : /%/.test(t)
      ? '%'
      : /\b(?:lbs?|pounds?|weight)\b/.test(low)
        ? 'lbs'
        : /\b(?:miles?|mi)\b/.test(low)
          ? 'mi'
          : /\b(?:bpm|heart rate)\b/.test(low)
            ? 'bpm'
            : '';

  // direction: lower-is-better cues vs higher-is-better cues; sensible defaults by topic
  const downCues = /\b(?:lose|losing|lost|drop|dropping|shed|shedding|down to|under|below|cut|cutting|reduce|reducing|lower)\b/.test(low) || /\bweight\b/.test(low);
  const upCues = /\b(?:raise|save|saving|reach|up to|grow|increase|more|hit|\+)\b/.test(low) || /\b(?:miles?|mi)\b/.test(low);
  let direction: MeasureDirection = downCues && !/\braise\b/.test(low) ? 'down' : upCues ? 'up' : 'up';
  // A delta goal's direction is unambiguous from its verb — gain/add = up, lose/drop/shed/cut = down.
  if (delta != null) direction = /\b(?:gain|gaining|gained|add|put on)\b/.test(low) ? 'up' : 'down';

  const label = /\b(?:weight|lbs?|pounds?|kgs?)\b/.test(low) // a weight goal is "Weight" even when phrased "lose 30 lbs"
    ? 'Weight'
    : /\b(?:raise|fundrais|\$\s?\d)/.test(low) && /\b(?:raise|fund)/.test(low)
      ? 'Funds raised'
      : /\b(?:saving|retirement)\b/.test(low)
        ? 'Savings'
        : /\bmiles?\b/.test(low)
          ? 'Weekly miles'
          : /\b(?:bpm|heart rate)\b/.test(low)
            ? 'Resting HR'
            // Fallback = the opening words, but strip a goal PREAMBLE first so the label is never "I'd like to" /
            // "I want to" (the bug from "I'd like to lose 30 lbs" — the preamble became the tracker name).
            : (t.replace(/^\s*(?:i'?d (?:like|love|want) to|i (?:want|wish|hope|need|plan|intend|aim|would like) to|i'?m (?:trying|hoping|planning|working) to|(?:get|getting) back to|start(?:ing)? to|let'?s)\s+/i, '').trim() || t)
                .split(/\s+/)
                .slice(0, 3)
                .join(' ');

  // Accumulation goals (raise/save a dollar amount toward a target) start at 0, so any amount logged
  // reads as progress — unlike a rate/level goal (weight, weekly miles) where the first entry IS the baseline.
  // Accumulation is reserved for money goals (save/raise $N); a "gain N lbs" delta is a LEVEL goal, not 0→N.
  const accumulation = delta == null && direction === 'up' && (/\$/.test(t) || /\b(?:raise|save|saving|savings|fundrais|retirement)\b/.test(low));

  return { label, unit, direction, target, delta, accumulation };
}

/** Resolve a reclaim item the member references, by exact-ish text match. Returns its id or null. */
export async function findReclaimItemId(db: Db, memberId: string, ref: string): Promise<string | null> {
  const want = norm(ref);
  if (!want) return null;
  const { rows } = await db.query<{ id: string; text: string }>(
    'select id, text from reclaim_item where member_id=$1 and removed_at is null',
    [memberId],
  );
  // exact, then contains-either-way (a short ref like "weight" matches "Weight down to 190 …")
  const exact = rows.find((r) => norm(r.text) === want);
  if (exact) return exact.id;
  const part = rows.find((r) => norm(r.text).includes(want) || want.includes(norm(r.text)));
  return part?.id ?? null;
}

/** Find a measure by label (case-insensitive contains). */
async function matchMeasure(db: Db, memberId: string, ref: string): Promise<{ id: string; label: string } | null> {
  const want = norm(ref);
  if (!want) return null;
  const { rows } = await db.query<{ id: string; label: string }>(
    'select id, label from measure where member_id=$1 and archived_at is null',
    [memberId],
  );
  const exact = rows.find((r) => norm(r.label) === want);
  if (exact) return exact;
  const part = rows.find((r) => norm(r.label).includes(want) || want.includes(norm(r.label)));
  return part ?? null;
}

// Guard the unit against a leading quantity leaking in ("35lbs", "35 lbs" → "lbs") — the agent's create_measure
// sometimes hands the whole "35 lbs" phrase as the unit, which then renders as "222 35lbs" on the card.
function cleanUnit(unit: string | undefined): string {
  return (unit ?? '').trim().replace(/^[\d.,]+\s*/, '').trim();
}

export type CreateMeasureInput = {
  label: string;
  unit?: string;
  direction?: MeasureDirection;
  startValue?: number | null;
  targetValue?: number | null;
  reclaimItemId?: string | null;
};

export async function createMeasure(
  db: Db,
  memberId: string,
  input: CreateMeasureInput,
): Promise<{ ok: true; id: string; label: string } | { ok: false; reason: 'no_label' | 'duplicate' }> {
  const label = (input.label ?? '').trim();
  if (!label) return { ok: false, reason: 'no_label' };
  // dedupe by label
  const existing = await matchMeasure(db, memberId, label);
  if (existing && norm(existing.label) === norm(label)) return { ok: false, reason: 'duplicate' };
  const direction = isDir(input.direction) ? input.direction : 'down';
  const { rows } = await db.query<{ id: string }>(
    `insert into measure (member_id, reclaim_item_id, label, unit, direction, start_value, target_value)
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [
      memberId,
      input.reclaimItemId ?? null,
      label,
      cleanUnit(input.unit),
      direction,
      input.startValue ?? null,
      input.targetValue ?? null,
    ],
  );
  return { ok: true, id: rows[0]!.id, label };
}

/** Log a reading (upsert per day). measureRef is a label; resolves to the measure. */
export async function logReadingByLabel(
  db: Db,
  memberId: string,
  measureRef: string,
  value: number,
  notedOn?: string,
): Promise<{ ok: true; label: string; value: number } | { ok: false; reason: 'nomatch' | 'bad_value' }> {
  if (!Number.isFinite(value)) return { ok: false, reason: 'bad_value' };
  const m = await matchMeasure(db, memberId, measureRef);
  if (!m) return { ok: false, reason: 'nomatch' };
  await upsertReading(db, memberId, m.id, value, notedOn);
  return { ok: true, label: m.label, value };
}

/** Log a reading by measure id (the manual dashboard input). */
export async function logReadingById(
  db: Db,
  memberId: string,
  measureId: string,
  value: number,
  notedOn?: string,
): Promise<{ ok: true } | { ok: false; reason: 'nomatch' | 'bad_value' }> {
  if (!Number.isFinite(value)) return { ok: false, reason: 'bad_value' };
  const { rows } = await db.query<{ id: string }>(
    'select id from measure where id=$1 and member_id=$2 and archived_at is null',
    [measureId, memberId],
  );
  if (!rows.length) return { ok: false, reason: 'nomatch' };
  await upsertReading(db, memberId, measureId, value, notedOn);
  return { ok: true };
}

async function upsertReading(db: Db, memberId: string, measureId: string, value: number, notedOn?: string) {
  const day = notedOn && /^\d{4}-\d{2}-\d{2}$/.test(notedOn) ? notedOn : null;
  await db.query(
    `insert into measure_reading (measure_id, member_id, value, noted_on)
     values ($1,$2,$3, coalesce($4::date, current_date))
     on conflict (measure_id, noted_on) do update set value = excluded.value, created_at = now()`,
    [measureId, memberId, value, day],
  );
}

const RECENT = 12;

function computeView(row: any, readings: MeasureReading[]): MeasureView {
  const first = readings.length ? readings[0]! : null;
  const last = readings.length ? readings[readings.length - 1]! : null;
  const start = row.start_value != null ? Number(row.start_value) : first ? first.value : null;
  const latest = last ? last.value : start;
  const target = row.target_value != null ? Number(row.target_value) : null;
  const direction: MeasureDirection = row.direction === 'up' ? 'up' : 'down';

  let progressPct: number | null = null;
  let atTarget = false;
  if (target != null && start != null && latest != null) {
    const span = direction === 'down' ? start - target : target - start;
    const moved = direction === 'down' ? start - latest : latest - start;
    progressPct = span > 0 ? Math.max(0, Math.min(100, Math.round((moved / span) * 100))) : null;
    atTarget = direction === 'down' ? latest <= target : latest >= target;
  }
  return {
    id: row.id,
    reclaimItemId: row.reclaim_item_id ?? null,
    label: row.label,
    unit: row.unit ?? '',
    direction,
    startValue: start,
    targetValue: target,
    latestValue: latest,
    latestOn: last ? last.notedOn : null,
    readings,
    count: readings.length,
    progressPct,
    atTarget,
  };
}

/** All active measures for a member, each with a recent slice of readings (oldest→newest). Degrades to [] if the
 *  measure/measure_reading tables aren't present (migration 0020 unapplied) — a drifted DB never crashes the page. */
export async function listMeasures(db: Db, memberId: string): Promise<MeasureView[]> {
  try {
    const { rows } = await db.query<any>(
      `select id, reclaim_item_id, label, unit, direction, start_value, target_value
       from measure where member_id=$1 and archived_at is null order by created_at`,
      [memberId],
    );
    const out: MeasureView[] = [];
    for (const row of rows) {
      const r = await db.query<{ value: string; noted_on: string }>(
        `select value, to_char(noted_on,'YYYY-MM-DD') as noted_on from measure_reading
         where measure_id=$1 order by noted_on desc limit $2`,
        [row.id, RECENT],
      );
      const readings = r.rows.map((x) => ({ value: Number(x.value), notedOn: x.noted_on })).reverse(); // oldest→newest
      out.push(computeView(row, readings));
    }
    return out;
  } catch (e) {
    console.warn('listMeasures failed — measure tables missing / migration 0020 unapplied?', (e as Error).message);
    return [];
  }
}

/** True when a measure has moved in its desired direction (or hit target) — i.e. real movement. */
export function measureMoving(m: MeasureView): boolean {
  if (m.atTarget) return true;
  if (m.startValue == null || m.latestValue == null) return false;
  return m.direction === 'down' ? m.latestValue < m.startValue : m.latestValue > m.startValue;
}

/** Compact, text-friendly view for the Member Agent's context. */
export async function measuresForAgent(
  db: Db,
  memberId: string,
): Promise<Array<{ label: string; unit: string; start: number | null; latest: number | null; target: number | null; lastOn: string | null; atTarget: boolean; count: number }>> {
  const views = await listMeasures(db, memberId);
  return views.map((v) => ({
    label: v.label,
    unit: v.unit,
    start: v.startValue,
    latest: v.latestValue,
    target: v.targetValue,
    lastOn: v.latestOn,
    atTarget: v.atTarget,
    count: v.count,
  }));
}
