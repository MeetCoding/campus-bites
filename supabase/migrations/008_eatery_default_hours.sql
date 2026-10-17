-- 008_eatery_default_hours: outlets without published hours default to 10:00–22:00 (owner
-- decision, 17 Oct 2026; admins/vendors adjust later). Canteens keep the PRD Day/Night defaults.
create or replace function public.outlets_default_shift()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type <> 'mess' then
    insert into public.outlet_shifts (outlet_id, opens_at, closes_at)
    values (new.id,
            case new.type when 'day_canteen' then time '10:30'
                          when 'night_canteen' then time '22:30'
                          else time '10:00' end,
            case new.type when 'day_canteen' then time '22:30'
                          when 'night_canteen' then time '10:30'
                          else time '22:00' end)
    on conflict (outlet_id) do nothing;
  end if;
  return new;
end;
$$;

insert into public.outlet_shifts (outlet_id, opens_at, closes_at)
select o.id, time '10:00', time '22:00'
from public.outlets o
where o.type = 'eatery'
on conflict (outlet_id) do nothing;
