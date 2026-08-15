import { notFound, redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { reclaimEnabled } from '../../../lib/agent/reclaim.ts';
import { activeQualityDayProfile, profileElements, recentQualityDays } from '../../../lib/reclaim/quality-day-store.ts';
import QualityDayLog from '../quality-day-log.tsx';
import { memberToday } from '../../../lib/time/zone-store.ts';
import type { Db } from '../../../lib/db/schema.ts';

// The Quality-Day daily log surface (Reclaim C3 Step 2). Flag-gated (RECLAIM). Shows the member's Quality-Day elements
// (from their coach-defined profile) + a tap-to-log for today. Drift-hardened (degrades if 0055/profile absent).
export default async function QualityDayPage({ params }: { params: Promise<{ memberId: string }> }) {
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
  const todayEntry = today ? (recent.find((r) => r.loggedOn === today) ?? null) : null;

  return (
    <>
      <div className="hero"><h1>Quality Days</h1></div>
      <div className="card">
        <p className="card-subtitle">
          Defining what makes a day yours — and noticing it, one day at a time.{avg != null ? ` This week so far: ${avg} / 10 across ${recent.length} day${recent.length === 1 ? '' : 's'}.` : ''}
        </p>
        {profile ? (
          <QualityDayLog memberId={memberId} elements={elements} today={todayEntry} />
        ) : (
          <p className="card-subtitle">Define your Quality Day first — it starts in the C3 session.</p>
        )}
      </div>
    </>
  );
}
