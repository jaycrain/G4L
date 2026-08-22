// THE SOURCE LIST FOR MEMBER-FACING COPY — the one place it is written down.
//
// Two tools need to know which files hold member copy: build-transcript.mjs (which reads them) and
// publish-canon.mjs (which must refuse to publish when one of them changed after the transcript was built).
// Copying the list into both would mean the freshness guard silently stops covering any surface added to only
// one copy — a guard that quietly narrows is worse than no guard, because it still reports green.

export const SECTIONS = [
  // THE FRONT DOOR AND THE FIRST DECISIONS. All four joined 2026-08-18, the day the extractor was taught to read
  // multi-line JSX — they had always carried member copy and always looked empty, so nothing ever reported them
  // missing. app/page.tsx is the PUBLIC landing page: the first words anyone reads, including everyone arriving
  // from a marketing link, and it had never been in a bundle.
  { title: 'The front door (public landing page)', files: ['app/page.tsx'] },
  // gap-confirm.tsx carries the three answers a member taps to close her own story, plus the line that shows her
  // the Doors we inferred and tells her she can take one off. That is authored copy at the heaviest beat in
  // onboarding, so it is quotable and it belongs in the bundle.
  { title: 'Onboarding', files: ['lib/agent/onboarding-staged.ts', 'app/onboarding/welcome.tsx', 'app/onboarding/identity-picker.tsx', 'app/onboarding/gap-confirm.tsx', 'lib/agent/gap-confirm-choice.ts'] },
  // The keeper OFFER — "Keep this in your Playbook?" and its receipt. Small, but it is the moment a member decides
  // what the program is allowed to remember about her, so marketing and the book will want the exact words.
  // keeper-actions.ts carries the failure copy. It is not rendered TODAY — the component only reads res.ok — but
  // listing it beats excluding it: the guard's own warning is that a wrong exclusion hides real copy, and the day
  // someone surfaces that error is the day it becomes member-facing without anyone re-checking this list.
  { title: 'The keeper offer', files: ['app/components/keeper-offer.tsx', 'app/components/keeper-actions.ts'] },
  // THE FOUR ARC CHATS. Off the backlog 2026-08-19: they carry authored copy a member reads at the close of every
  // Session — the badge beat ("You earned another badge!"), the hand-home CTA, and the tap that opens a ceremony.
  // Small in volume, high in visibility: these are the last words of a Session.
  { title: 'The Session close (the four arc chats)', files: [
    'app/rewire/rewire-chat.tsx', 'app/rebuild/rebuild-chat.tsx',
    'app/reclaim/reclaim-chat.tsx', 'app/reconnect/reconnect-chat.tsx',
  ] },
  { title: 'Email verification', files: ['app/login/verify/page.tsx'] },
  // THE FIRST DAY — and it had NEVER been in a bundle, through v3.2.1, v3.3 and v3.4.
  //
  // The Threshold ceremony is the seven beats a member reads the moment they finish onboarding, and the Opening
  // Tour is the twelve stops that introduce the product to them. Between them they are the most quotable copy we
  // have — the first words the program says to someone who has just admitted what they lost — and marketing and
  // the book have been working without them, unable to tell they were missing. Found 2026-08-13 while cutting
  // v3.4.1, when three topbar strings disappeared from the diff and the reason turned out to be this list.
  {
    title: 'The first day — the Threshold ceremony & the Opening Tour',
    files: ['lib/ceremony/threshold-beats.ts', 'app/dashboard/post-ceremony-tour.tsx'],
  },
  // The messaging ladder: one idea per feature, said as a tour line, a panel, a header and an intro. It is the
  // SOURCE for the subpage headers and (since 2026-08-13) for the tour lines too, so it has to be read here or
  // the copy Jay actually edits is invisible to canon.
  { title: 'The messaging ladder (panel · header · intro)', files: ['lib/content/panel-messaging.ts'] },
  // legacy-letter.ts joined 2026-08-16, the day it was written — it carries Greg's six Legacy Letter prompts
  // verbatim, and a member reads every one of them. Listed the same day the copy landed, because the guard
  // caught it: this is the file being added to the list BEFORE it could ship missing from a bundle, which is
  // exactly the failure the coverage ratchet exists to prevent.
  // doors-board.ts joined 2026-08-18 with the Doors board. It is the RECOGNITION copy for the R2 board — the paragraph a
  // member reads to decide whether a Door is hers — as distinct from lib/doors.ts's one-line taxonomy descriptor.
  // Listed the same day it was written, before it could ship missing from a bundle.
  { title: 'Reconnect — the gateway', files: ['lib/agent/reconnect.ts', 'lib/idq/instrument.ts', 'lib/ceremony/reconnect-ceremony-beats.ts', 'lib/reconnect/legacy-letter.ts', 'lib/content/doors-board.ts',
    // The board's own UI copy — the rating prompt and the three temporal questions she reads while tapping.
    // The CARD text lives in lib/content/doors-board.ts; these are the words around it, and a member reads
    // both. Added 2026-08-18, the day the surface was written.
    'app/reconnect/doors-board.tsx'] },
  { title: 'Rewire — mind', files: ['lib/agent/rewire.ts', 'lib/curriculum/content/rewire.ts', 'lib/ceremony/rewire-ceremony-beats.ts'] },
  { title: 'Rebuild — body', files: ['lib/agent/rebuild.ts', 'lib/rebuild/why-instrument.ts', 'lib/rebuild/skills-instrument.ts', 'lib/ceremony/rebuild-ceremony-beats.ts'] },
  { title: 'Reclaim — the outcome', files: ['lib/agent/reclaim.ts', 'lib/reclaim/bigger-world-instrument.ts', 'lib/ceremony/reclaim-ceremony-beats.ts'] },
  // The practice week a member ticks daily, and the reads their Playbook shows them back. Added 2026-08-12: these
  // carry real member-facing copy (the refusal when a tick would delete their own writing; "Where your ratings
  // point") and were in NO section, so the transcript was quietly missing them rather than reporting them absent.
  // The Quality-Day log joined this section on 2026-08-15, when the C3 rework moved the practice's own sentence
  // ("Noticing and defining a quality day, one day at a time") into the page's hero and added the day labels a
  // member reads while back-filling. Listed the same day the copy landed — the guard caught it before the bundle
  // could ship a version of Quality Days that no longer matched the app.
  { title: 'The practice week & Playbook reads', files: ['lib/rewire/w3-entry.ts', 'lib/rewire/w3-moves.ts', 'lib/practice/mark.ts', 'app/momentum/week-grid.tsx', 'lib/playbook/reads.ts', 'app/quality-day/[memberId]/page.tsx', 'app/quality-day/quality-day-log.tsx'] },
  { title: 'Grinta baseline (the 12-item survey)', files: ['lib/grinta/survey/instrument.ts'] },
  { title: 'Session & phase summaries ("Why this matters")', files: ['lib/content/summaries.ts'] },
  // WHERE IT LIVES — the line at every Session close naming what she made and where it went. Authored, and read
  // at the end of all thirteen Sessions, so it is quotable and belongs in canon.
  { title: 'The Session close — where it lives', files: ['lib/content/where-it-lives.ts'] },
  // The in-Session teaching layer (2026-08-17). "Why this matters" and "Explore the Science" stopped being
  // optional header widgets and became required beats INSIDE each Session — so this copy is now something every
  // member reads on the way through, not something a curious one opens. teaching.ts resolves the beats and holds
  // the asset titles on the provenance chips; teaching-cards.tsx is the rendered copy.
  { title: 'The in-Session teaching layer (Frame · Understand)', files: ['lib/content/teaching.ts', 'app/workspace/teaching-cards.tsx'] },
  // B2's development map — the lead line naming their strongest skill and the family shape. Member-facing prose
  // that reads as a finding about them, which is exactly the kind marketing and the book quote.
  { title: "B2 — the development map ('your map')", files: ['lib/rebuild/skills-map.ts'] },
  { title: 'Badges', files: ['lib/curriculum/registry.ts', 'app/badges/[memberId]/page.tsx'] },
  // The human step after a Session — the line that points a member at a real person in the Community. Small, but
  // it is the Companion's north star (bridging toward real people) said out loud, so marketing and the book will
  // want the exact words.
  { title: 'The human step after a Session', files: ['lib/connect/post-session-nudge.ts'] },
  // The seeded Community topics a Session's nudge now points AT. Member-facing: she reads the title and body
  // when she follows the link, so they are authored copy and Cowork has to be able to see them.
  { title: 'Community — the topic after each Session', files: ['lib/connect/session-topics.ts'] },
  // THIS LIST IS HAND-MAINTAINED, WHICH MEANS IT GOES STALE SILENTLY — and it had. Audited 2026-08-08 while
  // cutting v3.3 and found the transcript, the artifact marketing and the BOOK quote from, was missing the
  // CENTRE of the dashboard: triptych-right was listed but triptych-center (the Companion hero, the standing
  // update) and triptych-left (the panels) never were. It also still listed the Field Guide, which is now an
  // empty redirect. Under-reporting is the dangerous direction: a missing surface reads as "no copy there"
  // rather than as an error, so Claudette writes around a gap she can't see.
  // WHEN A NEW MEMBER-FACING SURFACE SHIPS, ADD IT HERE. That is the whole maintenance contract.
  {
    title: 'Dashboard & subpages (UI copy)',
    files: [
      'app/dashboard/redesign-dashboard.tsx',
      'app/dashboard/topbar-view.tsx', // brand · Playbook · account — on every logged-in screen
      'app/dashboard/dashboard-triptych.tsx', // the mobile fold's pane labels: Where You Are · G4L Companion · What's Next
      'app/dashboard/triptych-center.tsx', // the Companion hero, breadcrumb, keeper + "Where you stand"
      'app/dashboard/companion-hero.tsx',
      'app/dashboard/triptych-left.tsx', // Your Playbook · ID Score · Grinta · Badges
      'app/dashboard/triptych-right.tsx',
      'app/dashboard/resilience-pulse.tsx',
      // The Activity Panel's reflective line ("A quiet week — that is part of it too."). Member copy that sat
      // just UNDER the coverage guard's 3-string floor until 2026-08-14, so it was never a listed omission and
      // never in canon either — invisible in both directions. The guard caught it the moment the file changed.
      // Exactly the blind spot the ratchet exists for: not a file someone decided to leave out, a file nobody saw.
      'lib/activity/summary.ts',
      // The cadence pair (#155, 2026-08-14): the control a member taps to start a weekly practice from their
      // Reclaim List, and the Companion's note when they do. The guard caught the second one the moment it was
      // written — it IS member copy, so it belongs in canon rather than in an exclusion list.
      'app/dashboard/track-weekly.tsx',
      'app/dashboard/cadence-actions.ts',
      'app/momentum/[memberId]/page.tsx',
      'app/momentum/momentum-log.tsx',
      'app/score/[memberId]/page.tsx',
      'app/grinta/[memberId]/page.tsx',
      'app/movement/[memberId]/page.tsx',
      'app/reclaim-list/[memberId]/page.tsx',
      'app/connect/[memberId]/page.tsx', // the Community (route name only — never "Connect" to a member)
      'app/playbook/[memberId]/redesign-playbook-view.tsx',
      'app/account/page.tsx',
    ],
  },
];
