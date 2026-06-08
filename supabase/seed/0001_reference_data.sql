-- ============================================================================
-- G4L Platform — Seed 0001: reference / config data
-- The 8 Doors, the 4 IDQ dimensions, and the 12 gated Atlas assets.
-- All values are locked — see docs/CONTRACTS.md §3, §1, §5.
-- Idempotent: safe to re-run.
-- ============================================================================

-- The 8 Doors — CONTRACTS §3 (locked to the pitch deck) -----------------------
insert into door (slug, display_name, descriptor, sort_order) values
  ('career_cliff', 'The Career Cliff', 'The role that ended, plateaued, or a retirement that became a freefall.', 1),
  ('aging_parents','The Aging Parents','The role reversal that makes you a primary caregiver.', 2),
  ('empty_nest',   'The Empty Nest',  'The house that got quiet when the kids left.', 3),
  ('vanishing',    'The Vanishing',   'The friendships that quietly disappeared.', 4),
  ('body',         'The Body',        'The body that started saying no to what it used to do easily.', 5),
  ('diagnosis',    'The Diagnosis',   'The mirror moment you could not avoid.', 6),
  ('marriage',     'The Marriage',    'The drift from partnership into coexistence.', 7),
  ('loss',         'The Loss',        'The death of someone close that changed everything.', 8)
on conflict (slug) do update
  set display_name = excluded.display_name,
      descriptor   = excluded.descriptor,
      sort_order   = excluded.sort_order;

-- The 4 IDQ dimensions — CONTRACTS §1 -----------------------------------------
insert into idq_dimension (key, label, anchoring, item_count, sort_order) values
  ('physical','Physical','Lorig & Holman self-management', 6, 1),
  ('self',    'Self',    'SDT autonomy', 6, 2),
  ('social',  'Social',  'SDT relatedness', 6, 3),
  ('outlook', 'Outlook', 'SDT competence + intrinsic motivation', 6, 4)
on conflict (key) do update
  set label = excluded.label, anchoring = excluded.anchoring,
      item_count = excluded.item_count, sort_order = excluded.sort_order;

-- The 12 gated Atlas assets — CONTRACTS §5 ------------------------------------
insert into atlas_asset (code, name, r_group, layer, is_gated, supports_variants, sort_order) values
  ('R-1','IDQ',                          'Reconnect','Recognition',  true, false, 1),
  ('R-4','Identity Excavation',          'Reconnect','Excavation',   true, true,  2),
  ('R-6','Window Exercise',              'Reconnect','Spark',        true, true,  3),
  ('W-1','Disinformation Audit',         'Rewire',   'Awareness',    true, false, 4),
  ('W-3','Visualization Workshop',       'Rewire',   'Visualization',true, false, 5),
  ('W-5','False Start Protocol',         'Rewire',   'Hardiness',    true, false, 6),
  ('B-1','First Step Assessment',        'Rebuild',  null,           true, false, 7),
  ('B-2','Appreciating Your Strengths and Weaknesses', 'Rebuild', null, true, false, 8),
  ('B-3','First 1,000 Miles',            'Rebuild',  null,           true, false, 9),
  ('B-5','Fuel Plan',                    'Rebuild',  null,           true, false, 10),
  ('C-1','Reclaim Readiness Assessment', 'Reclaim',  null,           true, false, 11),
  ('C-3','Adventure Planning Worksheet', 'Reclaim',  null,           true, false, 12),
  ('C-5','Your Success Story',           'Reclaim',  null,           true, false, 13)
on conflict (code) do update
  set name = excluded.name, r_group = excluded.r_group, layer = excluded.layer,
      is_gated = excluded.is_gated, supports_variants = excluded.supports_variants,
      sort_order = excluded.sort_order;
