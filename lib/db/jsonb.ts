// Reading a jsonb column that may have been stored as an OBJECT or as a STRING.
//
// THE SHAPE, and why it exists. We bind jsonb params as `JSON.stringify(x)` with a `$n::jsonb` cast. That cast
// resolves the PARAMETER's type to jsonb, so postgres.js — told the target is jsonb — serialises the value it was
// given, and the value it was given is already a JSON string. It gets encoded a second time and lands as a jsonb
// SCALAR STRING. Local PGlite does not do this, so nothing local can catch it.
//
// Every JS reader survived it, because they all normalise on the way out. What died was every predicate that
// reaches into the column FROM SQL: `payload->>'kind'` on a jsonb string is NULL, so the filter silently matches
// nothing. On 2026-08-11 that made a member's Quality Days tracker vanish — the profile and the week were both in
// the database, `activeQualityDayProfile` filtered on `payload->>'kind'`, got nothing, and the empty grid was
// dropped as "a week with nothing to show". No error, no empty catch, no log.
//
// THE RULE THIS ESTABLISHES: **do not filter or extract jsonb in SQL.** Select the member's rows and decide in JS,
// where readJson normalises both shapes. A member has a handful of these rows, never a scan. The SQL predicate
// buys nothing and can fail in a way that looks exactly like absence.
//
// (The stored shape is being normalised separately — a migration plus the write fix. This is the read side, and it
// stays correct whichever shape a row is in, including the rows written before the fix.)

/**
 * Normalise a jsonb value read from the database into a JS object.
 *
 * Handles: an object (the intended shape), a JSON string (the double-encoded shape), and a doubly-nested string
 * (belt and braces — one more unwrap costs nothing and a third level has never been observed). Returns null on
 * anything that isn't an object at the end, so a caller can never mistake a bare string or a number for a payload.
 */
export function readJson<T = Record<string, unknown>>(value: unknown): T | null {
  let v = value;
  for (let i = 0; i < 3 && typeof v === 'string'; i++) {
    try {
      v = JSON.parse(v);
    } catch {
      return null; // a string that isn't JSON is not a payload — say so rather than guess
    }
  }
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as T) : null;
}

/** The same, for a jsonb column holding an ARRAY. Kept separate so `readJson` can reject arrays outright. */
export function readJsonArray<T = unknown>(value: unknown): T[] {
  let v = value;
  for (let i = 0; i < 3 && typeof v === 'string'; i++) {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? (v as T[]) : [];
}

/** Read a `kind` discriminator out of a payload of either shape. Null when it is absent or not a string. */
export function payloadKind(value: unknown): string | null {
  const p = readJson<{ kind?: unknown }>(value);
  return typeof p?.kind === 'string' ? p.kind : null;
}
