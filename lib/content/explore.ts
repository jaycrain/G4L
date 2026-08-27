// "Explore the Science" — the third tier of framing on a session, below the "Why this matters" summary.
//
// WHERE IT CAME FROM. Greg, 2026-08-07: "I suggest adding a bit more depth to the introduction that helps a member
// gain some insight before jumping in… I thought it could be used as a hyperlink and we can say 'Click the Explore
// link to take a deeper dive'… I think [it] is conceptually different than the Why it Matters box and provides more
// context." He drafted C1's from the Science Check and offered to do the rest: "It wouldn't be too hard to do this
// for other activities since I already drafted the foundations in the Science Check files."
//
// WHY IT IS NOT A REPLACEMENT for summaries.ts. All six of his C1 points were ALREADY in our C1 "Why this matters" —
// compressed into four sentences that he himself voice-passed on 2026-07-20. This tier is the same ideas at a
// different resolution and for a different job: six labelled principles you can point at, so a member who wants to
// know the foundation is real can see that it is. Tier 2 tells you why it matters; tier 3 shows you it's grounded.
// So: DO NOT restate a point here that the summary already makes better in fewer words — earn the extra tap.
//
// VOICE. Greg's draft is his own and he says so ("It is still a b[i]t 'researchy'"). His science is the source; the
// wording is ours. Two rules carried from the summaries:
//   · PROBABILISTIC, never deterministic — "tends to", "more likely", "research suggests". Never "proves"/"guarantees".
//     (The science-check language rule — it applies here more than anywhere, since this tier IS the evidence claim.)
//   · Second person, plain, no jargon a member would have to look up. "Goals you actually chose", not
//     "self-concordant goals". The construct name belongs in Greg's documents, not on a member's screen.
//
// The heads are deliberately full sentences — a member skimming only the bold lines should still get the argument.

import type { AssetId } from './summaries.ts';

export type ExplorePoint = { head: string; body: string };
export type Explore = {
  /** Panel subtitle — names what the foundation is FOR, in the member's terms. */
  lede: string;
  points: ExplorePoint[];
};

// ALL TWELVE (2026-08-07). C1 shipped first as a probe; Jay saw it working and asked for the rest the same day.
//
// SOURCE: each asset's Science Check has a "Scientific scaffolding" section — Greg's numbered principles with a
// paragraph each. That is where every point below comes from; nothing here is invented, and nothing scientific has
// been softened. What changed is the register:
//   · the construct names stay in HIS documents — no "self-discrepancy theory", no "self-concordance", no
//     "PRECEDE-PROCEED", no "broaden-and-build". A member should not have to look a word up to read their own screen.
//   · second person, and short enough that skimming only the bold lines still gets you the argument.
//   · probabilistic throughout ("tends to", "research suggests"), never deterministic — the science-check language
//     rule matters more here than anywhere else, because this tier IS the evidence claim.
//
// The counts differ because HIS do: R1/R2/R3/B3/C2/C3 have six principles, B2 five, W1/W2/B1 four. Padding the short
// ones to a uniform six would mean writing science he didn't write.
export const ASSET_EXPLORE: Partial<Record<AssetId, Explore>> = {
  r1: {
    lede: 'Why looking honestly at the distance comes first',
    points: [
      { head: 'A gap you can name is one you can work on',
        body: 'Research suggests people are moved more by a specific distance than a vague sense of having slipped. Locating it — this area, this far — turns a feeling into something you can act on.' },
      { head: 'Seeing clearly comes before feeling better',
        body: 'This does not try to cheer you up first. Turning attention on yourself as something to observe tends to surface where you have drifted from your own standards, and that recognition is what makes the rest of the work aim somewhere real.' },
      { head: 'Rating areas separately beats one overall verdict',
        body: 'A single judgment about yourself tends to be blunt and hard to use. Research suggests a more differentiated picture — steady here, thin there — is both more accurate and easier to act on than a global sense of how you are doing.' },
      { head: 'You are measured against yourself, not a chart',
        body: 'The reference point is the fuller version of you that you still remember, not an average or a norm. That comparison tends to land harder, because you are not falling short of a standard — you are at a distance from something you can still feel.' },
      { head: 'This is about who you are, not only what you do',
        body: 'People sustain effort longer when it connects to who they are or are becoming. Naming the identity part of the gap early is what lets later work be about closing a distance from yourself, rather than a list of tasks.' },
      { head: 'Knowing where you actually stand makes the rest aim true',
        body: 'Research suggests people regulate themselves better when they can say honestly where they are. Setting goals before that tends to produce effort pointed at the wrong thing.' },
    ],
  },
  r2: {
    lede: 'Why naming how it happened changes what you can do about it',
    points: [
      { head: 'The circumstances that cause this are known, and common',
        body: 'Loss, a shrinking social world, a role that absorbs everything, caregiving, autopilot — research documents these as reliable disrupters of routine and self-concept, often long after the event. Naming yours places it in a recognized pattern rather than leaving it as private drift.' },
      { head: 'A story you can work with beats a fog you are inside',
        body: 'People tend to move through life change more steadily when they can put it in order — what came first, what shaped you most, what is still going on. That sequence turns a pile of circumstances into something with a shape.' },
      { head: 'Naming what happened to you does not hand away your agency',
        body: 'Blaming yourself for everything tends toward shame; blaming circumstances entirely tends toward helplessness. Holding both — a real cause, and what you are still choosing — tends to support more durable motivation than either on its own.' },
      { head: 'Which doors matters more than that you drifted',
        body: 'Identity loss is rarely felt as one undifferentiated thing; it erodes in specific places. Knowing which ones gives you a different and more usable starting point than knowing only that something went.' },
      { head: 'Finding it is a shared pattern takes the weight out of it',
        body: 'When people learn others walked through the same doors, they tend to stop reading their own pattern as a personal defect. That does not remove responsibility for what comes next, but it lowers the shame that usually stops people engaging at all.' },
      { head: 'Sitting with why is different from noticing that',
        body: 'Knowing a problem exists is not the same as having worked out where it came from. The slower version tends to stay available to you later, as something to steer by, in a way that a passing realisation does not.' },
    ],
  },
  r3: {
    lede: 'Why an honest mirror and a direction belong in the same activity',
    points: [
      { head: 'Drift is patterned, not random',
        body: 'The Fade rarely arrives as one event. It shows up through repeated, individually reasonable choices that move the baseline — and research suggests people steer better against a pattern they can see than against a general sense of slipping.' },
      { head: 'Aiming at a person works better than aiming at an outcome',
        body: 'A picture of who you want to become tends to organize effort more durably than a target you want to hit. It makes the work about becoming someone rather than completing tasks.' },
      { head: 'The closer that future person feels, the more you will do for them',
        body: 'When a future self feels like a stranger, present comfort usually wins. Writing to and about the person you are becoming tends to close that distance — which matters for anything that costs effort now and pays later.' },
      { head: 'Past, present and direction work better as one thread',
        body: 'Motivation tends to weaken when your own story feels fragmented. Putting how you drifted, where you are, and where you are going into one arc makes the effort feel like it belongs to something.' },
      { head: 'Writing turns longing into something you can act on',
        body: 'Research suggests that putting difficult things and personal aims into words improves clarity and emotional processing. A letter asks for honesty in a way that a plan does not.' },
      { head: 'Looking back and looking forward correct each other',
        body: 'Dwelling only on the past risks rumination; imagining only the future risks fantasy. Holding both tends to be steadier than either, and it is what turns recognition into a direction.' },
    ],
  },
  w1: {
    lede: 'Why the reasonable-sounding lines are the ones that cost you',
    points: [
      { head: 'You respond to the meaning, not the fact',
        body: 'A skipped walk can be "I needed a break" or "I am slipping into something." Same fact, different consequence — and over time those readings shape how much effort you are willing to spend.' },
      { head: 'You can hear a hard truth without collapsing under it',
        body: 'Health information that touches identity often triggers defensiveness or avoidance. Research suggests people take it in better when their sense of worth is intact — so building the stronger lines first is what makes the honest look survivable.' },
      { head: '"It is too late" is the one that does the damage',
        body: 'Many of these lines carry a claim that nothing you do matters. Replacing them tends to restore the sense that effort is worth spending, which is what people need to keep spending it.' },
      { head: 'You are rehearsing the answer before you need it',
        body: 'Change often breaks down in the moment, where a comforting rationalisation arrives before any action does. Having a truer line ready is a way of preparing for that moment rather than meeting it cold.' },
    ],
  },
  w2: {
    lede: 'Why a vivid picture pulls harder than a stated goal',
    points: [
      { head: 'A picture carries more than a description',
        body: 'Imagining something in detail lets you simulate it rather than merely name it, and research suggests that tends to carry more emotional force than an abstract goal. It makes the destination feel worth the walk.' },
      { head: 'Aiming at a person, not an outcome',
        body: 'A future self acts like a guidepost: it organizes attention and makes effort read as becoming someone rather than finishing a task. That tends to feel more personal and less mechanical.' },
      { head: 'The closer that future feels, the more it is worth to you now',
        body: 'When the future self feels distant, present comfort usually wins. Returning to what you have already named and making it more concrete is how that distance narrows.' },
      { head: 'A clear direction makes a hard stretch bearable',
        body: 'Knowing where you are going tends to reduce discouragement, because a difficult period reads as part of a path rather than as random. That steadies you as much as it motivates you.' },
    ],
  },
  w3: {
    lede: 'Why what you do after a slip decides more than the slip',
    points: [
      { head: 'The recovery matters more than the lapse',
        body: 'Setbacks are ordinary in change. Research suggests what predicts the outcome is the reading: treated as temporary and workable, people tend to re-engage; treated as proof of failure, they tend to stop.' },
      { head: 'A gap between the urge and the response',
        body: 'Noticing stress, craving or discouragement as things happening — rather than as instructions — creates a small space to choose in. That space is where most of the useful decisions get made.' },
      { head: 'Catching drift while it is still small',
        body: 'Monitoring yourself is an active skill, not a passive one. Picking up the early signals and using them as a prompt to re-aim keeps a slip from becoming the new pattern.' },
      { head: 'Contempt makes coming back harder',
        body: 'Harsh self-judgment tends to increase avoidance, which makes re-entry harder still. Meeting a lapse with honesty and perspective does not excuse it — it makes recovering from it more likely.' },
    ],
  },
  b1: {
    lede: 'Why the reason you are doing this decides how long you last',
    points: [
      { head: 'Why you want it matters more than how much',
        body: 'Motivation can be strong and still be anxious, pressured or short-lived. Research suggests what endures is motivation tied to enjoyment, meaning or a sense of self — reasons that are life-giving rather than corrective.' },
      { head: '"I have to" can become "this is mine"',
        body: 'Nobody needs to start out loving exercise or vegetables. What tends to matter is whether the behavior can be connected to your own values and goals over time, which is a shift you can actually make.' },
      { head: 'A strong reason usually touches three things',
        body: 'Motivation tends to hold when something feels chosen rather than imposed, when you can get better at it, and when it connects to people you care about. A real "why" often has all three in it somewhere.' },
      { head: 'A reason has to outlast the discomfort',
        body: 'Early on, moving more and eating better often cost something before they give anything back. A reason tied to what you actually value is what bridges that stretch.' },
    ],
  },
  b2: {
    lede: 'Why this is a set of skills, not a question of willpower',
    points: [
      { head: 'These are skills, and skills can be built',
        body: 'Research consistently finds people do better when they can watch themselves, plan ahead, handle obstacles and adjust after a setback. Those are learnable capacities, not character traits you either have or lack.' },
      { head: 'Different skills matter at different points',
        body: 'Change unfolds over time rather than all at once, and what helps you get ready is not what carries you through action or keeps you steady afterwards. That is why the skills are grouped rather than listed flat.' },
      { head: 'Getting ready, taking action, staying consistent',
        body: 'The three groups do different jobs: building confidence and clearing barriers; assessing, planning and coping; then monitoring, support and recovering from lapses. Knowing which group is thin tells you where to put the practice.' },
      { head: 'Knowing where you stand before you plan',
        body: 'Effective change usually starts from an accurate read of your own strengths and limits. That read is what makes the goals, routines and support you choose next fit you rather than someone else.' },
      { head: 'The skills that matter most after motivation fades',
        body: 'Change is rarely linear — lapses, competing demands and friction are normal. What often separates a temporary disruption from stopping altogether is whether the maintenance skills are there.' },
    ],
  },
  b3: {
    lede: 'Why a week of watching teaches more than a month of resolving',
    points: [
      { head: 'Watching a thing tends to change it',
        body: 'Self-monitoring is among the most reliable tools in behavior change. Tracking something raises your awareness of it, and that awareness alone often shifts what you choose next.' },
      { head: 'Plan, watch, adjust',
        body: 'Change strengthens when you can compare what you meant to do with what happened and adapt. The plan sets the target and the week supplies the feedback — which makes this more than a diary.' },
      { head: 'A plan that survives a normal week, not your best one',
        body: 'People follow through more when a behavior is specific — what, when, where, and what you will do if conditions are imperfect. Naming the smaller backup version in advance is what keeps an ordinary week from ending it.' },
      { head: 'Resetting instead of quitting',
        body: 'Disruption, stress and low-energy days are part of it. Noticing what contributed to a false start and what happened next builds the habit of returning, which matters more than a clean run.' },
      { head: 'Food and movement pull on each other',
        body: 'Health behaviors cluster: energy, sleep, mood and routine are not separate systems. Watching both at once tends to show you how they actually interact rather than how you assume they do.' },
      { head: 'You usually need a clearer picture, not more force',
        body: 'The instinct after a bad stretch is to try harder. Often what helps more is an accurate read of your own routines and decision points, so the next plan is built on real patterns rather than guesses.' },
    ],
  },
  c2: {
    lede: 'Why a widening life is its own kind of progress',
    points: [
      { head: 'Staying engaged beats narrowing to avoid',
        body: 'People tend to do better when they can stay in contact with what matters and tolerate discomfort, rather than shrinking life to avoid difficulty. It is not optimism — it is range.' },
      { head: 'Moving toward, not only away',
        body: 'A life organized mostly around reducing threat tends to get smaller over time. Avoidance is not always wrong, but a healthier direction usually includes moving toward something, not only away from pain.' },
      { head: 'Growth shows up as possibility, not just relief',
        body: 'People often flourish when their sense of what is possible expands — learning, exploring, reconnecting, entering parts of life that had closed. That expansion is worth noticing in its own right.' },
      { head: 'Good stretches widen what you are willing to try',
        body: 'Research suggests positive states broaden attention and openness, which supports more exploratory behavior, which builds resources over time. The point is not forced positivity but noticing when the range is widening.' },
      { head: 'A future worth having pulls harder than one that merely hurts less',
        body: 'Being able to see a path forward, and to believe a fuller life is available, tends to support sustained effort. That is a different fuel from wanting the pain to stop.' },
      { head: 'Living larger counts, even on an average day',
        body: 'Improvement is often better read in participation than in mood. You can feel unremarkable and still be showing up more, trying more, connecting more — and that is real progress.' },
    ],
  },
  c3: {
    lede: 'Why watching your days is the same move that builds fitness',
    points: [
      { head: 'Watch the process, and the product follows',
        body: 'Tracking a behavior does not itself produce fitness or wellness. It strengthens the daily patterns that produce them — which is why the day, not the outcome, is what gets tracked here.' },
      { head: 'Healthy days are the process; wellness is the product',
        body: 'Wellness shows up as well-being, outlook and satisfaction with life. Tracking Quality Days means monitoring the process that, kept up, tends to lead there.' },
      { head: 'Wellness is a pattern, not a mood',
        body: 'It is not the absence of illness or a good day emotionally. It tends to be a state built by recurring behavior across the physical, mental and social parts of life — which makes it something you can influence.' },
      { head: 'A good day has parts you can name',
        body: 'Energy, outlook, function, connection, a sense of purpose. Naming which were present makes a vague sense of "that was a good one" into something you can deliberately repeat.' },
      { head: 'Quality days and a quality life build each other',
        body: 'Good days accumulate into a life shaped around them, and a life shaped that way tends to produce more of them. Research on upward spirals describes this loop, and it works in both directions.' },
      { head: 'The same attention that builds fitness, aimed at living',
        body: 'In the Lifestyle Pilot you watched movement and eating to build health. This is the identical move, applied to the wider question of how you actually want to live.' },
    ],
  },
  c1: {
    // DECLARE IT (Jay, 2026-08-26: "a little cringey — 'not a detour'"). This read "…is the work, not a detour
    // from it", which invents an objection nobody raised in order to knock it down. Nothing in C1 suggests a
    // member thinks revisiting their list is a detour; the clause exists to sound insightful, and a reader can
    // feel the manufactured strawman even when they can't name it.
    //
    // THE RULE IS NOT "NEVER NEGATE" — see b2's lede four entries up, which is KEPT: "Why this is a set of skills,
    // not a question of willpower." That negates a belief the member genuinely arrives holding, so the clause is
    // carrying content. The line is whether the thing being denied is something they actually think.
    lede: 'Why revisiting your list is the work',
    points: [
      {
        head: 'Goals you actually chose hold up longer',
        body:
          'Research suggests people stay with goals that fit their own values and sense of self, and drift from ones ' +
          'carried out of pressure, guilt, or comparison with someone else. A goal that is yours has a much better ' +
          'chance of surviving a hard week.',
      },
      {
        head: 'Who you think you are shapes what feels possible',
        body:
          'What you want gets filtered through how you see yourself. As that understanding shifts — and three phases ' +
          'of this work tend to shift it — the same goal can move from central to beside the point, or the reverse.',
      },
      {
        head: 'Sorting the list is what makes it usable',
        body:
          'Clear, ranked goals tend to work better than a long flat list of good intentions. Most lists start out ' +
          'diffuse and a little competing. Sitting with one deliberately is how it becomes something you can act on.',
      },
      {
        head: 'Changing a goal is a skill, not a retreat',
        body:
          'Revising what you are aiming at is part of steering, not evidence you failed at the first version. It ' +
          'usually reflects a sharper read on what is meaningful and what is realistic.',
      },
      {
        head: 'Goals get better when experience informs them',
        body:
          'A goal built on what you have actually noticed about your habits and your patterns tends to be sturdier ' +
          'than one built on how you hoped things would go. You have several weeks of that evidence now.',
      },
      {
        head: 'The parts of a life are not separate',
        body:
          'Change tends to hold better when what you learn in one area feeds the others, rather than sitting in its ' +
          'own box. Looking at the whole list at once is how those connections surface.',
      },
    ],
  },
};

export function exploreFor(asset: AssetId): Explore | undefined {
  return ASSET_EXPLORE[asset];
}

/**
 * RECONNECT resolves its Science Check by BEAT, not by session.
 *
 * The other nine sessions are 1:1 with an asset (SESSION_ASSET in content/summaries.ts), so `exploreFor` finds
 * them. Reconnect is one continuous arc carrying three of Greg's Science Checks — r1/r2/r3 — for beats inside it,
 * so keyed by session id it resolved to nothing and the "Explore the Science" button silently never rendered.
 * The content was there the whole time; the surface just could not find it.
 *
 * Mapped to what each entry actually SAYS, rather than to stage order:
 *   r1 "why looking honestly at the distance comes first"          → the way in, and the Doors
 *   r2 "why naming how it happened changes what you can do"        → the drift, what it cost
 *   r3 "why an honest mirror and a direction belong together"      → the measure (mirror) and the window (direction)
 */
const RECONNECT_STAGE_EXPLORE: Record<string, AssetId> = {
  entry: 'r1',
  doors: 'r1',
  drift: 'r2',
  measurement: 'r3',
  window: 'r3',
  checkpoint: 'r3',
  ceremony: 'r3',
};

/** The Science Check for where the member currently IS in Reconnect. Falls back to r1 — the session's opening
 *  beat — so a stage we have not mapped shows the right thing rather than nothing. */
export function exploreForReconnectStage(stage?: string | null): Explore | undefined {
  return ASSET_EXPLORE[(stage && RECONNECT_STAGE_EXPLORE[stage]) || 'r1'];
}

/**
 * The Session name to show in the workspace header while a member is inside Reconnect.
 *
 * The header used to print "Reconnect · the gateway" — the phase again, next to a row that already said
 * "Phase 1 · Reconnect", plus a word from our architecture notes. It never named the thing the member came to do
 * (Jay, 2026-08-11: "we're missing the actual Session name, 'The Doors'").
 *
 * These are the CURRICULUM's own titles (lib/curriculum/content/reconnect.ts), not new labels — the dashboard
 * hero already says "The Doors", and the header now agrees with it instead of inventing a parallel vocabulary.
 */
const RECONNECT_STAGE_TITLE: Record<string, string> = {
  entry: 'The Doors',
  doors: 'The Doors',
  drift: 'The Drift Quiz',
  measurement: 'The Drift Quiz',
  window: 'The Window',
  checkpoint: 'Your Checkpoint',
  ceremony: 'Your Threshold',
};

/** What to call the beat the member is on. Falls back to the opening Session rather than to nothing. */
export function reconnectStageTitle(stage?: string | null): string {
  return (stage && RECONNECT_STAGE_TITLE[stage]) || 'The Doors';
}
