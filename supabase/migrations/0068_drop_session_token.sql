-- 0068: drop the dead plaintext session token.
--
-- `member_session.token` held the RAW bearer string until 0064 moved to sha-256 (SEC-12). It was left in place
-- deliberately — nullable, unused — because prod migrations are applied BY HAND and the store had to work on
-- both shapes during the window between deploy and migration. That shim has now been removed: every read and
-- write goes through token_hash, and this column has been empty and unreferenced since 0064.
--
-- SAFE TO RUN NOW, and the ordering is why: the code released before this stopped touching `token` entirely,
-- so dropping it cannot break a running instance. That is the two-release rule from the hardening ledger,
-- followed rather than quoted — release one removes the dependency, release two removes the column.
--
-- Why bother with an empty column: a dead auth column is how someone later writes code against it. The next
-- person reading this table should see one way to identify a session, not two.

alter table member_session drop column if exists token;
