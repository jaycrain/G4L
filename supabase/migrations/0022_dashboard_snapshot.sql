-- 0022: Dashboard change-detection (Pillar 2 — "notice every change"). The companion remembers the
-- state of the member's key dashboard signals as of their last interaction, so on the next visit it
-- can notice what MOVED (ID Score, GRINTA, completed Beats, a tracker that climbed, a goal reclaimed)
-- and reflect it warmly — the watched-over feeling that underpins trust. Not a metric store; just the
-- last-seen snapshot for diffing.
alter table member_profile add column if not exists dashboard_snapshot jsonb;
alter table member_profile add column if not exists dashboard_snapshot_at timestamptz;
