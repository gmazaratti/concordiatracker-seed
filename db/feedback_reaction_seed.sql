-- ── Admin reaction seeding (make the board feel lively) ──────────────────────
-- Reactions FK to real auth.users, so we can't fabricate rows. Instead each
-- request carries a `seed_reactions` map ({emoji: count}) the admin dials up/down;
-- the client ADDS these to the real reaction counts for display. Display-only
-- social proof — no fake accounts, and real reactions are untouched.
--
-- RUN AFTER the matching app deploy. Safe to re-run.

alter table public.feature_requests
  add column if not exists seed_reactions jsonb not null default '{}'::jsonb;

-- Admin: nudge an emoji's seed count by ±delta (clamped at 0 → key removed).
create or replace function public.admin_bump_reaction(p_id uuid, p_emoji text, p_delta int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare seeds jsonb; cur int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select seed_reactions into seeds from public.feature_requests where id = p_id for update;
  seeds := coalesce(seeds, '{}'::jsonb);
  cur := coalesce((seeds ->> p_emoji)::int, 0) + p_delta;
  if cur <= 0 then
    seeds := seeds - p_emoji;
  else
    seeds := jsonb_set(seeds, array[p_emoji], to_jsonb(cur));
  end if;
  update public.feature_requests set seed_reactions = seeds where id = p_id;
  return seeds;
end $$;
grant execute on function public.admin_bump_reaction(uuid, text, int) to authenticated;
