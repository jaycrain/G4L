'use client';

import type { ReactNode } from 'react';
import { CANVAS_FOR_TYPE, type SessionDef, type SessionType, type CanvasKind } from '../../lib/workspace/session-registry.ts';

// Redesign scaffold (D-05) — the WORKSPACE SHELL skeleton. Structural only: a two-pane container (canvas + persistent
// rail) whose CANVAS is dispatched by the current segment's type, straight off the registry. This proves the thesis —
// "a session is its ordered segments; the canvas swaps per segment" — as real composition. Visual polish + copy are
// Scott's/the build's layer; here it's markup + data hooks + the dispatch. Dormant: not routed, not imported by any
// live surface, so it can't touch prod. The `rail` is passed in (the same Companion conversation surface, per D-01).

// One skeleton canvas per kind. The comment on each names the EXISTING component that drops in when this is built.
function Canvas({ kind }: { kind: CanvasKind }) {
  const common = 'ws-canvas';
  switch (kind) {
    case 'authored': // A — the draw-out artifact builds live in the member's words
      return <div className={`${common} ws-authored`} data-canvas="authored" />;
    case 'gauge': // B — administered: <ScaleChips> + a filling gauge → result reveal
      return <div className={`${common} ws-gauge`} data-canvas="gauge" />;
    case 'log': // C — week-long practice: the practice_week multi-day log
      return <div className={`${common} ws-log`} data-canvas="log" />;
    case 'inferred': // D — routing: the identified result (the Doors) assembles
      return <div className={`${common} ws-inferred`} data-canvas="inferred" />;
    case 'reveal': // E — ceremony: <CeremonySurface> reveal
      return <div className={`${common} ws-reveal`} data-canvas="reveal" />;
    case 'plan': // F — coach: the plan assembles toward its completeness contract
      return <div className={`${common} ws-plan`} data-canvas="plan" />;
  }
}

export default function WorkspaceShell({
  session,
  segmentIndex = 0,
  rail,
}: {
  session: SessionDef;
  segmentIndex?: number; // which segment of the session is active (the shell walks session.segments)
  rail: ReactNode; // the persistent Companion conversation (D-01) — passed in, one surface everywhere
}) {
  const type: SessionType = session.segments[segmentIndex] ?? session.segments[0]!;
  const kind = CANVAS_FOR_TYPE[type];
  return (
    <div className="workspace-shell" data-session={session.id} data-segment={segmentIndex} data-type={type}>
      {/* Canvas pane: slim wayfinding header (ring + phase · session · progress + "Full route →") over the artifact. */}
      <main className="ws-canvas-pane">
        <header className="ws-wayfinding" aria-label={`${session.label} — step ${segmentIndex + 1} of ${session.segments.length}`} />
        <Canvas kind={kind} />
      </main>
      {/* The persistent rail runs the session as a guided conversation — no page navigation between segments. */}
      <aside className="ws-rail">{rail}</aside>
    </div>
  );
}
