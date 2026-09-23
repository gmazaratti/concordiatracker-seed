-- An ORG-CREATING invite (org_id null): accepting builds a brand-new pending
-- club with no bio, which is the real club-president path and the one the
-- wizard is written for.
insert into public.org_invites
  (token, org_name, org_handle, glyph, color, recipient_email, max_uses, expires_at, org_id)
values
  ('club-sarah-7k2p', 'Sarah''s Test Club', 'sarahtestclub', 'ST', '#8fb39a', '', 1,
   now() + interval '14 days', null)
on conflict (token) do update
  set use_count = 0, expires_at = now() + interval '14 days', org_id = null
returning token, org_name, org_handle, org_id, max_uses, use_count, expires_at;
