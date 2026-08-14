// First-arrival THRESHOLD ceremony + POST-CEREMONY TOUR data — lifted out of redesign-dashboard so the triptych path can
// render the same first-run experience (the triptych returns early from page.tsx, so without this a brand-new member,
// fresh off onboarding, would land with no ceremony and no tour). Server-only; the triptych page renders <Threshold> /
// <PostCeremonyTour> from this. Mirrors redesign-dashboard's inline computation exactly.

import type { Db } from '../db/schema.ts';
import type { Dashboard } from '../gateway/flow.ts';
import type { ThresholdData } from '../ceremony/threshold-beats.ts';
import { getForecast } from '../curriculum/view.ts';
import { listPlaybook } from '../playbook/store.ts';

export type CeremonyTour = {
  thresholdCrossed: boolean;
  tourCompleted: boolean;
  doorsLine: string;
  nextSessionTitle: string | null;
  thresholdData: ThresholdData;
};

export async function ceremonyTourData(db: Db, memberId: string, dash: Dashboard): Promise<CeremonyTour> {
  const doorNames = dash.doors.map((d) => d.displayName);
  const pf = (
    await db.query<{ threshold_crossed_at: unknown; tour_completed_at: unknown }>(
      'select threshold_crossed_at, tour_completed_at from member_profile where member_id=$1',
      [memberId],
    )
  ).rows[0];
  const thresholdCrossed = !!pf?.threshold_crossed_at;
  const tourCompleted = !!pf?.tour_completed_at;
  const namedDoors =
    doorNames.length <= 1 ? doorNames[0] ?? '' : `${doorNames.slice(0, -1).join(', ')} and ${doorNames[doorNames.length - 1]}`;
  const doorsLine = doorNames.length
    ? `Your Door${doorNames.length > 1 ? 's' : ''} — how the gap opened. You named ${namedDoors}.`
    : 'Your Doors — how the gap opened, in your own words.';
  // Seeds feed the ceremony only (skip the read once the threshold is crossed).
  const playbookSeeds = thresholdCrossed
    ? []
    : (await listPlaybook(db, memberId)).filter((e) => e.authorship === 'gathered').slice(0, 3).map((e) => e.body);
  const forecast = await getForecast(db, memberId);

  return {
    thresholdCrossed,
    tourCompleted,
    doorsLine,
    nextSessionTitle: forecast.current?.openable ? forecast.current.title : null,
    thresholdData: {
      identityNoun: dash.identityNoun,
      doors: doorNames,
      reclaimItems: dash.reclaimList,
      idScore: dash.score?.score ?? null,
      dimensions: dash.score?.dimensions ?? null,
      seeds: playbookSeeds,
      firstMoveTitle: null,
    },
  };
}
