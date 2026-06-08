-- 0011: GRINTA! Bites consumption. Small, non-program content the Member Agent serves day to day;
-- consuming one is a "rep" that feeds the GRINTA! Index. Bite content lives in code (a versioned
-- registry, like assets); this records who consumed what. PK keeps it idempotent (consume once).
create table if not exists bite_consumed (
  member_id uuid not null references member_profile(member_id) on delete cascade,
  bite_code text not null,
  consumed_at timestamptz not null default now(),
  primary key (member_id, bite_code)
);
create index if not exists bite_consumed_member_idx on bite_consumed (member_id, consumed_at);
