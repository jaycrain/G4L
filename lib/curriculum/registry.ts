// The curriculum registry — the program AS DATA (Atlas Curriculum v1.0). The renderer reads these
// rows; adding asset #25 is a row here + content, never a renderer change (the acceptance test).
// For the thin slice, Identity Excavation (RCN-EXC) is authored in full; the rest carry the metadata
// the dashboard forecast needs (title/phase/layer/kind/order/summary), with steps authored as the
// other 23 Sessions get written — pure content work, no engineering.
import type { Asset, Badge, BadgeCategory, Kind, KindProfile } from './types.ts';
import { RECONNECT_SESSIONS } from './content/reconnect.ts';
import { REWIRE_SESSIONS, REWIRE_V23 } from './content/rewire.ts';
import { REBUILD_SESSIONS, REBUILD_V24 } from './content/rebuild.ts';
import { RECLAIM_SESSIONS, RECLAIM_V25 } from './content/reclaim.ts';

// v2.3 flip: with REWIRE staged, the Rewire Phase is the guided CONVERSATIONAL flow (W1→W2→W3→Checkpoint, route-
// backed); otherwise the old Atlas Rewire Sessions (prod v2, untouched until the flip). Env is per-deploy, so this
// resolves once at module load. Local check to avoid pulling the agent module into the registry.
const rewireStaged = process.env.REWIRE === 'staged';
// v2.4 flip: same pattern for Rebuild — with REBUILD staged, the guided conversational flow (B1→B2→B3→B4 Checkpoint,
// route-backed); otherwise the old Atlas Rebuild Sessions (prod, untouched until the flip).
const rebuildStaged = process.env.REBUILD === 'staged';
// v2.5 flip: same pattern for Reclaim — with RECLAIM staged, the guided conversational flow (C1→C2→C3→C4 Checkpoint,
// route-backed, the capstone); otherwise the old Atlas Reclaim Sessions (untouched until the flip).
const reclaimStaged = process.env.RECLAIM === 'staged';
// Redesign flip: with REDESIGN staged, the badge shelf is the real 16-milestone identity-framed set (Decision WW);
// otherwise the current set (prod, untouched until the redesign flip). Keeps the redesign from changing prod's badges.
const redesignStaged = process.env.REDESIGN === 'staged';

export const CATEGORY_COLOR: Record<BadgeCategory, string> = {
  milestone: '#374F63', // navy
  hardiness: '#3B9495', // teal
  goal: '#919536', // olive
  comeback: '#EC6233', // orange
  capstone: '#101045', // indigo
};

export const KIND_PROFILES: Record<Kind, KindProfile> = {
  session: { kind: 'session', grain: 'one per asset', surface: 'sub_page', close: 'one at end (reflect/goal)', scoreWeight: 'high' },
  pulse: { kind: 'pulse', grain: 'daily light rep', surface: 'inline', close: 'light (did-you / yes-no)', scoreWeight: 'low' },
  tracker: { kind: 'tracker', grain: 'per measurable goal', surface: 'widget', close: 'on the reading', scoreWeight: 'progress' },
  checkpoint: { kind: 'checkpoint', grain: 'end of phase', surface: 'ceremony', close: 'milestone + gate', scoreWeight: 'none' },
  measurement: { kind: 'measurement', grain: 'instrument', surface: 'instrument', close: 'n/a', scoreWeight: 'none' },
};

// --- The one fully-authored Session for the slice (content from the Session sub-page mockup). The
// companion_frame/probe are base scaffolds; the live companion personalizes them against the member's
// own prior answers + memory ("guide a Session" behavior). ---
const IDENTITY_EXCAVATION: Asset = {
  id: 'RCN-EXC',
  title: 'Identity Excavation',
  phase: 'reconnect',
  layer: 'Excavation',
  kind: 'session',
  order: 4,
  summary: "Dig up the buried self and name who you're reclaiming.",
  gating: 'reconnect_started',
  close_type: 'reflect',
  serves: ['self'],
  earns: 'named-yourself',
  steps: [
    {
      n: 1,
      title: 'The archaeological dig',
      prompt: 'What did you used to do that made you feel most like yourself?',
      input_type: 'writing',
      companion_frame: "Start with the body memory — the thing you did that lit you up. Don't analyze it yet; just put us there. When were you most alive?",
      probe: 'One real scene beats a category. When, where, who was around — put me in it.',
      contributes: 'none',
    },
    {
      n: 2,
      title: 'Your identity knows',
      prompt: 'Who were you when you did it — not the activity, the person?',
      input_type: 'writing',
      companion_frame: 'You told me what you did. Now tell me who you were — the person, not the activity. What did the people around you call you? Who did you become the moment you started?',
      probe: "Take your time. One straight sentence beats a paragraph of hedging — and don't shrink it. If you were good, say you were good.",
      contributes: 'none',
    },
    {
      n: 3,
      title: 'Make yourself the protagonist',
      prompt: 'Tell it as your story — you in the center, not off to the side.',
      input_type: 'writing',
      companion_frame: "Now put yourself at the center of it. Not a supporting role in someone else's life — the protagonist of your own. Say it like it's yours.",
      probe: 'Where are you hedging yourself out of the lead? Take the credit that’s actually yours.',
      contributes: 'none',
    },
    {
      n: 4,
      title: 'Name the Reclaimed Identity',
      prompt: 'Give that self a name to wear again.',
      input_type: 'writing',
      companion_frame: "Name it — one phrase you can put on, like a title you wear. Natural case: “the Elite Cyclist”, “the Builder”. The self you’re reclaiming.",
      probe: 'Make it yours — self-chosen, not a role someone else assigned you. What’s the version underneath?',
      contributes: 'facet',
    },
  ],
};

// Metadata-only assets (forecast rows; steps authored later as content). close_type set where known.
const meta = (
  id: string,
  title: string,
  phase: Asset['phase'],
  layer: string,
  kind: Kind,
  order: number,
  summary: string,
  extra: Partial<Asset> = {},
): Asset => ({ id, title, phase, layer, kind, order, summary, ...extra });

export const CURRICULUM: Asset[] = [
  // ── Reconnect ── (Sessions authored from the framework; the IDQ is a measurement; the Checkpoint is the firm gate)
  ...RECONNECT_SESSIONS,
  meta('RCN-IDQ', 'The IDQ', 'reconnect', 'Recognition', 'measurement', 2, 'The mirror — your starting read across four dimensions. Retakes every 60 days.', { produces: 'your ID Score (baseline measurement)' }),
  IDENTITY_EXCAVATION,
  meta('RCN-CHK', 'The Reconnect Checkpoint', 'reconnect', 'Checkpoint', 'checkpoint', 8, 'The reconnection milestone — have you found yourself? Firm gate; opens Rewire.', { close_type: 'milestone', earns: 'reconnect-milestone', gating: 'reconnect_core_complete' }),
  // ── Rewire ── v2.3 conversational flow when staged (W1→W2→W3→Checkpoint), else the old Atlas Sessions + soft gate.
  ...(rewireStaged
    ? REWIRE_V23
    : [
        ...REWIRE_SESSIONS,
        meta('RWR-CHK', 'The Rewire Checkpoint', 'rewire', 'Checkpoint', 'checkpoint', 7, 'Has the frame moved? Opens the deeper Rebuild work.', { close_type: 'milestone', earns: 'rewire-milestone' }),
      ]),
  // ── Rebuild ── v2.4 conversational flow when staged (B1→B2→B3→B4 Checkpoint), else the old Atlas Sessions + soft gate.
  ...(rebuildStaged
    ? REBUILD_V24
    : [
        ...REBUILD_SESSIONS,
        meta('RBD-CHK', 'The Rebuild Checkpoint', 'rebuild', 'Checkpoint', 'checkpoint', 6, 'The numbers begin to move — pull them against your baseline.', { close_type: 'milestone', earns: 'rebuild-milestone' }),
      ]),
  // ── Reclaim ── v2.5 conversational flow when staged (C1→C2→C3→C4 Checkpoint), else the old Atlas Sessions + capstone.
  ...(reclaimStaged
    ? RECLAIM_V25
    : [
        ...RECLAIM_SESSIONS,
        meta('RCL-CHK', 'The Reclaim Checkpoint', 'reclaim', 'Checkpoint', 'checkpoint', 8, 'Carrying it outward — the capstone, and the Loop clips you back in.', { close_type: 'milestone', earns: 'reclaim-capstone' }),
      ]),
  // ── The daily layer (runs across the path; layer='Daily' routes it to the forecast's across-row) ──
  meta('DLY-SEVEN', 'The Seven Minutes', 'reconnect', 'Daily', 'pulse', 1, 'A daily short rep to keep your grit warm.'),
  meta('DLY-CLIPIN', 'Daily clip-in', 'reconnect', 'Daily', 'pulse', 2, 'The daily rep — plus the Hardiness reps.'),
  meta('DLY-SLEEP', 'Sleep check-in', 'reconnect', 'Daily', 'pulse', 3, 'A quick nightly check on recovery.'),
  meta('DLY-MILES', 'First 1,000 Miles', 'reconnect', 'Daily', 'tracker', 4, 'The optional Rebuild-track mileage tool.'),
  meta('DLY-GOALS', 'Goal trackers', 'reconnect', 'Daily', 'tracker', 5, 'Your numbers — weight, dollars, miles — logged conversationally.'),
  meta('DLY-IDQ', 'The IDQ retake', 'reconnect', 'Daily', 'measurement', 6, 'The identity-distance read, retaken every 60 days.'),
];

const badge = (id: string, name: string, category: BadgeCategory, icon: string, earn_rule: string, ceremony: boolean, visibility: Badge['visibility'] = 'known'): Badge => ({
  id,
  name,
  category,
  color: CATEGORY_COLOR[category],
  icon,
  visibility,
  earn_rule,
  ceremony,
});

// The current (pre-redesign) badge set — prod, untouched until the redesign flip.
const LEGACY_BADGES: Badge[] = [
  badge('onboarding-courage', 'Onboarding Courage', 'milestone', 'door', 'onboarding_complete', false),
  badge('named-yourself', 'Named Yourself', 'milestone', 'spark', 'session:RCN-EXC:closed', true),
  badge('reconnect-milestone', 'Reconnected', 'milestone', 'bullseye', 'checkpoint:reconnect:passed', true),
  badge('rewire-milestone', 'Rewired', 'milestone', 'bolt', 'checkpoint:rewire:passed', true),
  badge('rebuild-milestone', 'Rebuilt', 'milestone', 'mountain', 'checkpoint:rebuild:passed', true),
  badge('goal-reclaimed', 'Goal Reclaimed', 'goal', 'check', 'reclaim:item:reclaimed', false),
  badge('reclaim-capstone', 'Reclaimed — a full cycle', 'capstone', 'sun', 'checkpoint:reclaim:passed', true),
];

// The redesign's real 16-milestone set (Decision WW) — identity-framed, greyed until earned, ceremonial reveal at the
// beat. Each marks a TRUE accomplishment, never participation. The 6 ids with existing earn-wiring are REUSED (so
// checkpoints / reclaim-keeps / RCN-EXC keep firing under their new identity-framed names); the other 10 are the honest
// forward-map — greyed until their earn event lands (wired progressively; event-driven ones fire where the event exists).
// icon = a distinct placeholder glyph per badge so no two collide within a phase (Scott swaps the final art later,
// anchored to the badge id). color is now driven by PHASE, not category — see badgePhase()/badgeTile() below.
const REDESIGN_BADGES: Badge[] = [
  badge('named-yourself', 'You named the Doors', 'milestone', 'door', 'reconnect:doors', true), // wired: RCN-EXC close
  badge('starting-line', 'You met your starting line', 'milestone', 'cflag', 'reconnect:idq', false),
  badge('reconnect-milestone', 'You crossed the Threshold', 'milestone', 'up', 'checkpoint:reconnect:passed', true), // wired
  badge('turned-voice', 'You turned the voice', 'milestone', 'rtn', 'rewire:w1', false),
  badge('built-picture', 'You built the picture', 'milestone', 'spark', 'rewire:w2', false),
  badge('caught-real-time', 'You caught it in real time', 'comeback', 'eye', 'rewire:w3', false),
  badge('rewire-milestone', 'You retrained the mind', 'milestone', 'bolt', 'checkpoint:rewire:passed', true), // wired
  badge('found-why', 'You found your why', 'milestone', 'flame', 'rebuild:b1', false),
  badge('honest-read', 'You took an honest read', 'milestone', 'trend', 'rebuild:b2', false),
  badge('week-noticing', 'You lived a week of noticing', 'hardiness', 'wheel', 'rebuild:b3', false),
  badge('rebuild-milestone', 'You rebuilt the body', 'milestone', 'mountain', 'checkpoint:rebuild:passed', true), // wired
  badge('goal-reclaimed', 'You kept a want', 'goal', 'check', 'reclaim:item:reclaimed', false), // wired · Journey/bullseye
  badge('widened-world', 'You widened the world', 'milestone', 'sunrise', 'reclaim:c2', false),
  badge('quality-days', 'You lived quality days', 'hardiness', 'sun', 'reclaim:c3', false),
  badge('wrote-story', 'You wrote your story', 'milestone', 'pen', 'reclaim:transition', true),
  badge('reclaim-capstone', 'You closed the loop', 'capstone', 'bullseye', 'checkpoint:reclaim:passed', true), // wired · Journey/bullseye
];

export const BADGES: Badge[] = redesignStaged ? REDESIGN_BADGES : LEGACY_BADGES;

// --- Badge visual identity (Decision WW styling pass) -------------------------------------------------------
// The redesign shelf reads as a MAP OF THE JOURNEY: each badge is colored by its PHASE (the ring palette), not
// its category. Phase derives from the earn_rule prefix; the two cross-cutting keeps ("kept a want", "closed the
// loop") are the Journey/bullseye group. Scott's final icon art + earned-reveal animation are a later pass.
export type BadgePhase = 'reconnect' | 'rewire' | 'rebuild' | 'reclaim' | 'journey';

export const PHASE_BADGE_COLOR: Record<Exclude<BadgePhase, 'journey'>, string> = {
  reconnect: '#EC6233', // orange
  rewire: '#919536', // olive
  rebuild: '#3B9495', // teal
  reclaim: '#374F63', // navy
};
// Journey / cross-cutting = the bullseye: a radial gradient of all four phases (same as the ring).
export const BULLSEYE_GRADIENT =
  'radial-gradient(circle, #EC6233 0 28%, #919536 28% 52%, #3B9495 52% 76%, #374F63 76% 100%)';

// The two cross-cutting keeps live outside a single phase — they carry the whole Journey.
const JOURNEY_BADGE_IDS = new Set(['goal-reclaimed', 'reclaim-capstone']);

/** The phase a badge belongs to — drives its color. Journey overrides first, else the earn_rule prefix. */
export function badgePhase(b: Pick<Badge, 'id' | 'earn_rule'>): BadgePhase {
  if (JOURNEY_BADGE_IDS.has(b.id)) return 'journey';
  const r = b.earn_rule;
  if (r.startsWith('reconnect') || r.includes(':reconnect:') || r === 'onboarding_complete') return 'reconnect';
  if (r.startsWith('rewire') || r.includes(':rewire:')) return 'rewire';
  if (r.startsWith('rebuild') || r.includes(':rebuild:')) return 'rebuild';
  return 'reclaim';
}

/** The CSS background for a badge tile (phase color, or the bullseye gradient for Journey badges). */
export function badgeTileBackground(b: Pick<Badge, 'id' | 'earn_rule'>): string {
  const p = badgePhase(b);
  return p === 'journey' ? BULLSEYE_GRADIENT : PHASE_BADGE_COLOR[p];
}

// --- Accessors (the renderer reads only through these) ---
export const PHASE_ORDER: Asset['phase'][] = ['reconnect', 'rewire', 'rebuild', 'reclaim'];

export function listCurriculum(): Asset[] {
  return CURRICULUM;
}
export function getAsset(id: string): Asset | null {
  return CURRICULUM.find((a) => a.id === id) ?? null;
}
export function getSession(id: string): Asset | null {
  const a = getAsset(id);
  return a && a.kind === 'session' ? a : null;
}
export function kindProfile(kind: Kind): KindProfile {
  return KIND_PROFILES[kind];
}
export function listBadges(): Badge[] {
  return BADGES;
}
export function getBadge(id: string): Badge | null {
  return BADGES.find((b) => b.id === id) ?? null;
}
/** The phase columns of the forecast (Sessions + Checkpoints + in-phase measurements), order-sorted. */
export function phaseColumns(): { phase: Asset['phase']; items: Asset[] }[] {
  return PHASE_ORDER.map((phase) => ({
    phase,
    items: CURRICULUM.filter((a) => a.phase === phase && a.layer !== 'Daily').sort((x, y) => x.order - y.order),
  }));
}
/** The daily layer that runs across the foot of the forecast. */
export function dailyLayer(): Asset[] {
  return CURRICULUM.filter((a) => a.layer === 'Daily').sort((x, y) => x.order - y.order);
}
