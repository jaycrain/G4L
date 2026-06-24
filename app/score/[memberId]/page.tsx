import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { getDashboard } from '../../../lib/gateway/flow.ts';
import { authorizeMember } from '../../authz.ts';
import IdqRadar from '../../dashboard/idq-radar.tsx';
import type { Db } from '../../../lib/db/schema.ts';

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
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
      </div>
      <div className="hero"><h1>More about your ID Score</h1></div>
      <div className="card sub-copy">
        {dash?.score && (
          <p className="sub-personal">Your ID Score right now is <strong>{Math.round(dash.score.score)}</strong>. {dash.score.context}</p>
        )}
        <p>Your ID Score is the mirror — and like any mirror, it won’t flatter you and it won’t lie. It’s a single 0–100 read of how close you are to the person you’re reclaiming, drawn from four corners of a life.</p>

        <h3>The shape of you</h3>
        <p>Identity isn’t one number — it’s a shape. Your score is built from four dimensions, and seeing them together shows you where you’re whole and where the distance runs widest.</p>

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
                {d.label}
                {dims && <span className="dim-val"> {dims[d.key]}<span className="dim-max">/30</span></span>}
              </dt>
              <dd>{d.reads}</dd>
            </div>
          ))}
        </dl>

        <p>Each is scored out of 30. Together they make the 0–100 number at the top (for example, 74 out of a possible 120 reads as 62). The big number is the whole picture; the four beneath it are the map — and a low one isn’t a failing grade, it’s a sign of where the work will pay off most.</p>
        <p className="muted"><em>How to use it:</em> when one dimension sits low, ask your Companion what to do about it — it’ll point you toward the Sessions and goals that move that corner.</p>

        <h3>Why it moves slowly</h3>
        <p>It comes from the IDQ — twenty-four questions you answer about every 60 days. That pace is on purpose. Who you are doesn’t lurch from week to week, so neither should this. The ID Score is built to move slowly, so that when it does move, you know you earned it — real change, not a good night’s sleep.</p>
        <p>So don’t chase it daily; you won’t catch it moving, and that’s the point. Do the reps, and let the next IDQ tell the truth. When the number climbs, that isn’t a better score — it’s more of you, back.</p>

        <h3>The mirror and the grit</h3>
        <p>Your ID Score moves slowly; your Grinta Index moves with the work. Watch them side by side: the grit is how hard you’re working, the mirror is how reconnected you feel. They’re two true pictures of the same comeback — we keep both honest and let you see them rise together.</p>
        <p>Sixty days from now, this number gets to tell a different story. The space in between is where you write it.</p>
      </div>
    </>
  );
}
