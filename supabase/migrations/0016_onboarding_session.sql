-- 0016: Onboarding save/resume. Persists in-flight onboarding so a hang / refresh / crash never
-- loses the member's conversation (the most fragile, most personal moment in the product). No member
-- row exists yet during onboarding, so this is keyed by email + a per-device resume token — only the
-- device that started a session can resume it, so a stranger can't resume someone's vulnerable
-- answers by guessing an email. Transient: deleted on completion.
create table if not exists onboarding_session (
  email      text primary key,
  token      text not null,
  state      jsonb not null,
  messages   jsonb not null,
  updated_at timestamptz not null default now()
);
alter table onboarding_session enable row level security;
