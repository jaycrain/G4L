// THE SOURCE LIST FOR MEMBER-FACING COPY — the one place it is written down.
//
// Two tools need to know which files hold member copy: build-transcript.mjs (which reads them) and
// publish-canon.mjs (which must refuse to publish when one of them changed after the transcript was built).
// Copying the list into both would mean the freshness guard silently stops covering any surface added to only
// one copy — a guard that quietly narrows is worse than no guard, because it still reports green.

export const SECTIONS = [
  { title: 'Onboarding', files: ['lib/agent/onboarding-staged.ts'] },
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
      'app/dashboard/triptych-center.tsx', // the Companion hero, breadcrumb, keeper + "Where you stand"
      'app/dashboard/triptych-left.tsx', // Your Playbook · ID Score · Grinta · Badges
      'app/dashboard/triptych-right.tsx',
      'app/dashboard/resilience-pulse.tsx',
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
