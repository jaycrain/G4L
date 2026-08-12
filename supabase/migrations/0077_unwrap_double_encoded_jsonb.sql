-- 0077 — UN-DOUBLE-ENCODE EVERY jsonb COLUMN.
--
-- Rows written before 2026-08-12 landed as jsonb SCALAR STRINGS rather than objects/arrays. Measured on prod, not
-- inferred: `select jsonb_typeof($1::jsonb)` with a JSON.stringify'd object returns "string", while
-- `$1::text::jsonb` returns "object". The cast resolved the PARAMETER's type to jsonb, so postgres.js serialised a
-- value that was already a JSON string and it was encoded twice.
--
-- Every JS reader survived it (they all parse a string on the way out), so nothing looked wrong. What died was
-- every predicate reaching into the column FROM SQL: `payload->>'kind'` on a jsonb string is NULL, so the filter
-- matched nothing, silently. That is how a member finished Quality Days with the profile and the week both in the
-- database and no tracker on their Playbook.
--
-- RUN THIS AFTER the write fix is live (commit 958e08d), not before — otherwise the next write re-strings the row.
--
-- SAFE ON EVERY COLUMN, INCLUDING THE HEALTHY ONES. Each statement is guarded by jsonb_typeof(col) = 'string', so
-- a column that was always stored correctly matches zero rows and is untouched. That is why all 21 are listed
-- rather than only the three we happened to observe on one member — we never surveyed the rest, and a guard that
-- makes the question moot beats a survey that can be incomplete.
--
-- `#>> '{}'` extracts the text a jsonb string is holding; ::jsonb then parses it once, correctly.
-- Idempotent: run it twice and the second run matches nothing.

update arc_session set messages = (messages #>> '{}')::jsonb
 where jsonb_typeof(messages) = 'string';
update arc_session set state = (state #>> '{}')::jsonb
 where jsonb_typeof(state) = 'string';
update bigger_world_reading set priorities = (priorities #>> '{}')::jsonb
 where jsonb_typeof(priorities) = 'string';
update bigger_world_reading set reflections = (reflections #>> '{}')::jsonb
 where jsonb_typeof(reflections) = 'string';
update bigger_world_reading set responses = (responses #>> '{}')::jsonb
 where jsonb_typeof(responses) = 'string';
update coaching_plan set payload = (payload #>> '{}')::jsonb
 where jsonb_typeof(payload) = 'string';
update founder_message set looked = (looked #>> '{}')::jsonb
 where jsonb_typeof(looked) = 'string';
update grinta_reading set responses = (responses #>> '{}')::jsonb
 where jsonb_typeof(responses) = 'string';
update member_event set meta = (meta #>> '{}')::jsonb
 where jsonb_typeof(meta) = 'string';
update member_feedback set context = (context #>> '{}')::jsonb
 where jsonb_typeof(context) = 'string';
update member_profile set dashboard_snapshot = (dashboard_snapshot #>> '{}')::jsonb
 where jsonb_typeof(dashboard_snapshot) = 'string';
update motivation_reading set responses = (responses #>> '{}')::jsonb
 where jsonb_typeof(responses) = 'string';
update motivation_reading set scores = (scores #>> '{}')::jsonb
 where jsonb_typeof(scores) = 'string';
update onboarding_session set messages = (messages #>> '{}')::jsonb
 where jsonb_typeof(messages) = 'string';
update onboarding_session set state = (state #>> '{}')::jsonb
 where jsonb_typeof(state) = 'string';
update outreach_log set provenance = (provenance #>> '{}')::jsonb
 where jsonb_typeof(provenance) = 'string';
update outreach_pref set channels = (channels #>> '{}')::jsonb
 where jsonb_typeof(channels) = 'string';
update quality_day_log set present = (present #>> '{}')::jsonb
 where jsonb_typeof(present) = 'string';
update self_management_reading set responses = (responses #>> '{}')::jsonb
 where jsonb_typeof(responses) = 'string';
update self_management_reading set scores = (scores #>> '{}')::jsonb
 where jsonb_typeof(scores) = 'string';
update session_progress set answers = (answers #>> '{}')::jsonb
 where jsonb_typeof(answers) = 'string';

-- VERIFY. Every row should read 'object' or 'array' — never 'string'. An empty result means no jsonb anywhere,
-- which would mean this query is wrong, not that the data is clean.
select 'arc_session.messages' as col, jsonb_typeof(messages) t, count(*) n from arc_session group by 2
union all select 'arc_session.state', jsonb_typeof(state), count(*) from arc_session group by 2
union all select 'bigger_world_reading.priorities', jsonb_typeof(priorities), count(*) from bigger_world_reading group by 2
union all select 'bigger_world_reading.reflections', jsonb_typeof(reflections), count(*) from bigger_world_reading group by 2
union all select 'coaching_plan.payload', jsonb_typeof(payload), count(*) from coaching_plan group by 2
union all select 'member_event.meta', jsonb_typeof(meta), count(*) from member_event group by 2
union all select 'session_progress.answers', jsonb_typeof(answers), count(*) from session_progress group by 2
order by 1, 2;
