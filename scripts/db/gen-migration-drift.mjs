// Generate the migration-drift diagnostic SQL from the schema.ts sentinels.
const Q = "'"; // SQL single quote
const M = [
  ["0001", { t: "door" }], ["0002", { t: "asset_completion" }], ["0003", { t: "founder_agent_drafts" }],
  ["0004", { c: ["member_profile", "avatar_url"] }], ["0005", { c: ["founder_agent_drafts", "trigger_key"] }],
  ["0006", { t: "push_subscription" }], ["0007", { t: "activity_event" }], ["0008", { t: "nudge_log" }],
  ["0009", { t: "member_credential" }], ["0010", { t: "agent_message" }], ["0011", { t: "bite_consumed" }],
  ["0012", { t: "member_door" }], ["0013", { t: "_rls_enabled" }], ["0014", { t: "reclaim_item" }],
  ["0015", { c: ["member_profile", "field_guide_seen_at"] }], ["0016", { t: "onboarding_session" }],
  ["0017", { t: "playbook_entry" }], ["0018", { c: ["member_profile", "threshold_crossed_at"] }],
  ["0019", { s: `exists(select 1 from pg_constraint where conname=${Q}reclaim_item_category_check${Q} and pg_get_constraintdef(oid) like ${Q}%life%${Q})` }],
  ["0020", { t: "measure" }], ["0021", { c: ["member_profile", "agent_memory"] }],
  ["0022", { c: ["member_profile", "dashboard_snapshot"] }], ["0023", { t: "session_progress" }],
  ["0024", { s: `exists(select 1 from pg_constraint where conname=${Q}playbook_entry_source_kind_check${Q} and pg_get_constraintdef(oid) like ${Q}%session%${Q})` }],
  ["0025", { c: ["member_profile", "phase_crossing_seen"] }], ["0026", { t: "daily_beat_log" }],
  ["0027", { c: ["member_profile", "playbook_synthesis"] }], ["0028", { t: "member_event" }],
  ["0029", { t: "member_feedback" }], ["0030", { c: ["activity_connection", "access_token_enc"] }],
  ["0031", { c: ["member_profile", "tour_completed_at"] }],
  ["0032", { s: `exists(select 1 from pg_trigger where tgname=${Q}member_profile_audit_del${Q})` }],
  ["0033", { s: `coalesce(pg_get_functiondef(to_regprocedure(${Q}audit_member_profile()${Q})) ilike ${Q}%dashboard_snapshot%${Q}, false)` }],
  ["0034", { t: "system_health" }], ["0035", { t: "connect_post" }], ["0036", { c: ["connect_report", "source"] }],
  ["0037", { t: "connect_notification" }], ["0038", { t: "connect_room" }], ["0039", { t: "_rls_sweep_0039" }],
  ["0040", { c: ["reclaim_item", "removed_at"] }], ["0041", { c: ["member_profile_audit", "source"] }],
  ["0042", { t: "_rls_sweep_0042" }],
  ["0043", { c: ["member_door", "removed_at"] }], ["0044", { c: ["atlas_asset", "administration_tier"] }],
  ["0045", { s: `exists(select 1 from pg_constraint where conname=${Q}reclaim_list_min_1${Q})` }],
  ["0046", { c: ["playbook_entry", "keeper_type"] }],
  ["0047", { t: "grinta_reading" }],
  ["0048", { t: "practice_week" }],
  ["0049", { t: "momentum_call" }],
];
const expr = (x) =>
  x.t ? `to_regclass(${Q}public.${x.t}${Q}) is not null`
  : x.c ? `exists(select 1 from information_schema.columns where table_schema=${Q}public${Q} and table_name=${Q}${x.c[0]}${Q} and column_name=${Q}${x.c[1]}${Q})`
  : `(${x.s})`;
const rows = M.map(([n, x]) => `  select ${Q}${n}${Q} as migration, coalesce(${expr(x)}, false) as applied`).join("\n  union all\n");
console.log(`-- Migration drift: which repo migrations are applied on this database?\n-- 'applied=false' rows are MISSING from this DB (run them, in order).\nselect migration, applied\nfrom (\n${rows}\n) t\nwhere applied = false   -- show ONLY the gaps; delete this line to see all ${M.length}\norder by migration;`);
