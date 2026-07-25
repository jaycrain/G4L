import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { latestGrintaReading } from '../../../lib/grinta/survey/store.ts';
import { authorizeMember } from '../../authz.ts';
import type { Db } from '../../../lib/db/schema.ts';
import SubpageShell from '../../dashboard/subpage-shell.tsx';

// "More about your Grinta Index" — the origin, what it measures, and how it grows. Data re-pointed to the SURVEY
// grinta (grinta_reading), NOT the activity register. Copy on the four Phases (GG), no "strand" (cut for
// consistency with the Card + dashboard footer), and the recalibration framing (HH: a Checkpoint dip = a truer
// snapshot, not a step back). The old 3-C (Commitment/Control/Challenge) copy is retired.
const R_RING: Record<string, string> = { reconnect: '#374f63', rewire: '#3b9495', rebuild: '#919536', reclaim: '#ec6233' };
const STRANDS = [
  { key: 'reconnect', label: 'Reconnect' },
  { key: 'rewire', label: 'Rewire' },
  { key: 'rebuild', label: 'Rebuild' },
  { key: 'reclaim', label: 'Reclaim' },
] as const;

export default async function GrintaMorePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const reading = await latestGrintaReading(db, memberId);

  return (
    <SubpageShell memberId={memberId}>
      <div className="hero"><h1>More about your Grinta Index</h1></div>

      {reading && (
        <div className="card metric grinta">
          <div className="score">
            <span className="num">{reading.composite}</span>
            <span className="grinta-scale">/ 5</span>
          </div>
          <div className="dims grinta-strands">
            {STRANDS.map((r) => {
              const v = reading.strands[r.key];
              return (
                <div className="dim" key={r.key}>
                  <span><span className="r-dot" style={{ background: R_RING[r.key] }} />{r.label}</span>
                  <span>{v != null ? `${v} / 5` : '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card sub-copy">
        <h3>Where the name comes from</h3>
        <blockquote className="grinta-origin-quote">
          “Grinta means grit. Never give up. There’s a moment in the race, everybody struggling, but the one with
          more Grinta, keep going… he gonna win.”
          <cite>— Eros Poli, GRINTA!</cite>
        </blockquote>
        <p>
          Grinta is the Italian word for grit — there’s no tidy English translation. It’s what keeps you going when
          every reasonable voice says stop. That’s the whole idea behind this number. Your Grinta isn’t luck or a good
          mood — it’s built, one Phase at a time. Reconnect, Rewire, Rebuild, Reclaim each add to it. Finish a Phase
          and it grows; close the loop and you’ve built something that holds.
        </p>

        <h3>What it measures</h3>
        <p>
          Your Grinta is built from four parts, one for each Phase — Reconnect, Rewire, Rebuild, Reclaim. You get a
          first reading of all four at the start, and each part grows as you finish its Phase.
        </p>

        <h3>How it grows</h3>
        <p>
          It isn’t a daily score and it isn’t a grade. It’s summative — it moves when you complete a Phase’s
          Checkpoint, not day to day. Close the whole loop and you’ve built something that holds. It’s yours alone —
          your own scale, not a curve, not a comparison.
        </p>
        <p>
          Your Grinta won’t only climb. At a Checkpoint you might rate yourself a little lower than before — and that’s
          not a step back. It usually means you’re seeing yourself more clearly than you could at the start. An honest
          read you can build from beats a flattering one you can’t. Over the whole loop the work compounds; a single
          Checkpoint is just a truer snapshot.
        </p>
      </div>
    </SubpageShell>
  );
}
