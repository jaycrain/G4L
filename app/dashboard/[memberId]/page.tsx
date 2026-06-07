import Link from 'next/link';
import { getDb } from '../../../lib/db/index.ts';
import { getDashboard } from '../../../lib/gateway/flow.ts';
import { completedCodes } from '../../../lib/assets/engine.ts';
import { recommendedNext, assetStatus, ASSET_ORDER, GATES, type AssetStatus } from '../../../lib/assets/gating.ts';
import { ASSET_NAMES } from '../../../lib/assets/definitions.ts';
import type { Db } from '../../../lib/db/schema.ts';
import AgentBubble from '../agent-bubble.tsx';

const STATUS_MARK: Record<AssetStatus, string> = { completed: '✓', available: '→', locked: '·' };

const DIM_LABEL: Record<string, string> = {
  physical: 'Physical',
  self: 'Self',
  social: 'Social',
  outlook: 'Outlook',
};
const ARROW: Record<string, string> = { up: '↑', down: '↓', flat: '→' };

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const db = (await getDb()) as unknown as Db;
  const dash = await getDashboard(db, memberId);

  if (!dash) return <p className="error">We couldn&apos;t find that member.</p>;

  // The program loop: what's done, what's next (dosed by current focus).
  const completed = await completedCodes(db, memberId);
  const gateCtx = { completed, dimensions: dash.score?.dimensions };
  const nextCode = recommendedNext(gateCtx);
  const program = ASSET_ORDER.map((code) => ({
    code,
    name: ASSET_NAMES[code]!,
    group: GATES[code]!.group,
    status: assetStatus(gateCtx, code),
  }));

  // A light, signal-driven teaser for the always-on companion bubble.
  const teaser = !dash.score
    ? 'Ready for your IDQ when you are.'
    : nextCode
      ? `Ready for ${ASSET_NAMES[nextCode]}? Or just want to talk?`
      : 'How are you landing this week?';

  return (
    <>
      <div className="hero">
        <h1>
          {dash.identityNoun ? (
            <>
              Reconnecting: <span className="noun">THE {dash.identityNoun}</span>
            </>
          ) : (
            dash.displayName
          )}
        </h1>
        {dash.identityParagraph && <p>{dash.identityParagraph}</p>}
      </div>

      {/* ID Score — never a bare number: always direction + delta + plain-language context */}
      {dash.score ? (
        <div className="card">
          <h3>Your ID Score</h3>
          <div className="score">
            <span className="num">{dash.score.score}</span>
            {dash.score.direction && (
              <span className={`dir-${dash.score.direction}`}>
                {ARROW[dash.score.direction]}
                {dash.score.delta !== null && dash.score.delta !== 0
                  ? ` ${dash.score.delta > 0 ? '+' : ''}${dash.score.delta}`
                  : ''}
              </span>
            )}
          </div>
          <p className="muted">{dash.score.context}</p>

          <div className="dims" style={{ marginTop: '0.75rem' }}>
            {dash.score.dimensions &&
              (Object.keys(DIM_LABEL) as Array<keyof typeof dash.score.dimensions>).map((k) => (
                <div className="dim" key={k}>
                  <span>{DIM_LABEL[k]}</span>
                  <span>{dash.score!.dimensions[k]} / 30</span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <p className="muted">Your IDQ baseline isn&apos;t in yet.</p>
        </div>
      )}

      {dash.currentFocus && (
        <div className="card">
          <h3>Current focus</h3>
          <span className="focus-chip">{dash.currentFocus.label}</span>
          {nextCode && (
            <p style={{ marginTop: '0.9rem' }}>
              <Link className="btn" href={`/asset/${nextCode}?member=${memberId}`}>
                Start: {ASSET_NAMES[nextCode]}
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="card">
        <h3>Your program</h3>
        <ul className="program">
          {program.map((a) => (
            <li key={a.code} className={`prog ${a.status}`}>
              <span className="mark">{STATUS_MARK[a.status]}</span>
              <span className="pname">{a.name}</span>
              <span className="pgroup">{a.group}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Your Reclaim List</h3>
        <ul className="reclaim">
          {dash.reclaimList.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      {dash.door && (
        <p className="muted">
          Your Door: <strong>{dash.door.displayName}</strong>
        </p>
      )}

      <AgentBubble memberId={memberId} teaser={teaser} />
    </>
  );
}
