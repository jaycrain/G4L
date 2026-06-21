-- 0036: Connect trust & safety. Lets the crisis-routing path file a report with NO human reporter
-- (source='system'), so member reports and auto-flagged crisis content land in ONE moderation queue.
-- Also lets moderation actions be attributed. Design: docs/connect-design.md.

-- A report can be system-generated (crisis detection) — no human reporter in that case.
alter table connect_report alter column reporter_id drop not null;
alter table connect_report add column if not exists source text not null default 'member'
  check (source in ('member', 'system'));

-- Sentinel for the apply check (schema.ts).
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_name = 'connect_report' and column_name = 'source') then
    raise exception 'connect_report.source missing';
  end if;
end $$;
