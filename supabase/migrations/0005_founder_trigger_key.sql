-- 0005: founder auto-trigger idempotency. A draft created automatically by a member event
-- (IDQ completion, asset milestone) records the event key so the same event never drafts twice.
-- Null for manually-generated drafts.
alter table founder_agent_drafts add column if not exists trigger_key text;
