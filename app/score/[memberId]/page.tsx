import PanelHeader from '../../components/panel-header.tsx';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { getDashboard } from '../../../lib/gateway/flow.ts';
import { authorizeMember } from '../../authz.ts';
import IdqRadar from '../../dashboard/idq-radar.tsx';
import type { Db } from '../../../lib/db/schema.ts';
import SubpageShell from '../../dashboard/subpage-shell.tsx';

// "More about your ID Score" — the mirror explainer + the identity radar (handoff: Member-Facing
// Refresh 2026-06-24, task #1). The radar is a display of the four PSSO sub-scores already computed;
// the previous IDQ overlays faintly so growth reads as the shape expanding. No scoring change.
const DIM_COPY = [
  { key: 'physical', label: 'Physical', reads: 'Your body, your energy, how you move and feel in it.' },
  { key: 'self', label: 'Self', reads: 'Who you are to yourself — identity, confidence, the inner story.' },
  { key: 'social', label: 'Social', reads: 'Your people — connection, belonging, who’s in your corner.' },
  { key: 'outlook', label: 'Outlook', reads: 'How you see what’s ahead — purpose, hope, the road in front of you.' },
] as const;

export default async function ScoreMorePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const dash = await getDashboard(db, memberId);
  const dims = dash?.score?.dimensions ?? null;

  // The IDQ before the latest → faint overlay so the current shape reads as having grown out from it.
  let prevDims: { physical: number; self: number; social: number; outlook: number } | null = null;
  if (dims) {
    const prev = (
      await db.query<{ physical_score: number; self_score: number; social_score: number; outlook_score: number }>(
        `select physical_score, self_score, social_score, outlook_score
           from idq_retake where member_id=$1 and cycle_indicator=1
           order by sequence_no desc offset 1 limit 1`,
        [memberId],
      )
    ).rows[0];
    if (prev) prevDims = { physical: prev.physical_score, self: prev.self_score, social: prev.social_score, outlook: prev.outlook_score };
  }

  return (
    <SubpageShell memberId={memberId}>
      <PanelHeader k="idScore" />
      <div className="card sub-copy">
        {/* SAY WHEN IT IS EMPTY. This was a bare `&&`, so a member who has not taken the IDQ got the whole page —
            "a 0–100 read", "the shape of you" — describing a number that was not there, with nothing saying so.
            The IDQ is submitted inside Reconnect (submitIdq, sequence_no = 0), so the wording is accurate. */}
        {dash?.score ? (
          <p className="sub-personal">Your ID Score right now is <strong>{Math.round(dash.score.score)}</strong>. {dash.score.context}</p>
        ) : (
          <p className="sub-personal">You don’t have an ID Score yet. Your first one lands when you take the IDQ, in Reconnect.</p>
        )}
        <p>Your ID Score is a 0–100 read of how close you are to the person you’re reclaiming, drawn from four corners of a life.</p>

        <h3>The shape of you</h3>
        {/* The heading used to stand over an empty space: the radar is `{dims && …}` and the dimension values are
            too, so before a first IDQ this section announced a shape and then showed none. */}
        <p>
          Your score is built from four dimensions. Seeing them together shows you where you’re whole and where the
          distance runs widest.{!dims && ' Yours fills in with your first IDQ.'}
        </p>

        {dims && (
          <div className="radar-wrap">
            <IdqRadar current={dims} previous={prevDims} size={300} />
            {prevDims && <p className="radar-legend"><span className="rl-now" /> now · <span className="rl-prev" /> your last IDQ</p>}
          </div>
        )}

        <dl className="dim-legend">
          {DIM_COPY.map((d) => (
            <div key={d.key} className="dim-row">
              <dt>
                <span className="dim-name">{d.label}</span>
                {dims && <span className="dim-val">{dims[d.key]}<span className="dim-max">/30</span></span>}
              </dt>
              <dd>{d.reads}</dd>
            </div>
          ))}
        </dl>

        <p>The big number is the whole picture; the four beneath it are the map. A lower number is a sign of where the work will pay off most.</p>

        <h3>Why it moves slowly</h3>
        <p>Your ID Score comes from taking the IDQ — twenty-four questions you answer about every 60 days. That pace is on purpose. Who you are doesn’t lurch from week to week, so neither should this. The ID Score is built to move slowly, so that when it does move, you know you earned it. It reflects real change, not just a good night’s sleep.</p>
        <p>Do the reps, and let the next IDQ tell the truth. When the number climbs, it’s more of you, back.</p>

        <h3>Closing the distance and the grit</h3>
        <p>Watch your ID Score and Grinta Index side-by-side: the grit is how hard you’re working, the ID Score is how reconnected you feel over time. They’re two true pictures of the same Comeback.</p>
        <p>Sixty days from now, this number will tell a different story. The space in between is where you do the work to get it there.</p>
      </div>
    </SubpageShell>
  );
}
