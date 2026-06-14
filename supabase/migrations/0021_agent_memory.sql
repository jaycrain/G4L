-- 0021: Durable companion memory. The check-in thread is replayed to the agent only as a recent
-- window (last ~40 messages). As older messages age out, their durable facts — people and
-- relationships, life events, health context, preferences — are distilled into a running memory so
-- "the knowing compounds" (Member Agent north star) instead of scrolling away forever.
--
-- agent_memory      : the running, merged summary the agent always carries (member's world, in brief).
-- agent_memory_seq  : the highest agent_message.seq already folded into agent_memory (so we never
--                     re-summarize the same messages). 0 = nothing folded yet.
alter table member_profile add column if not exists agent_memory text;
alter table member_profile add column if not exists agent_memory_seq bigint not null default 0;
