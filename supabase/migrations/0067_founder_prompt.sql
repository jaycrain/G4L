-- 0067: the questions Jay keeps asking, saved.
--
-- The console ships four default pins. They're a decent guess at a morning routine and they are not HIS
-- routine — that only shows up in use. Starring a question he just asked turns the pin row from a feature
-- tour into his own shortlist.
--
-- Server-side, not localStorage, for the same reason the thread is: he asks from a bike ride and then a desk,
-- and a shortcut that only exists on one device isn't a shortcut.
--
-- No member data here — these are his own words, typed by him, about how he works. None of the retention or
-- purge machinery that founder_message needs applies.

create table if not exists founder_prompt (
  id         bigserial primary key,
  operator   text not null default 'jay',
  text       text not null,
  created_at timestamptz not null default now(),
  unique (operator, text)   -- starring the same question twice is one pin, not two
);

create index if not exists founder_prompt_idx on founder_prompt (operator, created_at desc);

alter table founder_prompt enable row level security;
-- No policies: owner connection bypasses RLS, nothing member-facing reads this. Keeps the RLS-on-by-default
-- sweep (0039/0042) honest.
