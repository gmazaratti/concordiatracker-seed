-- ============================================================================
-- The hierarchy and the audit log, exercised against the REAL database inside
-- a transaction that rolls back. Nothing here survives the run.
--
-- Impersonation is `request.jwt.claims`, transaction-local, which is what every
-- one of these functions reads through `auth.uid()`.
-- ============================================================================
begin;

create temporary table t_out (n int generated always as identity, label text, got text, want text);
create or replace function pg_temp.want(p_label text, p_got text, p_want text) returns void
language sql as $$ insert into t_out (label, got, want) values (p_label, p_got, p_want); $$;

create or replace function pg_temp.be(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated',
                      'email', p_uid::text || '@t.test')::text, true);
$$;

/* A refusal is a success here, so every "must be refused" check runs through
   this rather than aborting the file. */
create or replace function pg_temp.refused(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'ALLOWED';
exception when others then
  return 'refused';
end $$;

do $$
declare
  org uuid := gen_random_uuid();
  owner_u uuid := gen_random_uuid();
  admin_u uuid := gen_random_uuid();
  member_u uuid := gen_random_uuid();
  r_owner uuid; r_admin uuid; r_member uuid; r_new uuid;
  m_admin uuid := gen_random_uuid();
  m_member uuid := gen_random_uuid();
  m_third uuid := gen_random_uuid();
  third_u uuid := gen_random_uuid();
  act uuid;
  ev uuid := gen_random_uuid();
begin
  -- `organizations.owner_id` and `org_members.user_id` are FKs to auth.users,
  -- so the three test people have to exist. Rolled back with everything else.
  insert into auth.users (id, email, instance_id, aud, role)
  values (owner_u,  'zz-owner@t.test',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
         (admin_u,  'zz-admin@t.test',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
         (member_u, 'zz-member@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
         (third_u,  'zz-third@t.test',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  insert into public.organizations (id, owner_id, handle, name, glyph, color, status, bio)
  values (org, owner_u, '@zz-roletest', 'Role Test', 'RT', '#8fb39a', 'approved', 'before');

  select id into r_owner  from public.org_roles where org_id = org and system_key = 'owner';
  select id into r_admin  from public.org_roles where org_id = org and system_key = 'admin';
  select id into r_member from public.org_roles where org_id = org and system_key = 'member';

  perform pg_temp.want('a new org is seeded with three roles',
    (select count(*)::text from public.org_roles where org_id = org), '3');

  insert into public.org_members (id, org_id, user_id, name, email, role, status, role_id)
  values (m_admin,  org, admin_u,  'Ada',  'ada@t.test',  'admin',  'active', r_admin),
         (m_member, org, member_u, 'Mo',   'mo@t.test',   'member', 'active', r_member),
         (m_third,  org, third_u,   'Tam',  'tam@t.test',  'member', 'active', r_member);

  -- ── Permissions follow the role ───────────────────────────────────────────
  perform pg_temp.be(member_u);
  perform pg_temp.want('member: may view insights',
    public.org_perm(org, 'view_insights')::text, 'true');
  perform pg_temp.want('member: may NOT post',
    public.org_perm(org, 'post_create')::text, 'false');
  perform pg_temp.want('member: may NOT grant roles',
    public.org_perm(org, 'roles_grant')::text, 'false');

  perform pg_temp.be(admin_u);
  perform pg_temp.want('admin: may post',
    public.org_perm(org, 'post_create')::text, 'true');
  perform pg_temp.want('admin: may NOT change the handle',
    public.org_perm(org, 'handle_change')::text, 'false');
  perform pg_temp.want('admin: legacy alias still answers',
    public.org_perm(org, 'manage_events')::text, 'true');

  perform pg_temp.be(owner_u);
  perform pg_temp.want('owner: may change the handle',
    public.org_perm(org, 'handle_change')::text, 'true');
  perform pg_temp.want('owner outranks everything',
    (public.ct_org_position(org) > 1000000)::text, 'true');

  -- ── The hierarchy ─────────────────────────────────────────────────────────
  perform pg_temp.be(admin_u);
  perform pg_temp.want('admin may manage a role below theirs',
    public.ct_org_may_manage_role(r_member)::text, 'true');
  perform pg_temp.want('admin may NOT manage their OWN role',
    public.ct_org_may_manage_role(r_admin)::text, 'false');
  perform pg_temp.want('admin may NOT manage the owner role',
    public.ct_org_may_manage_role(r_owner)::text, 'false');

  perform pg_temp.want('admin cannot create a role at their own level',
    pg_temp.refused(format(
      'select public.create_org_role(%L, %L, %L, null, 50, %L)',
      org, 'Peer', '#fff', '{}'::jsonb)), 'refused');

  -- A role genuinely below them is allowed.
  select id into r_new from public.create_org_role(
    org, 'Moderator', '#a855f7', 'Shield', 30,
    '{"post_create": true, "post_edit": true, "roles_grant": true}'::jsonb, true);
  perform pg_temp.want('admin may create a role below theirs',
    (r_new is not null)::text, 'true');

  perform pg_temp.want('a granted permission the granter lacks is dropped',
    (select (permissions->>'handle_change') from public.org_roles where id = r_new), 'false');

  -- ── Granting ──────────────────────────────────────────────────────────────
  perform public.set_org_member_role(m_member, r_new);
  perform pg_temp.want('admin granted the member a lower role',
    (select r.name from public.org_members m join public.org_roles r on r.id = m.role_id
      where m.id = m_member), 'Moderator');

  -- The moderator can grant, but only below position 30.
  perform pg_temp.be(member_u);
  perform pg_temp.want('moderator may NOT promote somebody to admin',
    pg_temp.refused(format('select public.set_org_member_role(%L, %L)', m_admin, r_admin)),
    'refused');
  perform pg_temp.want('moderator may NOT demote the admin who outranks them',
    pg_temp.refused(format('select public.set_org_member_role(%L, %L)', m_admin, r_member)),
    'refused');
  -- You cannot manage a role you hold, so you cannot demote yourself either.
  perform pg_temp.want('moderator cannot change their OWN role',
    pg_temp.refused(format('select public.set_org_member_role(%L, %L)', m_member, r_member)),
    'refused');
  -- But a genuinely lower person is fair game.
  perform pg_temp.want('moderator MAY grant Member to somebody below them',
    pg_temp.refused(format('select public.set_org_member_role(%L, %L)', m_third, r_member)),
    'ALLOWED');

  -- ── Ownership ─────────────────────────────────────────────────────────────
  perform pg_temp.be(admin_u);
  perform pg_temp.want('an admin cannot transfer ownership',
    pg_temp.refused(format('select public.transfer_org_ownership(%L, %L, false)', org, m_admin)),
    'refused');

  perform pg_temp.be(owner_u);
  perform public.transfer_org_ownership(org, m_admin, false);
  perform pg_temp.want('ownership moved to the admin',
    (select (owner_id = admin_u)::text from public.organizations where id = org), 'true');
  perform pg_temp.be(admin_u);
  perform pg_temp.want('the new owner is an owner',
    public.ct_org_is_owner(org)::text, 'true');
  perform pg_temp.be(owner_u);
  perform pg_temp.want('MULTIPLE OWNERS: the previous one still is, by role',
    public.ct_org_is_owner(org)::text, 'true');
  perform pg_temp.want('the transfer notified them',
    (select count(*)::text from public.notifications
      where user_id = admin_u and kind = 'org_role'), '1');

  -- ── The audit log ─────────────────────────────────────────────────────────
  perform pg_temp.be(admin_u);
  perform pg_temp.want('the grant was logged with an actor',
    (select count(*)::text from public.org_activity
      where org_id = org and actor_user is not null and entity_type = 'member_role'), '2');

  -- A profile edit, logged with its before, then undone.
  insert into public.events (id, org_id, title, "start")
  values (ev, org, 'After', now());
  select public.ct_org_log(org, 'edited the event', null, 'event', ev::text,
                           jsonb_build_object('title', 'Before'),
                           jsonb_build_object('title', 'After'))
    into act;
  perform pg_temp.want('the entry is revertible',
    (select public.ct_activity_revertible(a)::text from public.org_activity a where a.id = act), 'true');
  perform public.revert_org_activity(act);
  perform pg_temp.want('reverting restored the old title',
    (select title from public.events where id = ev), 'Before');
  perform pg_temp.want('and the undo is itself in the log',
    (select count(*)::text from public.org_activity where org_id = org and entity_type = 'revert'), '1');
  perform pg_temp.want('a reverted entry cannot be reverted twice',
    pg_temp.refused(format('select public.revert_org_activity(%L)', act)), 'refused');

  -- Undoing a role change must restore BOTH columns, or the legacy `role`
  -- and `role_id` disagree about whether somebody is an admin.
  perform pg_temp.be(admin_u);
  perform public.set_org_member_role(m_third, r_new);
  perform pg_temp.want('granting kept the legacy column in step',
    (select role from public.org_members where id = m_third), 'member');
  select a.id into act from public.org_activity a
   where a.entity_type = 'member_role' and a.entity_id = m_third::text
   order by a.created_at desc limit 1;
  perform public.revert_org_activity(act);
  perform pg_temp.want('undo restored role_id',
    (select r.system_key from public.org_members m join public.org_roles r on r.id = m.role_id
      where m.id = m_third), 'member');
  perform pg_temp.want('undo restored the legacy column too',
    (select role from public.org_members where id = m_third), 'member');

  -- ── Who may read the log ──────────────────────────────────────────────────
  perform pg_temp.be(third_u);
  perform pg_temp.want('the Member role cannot read the log',
    public.ct_org_can_view_activity(org)::text, 'false');
  perform pg_temp.be(admin_u);
  perform pg_temp.want('a role with the switch on can',
    public.ct_org_can_view_activity(org)::text, 'true');
  perform pg_temp.be(owner_u);
  perform pg_temp.want('and an owner always can',
    public.ct_org_can_view_activity(org)::text, 'true');

  -- ── Bulk undo is owner-only ───────────────────────────────────────────────
  perform pg_temp.be(admin_u);
  -- admin_u is now an owner (ownership was transferred to them), so use the
  -- moderator, who is not.
  perform pg_temp.want('a handoff re-opened setup',
    (select (setup_completed_at is null)::text from public.organizations where id = org), 'true');

  /* THE BULK RUN ITSELF, not just its refusal. Two more edits by one person,
     then undo their whole window and check both went back. */
  perform pg_temp.be(admin_u);
  update public.events set title = 'Changed once' where id = ev;
  perform public.ct_org_log(org, 'edited the event', null, 'event', ev::text,
                            jsonb_build_object('title', 'Original'), null);
  update public.organizations set bio = 'Changed too' where id = org;
  perform public.ct_org_log(org, 'edited the profile', null, 'organization', org::text,
                            jsonb_build_object('bio', 'before'), null);
  -- Asserted as "at least the two just made" rather than an exact number:
  -- the count also includes anything else this test left revertible, and a
  -- check that breaks when a case is added above it is a check nobody trusts.
  perform pg_temp.want('bulk undo put back at least the two edits',
    (public.revert_org_activity_bulk(org, admin_u, now() - interval '1 hour', now()) >= 2)::text,
    'true');
  perform pg_temp.want('the event went back',
    (select title from public.events where id = ev), 'Original');
  perform pg_temp.want('and so did the bio',
    (select bio from public.organizations where id = org), 'before');

  perform pg_temp.be(third_u);
  perform pg_temp.want('a non-owner cannot bulk-undo',
    pg_temp.refused(format(
      'select public.revert_org_activity_bulk(%L, %L, null, null)', org, admin_u)), 'refused');
end $$;

select case when got is not distinct from want then 'ok  ' else 'FAIL' end as r,
       label, got, want
  from t_out order by n;

rollback;
