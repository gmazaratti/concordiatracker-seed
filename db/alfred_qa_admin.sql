-- Alfred's QA sign-in gets the admin console. db/alfred_qa_admin.sql.
--
-- alfred.qa@concordiatracker.com is a dedicated email/password account
-- (internal, not counted as a user). It is the account a person-shaped QA
-- session signs in as. alfred@concordiatracker.com stays the passwordless API
-- identity (an agent, so it cannot use the human-admin tools); this one is a
-- HUMAN admin, which is what the console and "Parse manually" require.
-- There is no narrower QA role: the console gates on is_admin(), and manual
-- delivery on ct_admin_write(). The password is NOT set or read here.
insert into public.admins (user_id)
select id from auth.users where lower(email) = 'alfred.qa@concordiatracker.com'
on conflict do nothing;
