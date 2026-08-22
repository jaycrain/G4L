begin;

-- The Founders' authoring identity. NOT a member: it exists so a Community post can have a
-- truthful author, since connect_post.author_id is NOT NULL and references member_profile.
--
-- Guarded with NOT EXISTS rather than ON CONFLICT: member_profile.email carries no unique
-- constraint (only hubspot_contact_id does), so ON CONFLICT (email) errors 42P10.
insert into member_profile (display_name, email, active, ai_consent_granted_at)
select 'The Founders', 'founders@system.grintaforlife.internal', false, now()
where not exists (
  select 1 from member_profile
   where lower(email) = 'founders@system.grintaforlife.internal'
);

commit;
