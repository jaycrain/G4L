import type { Db } from '../db/schema.ts';
import type { Zone } from './member-clock.ts';

// STORING AND READING THE MEMBER'S ZONE.
//
// Detection is silent, from the browser (Intl.DateTimeFormat().resolvedOptions().timeZone). We do not ask a member
// what timezone they are in — it is a question they should never have to answer for a tracker to record the right
// day, and the browser already knows.
//
// BUT IT IS OVERRIDABLE, on the account page. A detected zone that is wrong — a VPN, a work laptop pinned to head
// office, a fortnight in another country — with no way to correct it is a worse trap than not detecting at all,
// because the member cannot tell that the wrongness is fixable. A manual choice is never overwritten by detection.

/** Anything the browser hands us that Intl does not recognize is discarded rather than stored. */
export function isValidZone(zone: string): boolean {
  if (!zone || zone.length > 64 || !/^[A-Za-z0-9+_\-/]+$/.test(zone)) return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The member's zone, or null when we have not detected one. Drift-hardened: a read hiccup reads as "unknown". */
export async function memberZone(db: Db, memberId: string): Promise<Zone> {
  try {
    const { rows } = await db.query<{ timezone: string | null }>(
      'select timezone from member_profile where member_id = $1',
      [memberId],
    );
    return rows[0]?.timezone ?? null;
  } catch (e) {
    // LOG. A failed read here is indistinguishable from "no zone yet", and both silently fall back to UTC — which
    // is the exact shape that let this whole class of bug live unnoticed.
    console.error(`memberZone read failed for member=${memberId}:`, (e as Error).message);
    return null;
  }
}

/**
 * Record a zone detected by the browser.
 *
 * NEVER OVERWRITES an existing value. If a member set theirs deliberately, a laptop that reports something else
 * next Tuesday must not silently undo that — a setting that changes itself is not a setting.
 */
export async function detectZone(db: Db, memberId: string, zone: string): Promise<void> {
  if (!isValidZone(zone)) return;
  try {
    await db.query(
      'update member_profile set timezone = $2 where member_id = $1 and timezone is null',
      [memberId, zone],
    );
  } catch (e) {
    console.error(`detectZone failed for member=${memberId}:`, (e as Error).message);
  }
}

/**
 * The member choosing, from the account page. This one DOES overwrite — it is the deliberate act.
 *
 * Written as the 'member' actor so the audit trail (migration 0032, which iterates every changed column and so
 * picks `timezone` up for free) records who decided. Detection above deliberately does NOT: it is the system
 * observing a browser, and logging that as the member's own choice would be a small lie in the one record that
 * exists to say who changed what.
 */
export async function setZone(db: Db, memberId: string, zone: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidZone(zone)) return { ok: false, error: 'That is not a timezone we recognize.' };
  try {
    const { writeAsActor } = await import('../db/actor.ts');
    await writeAsActor(db, 'member', (tx) =>
      tx.query('update member_profile set timezone = $2 where member_id = $1', [memberId, zone]),
    );
    return { ok: true };
  } catch (e) {
    console.error(`setZone failed for member=${memberId}:`, (e as Error).message);
    return { ok: false, error: 'Could not save that — please try again.' };
  }
}

/**
 * The member's local calendar date, YYYY-MM-DD. The one call every write and window should make.
 *
 * It costs an indexed single-row read per use. That is the right trade against the alternative — passing a date
 * down through every signature — because the caller most likely to get it wrong is the one furthest from the
 * member, and a date is not the kind of thing a function should be trusted to work out for itself. Twenty-six
 * places doing exactly that is what put a member's Quality Day on the wrong day.
 */
export async function memberToday(db: Db, memberId: string, at: Date = new Date()): Promise<string> {
  const { localDate } = await import('./member-clock.ts');
  return localDate(await memberZone(db, memberId), at);
}
