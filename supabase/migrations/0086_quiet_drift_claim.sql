-- THE QUIET-DRIFT CLAIM — the member declaring what we currently only infer.
--
-- Doors-board ruling #9 (docs/decisions/2026-08-18-doors-board.md). The R2 board carries a card for quiet drift, using
-- Greg's Autopilot copy. Claiming it must NOT write a Door.
--
-- WHY NOT A DOOR. Decision C removed the `acceptance` slug on 2026-08-15 because it was the only STANCE in a
-- taxonomy of EVENTS — the other Doors are things that happened to someone; this is something they concluded — and
-- that category error is why it could never be matched. It fired on a real member's "at my age and in this economy,
-- I was virtually unhireable": a woman describing being shut out of the job market, told by the product that she
-- had quietly surrendered to aging. Adding a slug back would restore a matcher target and that failure with it.
--
-- WHAT SURVIVED is the cue list, as isAcceptanceFade, feeding the Stage-0 admission gate — it decides whether a
-- resigned member has a real Fade and must be admitted. That signal is currently INFERRED from her prose every
-- time. This column lets her state it herself, which is strictly better than the inference that misread her, and
-- it is the same principle as ruling #4: her own claim outranks our matcher.
--
-- NULLABLE, and absent means NOT ASKED — never "not true". Every member predating the board has none of this, and
-- a surface that renders null as false would tell them something about themselves they never said.
--
-- member_profile carries an audit trigger (0032), so changes here are recorded without an app-layer duplicate.

alter table member_profile add column if not exists quiet_drift_claimed_at timestamptz;

comment on column member_profile.quiet_drift_claimed_at is
  'When the member claimed the quiet-drift card on the R2 Doors board. NOT a Door (Decision C: a stance, not an event). Null = never asked, not "no".';
