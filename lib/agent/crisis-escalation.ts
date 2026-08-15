// ESCALATE TO A HUMAN — the missing half of a hard rule.
//
// The AI Governance Framework says distress signals "route to 988 (US) / locale-appropriate resources, and
// escalate to a human." Our own canonical prohibitions are more specific (governance.ts): "Route to 988 and
// escalate to a human within 24h."
//
// As of 2026-08-07 we did the first half. detectCrisis fired on every surface, the member got 988 immediately —
// and then the turn returned and NOTHING was recorded. No event, no alert, no trace. Nobody ever learned it
// happened, so the 24-hour promise could not have been kept by anyone at any point.
//
// Worse, it looked covered. /admin carries an attention row typed 'crisis', fed by connect_report
// .concern_for_safety — members reporting COMMUNITY CONTENT. Unrelated to someone telling the Companion they
// want to hurt themselves. A gap that reads as handled is more dangerous than an obvious one, because nobody
// goes looking.
//
// WHAT THIS DOES NOT DO. It is not a clinical response and must never be mistaken for one. 988 is the help;
// this is so a human at G4L knows a member is in trouble and can follow up. Jay is that human (his call,
// 2026-08-07), and the channel is email because it is the only out-of-app channel wired today — web push is
// member-side, SMS needs A2P 10DLC registration first.
//
// TWO RULES IT MUST NEVER BREAK:
//   1. IT CANNOT DELAY OR BLOCK THE 988 REPLY. The member gets the resource first, always. Escalation is
//      fire-and-forget after the reply is composed; a mail outage must never cost someone the crisis line.
//   2. IT MUST NEVER FAIL SILENTLY. An unrecorded crisis is precisely the event this exists for, so every
//      failure path logs loudly. (Same shape as the access log; see swallowed-read-renders-as-truth.)

import type { Db } from '../db/schema.ts';
import { sendEmail } from '../email/send.ts';

export type CrisisSurface = 'companion' | 'onboarding' | 'session' | 'idq' | 'community';

/** How long before the same member's distress raises a second alert. A member in crisis may send several
 *  messages in a row; that is one event needing one human, not five emails that train the human to ignore them.
 *  Short enough that a genuinely separate episode tomorrow still alerts. */
const DEDUPE_WINDOW_HOURS = 6;

/** Trim to something an alert can carry without becoming a transcript. The point is "go look", not "read it here". */
function excerptOf(message: string): string {
  const t = (message ?? '').replace(/\s+/g, ' ').trim();
  return t.length > 300 ? `${t.slice(0, 297)}…` : t;
}

// `created_at`, NOT `at` — verified against migration 0028, after writing `at` from memory and watching the
// dedupe silently never fire. Fourth time a column guessed from memory has cost us; check the migration.
async function alreadyAlerted(db: Db, memberId: string): Promise<boolean> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from member_event
      where member_id = $1 and kind = 'crisis_flagged' and created_at > now() - ($2 || ' hours')::interval`,
    [memberId, String(DEDUPE_WINDOW_HOURS)],
  );
  return (rows[0]?.n ?? 0) > 0;
}

/**
 * Record the crisis and alert the human. Returns what happened, so a caller (or a test) can assert on it rather
 * than trusting that it ran.
 *
 * NEVER THROWS. Every path is caught, because this is called from surfaces whose actual job is to hand someone
 * the 988 number.
 */
export async function escalateCrisis(
  db: Db,
  memberId: string,
  opts: { surface: CrisisSurface; message: string },
): Promise<{ recorded: boolean; alerted: boolean; deduped: boolean }> {
  const out = { recorded: false, alerted: false, deduped: false };

  try {
    if (await alreadyAlerted(db, memberId)) out.deduped = true;
  } catch (e) {
    // Can't tell → alert anyway. A duplicate email is a far cheaper mistake than a missed one.
    console.error('crisis dedupe check failed — alerting anyway:', (e as Error).message);
  }

  // RECORD FIRST, and independently of the alert. A keeper-drop earlier this year came from a failing emit
  // aborting the commit beside it inside one shared try; these two are deliberately not each other's hostage.
  try {
    await db.query(
      `insert into member_event (member_id, kind, surface, ref, meta)
       values ($1, 'crisis_flagged', $2, null, $3)`,
      [memberId, opts.surface, JSON.stringify({ excerpt: excerptOf(opts.message) })],
    );
    out.recorded = true;
  } catch (e) {
    console.error(
      `CRISIS NOT RECORDED for member=${memberId} on ${opts.surface} — the member DID get the 988 response:`,
      (e as Error).message,
    );
  }

  if (out.deduped) return out;

  const to = process.env.CRISIS_ALERT_EMAIL?.trim();
  if (!to) {
    console.error(
      `CRISIS ALERT NOT SENT for member=${memberId} on ${opts.surface}: CRISIS_ALERT_EMAIL is unset. ` +
      `The event is recorded and visible in the console, but no one has been notified out of band.`,
    );
    return out;
  }

  try {
    const res = await sendEmail({
      to,
      subject: 'G4L — a member may be in crisis',
      // Deliberately thin on content. The alert says WHO and WHERE TO LOOK; the member's words live behind the
      // console, which is access-logged. An email inbox is not the right home for someone's worst moment.
      text:
        `A member's message tripped the crisis check and they were given the 988 line.\n\n` +
        `Member: ${memberId}\n` +
        `Where: ${opts.surface}\n\n` +
        `Open their record in the console to see the context and decide how to follow up.\n` +
        `Governance commitment: a human follows up within 24 hours.\n`,
    });
    out.alerted = res.ok;
    if (!res.ok) {
      console.error(`CRISIS ALERT FAILED TO SEND for member=${memberId}:`, res.error ?? 'unknown');
    }
  } catch (e) {
    console.error(`CRISIS ALERT THREW for member=${memberId}:`, (e as Error).message);
  }

  // STAMP THE OUTCOME ONTO THE EVENT. Without this, "we recorded a crisis" and "a human was actually told" are
  // indistinguishable after the fact — which is precisely the state we were in on 2026-08-07, when the alert
  // address was never set and the only evidence was a server log nobody reads. Best-effort update: the record
  // already exists, and failing to annotate it must not undo that.
  try {
    await db.query(
      `update member_event set meta = meta || $2::text::jsonb
        where member_id = $1 and kind = 'crisis_flagged'
          and created_at = (select max(created_at) from member_event where member_id = $1 and kind = 'crisis_flagged')`,
      [memberId, JSON.stringify({ alerted: out.alerted })],
    );
  } catch (e) {
    console.error(`could not stamp the alert outcome for member=${memberId}:`, (e as Error).message);
  }

  return out;
}

/**
 * THE SAME RULE, FOR SOMEONE WHO IS NOT A MEMBER YET (2026-08-15).
 *
 * escalateCrisis needs a member_id, and during onboarding there isn't one — the row is created only at the final
 * "This is me" tap. That is the entire reason onboarding was never wired: `CrisisSurface` has listed 'onboarding'
 * since it was written, with nothing behind it. The member-facing half worked the whole time (988 is delivered);
 * it was the human who never got told.
 *
 * This is the surface where that matters most. Someone disclosing that they want to stop existing is most likely
 * to do it in their FIRST conversation, before they have an account — and that was the one conversation with
 * nobody watching.
 *
 * Keyed by EMAIL, because that is the only durable identifier a prospect has. Everything else mirrors
 * escalateCrisis: record first and independently of the alert, dedupe on a 6h window, never throw.
 */
export async function escalateProspectCrisis(
  db: Db,
  email: string,
  opts: { message: string },
): Promise<{ recorded: boolean; alerted: boolean; deduped: boolean }> {
  const out = { recorded: false, alerted: false, deduped: false };
  const addr = (email ?? '').trim().toLowerCase();
  if (!addr) {
    // No address means no row to flag and nothing an operator could act on. Say so rather than returning a
    // clean-looking zero — a silent no-op here is indistinguishable from "nobody was in crisis".
    console.error('PROSPECT CRISIS with no email — the person DID get the 988 response, but nothing was recorded.');
    return out;
  }

  // RECORD + DEDUPE IN ONE STATEMENT. The flag is the dedupe: the update only matches a row that has not been
  // flagged inside the window, so a person sending five messages in a row raises one alert, not five. Doing it
  // as a single conditional UPDATE avoids the read-then-write race that two concurrent turns would otherwise hit.
  try {
    // lower(email), NOT email. saveOnboardingSession stores whatever the member typed at the gate, verbatim,
    // into a case-sensitive `text primary key` — so a person who typed "Donna@Gmail.com" has a row this would
    // never have matched. The failure would have been near-invisible: the flag silently not set, and the
    // "no onboarding_session row exists" branch below firing a misleading error about a different problem.
    const { rows } = await db.query<{ email: string }>(
      `update onboarding_session
          set crisis_flagged_at = now()
        where lower(email) = $1
          and (crisis_flagged_at is null or crisis_flagged_at < now() - ($2 || ' hours')::interval)
        returning email`,
      [addr, String(DEDUPE_WINDOW_HOURS)],
    );
    if (rows.length) out.recorded = true;
    else {
      // Either already flagged inside the window (dedupe — fine) or there is no session row at all (NOT fine:
      // it means the turn that detected this never saved, and an operator has nothing to open).
      const { rows: exists } = await db.query<{ n: number }>(
        'select count(*)::int as n from onboarding_session where lower(email) = $1',
        [addr],
      );
      if (exists[0]?.n) out.deduped = true;
      else console.error(`PROSPECT CRISIS for ${addr} but no onboarding_session row exists — nothing to open.`);
    }
  } catch (e) {
    console.error(`PROSPECT CRISIS NOT RECORDED for ${addr} — they DID get the 988 response:`, (e as Error).message);
  }

  if (out.deduped) return out;

  const to = process.env.CRISIS_ALERT_EMAIL?.trim();
  if (!to) {
    console.error(
      `PROSPECT CRISIS ALERT NOT SENT for ${addr}: CRISIS_ALERT_EMAIL is unset. The session is flagged, but ` +
      `no one has been notified out of band.`,
    );
    return out;
  }

  try {
    const res = await sendEmail({
      to,
      subject: 'G4L — someone in onboarding may be in crisis',
      // Same restraint as the member alert: who and where to look, not the words themselves. One addition — that
      // this person has NO ACCOUNT — because it changes what the responder can do. There is no dashboard to open
      // and no history to read; the only handle is the email address, and they may never come back.
      text:
        `Someone's message tripped the crisis check DURING ONBOARDING and they were given the 988 line.\n\n` +
        `Email: ${addr}\n` +
        `Where: onboarding — they do NOT have an account yet.\n\n` +
        `Their in-flight session is flagged in the console. They may never return, so this address may be the ` +
        `only way to reach them.\n` +
        `Governance commitment: a human follows up within 24 hours.\n`,
    });
    out.alerted = res.ok;
    if (!res.ok) console.error(`PROSPECT CRISIS ALERT FAILED TO SEND for ${addr}:`, res.error ?? 'unknown');
  } catch (e) {
    console.error(`PROSPECT CRISIS ALERT THREW for ${addr}:`, (e as Error).message);
  }

  return out;
}

/** Is out-of-band crisis alerting actually configured? Surfaced on the console so a missing address is visible
 *  BEFORE it matters, rather than discovered when a real member is in trouble. */
export function crisisAlertingConfigured(): boolean {
  return Boolean(process.env.CRISIS_ALERT_EMAIL?.trim() && process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}
