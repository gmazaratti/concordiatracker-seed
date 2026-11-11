-- "Excused, no grade" (2026-11-10): a skipped midterm whose weight moves to the
-- final, or anything exempted. The status is free text already; this adds the
-- one fact it needs, which assessment takes over the weight. Same owner only:
-- a reference into somebody else's assessments is refused.
alter table public.assignments add column if not exists weight_to uuid
  references public.assignments(id) on delete set null;

create or replace function public.ct_weight_to_guard()
returns trigger language plpgsql as $$
begin
  if new.weight_to is not null then
    if new.weight_to = new.id then raise exception 'An assessment cannot take its own weight.'; end if;
    if not exists (select 1 from public.assignments a where a.id = new.weight_to and a.user_id = new.user_id) then
      raise exception 'That assessment is not yours.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists assignments_weight_to_guard on public.assignments;
create trigger assignments_weight_to_guard before insert or update of weight_to on public.assignments
  for each row execute function public.ct_weight_to_guard();
