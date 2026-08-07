// THE RETENTION POLICY, AS DATA.
//
// Agreed by Jay 2026-08-07. It lives in code rather than a document for one reason: a policy nobody can see
// from inside the product is a policy that drifts from what the product actually does. This module is the single
// source of truth — the console renders it, and any purge job we build must read its numbers from here rather
// than restate them.
//
// THE HONEST PART, and the reason `status` exists on every row. Almost none of this is ENFORCED yet. Three
// purges run today (sessions, spent tokens, abandoned onboarding); nothing prunes transcripts or telemetry, and
// member-initiated account deletion does not exist at all. A policy page that read as "here is what we do"
// would be exactly the failure we fixed this afternoon in the crisis path — a gap that looks covered, so nobody
// goes looking. So each row says plainly whether it is a commitment or a running job.
//
// THE PRINCIPLE: retain by PURPOSE, not by one blanket number. The Companion reads the last ~40 messages plus
// the folded memory (lib/agent/memory.ts) and never the long tail of raw turns — so beyond a few months raw
// transcripts carry no product value and maximum sensitivity. That asymmetry sets the numbers below.

export type RetentionStatus = 'enforced' | 'agreed-not-built';

export type RetentionRow = {
  what: string;
  keep: string;
  why: string;
  status: RetentionStatus;
  /** For enforced rows: where the job lives. For the rest: what has to be built. */
  mechanism: string;
};

export const RETENTION_POLICY: readonly RetentionRow[] = [
  {
    what: 'Member artifacts — Reclaim List, Playbook keepers, ID Score, Grinta, badges, momentum, commitments',
    keep: 'Life of the account',
    why: 'This is the product. It is their record of their own comeback, and a keeper is something they chose to save.',
    status: 'enforced',
    mechanism: 'Nothing deletes these; retention is the default state.',
  },
  {
    what: 'Raw conversation turns (Companion + session transcripts)',
    keep: '12 months, rolling',
    why:
      'The Companion reads the last ~40 messages plus the folded memory, never the long tail — so older raw turns ' +
      'are liability without product value. Twelve months still covers a full Loop cycle and six IDQ retakes.',
    status: 'agreed-not-built',
    mechanism: 'Needs a scheduled purge. No job prunes transcripts today.',
  },
  {
    what: 'Folded agent memory (member_profile.agent_memory)',
    keep: 'Life of the account',
    why: 'Derived and far less granular than the transcript, and it is what "remember, so the knowing compounds" runs on.',
    status: 'enforced',
    mechanism: 'Rewritten in place as it folds; never accumulates.',
  },
  {
    what: 'Product telemetry (member_event)',
    keep: '24 months',
    why: 'Internal QI. Low individual sensitivity, real value in year-over-year patterns.',
    status: 'agreed-not-built',
    mechanism: 'Needs a scheduled purge, with crisis_flagged rows excluded.',
  },
  {
    what: 'Crisis events (member_event kind=crisis_flagged)',
    keep: 'Life of the account — never auto-purged',
    why:
      'A safety record. Deleting the evidence that we were told someone was in danger is not a retention policy. ' +
      'This deliberately cuts against minimum-necessary, and Jay agreed to that explicitly.',
    status: 'agreed-not-built',
    mechanism: 'Needs the telemetry purge to exclude this kind — which is why the purge must be written carefully.',
  },
  {
    what: 'Abandoned onboarding',
    keep: '30 days',
    why: 'Someone who started and never finished has not chosen to be a member; their half-told story should not linger.',
    status: 'enforced',
    mechanism: 'purge_expired_auth(), migration 0064, run on the daily cron.',
  },
  {
    what: 'Sessions and spent auth tokens',
    keep: 'Expiry, plus 7 days for tokens',
    why: 'Credentials-in-waiting have no reason to outlive their use.',
    status: 'enforced',
    mechanism: 'purge_expired_auth(), migration 0064, run on the daily cron.',
  },
  {
    what: 'Deleted accounts',
    keep: 'Hard delete within 30 days, after a 7-day grace window',
    why: '"I want out" and "I made a mistake" can be hours apart. After that, gone.',
    status: 'agreed-not-built',
    mechanism: 'Member-initiated deletion does not exist yet — there is no way for a member to ask.',
  },
] as const;

/** Things the policy cannot promise, stated on the page rather than buried. */
export const RETENTION_CAVEATS: readonly { head: string; body: string }[] = [
  {
    head: 'Deletion does not reach backups immediately',
    body:
      'Purging the live database does not purge Supabase point-in-time recovery. Deletion genuinely completes ' +
      'when the backup window rolls. The privacy policy should say so plainly rather than imply otherwise.',
  },
  {
    head: 'This is a product judgment, not legal advice',
    body:
      'We hold mental-health-adjacent disclosures from named people. Before Charter, someone qualified should ' +
      'confirm no law or insurer requirement sets a floor or ceiling these numbers miss.',
  },
  {
    head: 'Most of it is agreed, not running',
    body:
      'Three purges exist today. Transcripts and telemetry accumulate, and a member cannot yet ask to be ' +
      'deleted. Every row above says which it is; do not read the page as a description of what happens.',
  },
];
