import type { Db } from './schema.ts';

/**
 * A WRITE THAT MUST NEVER FAIL THE MEMBER'S SAVE.
 *
 * Found the hard way on 2026-08-12. Migration 0076 adds a `source` column recording which route a member took to
 * log a day — telemetry, not their record. The code shipped with `source` inside the INSERT, and prod applies
 * migrations by hand, so between the deploy and the paste there was a window where every Quality Day log threw
 * "column source does not exist" and told the member "Could not log — please try again." A metric took down a
 * feature that had been working for weeks.
 *
 * THE RULE: a member's record is written by one statement that knows nothing about telemetry, and the telemetry is
 * tagged on afterwards, best-effort. Then a column that does not exist yet, a permission that has not been granted,
 * or a schema that has drifted costs us a measurement and costs the member nothing.
 *
 * This also removes the deploy-ordering trap entirely. Additive columns can now ship before their migration lands
 * rather than after, which is the safer order anyway — the alternative is a coordination step nobody remembers at
 * 3am. LOGGED, never silent: a measurement that quietly stops being taken is how you learn about it a month late.
 */
export async function tagBestEffort(db: Db, label: string, sql: string, params: unknown[]): Promise<void> {
  try {
    await db.query(sql, params);
  } catch (e) {
    console.error(`${label} — telemetry tag skipped (non-fatal):`, (e as Error).message);
  }
}
