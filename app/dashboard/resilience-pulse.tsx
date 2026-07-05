'use client';

import {
  buildPulsePoints,
  buildPulsePath,
  buildPulseAnnotations,
  pulseTodayX,
  DEFAULT_PULSE_GEOM,
  type PulseBeat,
  type PulseKind,
  type PulsePoint,
  type PulseTone,
} from '../../lib/dashboard/resilience-pulse.ts';

// The Resilience Pulse dashboard card. ONE component, two states: EARLY (no beats → a flat baseline + one pulsing
// "today" beat, "it's already beating") and POPULATED (a rolling window of beats). Today is always the right-edge
// live point (orange, animated ring). On-brand (G4L palette); the behavioral register only — never a number/score.
const TEAL = '#3B9495';
const ORANGE = '#EC6233';
const RED = '#BB2127';
const QUIET = '#B4B2A9';
const g = DEFAULT_PULSE_GEOM;
const H = 188;

const dotColor = (k: PulseKind) => (k === 'false_start' ? RED : k === 'quiet' ? QUIET : TEAL);
const toneColor = (t: PulseTone) => (t === 'today' ? ORANGE : t === 'bad' ? RED : t === 'quiet' ? QUIET : TEAL);

export default function ResiliencePulse({ beats = [] }: { beats?: PulseBeat[] }) {
  const points = buildPulsePoints(beats, g);
  const path = buildPulsePath(points, g);
  const empty = points.length === 0;
  const today: PulsePoint =
    points[points.length - 1] ?? { x: pulseTodayX(g), y: g.baselineY, kind: 'quiet', today: true };
  const annotations = buildPulseAnnotations(points, g); // capped, sparse; empty state falls back to the early copy below

  return (
    <div className="card resilience-pulse">
      <h3 style={{ marginBottom: '0.25rem' }}>
        Your daily momentum <span style={{ color: 'var(--muted, #6b7683)', fontWeight: 400 }}>· the Resilience Pulse</span>
      </h3>
      <svg
        width="100%"
        viewBox={`0 0 ${g.width} ${H}`}
        role="img"
        aria-label={
          empty
            ? "The Resilience Pulse: a flat baseline with one live, pulsing point at today. It fills as you make daily calls."
            : "The Resilience Pulse: a rolling two-week rhythm of daily calls — up-beats for good calls, a dip for a false start, flat for quiet days, ending on today's live point."
        }
      >
        <line x1={g.padX} y1={g.baselineY} x2={g.width - g.padX} y2={g.baselineY} stroke={QUIET} strokeWidth="1" strokeDasharray="2 5" opacity="0.5" />
        {empty && (
          <text x={g.width / 2 + 60} y={g.baselineY - 16} textAnchor="middle" fontSize="13" fontStyle="italic" fill={QUIET}>
            …this fills as you go
          </text>
        )}
        <path d={path} fill="none" stroke={TEAL} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points
          .filter((p) => !p.today && p.kind !== 'quiet')
          .map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4" fill={dotColor(p.kind)} />
          ))}
        {/* today — the live pulsing point (both states) */}
        <circle cx={today.x} cy={today.y} r="6" fill="none" stroke={ORANGE} strokeWidth="2">
          <animate attributeName="r" values="6;24" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0" dur="1.8s" repeatCount="indefinite" />
        </circle>
        <circle cx={today.x} cy={today.y} r="6" fill="none" stroke={ORANGE} strokeWidth="2">
          <animate attributeName="r" values="6;24" dur="1.8s" begin="0.9s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0" dur="1.8s" begin="0.9s" repeatCount="indefinite" />
        </circle>
        <circle cx={today.x} cy={today.y} r="5.5" fill={ORANGE}>
          <animate attributeName="r" values="5.5;7;5.5" dur="1.8s" repeatCount="indefinite" />
        </circle>
        {/* auto-placed labels (today + up to 2 notable moments); the early state has no beats → renders just "today" */}
        {(empty ? [{ text: 'today', x: today.x, y: today.y - 16, tone: 'today' as PulseTone }] : annotations).map((a, i) => (
          <text key={i} x={a.x} y={a.y} textAnchor="middle" fontSize="12" fontWeight={a.tone === 'quiet' ? 400 : 500} fill={toneColor(a.tone)}>
            {a.text}
          </text>
        ))}
      </svg>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', fontSize: '12.5px', color: 'var(--muted, #6b7683)', margin: '0.5rem 0 0.25rem' }}>
        <LegendDot color={TEAL} label="Good Call — up-beat" />
        <LegendDot color={RED} label="False Start — dip" />
        <LegendDot color={QUIET} label="quiet day — flat" />
        <LegendDot color={ORANGE} label="today — live" />
      </div>
      <p style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--navy, #374F63)', margin: '0.4rem 0 0' }}>
        {empty
          ? "It's already beating. Every call you make moves the line — starting with today's."
          : 'Recovery is the point — the bounce after the dip is what "momentum, not streaks" looks like. Rolling window; it never accumulates into a score.'}
      </p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}
