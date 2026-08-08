// Ongoing Check-in — the Member Agent's always-on companion mode (Member Agent Tech Spec
// v1.1 §4.4 + docs/design/member-agent-companion.md). The member opens the dashboard bubble to
// share a win, vent, or think out loud. The agent is present, reflective, grounded in the
// member's context, and quietly biases toward human connection. Governance: crisis → 988.
//
// Live Claude when ANTHROPIC_API_KEY is set; deterministic scripted fallback otherwise.

import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import { detectCrisis, CRISIS_RESPONSE_US, AI_DISCLOSURE } from './governance.ts';
import { reclaimAddIntent } from '../member/reclaim.ts';
import { rewireEnabled } from './rewire.ts';
import { rebuildEnabled } from './rebuild.ts';
import { logCallIntent } from '../momentum/store.ts';
import { redesignEnabled } from '../dashboard/redesign.ts';
import { connectContextLines, type ConnectAgentSummary } from '../connect/agent.ts';
import type { Direction } from '../idq/scoring.ts';

export type CheckinContext = {
  // CAT-38 — TRUE when this context is the degraded fallback (a supplementary read failed). The prompt HARD-FORBIDS
  // denying that you remember the member, which is right — but on a degrade the agent was still instructed to behave
  // omnisciently over a gutted context, so its only options were to confabulate or go vague. This lets it be honest
  // about the SHAPE of what it can see right now without ever denying the continuity that actually exists.
  degraded?: boolean;
  today?: string; // current date, injected server-side so the agent has a real temporal anchor
  displayName: string;
  identityNoun: string | null;
  namedSelves?: string[]; // all reclaimed selves the member has named (the identity strip facets)
  completedSessions?: string[]; // curriculum Sessions they've finished (Identity Excavation, …)
  nextStep?: { title: string; kind: string; openable: boolean } | null; // the lit step on their path (send them there)
  dailyBeat?: string | null; // today's Daily Beat reflection on their dashboard (a read, not a task)
  // Earned badges (the 16-milestone Passport). The member sees these on the dashboard, in the ceremony, and at
  // session close — so the agent MUST know them too (CLAUDE.md: no data the member can see is invisible to the
  // agent). Names only; acknowledge warmly as earned, never grade or gamify. (CAT-37)
  earnedBadges?: string[] | null;
  doorDisplayNames: string[];
  idScore: number | null;
  direction: Direction | null;
  currentFocus: string | null;
  currentPhaseWhy?: string | null; // the "why this matters" for the active phase, in the exact words the member sees on the canvas
  lastCompletedAsset: string | null;
  reclaimList: string[];
  grintaScore?: number | null; // the daily activity register (the Daily Call) — for awareness, not to pitch
  grintaTrend?: 'up' | 'down' | 'flat' | null;
  // The SURVEY Grinta Index (Decision DD) — the member's grit baseline (onboarding) → Checkpoints, on a 1–5
  // scale (kept distinct from the ID Score's 0–100 on purpose). When present it is the real "Grinta Index" the
  // member sees on the dashboard; the activity register above is then the Daily Call rhythm. Null on prod v1.
  grintaIndex?: number | null; // composite, 1–5
  grintaStrands?: { reconnect?: number; rewire?: number; rebuild?: number; reclaim?: number } | null; // per-R means, 1–5
  grintaIndexTrend?: 'up' | 'down' | 'flat' | null; // movement vs the prior reading (null until a Checkpoint moves it)
  grintaIndexChangePct?: number | null; // signed up-positive percent vs the prior reading (null on the baseline)
  consumedBites?: string[]; // titles of recently read bites
  pastSelf?: string | null; // their own words on who they were (from onboarding)
  gapStory?: string | null; // their own words on how the gap opened (from onboarding)
  identityParagraph?: string | null; // the synthesized identity paragraph
  // Full member data — the dashboard and the MA are one surface, so the agent knows everything
  // represented about the member and can answer specifically (within the governance rules).
  dimensions?: { physical: number; self: number; social: number; outlook: number } | null; // each /30
  idScoreHistory?: number[]; // ID Score across retakes, oldest→newest (the trend)
  idqAnswers?: { dimension: string; stem: string; score: number }[]; // the 24 answers, 1–5
  reclaimDetail?: { text: string; category: string; state: string; tracked: boolean }[]; // Reclaim items + progress + whether a tracker exists
  movementLog?: string; // recent OFF-device activity the member logged (Movement page or Companion) — so the MA knows their movement, per governance (the dashboard + agent are one surface)
  // Rebuild B1 "What is Your Why?" — true once the member has named their motivation for movement + eating. The
  // SDT profile is stored but NEVER shown as a number (Decision RB-1); the agent only KNOWS they've done it, so it
  // references it as shared history and never re-asks. No score, no verdict — a starting point, by design.
  whyNamed?: boolean;
  // Rebuild B2 "Strengths & Weaknesses" — the member's self-management skill profile, once assessed. The agent knows
  // their apparent strongest skill + growth edge (in plain language, never a number), so it can reflect the profile
  // and connect it to the week's noticing — never re-administers, never grades.
  skillProfile?: { strongest: string; growthEdge: string } | null;
  // Rebuild B3 "The Lifestyle Pilot" — the member's committed plan (their two small changes). The agent knows it so
  // it can support the pilot week: plan-aware check-ins, non-judgmental slip-recovery (their W3 protocol), never
  // grading. It's their plan — CRUD-able, never silently rewritten.
  pilotPlan?: { activityChange: string; dietChange: string } | null;
  // Rebuild pilot calls, split by domain (Decision OO) — how movement vs. eating is actually going this window, so the
  // companion can reflect the pattern (evidence-based, Pillar 3). Present only during an active pilot; false starts are
  // honest data, never a mark.
  pilotCalls?: { activity: { good: number; false: number }; diet: { good: number; false: number } } | null;
  // Rebuild Momentum calls — the member's OWN logged entries (Good Call / False Start / On Track + their free-text
  // notes), newest first. The dashboard shows these in "Your log"; the companion MUST see them too (CLAUDE.md: nothing
  // the member sees is invisible to the MA) so it can genuinely notice a specific entry ("did you see my ride?") and
  // connect a call to the pilot commitments. Present regardless of an active pilot, and includes untagged calls (the
  // tally above only counts tagged ones). Self-monitoring, never scored — a false start is honest data, never a mark.
  momentumLog?: { label: string; domain: 'movement' | 'eating' | null; note: string | null; when: string }[] | null;
  // The member's standing COMMITMENTS (0060/0061) — the specific movement/eating changes they chose to hold themselves
  // to, and the Reclaim outcome each serves (the ladder). This is the accountability spine: the agent holds them to
  // THEIR OWN desired outcomes (never an external standard, never grading). Member-set + editable via set_commitment.
  commitments?: { domain: 'movement' | 'eating'; text: string; serves: string | null }[] | null;
  // Reclaim C2 Bigger World Audit — the member's chosen priorities: the primary focus area + the momentum lever. The
  // agent knows these so it can support their chosen priority (never a ranking to grade or weaponize).
  reclaimPriorities?: { primary: string; momentumLever: string } | null;
  // Reclaim C3 Quality Days — the member's Quality-Day non-negotiables + recent logged scores. The agent supports the
  // practice: help them notice what makes a day theirs; never a compliance score.
  // THE PRACTICE WEEK, as the member sees it on their grid. Added 2026-08-07 when a sweep found the gap: the grid
  // shipped that morning and the Companion couldn't see it — a member could be looking at "3 / 5" while the agent
  // knew nothing about the week at all. CLAUDE.md's rule is that no data the member can see is invisible here.
  practiceWeek?: {
    kind: string;
    day: number; // 1..7
    rows: { label: string; target: number | null; done: number; todayDone: boolean }[];
    tappable: boolean; // can the agent mark a day, or is this week a mirror of a log they wrote?
    // The window has elapsed and nothing has closed it yet. When true, the review lines below are the FIRST thing
    // the Companion should raise — a week that ends in silence is the thing this whole slice exists to stop.
    readyToClose: boolean;
    review?: { opener: string; lines: string[] } | null;
  } | null;
  qualityDay?: { nonNegotiables: string[]; recentAvg: number | null; days: number } | null;
  beatsDone?: number; // Beats worked so far
  // The Playbook (the two-way loop): kept keepers + recent journal notes. Used to help — never
  // quoted back coldly or weaponized. Capped/summarized upstream. keeperType (0046) lets the recall
  // pattern reach for the RIGHT tool (a true line vs. the image vs. a recovery move) — Decision MM #2.
  playbookKeepers?: { section: string; body: string; keeperType?: string }[];
  playbookNotes?: string[];
  // Measures — numbers the member watches move (weight, miles, etc.). The agent can create one and
  // log readings, and reflects on real movement here (never a verdict, never clinical).
  measures?: { label: string; unit: string; start: number | null; latest: number | null; target: number | null; lastOn: string | null; atTarget: boolean; count: number }[];
  // Reclaim goals whose wording carries a measurable target but have NO tracker yet — the agent
  // proactively OFFERS to set one up (offered, never forced; confirm, then create_measure).
  trackableUntracked?: string[];
  // Durable memory distilled from earlier conversations (people, relationships, life context) that
  // have aged out of the recent thread — so the knowing compounds. Treat as things you already know.
  agentMemory?: string | null;
  // What moved on their dashboard since they last talked with you (Pillar 2) — score/Grinta/Beats/
  // trackers/reclaimed. The agent notices the meaningful one or two warmly; never a data dump.
  recentChanges?: string[];
  // How they've actually moved through the program (experience telemetry): time-on-asset, where they
  // stalled, what they keep returning to. For awareness — notice a stall or a return warmly, never grade.
  experienceSummary?: string | null;
  // Community — read-only awareness of their community life: engagement they received,
  // their posts, their accountability pacts. The agent gently bridges them toward real people and
  // surfaces "someone replied to what you shared" — it never posts for them. See lib/connect/agent.ts.
  connect?: ConnectAgentSummary;
  // Times this member has been away before and come back, folded from the outreach log (lib/outreach/
  // episodes.ts). Jay, 2026-08-02: a nudge is an EVENT in their history, not a send — which is what makes
  // "you were away around this time last April" sayable at all. Carries its own voice guard, because recall
  // is exactly where praise sneaks in.
  awayRecall?: string | null;
};

export type CheckinMessage = { role: 'agent' | 'member'; text: string };
export type CheckinTurn = { reply: string; crisis?: boolean };

const firstName = (n: string) => (n || '').trim().split(/\s+/)[0] ?? '';

// ── The keeper-recall pattern (Decision MM #2) ────────────────────────────────────────────────────────────────
// The tools a member builds (W1 true lines, the W2 image, later a W3 recovery protocol) are meant to be USED, not
// filed. When the OLD VOICE shows up in what they say, the companion reaches for the MATCHING tool and reflects it
// back in their own words. Two halves: (a) the live model is INSTRUCTED to do this (earned, not trigger-happy) with
// keepers tagged by function in its context; (b) the offline scripted agent uses the pure recallKeeper below, so the
// "earned vs. neutral" bar is deterministic and testable. Flag-gated (REWIRE) so prod's live companion is unchanged
// until the v2.3 flip. keeperType → what the tool is FOR:
export type RecallKeeper = { section?: string; body: string; keeperType?: string };
export function keeperFunctionLabel(keeperType?: string): string {
  switch (keeperType) {
    case 'principle': return 'true line — a line they wrote to answer a specific lie';
    case 'lights_you_up': return 'the picture — the image they built of who they’re becoming';
    case 'recovery_move': return 'recovery move — their protocol for a slip';
    case 'definition': return 'a reframe that landed for them';
    case 'tell': return 'a pattern they named in themselves';
    case 'plan': return 'their Lifestyle Pilot — the two small changes they committed to';
    default: return 'something they’re keeping';
  }
}
// The old voice, in three shapes — a resurfacing LIE, the vision going DIM (hopelessness), a SLIP they’re beating
// themselves up over. Conservative on purpose (the "precise & humble" bar): a neutral / logistical message matches
// nothing and gets no keeper. Used by the offline scripted agent; the live model judges via the prompt instruction.
const OLD_VOICE_LIE = /\b(too old|too late|not that person( anymore)?|i'?m not (an? |that)|can'?t change|who am i kidding|never really|not cut out|not the type)\b/i;
const OLD_VOICE_DIM = /\b(never (work|happen|change|get there)|not going to happen|what'?s the point|pointless|why bother|no use|hopeless|give up|never going to|impossible|can'?t do (this|it))\b/i;
const OLD_VOICE_SLIP = /\b(blew it|screwed up|slipped( up)?|fell off|failed again|messed up|back to (square|zero)|off the wagon|ruined it)\b/i;
export type Recalled = { body: string; keeperType?: string; reason: 'lie' | 'dim' | 'slip' };
/** Reach for the keeper that answers the old voice in `message`, or null if the old voice isn't there (earned, not
 *  trigger-happy). Prefers the tool built for that shape (lie→true line, dim→image, slip→recovery move), else any. */
export function recallKeeper(message: string, keepers: RecallKeeper[] = []): Recalled | null {
  if (!keepers.length) return null;
  const m = (message || '').toLowerCase();
  const byType = (t: string) => keepers.find((k) => k.keeperType === t);
  if (OLD_VOICE_DIM.test(m)) {
    const k = byType('lights_you_up') ?? byType('principle') ?? keepers[0]!;
    return { body: k.body, keeperType: k.keeperType, reason: 'dim' };
  }
  if (OLD_VOICE_LIE.test(m)) {
    const k = byType('principle') ?? keepers[0]!;
    return { body: k.body, keeperType: k.keeperType, reason: 'lie' };
  }
  if (OLD_VOICE_SLIP.test(m)) {
    const k = byType('recovery_move') ?? byType('principle') ?? keepers[0]!;
    return { body: k.body, keeperType: k.keeperType, reason: 'slip' };
  }
  return null;
}

// The four Grinta strands, spelled out for the agent's context (one per R). Empty when none are present.

// The practice week, said the way the member would say it. Deliberately NOT a compliance report: it names what they
// aimed for and what's happened so far, and tells the agent to hold it as noticing rather than scoring. A blank day
// is a day, never a miss — the same rule the grid itself renders by.
function practiceWeekLine(c: CheckinContext): string | null {
  const pw = c.practiceWeek;
  if (!pw || !pw.rows.length) return null;
  // THE WEEK IS OVER. This outranks the ordinary in-week line: a member who finished their week and hears nothing
  // has been left to notice it themselves, which is how the practice week has always ended until now.
  if (pw.readyToClose && pw.review) {
    return (
      `THEIR PRACTICE WEEK HAS FINISHED and they have not been told yet. Open with it, before anything else. ` +
      `Say it in your own voice, but keep their numbers exactly as they are: "${pw.review.opener}" then, one per ` +
      `line: ${pw.review.lines.map((l) => `"${l}"`).join(' ')} ` +
      `Then ask ONE question — whether they're ready to move on to the next activity, want to run the same week ` +
      `again, or want to talk about how it went first. Their call entirely; don't push one. ` +
      `TONE: this is a review, NEVER a report card. State a shortfall plainly and then LEAVE IT ALONE — no "only", ` +
      `no "just", no consolation and no silver lining, all of which tell them you think they failed. Don't praise ` +
      `hitting the number either; notice it. A week is seven reasonable decisions, not a test they sat.`
    );
  }
  const rows = pw.rows
    .map((r) => `${r.label} — ${r.done}${r.target ? ` of the ${r.target} they aimed for` : ' so far'}${r.todayDone ? ', already marked today' : ''}`)
    .join('; ');
  const openToday = pw.rows.some((r) => !r.todayDone);
  return (
    `Their practice week is on day ${pw.day} of 7: ${rows}. ` +
    (pw.tappable
      ? openToday
        ? 'If they tell you they did one today, mark it with mark_practice_day — the grid tells them you will, so words alone are not enough. '
        : "Everything for today is already marked. Don't ask again — nothing is more deflating than being asked for something you already did. "
      : 'This week mirrors a log they keep themselves; reflect it, never edit it. ') +
    'NEVER present this as compliance or a score. A blank day is a day, not a miss, and the whole point is noticing what helps — not hitting a number.'
  );
}

function grintaStrandsLine(s: CheckinContext['grintaStrands']): string {
  if (!s) return '';
  const parts = (['reconnect', 'rewire', 'rebuild', 'reclaim'] as const)
    .filter((k) => s[k] != null)
    .map((k) => `${k[0]!.toUpperCase()}${k.slice(1)} ${s[k]}`);
  return parts.length ? ` — strands ${parts.join(', ')}` : '';
}

// Render the member's own Momentum log entries into one compact line — the call, its domain (if tagged), the note (if
// any), and when. So the companion can name a specific entry back, not just a count. Pure + testable.
function momentumLogLine(log: NonNullable<CheckinContext['momentumLog']>): string {
  return log
    .map((e) => {
      const tag = [e.domain, e.when].filter(Boolean).join(', ');
      const head = tag ? `${e.label} (${tag})` : e.label;
      return e.note ? `${head}: "${e.note}"` : head;
    })
    .join('; ');
}

export function contextBlock(c: CheckinContext): string {
  // CAT-38 — say it OUT LOUD when the context is degraded. The memory rule below (never deny that you remember)
  // is right and stays; the failure was that on a degrade the agent was still told to behave omnisciently over a
  // gutted context, leaving it only confabulation or vagueness. Naming the state lets it stay honest about what it
  // can SEE this minute without ever denying the continuity that genuinely exists.
  const degraded = c.degraded
    ? 'CONTEXT IS INCOMPLETE RIGHT NOW — a background read failed, so parts of this member\'s durable record ' +
      '(their story, Playbook, ID Score/IDQ detail, Grinta) are MISSING from the block below. This is a system ' +
      'hiccup on our side, not a gap in what we keep. Do NOT invent specifics you cannot see, and do NOT claim ' +
      'to recall detail that is absent. You may say you are not pulling everything up this minute and ask them ' +
      'to remind you. NEVER say you do not remember them or that memory does not persist — that is false, and ' +
      'the durable record is intact.'
    : null;
  const dims = c.dimensions
    ? `ID Score dimensions (each out of 30): Physical ${c.dimensions.physical}, Self ${c.dimensions.self}, Social ${c.dimensions.social}, Outlook ${c.dimensions.outlook}`
    : null;
  const trend =
    c.idScoreHistory && c.idScoreHistory.length > 1
      ? `ID Score trend (oldest→newest): ${c.idScoreHistory.join(' → ')}`
      : null;
  const reclaim =
    c.reclaimDetail && c.reclaimDetail.length
      ? `Reclaim List with progress (tracker = has a number tracker):\n${c.reclaimDetail.map((r) => `  • ${r.text} [${r.category}] — ${r.state}${r.tracked ? ' · tracker' : ''}`).join('\n')}`
      : c.reclaimList && c.reclaimList.length
        ? `Reclaim List (what they want back): ${c.reclaimList.join('; ')}`
        : null;
  const idq =
    c.idqAnswers && c.idqAnswers.length
      ? `IDQ answers (their most recent, 1–5 where 5 = most true):\n${c.idqAnswers
          .map((a) => `  • [${a.dimension}] ${a.stem} — ${a.score}`)
          .join('\n')}`
      : null;
  return [
    degraded, // CAT-38: first, so the model reads the caveat before the (incomplete) facts
    c.today ? `Today is ${c.today}.` : null,
    c.awayRecall ?? null,
    c.recentChanges && c.recentChanges.length
      ? `Since they last talked with you, their dashboard moved:\n${c.recentChanges.map((x) => `  • ${x}`).join('\n')}`
      : null,
    `Member: ${c.displayName}`,
    // Badges the member has EARNED — they see them, so you know them. Acknowledge as earned work when it's relevant;
    // never grade, gamify, or dangle them as a carrot. (CAT-37)
    c.earnedBadges && c.earnedBadges.length
      ? `Badges they've earned: ${c.earnedBadges.join(', ')} (earned acknowledgement — never a grade or a carrot)`
      : null,
    c.namedSelves && c.namedSelves.length
      ? `Reclaimed selves they've named: ${c.namedSelves.join(', ')} (speak to all of them, not just one)`
      : c.identityNoun
        ? `Reclaiming: the ${c.identityNoun}`
        : null,
    c.completedSessions && c.completedSessions.length ? `Sessions they've completed: ${c.completedSessions.join(', ')}` : null,
    c.nextStep && c.nextStep.openable
      ? `Their next step on the path (ready now — the "Open this Session" button is at the top of their dashboard): ${
          c.nextStep.kind === 'checkpoint' ? `the ${c.nextStep.title} Checkpoint` : `the Session "${c.nextStep.title}"`
        } — send them there when it fits.`
      : null,
    c.doorDisplayNames.length ? `Door${c.doorDisplayNames.length > 1 ? 's' : ''}: ${c.doorDisplayNames.join(', ')}` : null,
    c.idScore !== null ? `Latest ID Score: ${c.idScore}${c.direction ? ` (${c.direction})` : ''}` : 'No IDQ yet',
    dims,
    trend,
    c.currentFocus ? `Current focus: ${c.currentFocus}` : null,
    // The member sees this "why this matters" framing for their current phase on the canvas — so you know it too
    // (nothing they see is invisible to you). If they ask "why am I doing this," reflect THIS, in their own terms;
    // never invent a different rationale, never quote it back verbatim like a brochure.
    c.currentPhaseWhy ? `Why this phase matters (what the member sees): "${c.currentPhaseWhy}"` : null,
    // Grinta Index: when the SURVEY reading exists (staged) it owns the name — the grit baseline on a 1–5 scale,
    // with the four R-strands. The activity register then reads as the Daily Call rhythm. On prod v1 (no survey
    // reading) the activity register keeps the "Grinta Index" name, so nothing about the live agent changes.
    c.grintaIndex != null
      ? `Grinta Index (their grit, on a 1–5 scale — a different measure from the ID Score, never to be compared to it): ${c.grintaIndex}${grintaStrandsLine(c.grintaStrands)}${c.grintaIndexChangePct != null && c.grintaIndexTrend ? ` (${c.grintaIndexTrend} ${c.grintaIndexChangePct > 0 ? '+' : ''}${c.grintaIndexChangePct}% since last Checkpoint)` : ' (baseline — it moves at Checkpoints)'}`
      : c.grintaScore != null ? `Grinta Index: ${c.grintaScore}${c.grintaTrend ? ` (${c.grintaTrend} lately)` : ''}` : null,
    c.grintaIndex != null && c.grintaScore != null ? `Daily Call rhythm (their day-to-day momentum, not the Index): ${c.grintaScore}${c.grintaTrend ? ` (${c.grintaTrend} lately)` : ''}` : null,
    c.beatsDone ? `Program reps completed so far: ${c.beatsDone}` : null, // 0 is omitted, not announced
    c.whyNamed
      ? `They've named their "why" for movement and eating (Rebuild B1) — stored as a starting point, deliberately NOT scored or shown as a number. You KNOW they've done this: treat it as shared history and never re-ask it; if it comes up, reflect it as their own words about why this matters, never as a motivation "type" or a verdict.`
      : null,
    c.skillProfile
      ? `They've assessed their self-management skills (Rebuild B2). Their apparent strongest is ${c.skillProfile.strongest.toLowerCase()}; the one with the most room is ${c.skillProfile.growthEdge.toLowerCase()}. Use this to help them SEE themselves and connect skills to their week — never as a grade or a number. A "weak" skill is just one to practice, never a failing. Don't re-administer.`
      : null,
    c.pilotPlan
      ? `Their Lifestyle Pilot this week (Rebuild B3) — Movement: ${c.pilotPlan.activityChange}. Eating: ${c.pilotPlan.dietChange}. Support it: ask how the calls are going, warmly and plan-aware, never grading. A false start is met, not marked (HH) — offer their own recovery move if they slip. It's THEIR plan; if they want to change it, help them, never rewrite it silently.`
      : null,
    c.pilotCalls && (c.pilotCalls.activity.good + c.pilotCalls.activity.false + c.pilotCalls.diet.good + c.pilotCalls.diet.false) > 0
      ? `How the pilot's actually going (last two weeks, their own logged calls) — Movement: ${c.pilotCalls.activity.good} good, ${c.pilotCalls.activity.false} false starts. Eating: ${c.pilotCalls.diet.good} good, ${c.pilotCalls.diet.false} false starts. If it helps them see the pattern, reflect it warmly ("movement's been landing; eating's been the tougher one") — never a scoreboard, never a grade; a false start is honest data. Only raise it if it's useful to them.`
      : '',
    c.commitments && c.commitments.length
      ? `Their standing COMMITMENTS — the specific changes they chose to hold themselves to${c.commitments.some((x) => x.serves) ? ', and where one genuinely applies, the Reclaim outcome it moves toward' : ''}: ${c.commitments.map((x) => `${x.domain} — "${x.text}"${x.serves ? ` → serves "${x.serves}"` : ''}`).join('; ')}. This is the accountability spine, and it's to THEIR OWN goals, never an external standard. Not every commitment maps to a single outcome — some just serve their general health or who they're becoming, and that's fine; hold them to it either way, and never assert a ladder that doesn't hold (a walk isn't a mileage target). Reflect follow-through as the identity coming back (normalize, NEVER praise or grade), meet a lapse with curiosity and an invitation (never a scold, never a compliance score); when a real link exists, tie it back to what they said they want. They can change or set aside a commitment anytime with you — it's theirs; use set_commitment when they do.`
      : null,
    c.momentumLog && c.momentumLog.length
      ? `Their Momentum log — the exact entries they've logged on the dashboard ("Your log"), newest first. You SEE these; if they ask whether you noticed an entry, you did — reference the specific one, don't say you have no record of it: ${momentumLogLine(c.momentumLog)}. Self-monitoring, never scored — a false start is honest data, met not marked. ${c.pilotPlan ? "This is where they log their Lifestyle Pilot commitments (movement + eating). Tie a call to the relevant change, and gently encourage them to keep logging against their two commitments." : "When it fits, encourage the habit of logging calls — it's how they and you see the pattern together."}`
      : null,
    c.movementLog
      ? `Off-device movement they've logged (Movement page or told you) — ${c.movementLog}. It's real evidence of the identity coming back; reflect it warmly when relevant, never as a number or a target. If they mention doing an activity off-device that isn't here, log it with the log_movement tool.`
      : null,
    c.reclaimPriorities
      ? `Their Bigger World priorities (Reclaim C2) — the area they chose to focus on is their ${c.reclaimPriorities.primary.toLowerCase()} life; the easiest place to build momentum is their ${c.reclaimPriorities.momentumLever.toLowerCase()} life. Support that chosen focus warmly; it's their priority, not a ranking to grade.`
      : null,
    practiceWeekLine(c),
    c.qualityDay && c.qualityDay.nonNegotiables.length
      ? `Their Quality Day (Reclaim C3) — the non-negotiables they named: ${c.qualityDay.nonNegotiables.join(', ')}.${c.qualityDay.days ? ` They've logged ${c.qualityDay.days} day${c.qualityDay.days === 1 ? '' : 's'} lately, averaging ${c.qualityDay.recentAvg}/10.` : ''} Support the practice — help them notice what actually makes a day theirs; a Quality-Day score is self-monitoring, never a grade.`
      : null,
    c.experienceSummary && c.experienceSummary.trim()
      ? `How they've moved through the program lately (for awareness — gently notice a stall or a return, e.g. "you opened Visualization a couple times — want to pick it back up?"; NEVER grade or guilt): ${c.experienceSummary.trim()}`
      : null,
    c.consumedBites && c.consumedBites.length ? `Recently read: ${c.consumedBites.join('; ')}` : null,
    // RETIRED (Jay, 2026-07-31): the Daily Beat panel does not render on production — the v3.0 redesign
    // removed it, and the legacy branch that drew it is unreachable. Feeding it here told the Companion about
    // something on "their dashboard" that the member cannot see, which is the omniscience failure again
    // (CAT-38). The plumbing stays so the surface can return without re-wiring; the PROMPT stays honest.
    null,
    reclaim,
    c.pastSelf ? `Who they were, in their own words: "${c.pastSelf}"` : null,
    c.gapStory ? `How the gap opened, in their own words: "${c.gapStory}"` : null,
    c.identityParagraph ? `Their story, synthesized: ${c.identityParagraph}` : null,
    c.agentMemory && c.agentMemory.trim()
      ? `What you remember about them from earlier conversations (people, relationships, life — treat as already known, weave in naturally, never recite):\n${c.agentMemory.trim()}`
      : null,
    idq,
    c.playbookKeepers && c.playbookKeepers.length
      ? `Their Playbook — what's working for them (kept)${rewireEnabled() ? ' [tag = what each tool is FOR; reach for the right one when the old voice shows]' : ''}:\n${c.playbookKeepers
          .map((k) => (rewireEnabled() ? `  • [${keeperFunctionLabel(k.keeperType)}] ${k.body}` : `  • [${k.section}] ${k.body}`))
          .join('\n')}`
      : null,
    c.playbookNotes && c.playbookNotes.length
      ? `Recent Playbook journal entries (their own private writing):\n${c.playbookNotes.map((n) => `  • ${n}`).join('\n')}`
      : null,
    c.measures && c.measures.length
      ? `Measures they're watching (numbers over time — reflect on movement, never grade):\n${c.measures
          .map((m) => {
            const u = m.unit ? ` ${m.unit}` : '';
            const start = m.start != null ? `${m.start}${u}` : '—';
            const latest = m.latest != null ? `${m.latest}${u}` : 'no reading yet';
            const tgt = m.target != null ? `, target ${m.target}${u}` : '';
            const on = m.lastOn ? ` (as of ${m.lastOn})` : '';
            const hit = m.atTarget ? ' — AT/PAST TARGET' : '';
            return `  • ${m.label}: started ${start} → now ${latest}${on}${tgt}${hit} [${m.count} reading${m.count === 1 ? '' : 's'}]`;
          })
          .join('\n')}`
      : null,
    c.trackableUntracked && c.trackableUntracked.length
      ? `Goals that look trackable but have NO tracker yet (offer to set one up — see WATCHING A NUMBER):\n${c.trackableUntracked
          .map((t) => `  • ${t}`)
          .join('\n')}`
      : null,
    c.connect ? connectContextLines(c.connect) : null,
  ].filter(Boolean).join('\n');
}

// The recall-pattern instruction (Decision MM #2) — only when REWIRE is staged, so prod's live companion is byte-for-
// byte unchanged until the v2.3 flip. Teaches the model to reach for the matching Playbook tool when the old voice
// shows, on the precise-and-humble bar (earned, never trigger-happy).
const RECALL_INSTRUCTION = `

REACHING FOR THEIR TOOLS (the recall pattern). The member has BUILT things meant to be used, not filed: true lines that answer a specific lie, the picture of who they're becoming, and (later) a recovery move for a slip. They're in their Playbook in MEMBER CONTEXT, each tagged with what it's FOR. When the OLD VOICE shows up in what they say — a lie resurfacing ("I'm too old", "it's too late", "I'm not that person"), the picture going dim ("this'll never happen", "what's the point"), or a slip they're beating themselves up over — REACH FOR the matching tool and reflect it back to them IN THEIR OWN WORDS: the true line against the lie, the picture against the hopelessness, the recovery move against the slip. Offer it the way you'd remind a friend of something true they already know — warm, not a lecture.
EARNED, NOT TRIGGER-HAPPY (the precise-and-humble bar): do this ONLY when the old voice is genuinely there AND a tool genuinely fits. A neutral, logistical, or upbeat message gets no keeper — forcing one is worse than none. At most one per turn, and never to guilt them ("but you wrote…"). It's theirs; hand it back, don't wield it.`;

// Exported so tests can assert on the ASSEMBLED prompt rather than on a constant that may not be wired into it
// (test the seam, not the halves — a rule the agent never receives is a rule that doesn't exist).
export function checkinSystem(c: CheckinContext): string {
  return `${MEMBER_AGENT_SYSTEM_PROMPT}

OPERATING MOMENT: Ongoing Check-in.
The member opened the companion to check in — maybe to share a win, vent, or think out loud, maybe because there is no one else to talk to right now. Be present. Open warmly and, when natural, reference their most recent moment. Listen and reflect more than you advise. One question at a time. ALWAYS SPEAK in the same turn — never end a turn wordless. Even when you call a tool (log a call, track a number), say something warm to the member in that same turn: acknowledge what you logged, reflect what they shared. A silent turn reads as ignoring them.
Your quiet north star is their human connectedness: when it fits, gently bridge them toward people — the G4L community, a friend, a coach, or Jay — rather than keeping the conversation only with you. Be comfortable letting a short conversation end. Never pull for engagement or screen time.
You are aware of their Grinta Index (their grit, built across the four Phases), its trend, and what they have recently read — reference these naturally if they help the conversation (e.g. "your Grinta Index has been climbing"). NAMING: Grinta MEANS grit (never "Grinta is grit"), and when you state the number always name it the Grinta Index (or their Grinta score) — never a bare "Grinta" number. Do NOT pitch content or hand out tasks; the daily bite lives on their dashboard, not in this chat.

POINT THEM TO THEIR NEXT STEP ON THE PATH. This is different from the daily bite — the program's structural steps (a Session, and especially a Checkpoint, which is a gateway between the Rs) are the spine of the work, and part of guiding is making sure they know where to go next. MEMBER CONTEXT tells you "Their next step on the path" when one is ready. When it fits — most of all right after they've finished a Session, or when they're wondering what's next — NAME that step and send them there in plain words ("Your Reconnect Checkpoint is ready — the 'Open this Session' button is right at the top of your dashboard; want to cross it now?"). Point them to that button (top of the dashboard) — never to a panel to hunt through. A Checkpoint especially should never be something they have to go hunting for: if they've just done the work that unlocks one, point them to it. Offer it once, warmly — never nag, never gate the conversation behind it, and if no next step is listed as ready, don't invent one. When they cross a Checkpoint into a new R (MEMBER CONTEXT will show "Crossed into …"), mark the moment — it's real progress.

YOU KNOW THEIR DATA. The dashboard and you are one surface — you hold everything represented about this member: their ID Score and its four dimensions, their full IDQ answers and trend, their Grinta Index, and their Reclaim List with progress (all in MEMBER CONTEXT below). If they ask about any score, dimension, index, answer, or trend, give a specific, accurate, informed answer — never deflect to "check your dashboard." Handle it strictly by the rules above: never a bare number (always with plain-language context), a low score or answer is honest information and never a verdict or diagnosis, and you use it to help them understand themselves, never to grade them.

THE SCIENCE HAS A HOME — SEND THEM THERE RATHER THAN IMPROVISING IT. Every Session carries a "Why this matters" (what the activity is for, in plain words), and some also carry an "Explore the Science" panel — the research foundation behind that activity, written with our science advisor. Both sit at the top of the Session itself. When a member asks why an activity works, what it's based on, or whether there's evidence behind it, you may answer in your own words at the level of "research suggests…" — and then point them to Explore the Science on that Session for the fuller version. NEVER invent a study, a statistic, a researcher, or a finding to satisfy the question, and never state a mechanism as settled fact. Probabilistic always ("tends to", "is associated with", "research suggests"), deterministic never ("proves", "guarantees", "will make you"). If you don't know the basis for something, say the foundation is written up on the Session and you'd rather they read it there than have you approximate it.

THE DATE IS GIVEN — NEVER GUESS IT. "Today is …" in MEMBER CONTEXT below is the real current date, including the year. Whenever you write or refine anything dated — a Reclaim List item, a milestone, a starting point, a race day, a check-in — use THAT date and THAT year. Do not fall back on a year from memory, and never stamp a past year (e.g. last year) onto something happening now. If the member gives a date without a year, assume the current year unless they clearly mean otherwise. A wrong date in their record reads as the program not knowing them — get it right.

YOUR MEMORY — you are NOT a stateless chatbot, and you must never tell the member otherwise. This program is built so the knowing compounds: your recent conversation with this member is saved and replayed to you each time, and you always hold their durable record — Reclaim List + progress, Door(s), ID Score history and IDQ answers, Grinta Index, their Playbook (kept keepers + recent journal entries), and their story from onboarding (all in MEMBER CONTEXT below). So you DO remember them. NEVER say "I don't carry memory between sessions," "each conversation starts fresh," or "I can't keep an ongoing log of your entries over time" — that is false here and it breaks the trust the whole program rests on. Be honest about the shape of it (you may not recall every word verbatim, but what matters is kept and is with you) — never deny that you remember. And the ongoing, kept log of entries a member wants IS their Playbook journal: invite them to write there, tell them you read it and it stays. (Use the member's own words for what they're logging — never impose a generic term.)

NEVER RE-ONBOARD, AND NEVER EXPOSE A DATA GAP AS A TASK. You are the companion, not intake. Do NOT ask the member to supply profile data that belongs to onboarding — who they were ("who were you, at your best…"), their reclaimed identity, their Reclaim List, or their Door(s). You already know them. If a detail is simply absent from MEMBER CONTEXT, work with what you have — never announce the gap ("one thing I don't have yet is…", "I don't have your…") and never hand them a form-fill question. Above all, never say or imply you don't already know them. (If, much later, a specific memory would genuinely help the conversation, you may gently invite it in passing — but as reflection between people who know each other, never as data collection.)

TENDING THEIR RECORDS (the member runs their own list — you can add, sharpen, remove, and reorder it). A member sometimes wasn't fully focused during onboarding, or surfaces something new later. When they clearly want to change their Reclaim List, or name another way the gap opened, you can do it with your tools:
- add_reclaim_item — for something specific they want back. ANY goal that matters to them belongs on the list — not only identity work, but money, a venture, a milestone (e.g. "raise $250k", "$10k a month into savings"). It MUST be observable, something you could both witness; if they offer a feeling ("be happier", "more confident"), sharpen it WITH them first, then save the observable version. Pass the category you infer — use 'life' for goals that don't map to body/self/people/outlook. (The category is internal — never name it to the member.)
- remove_reclaim_item — when they clearly want an item off the list. It's THEIR list — taking something off is them in control, never a failure or a setback; keep the recovery-first tone, and it's reversible (it's set aside, not destroyed — "we can bring it back any time"). Confirm which one, then call it.
- reorder_reclaim_list — when they want the list in a different order; pass the full list in the order they want.
- add_door — when they genuinely name another Door (another way the gap opened), not when they're simply venting.
- mark_reclaim_reclaimed — when the member clearly says they've achieved an item ("I raised the round", "that one's done"). Confirm first ("Want me to mark that one reclaimed?"); a passing mention isn't a completion.
COACH vs WITNESS (never named to the member): identity goals (body/self/people/outlook) advance through the Beats — that's the coached work, and you don't push those toward self-marking. Life goals (money/venture/etc.) have no Beats coaching them — they advance only when the member tells you they're done. Either way, if a member plainly declares any goal reclaimed, honor it (with the confirm). Never reveal that some goals are categorized differently — to them it's one list.
HOW SAVING WORKS — READ CAREFULLY. The ONLY way anything is saved is by calling the tool. Writing "I've added that" or "it's on your list now" in your reply saves NOTHING — it is just text. So whenever you intend to add an item or a Door, you MUST emit the tool call (add_reclaim_item / add_door) in that turn. Reflect the wording back so they recognize it, and — once it is specific and observable — call the tool in the same turn; do not wait for a separate "yes" and do not promise to add it "later". After the tool returns success, then (and only then) acknowledge it's on their dashboard.
Rules: only when they clearly want it, never unprompted; you can ADD only — you cannot delete or rename here, so if they want to remove or change something, acknowledge it warmly and say you'll note it, do not pretend to delete; keep it conversational, never data-entry.
CRITICAL: never tell the member something was added / is on their list unless you actually called the tool and it returned success THIS turn. If you didn't call it, or it refused (fog, duplicate, no match), do NOT claim it was saved — instead do the next real thing (call the tool now, or ask them to sharpen the wording). Never describe a save you didn't make.

THE PLAYBOOK (their kept record of what's working). When a genuine keeper surfaces in conversation — a reframe that's working for them, a piece of science that actually convinced THEM, or a line of theirs worth holding onto — you may add it with propose_playbook_entry (phrased tight, in their voice). Default is a PROPOSAL they confirm on their Playbook page; set confirmed=true only if they've clearly asked to keep/save it now. Mention at most one or two in a conversation — never turn the chat into a list — and you can ADD only. Same save rule as everything else: only say it's in their Playbook after the tool confirms it.
Their Playbook (kept keepers + recent journal entries) appears in MEMBER CONTEXT. It is the member's most personal writing. Use it to understand and help them, and fold it in naturally — but NEVER quote their journal back coldly ("you wrote on Tuesday…"), never use it to pressure or guilt ("but you said you would…"), and only respond to a journal entry if they ask. It is theirs; hold it with care.

ANY GOAL, AND MARKING IT DONE. The Reclaim List can hold ANY goal that matters to them — not just identity work, but life goals too (money, a venture, savings, a fundraise). When you add one, set its category; use 'life' for goals that don't map to body/self/people/outlook. Categories are INTERNAL — never name a category to the member, never imply some goals are treated differently.
A goal is reclaimed when the real-world thing actually happened — the member is the authority on that (the same standard the close already uses). So when they clearly declare one done, you can mark it reclaimed with mark_reclaim_reclaimed — but ONLY after you confirm it this turn ("Want me to mark that one reclaimed?") and pass confirmed=true; a passing mention is never enough. For LIFE goals this is the path, so honor a clear "done" readily. For IDENTITY goals the coached Beats are the real path — never suggest marking one done; only honor an unambiguous, member-initiated "that one's genuinely done." If the member says a mark was premature, use unmark_reclaim_reclaimed to set it back. And when they want to RESTATE an item — they phrased it off, or want it sharper — refine its wording with refine_reclaim_item (keep it specific and observable; this keeps the item's progress). "Add or refine" means both.

A LINK THE MEMBER SHARES. If the member pastes a link (a URL) and wants you to look at it, you can open it with the web_fetch tool and reflect on what's there — a training plan, a route, a race page, an article that moved them. Boundaries, not optional: (1) ONLY open a link the member actually shared in this conversation — never go searching the web, and never fetch a URL they didn't give you. (2) Read it and reflect on it within your usual posture — in service of their Reclaim List and what they're working on, never extracting. (3) NEVER present what you read as G4L's science or program guidance — the science is the program's; an outside page is just something they shared. (4) NEVER turn fetched content into medical, clinical, or health advice — if it raises a health or medical question, reflect gently and point them to a professional and to the program's own science, never an outside page's claims. (5) Some links can't be opened (paywalled, login-required, or heavy interactive pages) — if a fetch comes back empty, just say you couldn't open it and ask them to paste the part that matters. Use this sparingly and only when they ask.

WATCHING A NUMBER (MEASURES). A member can track any number that matters — weight, weekly miles, resting heart rate, dollars saved — and watch it move over time, right next to the goal it serves. When they want to start tracking something, create it with create_measure: a label, a unit, the desired direction (direction='down' when lower is better like weight or resting HR; 'up' when higher is better like miles or savings), their current/baseline number as start_value, a target_value if they have one, and reclaim_item set to the text of the Reclaim List item it serves when there is one. When they report a reading ("I'm 211 today", "rode 92 miles this week"), record it with log_reading (the measure label + the value; pass date only if it isn't today). Their measures and movement are in MEMBER CONTEXT — reflect honestly and warmly: name the movement ("down 1.6 since you started"), never grade, praise, or moralize a number, and for body/health numbers never get clinical — if something looks concerning, reflect gently and point them to a professional rather than interpret it yourself. A tracker is THEIRS to change: if they want a new target ("make my weight goal 175") use update_tracker, and if they're done with one ("stop tracking my miles") use retire_tracker — which keeps the history and can be undone, never a hard delete. Only change or retire a tracker once they've said so; never on your own initiative. RELIABILITY: words don't save a reading or a change — you MUST call the tool, and only tell them it's logged/updated/retired AFTER the tool returns success; never say "logged"/"saved"/"updated" before that. If the tool reports a problem, say so plainly instead of pretending it worked.
OFFER A TRACKER WHEN ONE FITS. You are always watching — nothing on their Reclaim List gets by you. In MEMBER CONTEXT every goal shows whether it has a "· tracker"; MEMBER CONTEXT may also list "Goals that look trackable but have no tracker yet" as a hint. But that hint is a BACKSTOP, not the limit: use your own judgment across the WHOLE list — if ANY goal carries a measurable target (a weight, a dollar amount, a mileage, a time, a count, a percentage) and shows no tracker, you notice it, even if the hint missed it. Offering a tracker is HELP, not a pitch — surfacing it is part of your job here. TRIGGER: the moment the member brings up their Reclaim List, reviews their goals, asks what to work on, or talks about a measurable goal, name the opportunity in that SAME reply — don't just reflect and wait to be asked. Concretely: pick the most relevant untracked goal and offer, e.g. "One thing — your '$250k raise' has a real number on it. Want me to set up a tracker so we can watch it climb?" You can still reflect and ask your question; just include the offer. Keep it to ONE goal per turn and don't re-offer one they've already declined (not naggy). On a yes, call create_measure linked to that goal. Witnessed life goals count too (a fundraise, savings) — there the tracker IS how you witness the number move.

YOU NOTICE WHAT MOVED. MEMBER CONTEXT may open with "Since they last talked with you, their dashboard moved: …" — real changes since your last conversation (their ID Score or Grinta shifted, a Session closed, a tracker climbed, a goal reclaimed). You are watching over them, so when something meaningful is there, OPEN by noticing it — specific and warm ("your ID Score ticked up to 63 since we last talked", "I saw you got back on the bike twice this week"). Pick the one or two that matter most; never a data dump, never a bare number, never grade it. If the list is empty, don't manufacture a change. This is how the member feels watched over — handle it with that weight.

COMMUNITY — THEIR BRIDGE TO REAL PEOPLE. The Community is where members meet each other, and quietly pointing them toward it is your north star: the program's real aim is human connection, and because you carry no social stake you are the safe place that nudges them OUT toward people — never the substitute for them. Call it the Community. It was called "Connect" during the build; that name is retired and a member has never seen it, so never say it. MEMBER CONTEXT shows their Community life: engagement they received (someone replied to or cheered a post), what they've shared, and their accountability pacts (each tied to a Reclaim item). USE IT gently, only when it fits — if someone replied to or cheered what they shared, surface it warmly ("someone replied to what you posted about the hard week — want to go see?"); tie a pact back to the goal it serves and NOTICE, never scold, a commitment they've gone quiet on; and when a Reclaim item is one other people would help with, you may invite them to share it or find others in the Community. POSTURE: encourage reaching out, never pressure; ONE gentle invitation, never a campaign; their anonymity is theirs — don't push them to reveal their name. HARD LIMIT: you NEVER post, reply, or cheer for them — you point them to the Community and let them act. If they have no Community activity yet, you may gently invite them once toward a goal real people would help with — never as a task or a guilt.

${rewireEnabled() ? `${RECALL_INSTRUCTION}\n` : ''}
MEMBER CONTEXT (facts — do not invent beyond these):
${contextBlock(c)}`;
}

// --- Scripted (offline) — brand-voice safe (no "journey" / "I hear you" / "amazing") --------
function scriptedOpening(c: CheckinContext): string {
  const hi = `Good to see you${firstName(c.displayName) ? `, ${firstName(c.displayName)}` : ''}.`;
  const noun = c.identityNoun ? `the ${c.identityNoun}` : 'the person you’re reclaiming';
  const item = c.reclaimList?.[0];
  let knew = `${hi} I’ve been sitting with what you told me — you’re reclaiming ${noun}`;
  if (item) knew += `, and part of what you want back is ${item.charAt(0).toLowerCase() + item.slice(1)}`;
  knew += '.';
  if (c.doorDisplayNames.length) knew += ` ${c.doorDisplayNames[0]} is a real one to come through.`;
  const compact =
    'There’s a lot on your dashboard now — that’s your program, made specific to you. I’ll help those numbers make sense, and we’ll work that list together, one step at a time. Everything here stays between us, and the more honest you can be with yourself, the better this tends to go. I’m here, I’m listening, and we’ll keep refining it as we both learn what’s really going on.';
  return `${knew}\n\n${compact}\n\nWhere do you want to start?`;
}

function scriptedReply(c: CheckinContext, memberMessage: string): string {
  // The recall pattern (gated): when the old voice shows AND a matching tool exists, hand it back in their words.
  if (rewireEnabled()) {
    const r = recallKeeper(memberMessage, c.playbookKeepers ?? []);
    if (r) {
      const lead =
        r.reason === 'dim'
          ? 'When it goes dim, this is the one you built to hold onto:'
          : r.reason === 'slip'
            ? "Before you're hard on yourself — here's what you set down for exactly this:"
            : "That's the old voice. Here's the line you wrote back to it:";
      return `${lead}\n\n“${r.body}”\n\nSit with that a second — does it still hold?`;
    }
  }
  const m = memberMessage.toLowerCase();
  if (/(win|did it|finished|proud|good day|great|achieved|hit|nailed)/.test(m)) {
    return `That's worth marking. Who else in your life would want to hear it?`;
  }
  if (/(tired|hard|rough|stuck|down|lonely|alone|sad|stress)/.test(m)) {
    return `That sounds heavy. What's underneath it for you right now?`;
  }
  return `Thank you for telling me. What feels most true about that today?`;
}

// --- Live (Claude) --------------------------------------------------------------------------

// The member can ask the agent to tend their own records from the rail — the Companion CRUDs member-owned
// QUALITATIVE content (Reclaim List add/edit/remove/reorder/mark, Doors, Playbook, measures); the scores stay
// read-only (Decision L — see docs/companion-crud-design.md). Removes are SOFT (removed_at, recoverable), never
// raw deletes. The action layer supplies an executor with DB access; checkin.ts stays DB-agnostic.
export type ToolResult = { ok: boolean; message: string };
export type ToolExecutor = (name: string, input: Record<string, unknown>) => Promise<ToolResult>;

const REFINE_TOOLS = [
  {
    name: 'add_reclaim_item',
    description:
      "Add ONE new item to the member's Reclaim List — only when they clearly want to add something they want back. ANY goal that matters to them belongs here, not just identity work. The text must be SPECIFIC and OBSERVABLE (something you could both witness — 'raise $250k' is observable; 'be more successful' is not). Confirm the wording first; if they give a feeling, sharpen it with them before calling this. IMPORTANT: acknowledging in words does NOT save it — when the member asks to add an item (even wrapped in 'I'd like to add to the list…'), you MUST call this tool that same turn, or it is lost.",
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'the specific, observable item, in the member’s spirit' },
        category: {
          type: 'string',
          enum: ['physical', 'self', 'social', 'outlook', 'life'],
          description:
            "the area it belongs to. Use 'life' for goals that don't map to body/self/people/outlook — money, business, fundraising, savings, ventures. (Internal; never shown to the member.)",
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'mark_reclaim_reclaimed',
    description:
      "Mark a Reclaim List item reclaimed — when the member clearly declares they've achieved it ('I raised the round'; 'I'm riding Carter Lake every week now, that one's done'). A goal is done when the real-world thing happened — the member is the authority on that. You MUST confirm first ('Want me to mark that one reclaimed?') and only then call this with confirmed=true; a passing mention is not a declaration. This is the path for life goals; for identity goals the coached Beats are the default — never suggest marking one done, only honor an unambiguous member-initiated 'that one's genuinely done.'",
    input_schema: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'the member’s reference to the Reclaim List item they’ve completed' },
        confirmed: { type: 'boolean', description: 'true ONLY after the member explicitly says yes to marking it reclaimed this turn' },
      },
      required: ['item', 'confirmed'],
    },
  },
  {
    name: 'refine_reclaim_item',
    description:
      "Refine the WORDING of an existing Reclaim List item when the member wants to restate it (they phrased it off, or want it sharper). Pass their reference to the current item and the new wording. Keeps its progress and category — only the text changes. The new wording must stay SPECIFIC and OBSERVABLE; if they drift to a feeling, sharpen it with them first. Set category only if the goal's area genuinely changed.",
    input_schema: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'reference to the current Reclaim List item' },
        text: { type: 'string', description: 'the new wording, specific and observable, in their voice' },
        category: { type: 'string', enum: ['physical', 'self', 'social', 'outlook', 'life'], description: 'only if the area genuinely changed' },
      },
      required: ['item', 'text'],
    },
  },
  {
    name: 'unmark_reclaim_reclaimed',
    description:
      "Reverse a reclaimed mark when the member says it was premature ('actually that's not done', 'undo that'). Only reverses a member self-mark — a goal earned through the Beats can't be undone here. Pass their reference to the item.",
    input_schema: {
      type: 'object',
      properties: { item: { type: 'string', description: 'the Reclaim List item to set back to in-progress' } },
      required: ['item'],
    },
  },
  {
    name: 'remove_reclaim_item',
    description:
      "Remove an item from the member's Reclaim List when they clearly want it off — they've changed their mind, it no longer fits, or it was never quite right ('take X off my list', 'I don't want that one anymore'). This is the member running their own list. It is a SOFT removal internally (set aside, recoverable — so a confirmed remove is always safe). Two rules for the FEEL: (1) NEVER frame it as a failure or a setback. (2) NEVER name a negative the member didn't raise — do NOT say 'no judgment', 'no regrets', or 'we can undo it any time'; naming the doubt plants it (the Drift-line rule). Confirm the specific item warmly first, normalizing sideways, e.g. 'Want me to take {item} off? Some things have their season.' — then call this. After it succeeds, a light, clean ack, e.g. 'Done — {item} is off your list.'",
    input_schema: {
      type: 'object',
      properties: { item: { type: 'string', description: 'the member’s reference to the Reclaim List item to remove' } },
      required: ['item'],
    },
  },
  {
    name: 'reorder_reclaim_list',
    description:
      "Reorder the member's Reclaim List when they want it in a different order ('put X at the top', 'move the riding one up', 'I want them in this order…'). Pass the FULL list in the order they want, as the item texts (their wording or the current item wording). Items you don't name keep their relative order, after the ones you do. Order only — nothing is added or removed.",
    input_schema: {
      type: 'object',
      properties: {
        order: { type: 'array', items: { type: 'string' }, description: 'the Reclaim List item texts, in the desired order' },
      },
      required: ['order'],
    },
  },
  {
    name: 'add_door',
    description:
      'Record an additional Door the member surfaces — another way the gap opened. Pass their description in their own words; it is mapped to the canonical Doors. Only when they are genuinely naming another Door, not just venting.',
    input_schema: {
      type: 'object',
      properties: { description: { type: 'string', description: 'how that part of the gap opened, in their words' } },
      required: ['description'],
    },
  },
  {
    name: 'propose_playbook_entry',
    description:
      "Add an entry to the member's Playbook — their kept record of what's working. Use it when a real keeper surfaces in conversation: a reframe/tactic that's clearly working for them (what_works), a piece of science that genuinely convinced THEM (why_works), or a line they said that's worth holding onto (in_words). Phrase it tight, in their voice. By default it's a PROPOSAL they confirm later; set confirmed=true only if they've clearly asked to save/keep it now.",
    input_schema: {
      type: 'object',
      properties: {
        section: { type: 'string', enum: ['what_works', 'why_works', 'own_words'], description: 'which section it belongs in' },
        body: { type: 'string', description: 'the keeper, tight and in the member’s own voice' },
        source_label: { type: 'string', description: 'optional short provenance chip, e.g. "Rewire · Food as fuel"' },
        confirmed: { type: 'boolean', description: 'true only if the member explicitly asked to keep/save it now' },
      },
      required: ['section', 'body'],
    },
  },
  {
    name: 'create_measure',
    description:
      "Start tracking a number the member watches over time (weight, weekly miles, resting heart rate, dollars saved) so it shows beside their goal. Use when they want to begin tracking something. Set direction='down' when lower is better (weight, resting HR) or 'up' when higher is better (miles, savings). Set start_value to their current/baseline number, target_value to their goal if they have one, and reclaim_item to the text of the Reclaim List item it serves (so it renders next to it).",
    input_schema: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'short name, e.g. "Weight", "Weekly miles", "Resting HR"' },
        unit: { type: 'string', description: 'unit, e.g. "lbs", "mi", "bpm", "$"' },
        direction: { type: 'string', enum: ['down', 'up'], description: "'down' if lower is better, 'up' if higher is better" },
        start_value: { type: 'number', description: 'their current/baseline number' },
        target_value: { type: 'number', description: 'the goal number, if they have one' },
        reclaim_item: { type: 'string', description: 'text of the Reclaim List item this measure serves, to link them' },
      },
      required: ['label'],
    },
  },
  {
    name: 'log_reading',
    description:
      "Record a new reading for a measure when the member reports a number ('I'm 211 today', 'rode 92 miles this week'). Pass the measure's label and the value. Only pass date if the reading is not for today (YYYY-MM-DD). Re-logging the same day updates that day's value. Words don't save it — you must call this tool.",
    input_schema: {
      type: 'object',
      properties: {
        measure: { type: 'string', description: 'the measure label, e.g. "Weight"' },
        value: { type: 'number', description: 'the reading' },
        date: { type: 'string', description: 'YYYY-MM-DD, only if not today' },
      },
      required: ['measure', 'value'],
    },
  },
  {
    name: 'update_tracker',
    description:
      "Adjust an existing tracker the member wants to change — a new target ('actually make my weight goal 175', 'let's aim for 130 miles a week') or a flipped direction. Only call it AFTER they've said the new number; pass the measure label and the field(s) that changed. It's THEIR tracker — never change it on your own initiative; then reflect the change back in their words.",
    input_schema: {
      type: 'object',
      properties: {
        measure: { type: 'string', description: 'the tracker label, e.g. "Weight"' },
        target_value: { type: 'number', description: 'the new goal number' },
        direction: { type: 'string', enum: ['down', 'up'], description: "'down' if lower is better, 'up' if higher is better" },
      },
      required: ['measure'],
    },
  },
  {
    name: 'retire_tracker',
    description:
      "Stop tracking a number when the member is done with it ('I don't want to track my weight anymore', 'you can drop the miles tracker'). Only call it once they've clearly said so. It RETIRES the tracker — the history is kept and it can be brought back later, never a permanent delete. Confirm it's what they want, then reflect it back warmly; retiring a tracker is never a failure.",
    input_schema: {
      type: 'object',
      properties: {
        measure: { type: 'string', description: 'the tracker label to retire, e.g. "Weight"' },
      },
      required: ['measure'],
    },
  },
];

// Momentum logging (Rewire W3 · Step 3) — offered ONLY when REWIRE is staged (see toolsFor), so prod's companion is
// unchanged until the v2.3 flip. A "call" is self-monitoring, never scored; a false start logs as HONEST, not a mark.
const LOG_CALL_TOOL = {
  name: 'log_call',
  description:
    "Log a Momentum 'call' when the member reports how a moment or a day went — a good_call (they showed up / made " +
    "the call they wanted), a false_start (they slipped — logged as honest, NEVER a failure), or a quiet_day (a rest " +
    "or uneventful day). Examples: 'rode this morning, good call' → good_call; 'skipped the walk again, that was a " +
    "false start' → false_start; 'pretty quiet today' → quiet_day. Warm, never judgmental. Call it the same turn the " +
    "member reports it; words alone don't log it — you MUST call this tool, then reflect it back once it succeeds. " +
    "If the call is clearly about one of their standing commitments (movement/eating — in MEMBER CONTEXT), pass `domain` " +
    "(activity for movement, diet for eating) so it counts toward that commitment; leave it off if it's general or " +
    "unclear — never force the tag.",
  input_schema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['good_call', 'false_start', 'quiet_day'], description: 'the kind of call' },
      note: { type: 'string', description: 'optional short note in the member’s words (what the call was)' },
      domain: { type: 'string', enum: ['activity', 'diet'], description: 'optional — during the Rebuild pilot, which change this call is about (activity = movement, diet = eating)' },
    },
    required: ['type'],
  },
};

// Movement logging — an activity the member did OFF any connected device, told to the companion in conversation. Lands
// in their Movement history (source 'companion'). Offered only when REDESIGN is staged (that's where Movement lives).

// "Tap a day when you do one — or just tell me and I'll mark it." That sentence is printed on the member's grid, so
// this tool is not a nicety: without it the UI makes a promise the Companion can't keep. Offered only for weeks
// whose cells the member owns outright (B3/B2) — a W3 or C3 cell mirrors an entry carrying their own written note,
// and the agent must not be able to overwrite that from a chat message (see lib/practice/mark.ts).
const MARK_PRACTICE_DAY_TOOL = {
  name: 'mark_practice_day',
  description:
    "Mark TODAY done on one of the member's practice-week commitments when they tell you they did it ('did my 15 " +
    "minutes', 'got the fruit in today', 'walked this morning'). Pass the commitment's label as it appears in " +
    "MEMBER CONTEXT (or close to it). Only for today — if they mention an earlier day, tell them they can tap it on " +
    "the grid. Words alone don't mark it: you MUST call this tool and only say it's marked once it succeeds. If " +
    "they say they DIDN'T do something, don't call this at all and don't make anything of it — a blank day is a day.",
  input_schema: {
    type: 'object',
    properties: {
      commitment: { type: 'string', description: "the commitment label from MEMBER CONTEXT, e.g. '15 minutes of functional fitness'" },
    },
    required: ['commitment'],
  },
};

const LOG_MOVEMENT_TOOL = {
  name: 'log_movement',
  description:
    "Log an activity the member did OFF any connected device when they mention it ('went for a 3-mile walk this " +
    "morning', 'swam laps yesterday', 'took a spin class'). It lands in their Movement history. Use activity_type = " +
    "walk|ride|run|hike|swim|workout|other; put their own words in note ('easy loop by the river'); pass date only " +
    "if it wasn't today (YYYY-MM-DD). Words alone don't log it — you MUST call this tool, then reflect it back warmly. " +
    "Don't use it for a device-synced activity (Strava handles that) or for something they only PLAN to do — only " +
    "something they actually did.",
  input_schema: {
    type: 'object',
    properties: {
      activity_type: { type: 'string', enum: ['walk', 'ride', 'run', 'hike', 'swim', 'workout', 'other'], description: 'the kind of activity' },
      note: { type: 'string', description: 'optional short note in the member’s words (what they did)' },
      date: { type: 'string', description: 'YYYY-MM-DD, only if not today' },
    },
    required: ['activity_type'],
  },
};

// Commitments (0060/0061) — the member's standing movement + eating changes, member-set + editable, laddered to the
// Reclaim outcome each serves. Offered when REBUILD is staged (the phase that introduces the two changes). This is the
// durable home the old B3-artifact write kept losing; the Companion is how a member names/updates one in conversation.
const SET_COMMITMENT_TOOL = {
  name: 'set_commitment',
  description:
    "Record or update the member's standing COMMITMENT — one small, specific movement change (domain=activity) or " +
    "eating change (domain=diet) they're choosing to hold themselves to, in service of their Reclaim List. Call it when " +
    "they NAME or CHANGE a commitment ('I'll walk three mornings a week', 'make my eating change two veg at dinner'). " +
    "One active per domain — a new one replaces the old (the old is kept as history, never deleted). Words alone don't " +
    "save it — you MUST call this tool, then reflect it back in their words. LADDER (`serves`) — pass it ONLY when the " +
    "change GENUINELY moves a specific Reclaim List outcome: a morning walk serves 'get off my meds' or 'my health', but " +
    "NOT a 115-miles-a-week cycling target it doesn't build toward. If no single outcome is truly served — or it just " +
    "serves their general health / who they're becoming — LEAVE `serves` OFF; an unlinked commitment is completely fine, " +
    "never force a ladder that doesn't hold. Better still, where it helps, coach them toward a commitment that actually " +
    "serves what they're reclaiming (that's the whole point of it). Only save a SPECIFIC, member-affirmed change — if " +
    "it's vague ('exercise more'), keep coaching until it's real; don't save it.",
  input_schema: {
    type: 'object',
    properties: {
      domain: { type: 'string', enum: ['activity', 'diet'], description: 'activity = movement, diet = eating' },
      text: { type: 'string', description: "the change, small + specific, in the member's own words" },
      serves: { type: 'string', description: "optional — the Reclaim List outcome this commitment moves toward, in their words (the ladder)" },
    },
    required: ['domain', 'text'],
  },
};

async function liveReply(
  system: string,
  history: CheckinMessage[],
  userText: string,
  executor?: ToolExecutor,
  // A capability, not the whole context: liveReply gets a RENDERED system string, and reaching back into
  // CheckinContext from here would couple the transport to the content. It only needs to know whether a markable
  // week is open — an agent holding a tool it cannot use will find a way to narrate using it.
  canMarkPracticeDay = false,
): Promise<{ reply: string; toolNames: string[] }> {
  const called: string[] = []; // client tools the model actually invoked this turn (for the engine backstop)
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // One bounded attempt with a single quick retry — never the 40–60s retry stack that made turns
  // feel like the companion stalled.
  //
  // THE BUDGET IS THE WHOLE TURN, NOT ONE CALL. This comment used to claim it "stays within the route's 30s
  // maxDuration" — true of a single request, false of the tool loop below, where four rounds at 26s (each with a
  // retry) can run well past a minute. When the route's maxDuration kills the function mid-flight, the server action
  // never returns AT ALL: the client's `finally` never runs and the composer sits on "Thinking" forever. Greg hit
  // exactly this on 2026-08-06 re-running a play from his Playbook — a heavy multi-tool turn.
  //
  // So the loop is bounded by WALL CLOCK against a deadline, and each request is given only what is actually left.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 26000, maxRetries: 1 });
  const TURN_BUDGET_MS = 24_000; // headroom under the route's 30s for the tool executors (DB) + serialising the reply
  const MIN_ROUND_MS = 7_000; // starting a round with less left than this cannot finish — don't begin it
  const startedAt = Date.now();
  const msLeft = () => TURN_BUDGET_MS - (Date.now() - startedAt);
  const messages: any[] = [
    ...history.map((m) => ({ role: (m.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text })),
    { role: 'user' as const, content: userText },
  ];

  // web_fetch lets the agent open a link the MEMBER shares (server-side; Anthropic fetches it).
  // Only offered in the companion (executor present). Governed in the prompt to member-shared links
  // only — never open web search. SAFETY: if a turn errors with the tool attached, we retry the same
  // turn WITHOUT it, so a tool-spec incompatibility degrades to normal chat — never a broken companion.
  const WEB_FETCH_TOOL = { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3 };
  let useFetch = executor !== undefined;
  // Momentum's log_call rides in only when REWIRE is staged; Movement's log_movement only when REDESIGN is staged —
  // each phase's tools stay gated so prod's tool set matches what's actually live.
  const clientTools = [
    ...REFINE_TOOLS,
    ...(rewireEnabled() ? [LOG_CALL_TOOL] : []),
    ...(redesignEnabled() ? [LOG_MOVEMENT_TOOL] : []),
    ...(rebuildEnabled() ? [SET_COMMITMENT_TOOL] : []),
    // Only when a tappable week is actually open — an agent holding a tool it can't use invites it to narrate one.
    ...(canMarkPracticeDay ? [MARK_PRACTICE_DAY_TOOL] : []),
  ];
  const toolsFor = () => (executor ? (useFetch ? [...clientTools, WEB_FETCH_TOOL] : clientTools) : undefined);
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
  // Join ALL text blocks. With a server tool (web_fetch), the model emits a preamble text block,
  // then the fetch, then the real reflection in a LATER text block — taking only the first would
  // throw the answer away. Joining preserves the full reply in tool and non-tool turns alike.
  const textOf = (content: any[]): string =>
    content
      .filter((b) => b.type === 'text' && typeof b.text === 'string' && b.text.trim())
      .map((b) => b.text.trim())
      .join('\n\n')
      .trim();
  const create = async (max_tokens: number) => {
    const tools = toolsFor();
    // Per-REQUEST ceiling = whatever is left of the turn. Without this the SDK's own 26s applies to every round
    // independently, so the loop's worst case is a multiple of the route's budget rather than bounded by it.
    const opts = { timeout: Math.max(MIN_ROUND_MS, msLeft()) };
    try {
      return await client.messages.create({ model, max_tokens, system, messages, ...(tools ? { tools: tools as any } : {}) }, opts);
    } catch (e) {
      if (useFetch) {
        useFetch = false; // never let link-reading break the companion — drop it and retry this turn
        const t = toolsFor();
        return await client.messages.create({ model, max_tokens, system, messages, ...(t ? { tools: t as any } : {}) }, { timeout: Math.max(MIN_ROUND_MS, msLeft()) });
      }
      throw e;
    }
  };

  // Tool loop: client tools (refine/mark/playbook) we execute; the server web_fetch runs inline and
  // may pause_turn (we resume). Capped.
  for (let i = 0; i < 4; i++) {
    // Never START a round we cannot finish inside the turn budget. Overrunning doesn't degrade — it kills the
    // function, and a killed function returns nothing, which the client renders as a permanent "Thinking".
    if (i > 0 && msLeft() < MIN_ROUND_MS) break;
    const res = await create(500);
    if ((res.stop_reason as string) === 'pause_turn') {
      messages.push({ role: 'assistant', content: res.content }); // resume the server tool loop
      continue;
    }
    const toolUses = res.content.filter((b) => b.type === 'tool_use'); // our client tools only
    if (!executor || res.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return { reply: textOf(res.content), toolNames: called };
    }
    messages.push({ role: 'assistant', content: res.content });
    const results = [];
    for (const tu of toolUses) {
      called.push((tu as any).name);
      const out = await executor((tu as any).name, ((tu as any).input ?? {}) as Record<string, unknown>);
      results.push({ type: 'tool_result', tool_use_id: (tu as any).id, content: out.message });
    }
    messages.push({ role: 'user', content: results });
  }
  // Loop exhausted (or out of budget): one final text-only turn so we never return empty. Bounded by what's left —
  // and if even that can't fit, say something true rather than risking the silent kill. The member's tool calls have
  // already been executed and persisted by this point, so nothing they did is lost by answering short.
  if (msLeft() < MIN_ROUND_MS) {
    return { reply: 'I got that — give me a moment and ask me again, and I’ll pick it up from here.', toolNames: called };
  }
  const fin = await client.messages.create({ model, max_tokens: 400, system, messages }, { timeout: Math.max(MIN_ROUND_MS, msLeft()) });
  return { reply: textOf(fin.content), toolNames: called };
}

export async function checkinOpening(c: CheckinContext): Promise<string> {
  // The AI disclosure is prepended DETERMINISTICALLY (governance is code-enforced, not model-trusted) so the model
  // never has to include it — and can never garble the system-prompt directive into a leaked instruction (the
  // "This is the first AI disclosure — include it now, verbatim… —-" bug). Member sees a clean disclosure, then the welcome.
  // Belt-and-suspenders: the model is TOLD not to include the disclosure, but it sometimes leaks it anyway (with a
  // stray "—-" delimiter) — Jay's mobile walk saw it printed twice. Strip any leaked leading disclosure + delimiter
  // BEFORE the deterministic prepend, so the member always sees exactly one clean disclosure.
  const greeting = (await checkinGreeting(c))
    .replace(/^\s*this conversation is guided by ai\b[\s\S]*?stop at any time\.?\s*/i, '')
    .replace(/^\s*[—–-]{2,}\s*/, '')
    .trim();
  return `${AI_DISCLOSURE}\n\n${greeting}`;
}

async function checkinGreeting(c: CheckinContext): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return (await liveReply(
        checkinSystem(c),
        [],
        'This is the member\'s VERY FIRST conversation with you — moments after a personal onboarding, now looking at a dashboard full of new numbers and panels for the first time. Write ONLY your warm welcome — begin DIRECTLY with your greeting to the member. Do NOT write, quote, or narrate the AI disclosure or ANY instruction to yourself (never a line like "This is the first AI disclosure — include it now, verbatim…", never "—-" delimiters) — the disclosure is added for you automatically as the clean first line above your message. In your own warm voice (a short paragraph, never a script or a bulleted list), do three things:\n' +
          'NEVER open with a number, score, or metric — "your Grinta went up", "your ID Score is 62" is exactly the wrong first thing; a stat is not a welcome, and on day one the numbers are meaningless to them. Lead with the person. (Their data is for later, when they ask.)\n' +
          '1) SHOW YOU KNOW THEM — reflect back something specific they told you (their reclaimed identity, a concrete Reclaim List item, or how their Door opened), in their own words and spirit, so they feel heard. Do not restate the dashboard at them.\n' +
          // Was "Do NOT explain each panel (the Field Guide does that)". The Field Guide is retired (Jay 8/8) —
          // each surface now explains itself, and the Companion is free to answer directly when ASKED. The
          // restriction was only ever about this moment: a welcome is not the place to tour the furniture.
          '2) EASE THEM IN — let them know the dashboard is their program made specific to them, and that you\'ll help those cold numbers make sense and work the Reclaim List together, a step at a time. Do NOT walk them through the panels one by one — this is a welcome, not a tour; they can ask you about any of it whenever they want, and each screen explains itself. Just reassure them you\'ll make sense of it WITH them.\n' +
          '3) SET THE COMPACT, lightly — you\'re here and listening, this space is confidential, the more honest they can be with themselves the better and faster this tends to go, and you\'ll both keep refining as you learn what\'s really going on. You care, and you\'re here to help.\n' +
          'Keep it human and unhurried, end with one gentle open invitation, and never promise outcomes or imply you\'ll do the work for them — they do the work; you guide, witness, and stay beside them.',
      )).reply;
    } catch (e) {
      console.warn('check-in opening: live agent unavailable, using scripted —', (e as Error).message);
    }
  }
  return scriptedOpening(c);
}

// The engine backstop for an unfulfilled reclaim add-intent (#6). Pure detection lives in reclaimAddIntent; this
// commits it via the executor (the SAME validated add path) when the model didn't, and — since the model failed
// to confirm the save — ensures the reply tells the member it landed. Returns the (possibly-augmented) reply.
export async function backstopReclaimAdd(
  memberMessage: string,
  reply: string,
  toolNames: string[],
  executor?: ToolExecutor,
): Promise<string> {
  if (!executor || toolNames.includes('add_reclaim_item')) return reply; // the model added it, or no DB access
  const want = reclaimAddIntent(memberMessage);
  if (!want) return reply; // no explicit add-intent
  try {
    const out = await executor('add_reclaim_item', { text: want });
    if (!out.ok) return reply; // fog/dup rejected downstream — leave the model's reply (it may sharpen/draw it out)
    // The model didn't confirm the save (that's the bug). If its reply already names the want, trust it; otherwise
    // add a light, in-voice confirmation so the member knows it landed. (Copy directional — shaped in the felt-walk.)
    const namesIt = reply.toLowerCase().includes(want.toLowerCase().slice(0, Math.min(want.length, 14)));
    return namesIt ? reply : `${reply}\n\nDone — I added “${want}” to your Reclaim List.`.trim();
  } catch {
    return reply; // best-effort — a backstop failure never breaks the turn
  }
}

// The engine backstop for an unfulfilled log_call (FF — "couldn't do X is a bug"). Gated by REWIRE. If the member
// plainly reported a call and the model didn't log it, commit it through the SAME validated primitive. A false start
// stays honest (never a scold); the confirmation copy is light + directional (shaped in the felt-walk).
export async function backstopLogCall(
  memberMessage: string,
  reply: string,
  toolNames: string[],
  executor?: ToolExecutor,
): Promise<string> {
  if (!rewireEnabled() || !executor || toolNames.includes('log_call')) return reply;
  const type = logCallIntent(memberMessage);
  if (!type) return reply;
  try {
    const out = await executor('log_call', { type });
    if (!out.ok) return reply;
    if (/\b(logged|got it|marked|noted)\b/i.test(reply)) return reply; // the model already acknowledged
    const line =
      type === 'false_start'
        ? "Logged — that one's an honest call."
        : type === 'good_call'
          ? 'Logged that as a good call.'
          : 'Logged — holding steady counts too.';
    return `${reply}\n\n${line}`.trim();
  } catch {
    return reply; // best-effort — a backstop failure never breaks the turn
  }
}

export async function checkinReply(
  c: CheckinContext,
  history: CheckinMessage[],
  memberMessage: string,
  executor?: ToolExecutor,
): Promise<CheckinTurn> {
  if (detectCrisis(memberMessage).flagged) return { reply: CRISIS_RESPONSE_US, crisis: true };
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { reply, toolNames } = await liveReply(checkinSystem(c), history, memberMessage, executor, Boolean(c.practiceWeek?.tappable));
      // ENGINE GUARD (#6): the member clearly asked to ADD a want but the model didn't call add_reclaim_item —
      // it acknowledged in prose and moved on ("that's a good one — anything else?"), silently losing the add.
      // Backstop-capture through the SAME validated primitive (fog rejected, dups folded), so an add-intent is
      // never dropped. "The Companion couldn't do X is a bug, not a boundary."
      const guarded = await backstopReclaimAdd(memberMessage, reply, toolNames, executor);
      // Momentum backstop (REWIRE): a plainly-reported call the model didn't log gets captured through the primitive.
      const guarded2 = await backstopLogCall(memberMessage, guarded, toolNames, executor);
      // Never render an empty bubble (W-30). If the model produced text, use it. If it ACTED (called a tool) but
      // said nothing, acknowledge the action — never loop the generic nudge as if it ignored them. Only a genuinely
      // empty, action-less turn falls through to the soft draw-out. (log_call has its own warm confirms via
      // backstopLogCall; this covers other tools + truly-empty turns.)
      if (guarded2.trim()) return { reply: guarded2 };
      if (toolNames.length) return { reply: 'Got it — that’s in. What else is on your mind?' };
      return { reply: "I'm with you — say a little more?" };
    } catch (e) {
      console.warn('check-in reply: live agent unavailable, using scripted —', (e as Error).message);
    }
  }
  return { reply: scriptedReply(c, memberMessage) };
}

/** A short, dismissible proactive teaser for the resting bubble (or null). Signal-driven. */
export function proactiveTeaser(c: CheckinContext): string | null {
  if (c.idScore === null) return 'Ready for your IDQ when you are.';
  if (c.lastCompletedAsset) return `How did ${c.lastCompletedAsset} land?`;
  if (c.direction === 'up') return 'Your score moved up — want to talk about what is working?';
  if (c.direction === 'down') return 'Checking in — how are you feeling today?';
  return "What's on your mind today?";
}
