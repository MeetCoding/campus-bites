-- 006_outlet_toggle: the open/closed toggle must count even when it re-asserts the stored value
-- (e.g. tapping "Closed" while is_open is already false from yesterday, but the schedule says
-- open). Clients may touch status_updated_at; the trigger pins it to now() so it can't be
-- backdated or post-dated.

grant update (status_updated_at) on public.outlets to authenticated;

create or replace function public.outlets_stamp_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_open is distinct from old.is_open
     or (new.status_updated_at is distinct from old.status_updated_at
         and current_user = 'authenticated') then
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;
