import { notFound, redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { reclaimEnabled } from '../../../lib/agent/reclaim.ts';
import { activeQualityDayProfile, profileElements, recentQualityDays } from '../../../lib/reclaim/quality-day-store.ts';
import QualityDayLog from '../quality-day-log.tsx';
import { memberToday } from '../../../lib/time/zone-store.ts';
import { canLogOn } from '../../../lib/practice/mark.ts';
import type { Db } from '../../../lib/db/schema.ts';

/** "Today" / "Yesterday · Friday, 14 August" — the day being logged, said the way a member would say it.
 *  Built from the date STRING, never a local Date: `new Date('2026-08-14')` is UTC midnight and renders as the
 *  13th for anyone west of Greenwich, which is the exact bug this surface already paid for once. */
function dayLabel(date: string, isToday: boolean): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  const pretty = dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return isToday ? `Today · ${pretty}` : `Yesterday · ${pretty}`;
}

// The Quality-Day daily log surface (Reclaim C3 Step 2). Flag-gated (RECLAIM). Shows the member's Quality-Day elements
// (from their coach-defined profile) + a tap-to-log for today. Drift-hardened (degrades if 0055/profile absent).
export default async function QualityDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ on?: string }>;
}) {
  if (!reclaimEnabled()) notFound();
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const profile = await activeQualityDayProfile(db, memberId).catch(() => null);
  const elements = profile ? profileElements(profile) : [];
  const recent = await recentQualityDays(db, memberId).catch(() => []);
  const avg = recent.length ? Math.round((recent.reduce((s, r) => s + r.score, 0) / recent.length) * 10) / 10 : null;
  // TODAY'S ENTRY, SO THE FORM CAN EDIT IT RATHER THAN REPLACE IT (Jay, 2026-08-15, on his own account).
  //
  // logQualityDay upserts on (member_id, logged_on) and REPLACES `present`. The form always started empty, so a
  // second visit on the same day submitted only the elements ticked that time — and that submission became the
  // whole record, silently erasing the earlier ones. What Jay saw was "only the last box I entered stays
  // checked", which read as a grid bug and was actually data loss.
  //
  // The fix is to make the form an EDITOR of today's record instead of a blank slate. Deliberately NOT a
  // server-side merge of the arrays, which is the tempting one-liner: union-on-write means a member can never
  // UNTICK something logged by mistake, and a tracker you cannot correct is worse than one that forgets.
  const today = await memberToday(db, memberId).catch(() => null);

  // WHICH DAY IS BEING LOGGED. `?on=` comes from a grid cell, so it is member input and gets re-validated here
  // rather than trusted: a well-formed date, and one canLogOn still accepts (today or yesterday — Jay's call,
  // 2026-08-15). Anything else silently falls back to today rather than erroring; a member who edited a URL gets
  // the ordinary page, not a failure, and there is nothing here worth refusing over.
  const { on } = await searchParams;
  const asked = typeof on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : null;
  const logDate = asked && today && canLogOn(asked, today) ? asked : today;
  const entry = logDate ? (recent.find((r) => r.loggedOn === logDate) ?? null) : null;
  const isToday = logDate === today;

  return (
    <>
      {/* THE INTRO MOVED INTO THE HERO (Jay, 2026-08-15, his wording). It used to open the card, welded to the
          week's average in the same sentence — so the line that says what this IS competed with a status readout,
          and neither landed. The subhead states the practice; the stat now sits with the date, where a member
          looks for status. */}
      <div className="hero">
        <h1>Quality Days</h1>
        <p className="hero-sub">Noticing and defining a quality day, one day at a time.</p>
      </div>
      <div className="card">
        {profile ? (
          <>
            <div className="qd-daybar">
              <span className="qd-dayname">{logDate ? dayLabel(logDate, isToday) : 'Today'}</span>
              {avg != null && (
                <span className="qd-weekstat">This week so far · {avg} / 10 across {recent.length} day{recent.length === 1 ? '' : 's'}</span>
              )}
            </div>
            <QualityDayLog memberId={memberId} elements={elements} today={entry} logDate={logDate} isToday={isToday} />
          </>
        ) : (
          <p className="card-subtitle">Define your Quality Day first — it starts in the C3 session.</p>
        )}
      </div>
    </>
  );
}
