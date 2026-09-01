// G4L — TECH OVERVIEW, for the internal team (Jennifer and Greg, being onboarded).
//
// TWO DECKS MERGED. Part One is what we built; Part Two is the "Beginning Your Comeback" tutorial, layered in
// after the technical half rather than kept separate. Jay, 2026-08-31: "do the tech overview stuff first, then
// onboarding steps."
//
// THE DIVISION OF LABOUR, and it held: Cowork wrote every word (handoff 2026-09-01), CC owns the numbers and the
// build. She marked eight placeholders `[confirm]` rather than guessing them — all resolved here from the repo.
//
// EVERY NUMBER IS MEASURED, not remembered — decks/measure.js computes them into facts.json. Jay's instruction was
// "don't update this from memory", and the deck says out loud where a figure is a floor rather than an estimate.
// Edit THIS script, never the .pptx.
const pptxgen = require('pptxgenjs');
const path = require('path');
const F = require('./facts.json');

const p = new pptxgen();
p.layout = 'LAYOUT_WIDE';
const RINGS = path.join(__dirname, 'rings_transparent.png');
const STRIPE = path.join(__dirname, 'stripe_band.png');
const WORDMARK = path.join(__dirname, 'wordmark_navy.png');

const NAVY='374F63', TEAL='3B9495', ORANGE='EC6233', OLIVE='919536',
      BODY='3A434B', GREY='5B636B', GREYL='8A929A', LGREY='E8E6E6', OFF='F3F4F5', WHITE='FFFFFF';
const HEAD='Barlow';
const rr = p.ShapeType.roundRect, oval = p.ShapeType.ellipse;

// --- THE SAFE FLOOR, ENFORCED ------------------------------------------------------------------------------
// Cowork's wordmark sits at y 6.58–7.10; the stripe band runs 7.15–7.50. Content laid through it printed over
// "GRINTA FOR LIFE." on six of ten slides — caught by Jay opening it in PowerPoint, which is the first place a
// deck is actually SEEN. So the floor is enforced rather than remembered: a colliding slide fails the build.
const FLOOR = 6.45;
const check = (what, o) => {
  const bottom = (o.y ?? 0) + (o.h ?? 0);
  if (bottom > FLOOR + 1e-9) throw new Error(`${what} at y=${o.y} h=${o.h} ends at ${bottom.toFixed(2)} — past the ${FLOOR} floor; it would print over the wordmark.`);
  return o;
};
const T  = (s, t, o) => s.addText(t, check('text', o));
const SH = (s, ty, o) => s.addShape(ty, check('shape', o));
const IM = (s, o) => s.addImage(check('image', o));

// --- chrome (Cowork's Deck Kit, untouched — exempt from the floor by definition) -----------------------------
const chrome = (s, n) => {
  s.addImage({ path: STRIPE, x:0, y:7.15, w:13.333, h:0.35 });
  s.addImage({ path: WORDMARK, x:0.5, y:6.58, w:1.1, h:0.523 });
  if (n) s.addText(String(n), { x:12.25, y:0.3, w:0.75, h:0.32, fontFace:HEAD, color:GREYL, fontSize:13, align:'right', margin:0 });
};
const title = (s, t, dek) => {
  T(s, t, { x:0.55, y:0.42, w:11.5, h:0.7, fontFace:HEAD, bold:true, color:NAVY, fontSize:32, align:'left', margin:0 });
  if (dek) T(s, dek, { x:0.57, y:1.12, w:11.8, h:0.4, fontFace:HEAD, color:GREY, fontSize:17, align:'left', margin:0 });
};

// --- layout helpers -----------------------------------------------------------------------------------------
/** A full-width statement band. `parts` is a pptx rich-text array or a plain string. */
const band = (s, y, h, parts, fill) => {
  SH(s, rr, { x:0.6, y, w:12.13, h, rectRadius:0.12, fill:{color:fill||NAVY}, line:{width:0} });
  T(s, parts, { x:0.95, y, w:11.4, h, fontFace:HEAD, color:WHITE, fontSize:15, align:'left', valign:'middle', lineSpacingMultiple:1.12, margin:0 });
};
/** A row of equal cards. Each item is {head, body, color?}. */
const cards = (s, y, h, items, accent) => {
  const gap = 0.28, w = (12.13 - gap * (items.length - 1)) / items.length;
  items.forEach((it, i) => {
    const x = 0.6 + i * (w + gap);
    SH(s, rr, { x, y, w, h, rectRadius:0.12, fill:{color:OFF}, line:{color:LGREY, width:1} });
    T(s, it.head, { x:x+0.24, y:y+0.2, w:w-0.48, h:0.42, fontFace:HEAD, bold:true, color:it.color||accent||NAVY, fontSize:14.5, align:'left', margin:0 });
    T(s, it.body, { x:x+0.24, y:y+0.66, w:w-0.48, h:h-0.9, fontFace:HEAD, color:BODY, fontSize:12.5, align:'left', valign:'top', lineSpacingMultiple:1.12, margin:0 });
  });
};
/** A numbered list, one column. */
const numbered = (s, y, items) => {
  items.forEach((it, i) => {
    const yy = y + i * 0.86;
    SH(s, oval, { x:0.6, y:yy, w:0.34, h:0.34, fill:{color:NAVY}, line:{width:0} });
    T(s, String(i + 1), { x:0.6, y:yy-0.005, w:0.34, h:0.34, fontFace:HEAD, bold:true, color:WHITE, fontSize:14, align:'center', valign:'middle', margin:0 });
    T(s, [{ text:it.head + '  ', options:{bold:true, color:NAVY} }, { text:it.body, options:{color:BODY} }],
      { x:1.1, y:yy-0.04, w:11.6, h:0.78, fontFace:HEAD, fontSize:13.5, align:'left', valign:'top', lineSpacingMultiple:1.1, margin:0 });
  });
};
/** The measured-figures grid. Each item is [value, label, color?]. */
const statGrid = (s, y, items) => {
  const n = 6, gap = 0.22, w = (12.13 - gap * (n - 1)) / n, h = 1.28;
  items.forEach((it, i) => {
    const x = 0.6 + i * (w + gap);
    SH(s, rr, { x, y, w, h, rectRadius:0.1, fill:{color:OFF}, line:{color:LGREY, width:1} });
    T(s, String(it[0]), { x, y:y+0.14, w, h:0.56, fontFace:HEAD, bold:true, color:it[2]||NAVY, fontSize:23, align:'center', margin:0 });
    T(s, it[1], { x:x+0.06, y:y+0.74, w:w-0.12, h:0.46, fontFace:HEAD, color:GREY, fontSize:10.5, align:'center', valign:'top', lineSpacingMultiple:1.05, margin:0 });
  });
};
/** One phase row: colour rail + label + its Sessions, then the Checkpoint in a lighter tint of the same phase. */
const phaseRow = (s, y, name, sub, color, sessions) => {
  SH(s, rr, { x:0.6, y, w:0.09, h:0.92, rectRadius:0.04, fill:{color}, line:{width:0} });
  T(s, name, { x:0.82, y:y+0.06, w:1.55, h:0.34, fontFace:HEAD, bold:true, color, fontSize:14, align:'left', margin:0 });
  T(s, sub, { x:0.82, y:y+0.42, w:1.55, h:0.3, fontFace:HEAD, color:GREYL, fontSize:10.5, align:'left', margin:0 });
  const items = [...sessions, 'Checkpoint'];
  const gap = 0.16, x0 = 2.5, w = (12.73 - x0 - gap * (items.length - 1)) / items.length;
  items.forEach((label, i) => {
    const last = i === items.length - 1;
    const x = x0 + i * (w + gap);
    SH(s, rr, { x, y, w, h:0.92, rectRadius:0.1, fill:{color}, line:{width:0}, transparency: last ? 40 : 0 });
    T(s, label, { x:x+0.14, y, w:w-0.28, h:0.92, fontFace:HEAD, bold:true, color:WHITE, fontSize:11.5, align:'left', valign:'middle', lineSpacingMultiple:1.05, margin:0 });
  });
};

// ================================================================================ PART ONE · WHAT WE BUILT

// 1 · cover
let s = p.addSlide(); s.background = { color: WHITE };
IM(s, { path: RINGS, x:9.0, y:1.55, w:3.25, h:3.25 });
T(s, 'GRINTA FOR LIFE · THE BUILD, END TO END', { x:0.7, y:2.4, w:7.9, h:0.35, fontFace:HEAD, bold:true, color:TEAL, fontSize:14, charSpacing:2, align:'left', margin:0 });
T(s, 'Tech Overview', { x:0.66, y:2.78, w:8.0, h:1.1, fontFace:HEAD, bold:true, color:NAVY, fontSize:44, align:'left', margin:0 });
T(s, 'What we built — and how to begin.', { x:0.7, y:4.0, w:7.9, h:0.5, fontFace:HEAD, color:GREY, fontSize:22, align:'left', margin:0 });
T(s, `For the team   ·   ${F.version}   ·   ${F.date}   ·   Confidential`, { x:0.7, y:4.72, w:8.2, h:0.35, fontFace:HEAD, italic:true, color:GREYL, fontSize:13, align:'left', margin:0 });
chrome(s, null);

// 2 · the product in one slide
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'The product in one slide.', 'What Grinta for Life is, in a sentence.');
band(s, 1.68, 1.15, "Grinta for Life is a science-backed, AI-native membership app for the midlife Comeback — it measures the distance between who you are and who you're reclaiming, and walks you back, one Session at a time.");
cards(s, 3.05, 2.5, [
  { head:'The problem', body:'Midlife Identity Loss, the Fade: a hundred reasonable trade-offs, and slowly you drift from who you were.', color:NAVY },
  { head:'The product', body:'A guided Program in four phases, an AI Companion that remembers, and a measured path back.', color:TEAL },
  { head:'The proof', body:'Every step is measured: the ID Score, the Grinta Index, a Comeback you can see.', color:ORANGE },
]);
chrome(s, 2);

// 3 · where it started
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'It was specified before it was built.', 'A document corpus first, then code to match it.');
band(s, 1.68, 1.0, "This wasn't improvised. It started as a corpus of design canon, science memos, and member-script docs — and the app was built to that spec and verified against it.");
cards(s, 2.9, 2.6, [
  { head:'The canon', body:'Versioned, checksummed bundles; one source of truth. 28 releases published to date.', color:NAVY },
  { head:'The science', body:"Dr. Greg Welk's measurement and framework memos under every instrument.", color:TEAL },
  { head:'The scripts', body:'Member-facing copy authored, reconciled, and tested against the live app.', color:OLIVE },
]);
chrome(s, 3);

// 4 · how we work
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'How we work.', 'A loop that keeps the app and the canon honest to each other.');
const step = (x, kicker, head, body, color) => {
  SH(s, rr, { x, y:1.9, w:3.75, h:2.3, rectRadius:0.12, fill:{color:OFF}, line:{color:LGREY, width:1} });
  T(s, kicker, { x:x+0.26, y:2.08, w:3.2, h:0.3, fontFace:HEAD, bold:true, color, fontSize:12, charSpacing:1.4, margin:0 });
  T(s, head, { x:x+0.26, y:2.42, w:3.2, h:0.42, fontFace:HEAD, bold:true, color:NAVY, fontSize:19, margin:0 });
  T(s, body, { x:x+0.26, y:2.92, w:3.25, h:1.1, fontFace:HEAD, color:BODY, fontSize:12.5, valign:'top', lineSpacingMultiple:1.12, margin:0 });
};
step(0.6, 'STEP 1', 'Decide', 'Naming, voice and design land in Cowork first — written down before anything is built.', TEAL);
step(4.79, 'STEP 2', 'Build', 'Shipped to production, spec by spec. Nineteen releases in a single day is a real day here.', NAVY);
step(8.98, 'STEP 3', 'Verify', 'Tests, plus a canon reconciliation every version so the words and the code never drift.', OLIVE);
[4.44, 8.63].forEach((x) => T(s, '→', { x, y:2.75, w:0.36, h:0.5, fontFace:HEAD, bold:true, color:GREYL, fontSize:24, align:'center', margin:0 }));
band(s, 4.5, 0.85, 'The result: a decision is traceable from the sentence to the commit.');
chrome(s, 4);

// 5 · tech stack  [Cowork placeholder 1 — resolved from package.json + the provider]
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'What it runs on.', 'A modern, installable web app.');
cards(s, 1.75, 2.15, [
  { head:'Front end', body:`Next.js ${F.next} (App Router) · React ${F.react} · TypeScript ${F.typescript} · installable PWA.`, color:NAVY },
  { head:'Data', body:`Supabase Postgres with row-level isolation — ${F.migrations} migrations deep, each versioned.`, color:TEAL },
]);
cards(s, 4.12, 2.15, [
  { head:'Hosting & CI', body:'Vercel — every push to main deploys, and a green-light check proves the new code is live before anyone walks it.', color:OLIVE },
  { head:'AI', body:`Anthropic's Claude (SDK ${F.sdk}), with the system prompt cached — ~10,000 tokens a turn read rather than re-sent.`, color:ORANGE },
]);
chrome(s, 5);

// 6 · under the hood
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'Under the hood.', 'The engines that make it more than a chatbot.');
cards(s, 1.72, 2.1, [
  { head:'The measurement engine', body:'Proprietary instruments — the ID Score, the Grinta Index — that measure the work and gate progression.', color:NAVY },
  { head:'The Companion', body:'An AI guide that draws answers out, remembers everything and never lectures. Its voice is governed by rule, not by hope.', color:TEAL },
  { head:'The curriculum registry', body:"Sessions, phases and Checkpoints defined as data and derived, so a name can't drift between two files.", color:OLIVE },
]);
cards(s, 4.02, 2.1, [
  { head:'Capture integrity', body:"A member's own words are stored verbatim. Nothing invented, nothing silently dropped.", color:ORANGE },
  { head:'Nudges', body:'Proactive check-ins between Sessions — grounded in what they actually did, never a pitch.', color:NAVY },
  { head:'One conversation kernel', body:'Every phase runs the same arc engine, so a fix to the rhythm reaches all sixteen sittings at once.', color:TEAL },
]);
chrome(s, 6);

// 7 · the surfaces  [Cowork placeholder 2 — the canonical ten, measured]
s = p.addSlide(); s.background = { color: WHITE };
title(s, `${F.memberSurfaces} surfaces a member lives in.`, 'Each one built, not sketched.');
['Dashboard','Program','Playbook','ID Score','Grinta Index','Badges','Reclaim List','Movement','Momentum','Community'].forEach((label, i) => {
  const c = i % 5, r = Math.floor(i / 5), w = 2.31, h = 1.5;
  const x = 0.6 + c * (w + 0.19), y = 1.85 + r * (h + 0.24);
  SH(s, rr, { x, y, w, h, rectRadius:0.12, fill:{color:OFF}, line:{color:LGREY, width:1} });
  T(s, label, { x:x+0.14, y, w:w-0.28, h, fontFace:HEAD, bold:true, color:NAVY, fontSize:14.5, align:'center', valign:'middle', margin:0 });
});
T(s, 'Plus Account Settings — a subpage without a panel, where the app bends to their life.',
  { x:0.62, y:5.28, w:12.1, h:0.4, fontFace:HEAD, italic:true, color:GREY, fontSize:13, margin:0 });
chrome(s, 7);

// 8 · the Program as it runs today
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'The Program, as it runs today.', 'Cycle 1 · The Foundation — four phases, one pass.');
phaseRow(s, 1.72, 'Reconnect', 'the gateway', NAVY,   ['IDQ','Excavation','The Fade']);
phaseRow(s, 2.82, 'Rewire',    'the mind',    TEAL,   ['Disinformation Audit','Visualization Workshop','False Start Protocol']);
phaseRow(s, 3.92, 'Rebuild',   'the body',    OLIVE,  ["What's Your Why?",'Strengths & Weaknesses','The Lifestyle Pilot']);
phaseRow(s, 5.02, 'Reclaim',   'the outcome', ORANGE, ['Looking Forward','Bigger World Audit','Quality Days']);
T(s, `${F.guidedSessions} Sessions, ${F.checkpoints} Checkpoints — one full Cycle, about six weeks, at the member's pace. Every Session opens with a frame and one question; the instrument arrives after the member has said something.`,
  { x:0.62, y:6.02, w:12.1, h:0.42, fontFace:HEAD, color:GREY, fontSize:12.5, valign:'top', margin:0 });
chrome(s, 8);

// 9 · by the numbers
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'By the numbers.', 'Every figure here is measured from the repository — re-run decks/measure.js and check.');
statGrid(s, 1.78, [
  [F.sourceLines.toLocaleString(), 'source lines'],
  [F.tests.toLocaleString(), `tests · ${F.testFiles} files`, TEAL],
  [F.commits.toLocaleString(), 'commits'],
  [F.migrations, 'migrations'],
  [F.guidedSessions, 'guided Sessions', OLIVE],
  [F.checkpoints, 'Checkpoints'],
]);
statGrid(s, 3.28, [
  [F.doors, 'Doors', ORANGE],
  [F.badges, 'badges'],
  [F.scienceInsights, 'science insights', TEAL],
  [F.memberSurfaces, 'member surfaces'],
  [F.playbookTabs, 'Playbook tabs'],
  [F.progressRegisters, 'progress registers', OLIVE],
]);
band(s, 5.0, 0.95, [
  { text:'Nothing here is typed in.  ', options:{bold:true} },
  { text:'Each figure is computed from the repository by a script, so a number in this deck can be checked a month from now — and corrected by re-running it, never by retyping a slide.', options:{} },
]);
chrome(s, 9);

// 10 · governance + security
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'Built to be trusted.', "The rules aren't described — they execute.");
cards(s, 1.72, 1.95, [
  { head:'Always disclosed', body:"A member always knows they're talking to AI. It never poses as a person.", color:NAVY },
  { head:'A safety net underneath', body:'Turn dark and the Companion routes to real help immediately, including the 988 Suicide & Crisis Lifeline. It runs before the model is ever consulted.', color:ORANGE },
]);
cards(s, 3.82, 1.95, [
  { head:'Private by design', body:"What you build here is private, and it isn't used to train AI. Row-level isolation at the database; every operator read is logged.", color:TEAL },
  { head:'Nothing is graded', body:'No scores, no passing marks — a reading, not a verdict. The Companion is blocked in code from implying otherwise.', color:OLIVE },
]);
T(s, 'Hardened August 2026: authorization on every server action · row-level isolation · logged operator access · explicit rules on who may read an intake transcript · rate-limited sign-in and single-use recovery tokens.',
  { x:0.62, y:5.9, w:12.1, h:0.5, fontFace:HEAD, italic:true, color:GREY, fontSize:12.5, valign:'top', lineSpacingMultiple:1.1, margin:0 });
chrome(s, 10);

// 11 · keeping it honest  [Cowork placeholder 3 — the definitive eight, each a real file]
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'Keeping it honest.', 'Eight guards that fail the build before a member ever sees a mistake.');
[
  ['Voice gate', "Deletes AI-tell words from the Companion's own sentences before they reach a member."],
  ['Naming guard', 'Retired terms cannot come back. It has failed our own new code more than once.'],
  ['Prompt-rules binding', 'A phrase we forbid the AI to say cannot appear in our written copy either.'],
  ['Unrun-rules checker', 'Finds rules that exist in the code and never run. Ratcheted — the count can only fall.'],
  ['Session eval', 'Drives six Sessions against the live model with a scripted member. Seconds, not a five-hour walk.'],
  ['Replay fixtures', 'Real onboarding runs become regression tests, so a fix cannot break the ones before it.'],
  ['Walk tripwires', 'Scan a real transcript for rushing, repeating, or leaving a member hanging.'],
  ['Green-light', 'Proves the new code is actually live before anyone walks it. "Deployed" is not "running."'],
].forEach(([head, body], i) => {
  const c = i % 4, r = Math.floor(i / 4), w = 2.95, h = 1.85;
  const x = 0.6 + c * (w + 0.16), y = 1.75 + r * (h + 0.2);
  SH(s, rr, { x, y, w, h, rectRadius:0.12, fill:{color:OFF}, line:{color:LGREY, width:1} });
  T(s, head, { x:x+0.2, y:y+0.16, w:w-0.4, h:0.4, fontFace:HEAD, bold:true, color:NAVY, fontSize:13.5, margin:0 });
  T(s, body, { x:x+0.2, y:y+0.6, w:w-0.4, h:h-0.76, fontFace:HEAD, color:BODY, fontSize:11.5, valign:'top', lineSpacingMultiple:1.12, margin:0 });
});
T(s, "These aren't guidelines. They're tests — a violation stops the build. Every one was written after a real failure.",
  { x:0.62, y:5.72, w:12.1, h:0.4, fontFace:HEAD, bold:true, color:NAVY, fontSize:13.5, margin:0 });
chrome(s, 11);

// 12 · instrumentation  [Cowork placeholder 4 — the real emitted event set]
s = p.addSlide(); s.background = { color: WHITE };
title(s, "We can see how it's actually used.", 'Measured, so we can improve it honestly.');
band(s, 1.68, 0.95, 'Telemetry was a first-class requirement from day one — it is how the program measures whether it is actually working.');
cards(s, 2.85, 2.2, [
  { head:'What we capture', body:'Session opens, steps and closes · Checkpoint crossings · ID Score completions · page views · daily reads · practice weeks started · a Move re-run.', color:NAVY },
  { head:'What it answers', body:'Where members drop off · which Sessions stall · ID Score and Grinta trends over time · how many days a member talks · quiet stretches worth a nudge.', color:TEAL },
  { head:'Where it lands', body:'The Founder Console — the internal instrument for watching the membership and scaling it without losing the personal read.', color:OLIVE },
]);
T(s, 'One event exists only to record when the Companion lost context — a fault we would rather measure than assume away.',
  { x:0.62, y:5.28, w:12.1, h:0.4, fontFace:HEAD, italic:true, color:GREY, fontSize:12.5, margin:0 });
chrome(s, 12);

// 13 · what it took
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'What it took.', 'Two honest numbers, and the shape of the effort.');
// THE ESTIMATE IS DATED AND THE TOTAL IS DERIVED (Jay, 2026-08-31). The ~650 sat hardcoded beside a measured 506,
// and the combined figure was hardcoded too — so the total could silently disagree with its own parts. It cannot now.
const NONCODE = 650, NONCODE_AS_OF = 'Aug 2026';
const TOTAL = F.hours + NONCODE;
const panel = (x, kicker, big, unit, lines, color) => {
  SH(s, rr, { x, y:1.75, w:5.95, h:2.0, rectRadius:0.12, fill:{color:OFF}, line:{color:LGREY, width:1} });
  T(s, kicker, { x:x+0.3, y:1.93, w:5.35, h:0.3, fontFace:HEAD, bold:true, color, fontSize:12.5, charSpacing:1.2, margin:0 });
  T(s, [{ text:big, options:{fontSize:40, bold:true, color} }, { text:'  '+unit, options:{fontSize:13, color:GREY} }],
    { x:x+0.3, y:2.25, w:5.35, h:0.7, fontFace:HEAD, align:'left', valign:'middle', margin:0 });
  T(s, lines, { x:x+0.3, y:2.98, w:5.35, h:0.68, fontFace:HEAD, color:BODY, fontSize:12.5, valign:'top', lineSpacingMultiple:1.08, margin:0 });
};
panel(0.6, 'BUILDING IT', String(F.hours), 'hours (floor)',
  'Measured from commit history — sessions clustered from timestamps. A floor: it cannot see planning, reading, or a day that ended without a commit.', NAVY);
panel(6.78, 'DESIGNING, WRITING, RESEARCHING', '~' + NONCODE, `hours (estimate, ${NONCODE_AS_OF})`,
  'Bottom-up census of the document corpus, the 2nd-edition manuscript, and completed work items. Professional-equivalent effort, not a clock.', TEAL);
band(s, 3.92, 0.95, [
  { text:`Behind G4L: ~${TOTAL.toLocaleString()} hours, counted two ways.  `, options:{bold:true} },
  { text:'The non-code investment slightly exceeds the code — the honest shape of a product this content- and design-heavy.', options:{} },
]);
T(s, `${F.activeDays} active days · ${F.workSessions} work sessions · median sitting ${F.medianHours} hours · longest ${F.longestHours}. The two figures are counted differently and overlap slightly, so the total is an estimate rather than a precise sum — and it is derived from its parts here, never typed.`,
  { x:0.62, y:5.02, w:12.1, h:1.2, fontFace:HEAD, color:BODY, fontSize:13, valign:'top', lineSpacingMultiple:1.1, margin:0 });
chrome(s, 13);

// 14 · version history  [Cowork placeholder 5]
s = p.addSlide(); s.background = { color: WHITE };
title(s, `From v2.1 to ${F.version}.`, `${F.commits.toLocaleString()} commits across ${F.activeDays} active days.`);
[
  ['v2.1–2.2', 'Staged onboarding and the Reconnect gateway', NAVY],
  ['v2.3–2.5', 'Rewire, Rebuild and Reclaim — all four Rs conversational', TEAL],
  ['v3.0', 'The desktop redesign — the member surface rebuilt', OLIVE],
  ['v3.2', 'The Companion triptych — the dashboard re-architected', ORANGE],
  ['v3.5', 'Reconnect becomes Sessions with real boundaries', NAVY],
  [F.version, 'The renames, the guards, and the walk fixes', TEAL],
].forEach(([v, what, color], i) => {
  const y = 1.85 + i * 0.74;
  SH(s, oval, { x:0.66, y:y+0.08, w:0.26, h:0.26, fill:{color}, line:{width:0} });
  T(s, v, { x:1.1, y, w:1.8, h:0.42, fontFace:HEAD, bold:true, color, fontSize:15, margin:0 });
  T(s, what, { x:3.0, y, w:9.7, h:0.42, fontFace:HEAD, color:BODY, fontSize:14, margin:0 });
});
chrome(s, 14);

// 15 · what's next
s = p.addSlide(); s.background = { color: WHITE };
title(s, "What's next.", 'Directional — the near path and the bigger one.');
cards(s, 1.75, 2.5, [
  { head:'Now', body:'Community and proactive Nudges landing. Cohort 1 — the Guides go first.', color:NAVY },
  { head:'Soon', body:'The book as the authority asset; the Reclaim Challenge as top-of-funnel.', color:TEAL },
  { head:'The bigger play', body:'B2B / multi-tenant: the same measured Program serving organizations and cohorts under one platform. The foundation is built — row-level isolation from day one — and dormant until a customer funds it.', color:OLIVE },
]);
band(s, 4.6, 0.9, 'Charter MVP is the near horizon. Everything on this slide is directional, not committed.');
chrome(s, 15);

// 16 · the part worth being proud of
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'The part worth being proud of.', 'Built fast — and it held.');
band(s, 1.68, 1.15, [
  { text:`All of this came together in about ${F.weeks} weeks of active work.  `, options:{bold:true} },
  { text:`Speed usually buys fragility. Here it didn't — ${F.tests.toLocaleString()} tests and the eight guards are the receipts.`, options:{} },
]);
cards(s, 3.05, 2.4, [
  { head:'Measurement', body:'Proprietary instruments, built in rather than bolted on. The ID Score and the Grinta Index are ours.', color:NAVY },
  { head:'A Companion that remembers', body:'Continuity no course or chatbot has. It knows the whole story and never asks twice.', color:TEAL },
  { head:'A real science partner', body:'Dr. Greg Welk, under every instrument — the framework and the measurement both.', color:OLIVE },
]);
T(s, 'Not a chatbot. Not a course.', { x:0.62, y:5.62, w:12.1, h:0.4, fontFace:HEAD, bold:true, color:NAVY, fontSize:15, align:'center', margin:0 });
chrome(s, 16);

// ================================================================== PART TWO · BEGINNING YOUR COMEBACK

// 17 · this is a Comeback
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'This is a Comeback.', 'What Grinta for Life asks of you — and gives back.');
T(s, [
  { text:'Grinta for Life is a Comeback — the work of closing the gap between who you are right now and who you still are underneath. ', options:{} },
  { text:'The Fade', options:{bold:true, color:NAVY} },
  { text:' is how that gap opened. ', options:{} },
  { text:'The Companion, the Sessions and the Program', options:{bold:true, color:NAVY} },
  { text:' are how you close it. Give it real time and it gives real change back.', options:{} },
], { x:0.62, y:1.7, w:12.1, h:1.15, fontFace:HEAD, color:BODY, fontSize:16, valign:'top', lineSpacingMultiple:1.2, margin:0 });
['The Fade  ·  the problem', 'The work  ·  the means', 'Your Comeback  ·  the outcome'].forEach((t, i) => {
  const x = 0.6 + i * 4.13;
  SH(s, rr, { x, y:3.05, w:3.85, h:0.72, rectRadius:0.36, fill:{color:i===2?TEAL:OFF}, line:{color:i===2?TEAL:LGREY, width:1} });
  T(s, t, { x, y:3.05, w:3.85, h:0.72, fontFace:HEAD, bold:true, color:i===2?WHITE:NAVY, fontSize:12.5, align:'center', valign:'middle', margin:0 });
  if (i < 2) T(s, '→', { x:x+3.85, y:3.05, w:0.28, h:0.72, fontFace:HEAD, bold:true, color:GREYL, fontSize:18, align:'center', valign:'middle', margin:0 });
});
band(s, 4.15, 1.1, [
  { text:'Settle in.  ', options:{bold:true} },
  { text:'This is a practice you return to, measured over weeks — not a five-minute experience. The more honest and detailed you are, the better it knows you.', options:{} },
], TEAL);
chrome(s, 17);

// 18 · why it works this way
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'Why it works this way.', 'A good guide draws the answers out of you — and trusts you to lead.');
band(s, 1.68, 1.3, "The Companion asks; it never lectures. It draws your own answers out and reflects them back, so you hear yourself. No grading, no fixing — you're the only expert on your own life, which is exactly why it's safe to be honest here.");
cards(s, 3.2, 2.35, [
  { head:"It's yours.", body:'Your goals, your pace, your words — so the change holds when life pushes back.', color:NAVY },
  { head:'You feel it move.', body:'Small, real wins you can see. A slip is part of the work, not a failure.', color:TEAL },
  { head:"You're not alone.", body:"A Companion that remembers you, and a Community that's been where you are.", color:ORANGE },
]);
chrome(s, 18);

// 19 · it's safe to be honest
s = p.addSlide(); s.background = { color: WHITE };
title(s, "It's safe to be honest.", "The work only holds if you tell the truth — so here's how that's protected.");
band(s, 1.68, 1.05, '"This conversation is guided by AI. Everything you share shapes your G4L experience and is handled with care. You can stop at any time."');
cards(s, 2.95, 2.3, [
  { head:'Always disclosed.', body:"You always know when you're talking to the Companion.", color:NAVY },
  { head:'Yours alone.', body:"What you share shapes your experience and nothing else — it isn't used to train AI.", color:TEAL },
  { head:'Nothing to perform for.', body:'The Companion carries no social stake — which is what makes it a place to be honest, and a bridge back to real people.', color:OLIVE },
]);
T(s, 'A safety net runs underneath — if things ever turn dark, the Companion connects you to real help right away, including the 988 Suicide & Crisis Lifeline.',
  { x:0.62, y:5.45, w:12.1, h:0.5, fontFace:HEAD, italic:true, color:GREY, fontSize:13, valign:'top', margin:0 });
chrome(s, 19);

// 20 · the mindset to bring
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'The mindset to bring.', 'Five things to carry in.');
numbered(s, 1.85, [
  { head:'Be honest with yourself.', body:"It works to the degree you tell the truth — including the parts you'd rather skip." },
  { head:'Give it detail.', body:'The more you tell the Companion, the better it knows you.' },
  { head:'Slow down.', body:'The Sessions are conversations. Sit with the questions.' },
  { head:'Be present.', body:"Some of it will stir things up. That's the work landing." },
  { head:'Come back.', body:'The value compounds across days and weeks.' },
]);
chrome(s, 20);

// 21 · set yourself up
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'Set yourself up.', 'A little prep makes the first sitting land.');
cards(s, 1.85, 2.6, [
  { head:'Somewhere private', body:'A quiet hour where you can be honest — out loud or in writing.', color:NAVY },
  { head:'Start on desktop', body:'The Dashboard is built for a bigger screen. Your phone is great for checking in later.', color:TEAL },
  { head:'Three things in mind', body:"Who you were before the Fade, what changed, and what you'd want back.", color:OLIVE },
]);
chrome(s, 21);

// 22 · how to get in  [Cowork placeholder 7 — the app URL]
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'How to get in.', 'One link, any device — installable like an app.');
SH(s, rr, { x:0.6, y:1.7, w:12.13, h:0.95, rectRadius:0.12, fill:{color:TEAL}, line:{width:0} });
T(s, [
  { text:'Open in your browser:   ', options:{fontSize:14} },
  { text:'https://g4l-ten.vercel.app', options:{bold:true, fontSize:19} },
], { x:0.95, y:1.7, w:11.4, h:0.95, fontFace:HEAD, color:WHITE, align:'left', valign:'middle', margin:0 });
T(s, 'Grinta for Life is a Progressive Web App: it runs in any modern browser, and you can install it to your home screen for a full-screen, app-like experience with reminders. Sign up with your own email — each account is private to one person.',
  { x:0.62, y:2.85, w:12.1, h:0.85, fontFace:HEAD, color:BODY, fontSize:14, valign:'top', lineSpacingMultiple:1.15, margin:0 });
[['Desktop browser','The best place for Sessions.'],['iPad','Safari → Add to Home Screen.'],['iPhone','Safari → Add to Home Screen. Installing turns on reminders.'],['Android','Chrome → Install app.']]
  .forEach(([h, b], i) => {
    const w = 2.95, x = 0.6 + i * (w + 0.16);
    SH(s, rr, { x, y:3.9, w, h:1.5, rectRadius:0.12, fill:{color:OFF}, line:{color:LGREY, width:1} });
    T(s, h, { x:x+0.2, y:4.06, w:w-0.4, h:0.36, fontFace:HEAD, bold:true, color:NAVY, fontSize:13.5, margin:0 });
    T(s, b, { x:x+0.2, y:4.46, w:w-0.4, h:0.8, fontFace:HEAD, color:BODY, fontSize:11.5, valign:'top', lineSpacingMultiple:1.1, margin:0 });
  });
chrome(s, 22);

// 23 · your first sitting
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'Your first sitting.', "Four steps, in order. Don't rush them.");
numbered(s, 1.85, [
  { head:'Onboarding.', body:"A real conversation where you name who you're reclaiming, your Fade, the Doors it came through, and a first Reclaim List." },
  { head:'The Threshold Ceremony.', body:'Your first arrival on the Dashboard. Let it land.' },
  { head:'The Opening Tour.', body:'A quick orientation to the pieces, re-runnable any time.' },
  { head:'Settle in with the Companion.', body:'Talk to it on the Dashboard. Feel that it remembers you.' },
]);
T(s, "That's a full first sitting. Stopping here and coming back is fine.",
  { x:0.62, y:5.5, w:12.1, h:0.4, fontFace:HEAD, italic:true, color:GREY, fontSize:13.5, margin:0 });
chrome(s, 23);

// 24 · your first Sessions
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'Your first Session: the IDQ.', 'Where the measured Comeback begins.');
IM(s, { path: RINGS, x:9.6, y:1.8, w:2.8, h:2.8 });
T(s, [
  { text:"When you're ready, your first Session is the ", options:{} },
  { text:'IDQ', options:{bold:true, color:NAVY} },
  { text:". You'll answer a set of questions, rating yourself across the areas of your life — where you are now, against the fuller version of you that you remember. It's where your ", options:{} },
  { text:'ID Score', options:{bold:true, color:NAVY} },
  { text:' begins: the distance left to close.\n\nFrom there, ', options:{} },
  { text:'Excavation', options:{bold:true, color:NAVY} },
  { text:' walks the Doors your Fade came through — a career that ended, a body that started saying no, a relationship that changed, a loss that reshaped things — and ', options:{} },
  { text:'The Fade', options:{bold:true, color:NAVY} },
  { text:' takes a clear read of what it cost, then turns you forward with the Legacy Letter.', options:{} },
], { x:0.62, y:1.8, w:8.75, h:2.7, fontFace:HEAD, color:BODY, fontSize:14, valign:'top', lineSpacingMultiple:1.18, margin:0 });
T(s, 'The outer ring is Reconnect — where every Comeback begins.',
  { x:9.45, y:4.7, w:3.1, h:0.4, fontFace:HEAD, italic:true, color:GREYL, fontSize:11, align:'center', margin:0 });
band(s, 5.2, 1.1, [
  { text:'Answer fully.  ', options:{bold:true} },
  { text:'This is where the Companion begins to know you. A sentence more beats a sentence less.', options:{} },
], TEAL);
chrome(s, 24);

// 25 · how far to go · how to engage
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'How far to go — and how to engage.', 'Go at the pace that keeps you honest.');
SH(s, rr, { x:0.6, y:1.75, w:5.95, h:3.5, rectRadius:0.12, fill:{color:OFF}, line:{color:LGREY, width:1} });
T(s, 'HOW FAR TO GO', { x:0.9, y:1.95, w:5.35, h:0.3, fontFace:HEAD, bold:true, color:NAVY, fontSize:12, charSpacing:1.4, margin:0 });
T(s, [
  { text:'A full first sitting\n', options:{bold:true} },
  { text:'Onboarding → Threshold → Tour → settled with the Companion.\n\n', options:{} },
  { text:'Your first Session\n', options:{bold:true} },
  { text:'The IDQ — your ID Score, and the baseline for everything after it.\n\n', options:{} },
  { text:'All the way through the Reconnect Checkpoint\n', options:{bold:true} },
  { text:'Where your first work is measured and your Grinta moves for the first time.', options:{} },
], { x:0.9, y:2.35, w:5.35, h:2.75, fontFace:HEAD, color:BODY, fontSize:12.5, valign:'top', lineSpacingMultiple:1.12, margin:0 });
SH(s, rr, { x:6.78, y:1.75, w:5.95, h:3.5, rectRadius:0.12, fill:{color:OFF}, line:{color:LGREY, width:1} });
T(s, 'HOW TO ENGAGE WELL', { x:7.08, y:1.95, w:5.35, h:0.3, fontFace:HEAD, bold:true, color:TEAL, fontSize:12, charSpacing:1.4, margin:0 });
T(s, [
  { text:'Talk like a person.  ', options:{bold:true} }, { text:'Plain words, real life.\n\n', options:{} },
  { text:'Answer in full.  ', options:{bold:true} }, { text:'Details and specifics, not a summary.\n\n', options:{} },
  { text:'Stop and return.  ', options:{bold:true} }, { text:'Nothing is lost.\n\n', options:{} },
  { text:'Honesty over finishing.  ', options:{bold:true} }, { text:'Racing gives you a demo; going slowly gives you your Comeback.', options:{} },
], { x:7.08, y:2.35, w:5.35, h:2.75, fontFace:HEAD, color:BODY, fontSize:12.5, valign:'top', lineSpacingMultiple:1.12, margin:0 });
T(s, 'A first Cycle runs about six weeks, for most people.',
  { x:0.62, y:5.45, w:12.1, h:0.4, fontFace:HEAD, bold:true, color:NAVY, fontSize:14, align:'center', margin:0 });
chrome(s, 25);

// 26 · as you go
s = p.addSlide(); s.background = { color: WHITE };
title(s, 'As you go.', 'For our team and Guides.');
band(s, 1.85, 1.6, [
  { text:"You're among the first through this.  ", options:{bold:true} },
  { text:'If something snags — a confusing moment, a word that feels off, a place the honesty broke — jot it down and send it our way. Your read is how we make it right for everyone who follows.', options:{} },
]);
T(s, 'Note what helped or got in the way of being honest — that is the signal we most want.',
  { x:0.62, y:3.75, w:12.1, h:0.45, fontFace:HEAD, color:BODY, fontSize:15, align:'center', margin:0 });
T(s, 'Every fix in this deck came from someone walking the product and writing down what broke.',
  { x:0.62, y:4.4, w:12.1, h:0.45, fontFace:HEAD, italic:true, color:GREY, fontSize:13, align:'center', margin:0 });
chrome(s, 26);

// 27 · this is your Comeback
s = p.addSlide(); s.background = { color: WHITE };
IM(s, { path: RINGS, x:5.17, y:1.5, w:3.0, h:3.0 });
T(s, 'This is your Comeback.', { x:0.6, y:4.75, w:12.13, h:0.7, fontFace:HEAD, bold:true, color:NAVY, fontSize:36, align:'center', margin:0 });
T(s, 'Take your time. We built it to meet you honestly — meet it the same way.',
  { x:0.6, y:5.5, w:12.13, h:0.5, fontFace:HEAD, color:GREY, fontSize:17, align:'center', margin:0 });
chrome(s, null);

const OUT = path.join(process.env.HOME, 'Desktop', 'G4L-Tech-Overview.pptx');
p.writeFile({ fileName: OUT }).then(() => console.log(`WROTE ${OUT}  ·  27 slides · ${F.version} · floor ${FLOOR} enforced`));
