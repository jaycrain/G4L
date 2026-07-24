-- 0061: the LADDER — link a commitment to the Reclaim List item it serves. A commitment ("walk 3 days") is a weekly
-- rung; the Reclaim item ("ride 115 miles a week", "get off all meds") is the outcome it moves toward. The whole
-- accountability posture is holding the member to THEIR OWN desired outcomes, so a commitment knowing which outcome it
-- serves is load-bearing (Jay: "our role is to help them realize their Reclaim List"). Nullable — a commitment can
-- stand alone. On reclaim item delete, keep the commitment, just unlink it.
alter table commitment add column if not exists reclaim_item_id uuid references reclaim_item(id) on delete set null;
