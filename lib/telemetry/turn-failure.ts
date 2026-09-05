// ONE PLACE THAT RECORDS A FAILED CONVERSATIONAL TURN.
//
// All four arcs (reconnect / rewire / rebuild / reclaim) end their turn handler with an identical catch. Until
// 2026-09-03 every one of them was a BARE catch that swallowed the error and returned the generic line; Donna
// hit it three times in Reclaim C1 and nothing anywhere recorded that it had happened. They were then given an
// identical console.error — four copies of one rule, which is the shape that rots. This is that rule hoisted.
//
// WHY IT IS NOT JUST A CONSOLE LINE ANY MORE. Greg's Excavation turn threw on 2026-09-04. The console.error
// fired exactly as designed and was still unfindable the next morning: the workspace canvas polled every five
// seconds, so a single open tab wrote about twelve runtime log lines a minute and pushed his error out of the
// readable window. Being loud is not the same as being findable.
//
// So the failure is written to member_event as well, where it persists and where the member diagnostic already
// looks. Two independent records with different failure modes: the console survives a dead database, the event
// survives time.

import { getDb } from '../db/index.ts';
import { logEvent } from './store.ts';
import type { Db } from '../db/schema.ts';

export type TurnFailure = {
  /** The arc whose handler threw — also the event's surface. */
  arc: 'reconnect' | 'rewire' | 'rebuild' | 'reclaim';
  /** The Session within the arc ('r2', 'w1', …), or the arc name when a turn carries no session. */
  session: string;
  /** The conversational stage the engine was in when it threw — the single most useful field. */
  stage: string;
  /** LENGTH ONLY. Whether size was the trigger is diagnostic; the words are the member's. */
  msgLen: number;
  /** The thrown value, as caught. */
  error: unknown;
};

/** The error's message, trimmed to something a log column can hold without becoming unreadable. */
function describe(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message.slice(0, 300) };
  return { name: 'unknown', message: String(error).slice(0, 300) };
}

/**
 * Record a failed turn. Best-effort and never throws: this runs inside a catch that is already returning an
 * apology to a member, and a failure to RECORD the failure must not become a second one.
 */
export async function recordTurnFailure(memberId: string, f: TurnFailure): Promise<void> {
  const { name, message } = describe(f.error);
  // FIRST, and unconditionally. If the database is what broke, this is the only record that will exist.
  console.error(
    `${f.arc.toUpperCase()} turn FAILED for member=${memberId} session=${f.session} ` +
    `stage=${f.stage} msgLen=${f.msgLen}:`,
    f.error,
  );
  try {
    const db = (await getDb()) as unknown as Db;
    await logEvent(db, memberId, 'turn_failed', {
      surface: f.arc,
      ref: f.session,
      meta: { stage: f.stage, msgLen: f.msgLen, error: message, errorName: name },
    });
  } catch {
    /* the console line above is the fallback — a telemetry write must never mask the real failure */
  }
}
