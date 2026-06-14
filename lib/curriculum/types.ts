// The curriculum registry types (Give-Back Model v0.4 / Build Bible). The whole point: content is
// DATA, not code. A Session is a registry row with ordered steps; the renderer renders from the row.
// Adding asset #25 is a row + content, never a renderer change.

export type Phase = 'reconnect' | 'rewire' | 'rebuild' | 'reclaim';

// The four content kinds (+ measurement for the IDQ). A "kind" is a profile the build reads — never a
// hardcoded branch. A 5th kind is a new profile row that earns its place (a behavior the others can't).
export type Kind = 'session' | 'pulse' | 'tracker' | 'checkpoint' | 'measurement';

export type CloseType = 'reflect' | 'goal' | 'rep' | 'milestone';
export type InputType = 'writing' | 'choice' | 'assessment' | 'number' | 'scale';
export type Contributes = 'facet' | 'goal' | 'none';

// One lit section inside a Session. The companion delivers companion_frame, the member answers the
// prompt, the companion probes if the answer is thin. contributes = the artifact this step can yield.
export type Step = {
  n: number;
  title: string;
  prompt: string;
  input_type: InputType;
  companion_frame: string; // base scaffold; the live companion personalizes against the member's words
  probe: string; // the push-for-depth when an answer is thin
  contributes: Contributes;
};

export type Asset = {
  id: string; // RCN-EXC
  title: string; // Identity Excavation
  phase: Phase;
  layer: string; // Excavation — program depth within the phase
  kind: Kind;
  order: number; // sequence within the phase (drives the curriculum forecast)
  summary: string; // one line — shown on the dashboard forecast
  gating?: string; // when it unlocks, e.g. reconnect_core_complete
  close_type?: CloseType; // Sessions/Checkpoints
  serves?: string[]; // physical|self|social|outlook|any or a GRINTA component
  steps?: Step[]; // Sessions only — the ordered lit sections
  earns?: string; // badge id this asset's close earns, if any
};

export type BadgeCategory = 'milestone' | 'hardiness' | 'goal' | 'comeback' | 'capstone';

export type Badge = {
  id: string;
  name: string;
  category: BadgeCategory; // category sets the color
  color: string; // palette hex
  icon: string; // glyph key (star|flame|flag|up…)
  visibility: 'known' | 'surprise'; // known = greyed forward-map slot; surprise = hidden, uncounted
  earn_rule: string; // trigger: onboarding_complete · session:RCN-EXC:closed · checkpoint:reconnect:passed
  ceremony: boolean; // true = fire a Companion Ceremony alongside the badge
};

// Each kind is a profile row the build reads (grain · surface · close · score weight). Config, not branches.
export type KindProfile = {
  kind: Kind;
  grain: string;
  surface: 'sub_page' | 'inline' | 'widget' | 'ceremony' | 'instrument';
  close: string;
  scoreWeight: 'high' | 'low' | 'progress' | 'none'; // Sessions dominate; Pulses keep warm; no pile of Pulses out-scores a Session
};
