// THE SOURCE LIST FOR MEMBER-FACING COPY — the one place it is written down.
//
// Two tools need to know which files hold member copy: build-transcript.mjs (which reads them) and
// publish-canon.mjs (which must refuse to publish when one of them changed after the transcript was built).
// Copying the list into both would mean the freshness guard silently stops covering any surface added to only
// one copy — a guard that quietly narrows is worse than no guard, because it still reports green.

export const SECTIONS = [
  { title: 'Onboarding', files: ['lib/agent/onboarding-staged.ts', 'app/onboarding/welcome.tsx'] },
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
  { title: 'Reconnect — the gateway', files: ['lib/agent/reconnect.ts', 'lib/idq/instrument.ts', 'lib/ceremony/reconnect-ceremony-beats.ts'] },
  { title: 'Rewire — mind', files: ['lib/agent/rewire.ts', 'lib/curriculum/content/rewire.ts', 'lib/ceremony/rewire-ceremony-beats.ts'] },
  { title: 'Rebuild — body', files: ['lib/agent/rebuild.ts', 'lib/rebuild/why-instrument.ts', 'lib/rebuild/skills-instrument.ts', 'lib/ceremony/rebuild-ceremony-beats.ts'] },
  { title: 'Reclaim — the outcome', files: ['lib/agent/reclaim.ts', 'lib/reclaim/bigger-world-instrument.ts', 'lib/ceremony/reclaim-ceremony-beats.ts'] },
  // The practice week a member ticks daily, and the reads their Playbook shows them back. Added 2026-08-12: these
  // carry real member-facing copy (the refusal when a tick would delete their own writing; "Where your ratings
  // point") and were in NO section, so the transcript was quietly missing them rather than reporting them absent.
  { title: 'The practice week & Playbook reads', files: ['lib/rewire/w3-entry.ts', 'lib/practice/mark.ts', 'app/momentum/week-grid.tsx', 'lib/playbook/reads.ts'] },
  { title: 'Grinta baseline (the 12-item survey)', files: ['lib/grinta/survey/instrument.ts'] },
  { title: 'Session & phase summaries ("Why this matters")', files: ['lib/content/summaries.ts'] },
  { title: 'Badges', files: ['lib/curriculum/registry.ts', 'app/badges/[memberId]/page.tsx'] },
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
