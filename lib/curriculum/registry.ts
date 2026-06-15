// The curriculum registry — the program AS DATA (Atlas Curriculum v1.0). The renderer reads these
// rows; adding asset #25 is a row here + content, never a renderer change (the acceptance test).
// For the thin slice, Identity Excavation (RCN-EXC) is authored in full; the rest carry the metadata
// the dashboard forecast needs (title/phase/layer/kind/order/summary), with steps authored as the
// other 23 Sessions get written — pure content work, no engineering.
import type { Asset, Badge, BadgeCategory, Kind, KindProfile } from './types.ts';
import { RECONNECT_SESSIONS } from './content/reconnect.ts';

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
      probe: "Take your time. One honest sentence beats a paragraph of hedging — and don't shrink it. If you were good, say you were good.",
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
  meta('RCN-IDQ', 'The IDQ', 'reconnect', 'Recognition', 'measurement', 2, 'The honest mirror — your starting read across four dimensions. Retakes every 60 days.', { produces: 'your ID Score (baseline measurement)' }),
  IDENTITY_EXCAVATION,
  meta('RCN-CHK', 'The Reconnect Checkpoint', 'reconnect', 'Checkpoint', 'checkpoint', 8, 'The reconnection milestone — have you found yourself? Firm gate; opens Rewire.', { close_type: 'milestone', earns: 'reconnect-milestone', gating: 'reconnect_core_complete' }),
  // ── Rewire ──
  meta('RWR-DISINFO', 'Disinformation Audit', 'rewire', 'Awareness', 'session', 1, 'Catch the comfortable lies your mind runs, and take them apart.', { close_type: 'reflect', gating: 'rewire_unlocked' }),
  meta('RWR-NUMBERS', 'Numbers Exercise', 'rewire', 'Awareness', 'session', 2, 'Pull your numbers and look at them without flinching.', { close_type: 'reflect' }),
  meta('RWR-FOOD', 'Food Relationship Assessment', 'rewire', 'Awareness', 'session', 3, "Reframe food as fuel for who you're becoming.", { close_type: 'reflect' }),
  meta('RWR-VIZ', 'Visualization Workshop', 'rewire', 'Visualization', 'session', 4, 'Rehearse the feeling of doing the hard thing.', { close_type: 'reflect' }),
  meta('RWR-SELFTALK', 'Self-Talk Audit', 'rewire', 'Hardiness', 'session', 5, 'Catch the harsh inner voice and reframe one line of it.', { close_type: 'reflect' }),
  meta('RWR-FALSESTART', 'False Start Protocol', 'rewire', 'Hardiness', 'session', 6, 'Write your clip-back-in move before the slip happens.', { close_type: 'reflect' }),
  meta('RWR-CHECK', 'Rewire Checkpoint', 'rewire', 'Checkpoint', 'checkpoint', 7, 'Has the frame moved? Opens the deeper Rebuild work.', { close_type: 'milestone' }),
  // ── Rebuild ──
  meta('RBD-FIRSTSTEP', 'First Step Assessment', 'rebuild', 'Foundation', 'session', 1, 'Pick your vehicle and set an honest baseline.', { close_type: 'goal' }),
  meta('RBD-INVISIBLE', 'Invisible Foundations', 'rebuild', 'Foundation', 'session', 2, 'Shore up the unseen basics that hold everything.', { close_type: 'reflect' }),
  meta('RBD-SLEEP', 'Sleep & Recover', 'rebuild', 'Foundation', 'session', 3, "Set up recovery — it's part of the work, not a break from it.", { close_type: 'reflect' }),
  meta('RBD-FUEL', 'Fuel Plan', 'rebuild', 'Structure', 'session', 4, 'Build a pattern of eating you have, not one you go on.', { close_type: 'goal' }),
  meta('RBD-MOVEMENT', 'Movement Menu', 'rebuild', 'Structure', 'session', 5, 'Build your week of movement around the floor of 150 minutes.', { close_type: 'goal' }),
  meta('RBD-CHECK', 'Rebuild Checkpoint', 'rebuild', 'Checkpoint', 'checkpoint', 6, 'The numbers begin to move — pull them against your baseline.', { close_type: 'milestone' }),
  // ── Reclaim ──
  meta('RCL-READY', 'Reclaim Readiness', 'reclaim', 'Emergence', 'session', 1, 'Are you starting to carry the recovered identity outward?', { close_type: 'reflect' }),
  meta('RCL-STORY', 'Your Success Story', 'reclaim', 'Emergence', 'session', 2, 'Say the story of what you got back, in your own words.', { close_type: 'reflect' }),
  meta('RCL-ADVENTURE', 'Adventure Planning', 'reclaim', 'Extension', 'session', 3, 'Put a measuring-stick event on the calendar and back-plan it.', { close_type: 'goal' }),
  meta('RCL-WORLD', 'Bigger World Audit', 'reclaim', 'Extension', 'session', 4, 'Widen the circle the Fade shrank.', { close_type: 'reflect' }),
  meta('RCL-INVITE', 'Invitation Exercise', 'reclaim', 'Extension', 'session', 5, 'Bring someone with you — “come do this with me.”', { close_type: 'reflect' }),
  meta('RCL-SOCIAL', 'Social Connection', 'reclaim', 'Legacy', 'session', 6, 'Find the people and place you really belong.', { close_type: 'reflect' }),
  meta('RCL-LEGACY', 'Legacy Letter', 'reclaim', 'Legacy', 'session', 7, 'Write it forward — and name the Loop.', { close_type: 'reflect' }),
  meta('RCL-CHECK', 'Reclaim Checkpoint', 'reclaim', 'Checkpoint', 'checkpoint', 8, 'Carrying it outward — and the Loop clips you back in.', { close_type: 'milestone' }),
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

export const BADGES: Badge[] = [
  badge('onboarding-courage', 'Onboarding Courage', 'milestone', 'star', 'onboarding_complete', false),
  badge('named-yourself', 'Named Yourself', 'milestone', 'flag', 'session:RCN-EXC:closed', true),
  badge('reconnect-milestone', 'Reconnected', 'milestone', 'up', 'checkpoint:reconnect:passed', true),
];

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
