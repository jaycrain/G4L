// Redesign scaffold (D-05) — the SESSION-TYPE REGISTRY. The code-truth crosswalk from the desktop-redesign handoff:
// every session → its ordered interaction segments → the canvas each renders. The workspace shell dispatches on this:
// a session is its ordered segments; the canvas swaps per segment. Nothing here is wired to a live surface yet — it's the
// dormant foundation the two-pane shell composes over. See the Drive doc "G4L Session-Type Registry (from the code)".
//
// SIX types over THREE engine modes + TWO adjunct surfaces:
//   A draw-out artifact  · B administered instrument · C week-long practice
//   D routing / inferred · E ceremony               · F coach (added 7/13, Jay)
// A & D both run on the `drawout` engine mode (A authors, D infers). B = administeredStage. F = coach mode.
// C = the practice_week scaffold (an adjunct that rides AFTER a session). E = the ceremony surface (non-interactive).

export type SessionType = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

// The canvas is "the work made visible" — its form is fixed per type (Jay's canvas-per-type resolution, 7/13).
export type CanvasKind = 'authored' | 'gauge' | 'log' | 'inferred' | 'reveal' | 'plan';

export const CANVAS_FOR_TYPE: Record<SessionType, CanvasKind> = {
  A: 'authored', // member authors an artifact, builds live
  B: 'gauge', // a rating gauge (chips) fills → result reveal (watch-not-build)
  C: 'log', // a running multi-day log accumulates
  D: 'inferred', // an identified result assembles (the Doors named)
  E: 'reveal', // the earned reveal / stage (watch-not-build)
  F: 'plan', // a plan assembles toward its completeness contract, member-confirmed
};

export const TYPE_LABEL: Record<SessionType, string> = {
  A: 'draw-out artifact',
  B: 'administered instrument',
  C: 'week-long practice',
  D: 'routing / inferred',
  E: 'ceremony',
  F: 'coach',
};

export type Phase = 'reconnect' | 'rewire' | 'rebuild' | 'reclaim';
export type SessionKind = 'session' | 'checkpoint';

export interface SessionDef {
  id: string; // stable key (matches the built arc/route where one exists)
  phase: Phase;
  label: string;
  kind: SessionKind;
  segments: SessionType[]; // ORDERED — the canvas swaps per segment as the session runs
  note?: string;
}

// Every session + checkpoint, in phase order. Grounded in the real arc stageOrders (verified 7/13).
export const SESSION_REGISTRY: SessionDef[] = [
  // ── Reconnect — ONE continuous arc; the ring fills by INTERNAL BEAT (not 3 discrete sessions). ──
  {
    id: 'reconnect',
    phase: 'reconnect',
    label: 'Reconnect',
    kind: 'session',
    segments: ['D', 'B', 'A', 'B', 'E'], // Doors(D) → IDQ+Grinta(B) → Visioning(A) → Checkpoint(B) → Threshold(E)
    note: 'one arc; ring advances by internal beat (Doors / measure / Vision / checkpoint)',
  },

  // ── Rewire — 3 sessions + checkpoint ──
  { id: 'w1', phase: 'rewire', label: 'Disinformation Audit', kind: 'session', segments: ['A'] },
  { id: 'w2', phase: 'rewire', label: 'Visualization Workshop', kind: 'session', segments: ['A', 'C'], note: 'draw-out then w2_image practice week' },
  { id: 'w3', phase: 'rewire', label: 'False Start Protocol', kind: 'session', segments: ['A', 'C'], note: 'draw-out plan then w3_logging practice week' },
  { id: 'rewire-checkpoint', phase: 'rewire', label: 'Rewire Checkpoint', kind: 'checkpoint', segments: ['B', 'E'] },

  // ── Rebuild — 3 sessions + checkpoint ──
  { id: 'b1', phase: 'rebuild', label: "What's Your Why?", kind: 'session', segments: ['A', 'B'], note: 'A+B (Jay 7/13): draw-out "why" wraps Greg\'s SDT instrument (unchanged)' },
  { id: 'b2', phase: 'rebuild', label: 'Strengths & Weaknesses', kind: 'session', segments: ['B', 'C'], note: 'administered then b2_noticing practice week' },
  { id: 'b3', phase: 'rebuild', label: 'The Lifestyle Pilot', kind: 'session', segments: ['F', 'C'], note: 'coach plan then b3_pilot practice week' },
  { id: 'b4', phase: 'rebuild', label: 'Rebuild Checkpoint', kind: 'checkpoint', segments: ['B', 'E'] },

  // ── Reclaim — 3 sessions + checkpoint ──
  { id: 'c1', phase: 'reclaim', label: 'Readiness Assessment', kind: 'session', segments: ['B', 'F'], note: 'evidence self-check then coach Reclaim-List refine' },
  { id: 'c2', phase: 'reclaim', label: 'Bigger World Audit', kind: 'session', segments: ['B'] },
  { id: 'c3', phase: 'reclaim', label: 'Quality Days', kind: 'session', segments: ['F', 'C'], note: 'coach QD-profile then c3_quality practice week' },
  { id: 'c4', phase: 'reclaim', label: 'Reclaim Checkpoint', kind: 'checkpoint', segments: ['B', 'E'], note: 'the ceremony half is "The Transition" (Success Story → Community)' },
];

const BY_ID = new Map(SESSION_REGISTRY.map((s) => [s.id, s]));
export const PHASES: Phase[] = ['reconnect', 'rewire', 'rebuild', 'reclaim'];

export function sessionById(id: string): SessionDef | undefined {
  return BY_ID.get(id);
}

export function sessionsForPhase(phase: Phase): SessionDef[] {
  return SESSION_REGISTRY.filter((s) => s.phase === phase);
}

// The ordered canvas kinds a session will render — what the shell dispatches through.
export function canvasSequence(def: SessionDef): CanvasKind[] {
  return def.segments.map((t) => CANVAS_FOR_TYPE[t]);
}

// The distinct interaction types across ALL sessions — the set of canvas renderers the shell must implement.
export function allTypesUsed(): SessionType[] {
  const seen = new Set<SessionType>();
  for (const s of SESSION_REGISTRY) for (const t of s.segments) seen.add(t);
  return (['A', 'B', 'C', 'D', 'E', 'F'] as SessionType[]).filter((t) => seen.has(t));
}
