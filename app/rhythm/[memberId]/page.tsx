import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { currentMemberId } from '../../auth.ts';
import { mobileEnabled } from '../../../lib/dashboard/redesign.ts';
import { outreachEnabled } from '../../../lib/outreach/config.ts';
import { getPref } from '../../../lib/outreach/store.ts';
import { loadContext } from '../../../lib/outreach/context.ts';
import RhythmSetting from '../rhythm-setting.tsx';
import type { Db } from '../../../lib/db/schema.ts';

export const metadata = { title: 'Setting our rhythm — Grinta for Life' };

// The guided rhythm-setting beat (Decision EEE). Gated by MOBILE + OUTREACH; acts on the logged-in member only.
export default async function RhythmPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const me = await currentMemberId();
  if (!me || me !== memberId) redirect('/login');
  if (!(mobileEnabled() && outreachEnabled())) redirect(`/dashboard/${memberId}`);
  const db = (await getDb()) as unknown as Db;
  const [ctx, pref] = await Promise.all([loadContext(db, memberId).catch(() => null), getPref(db, memberId).catch(() => null)]);
  return <RhythmSetting memberId={memberId} currentPhase={ctx?.phase ?? 'reconnect'} initialRhythm={pref?.rhythm ?? 'few_week'} />;
}
