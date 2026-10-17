-- 005_canteens: Hostel Canteens & Campus Eateries (TASKS M4) — shift timings + live open status,
-- vendor open/closed toggle, custom menus, institute fixed-rate cards, food search, Realtime.
-- See ARCHITECTURE.md §3 (boundary), §4 (data model), §5.7 (live status).

-- Who may run a canteen/eatery day to day: app.can_manage_outlet() minus messes (a mess is
-- run through the Mess Hub tools, never a vendor menu).
create function app.can_run_outlet(p_outlet uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app.can_manage_outlet(p_outlet)
     and exists (select 1 from public.outlets o where o.id = p_outlet and o.type <> 'mess')
$$;
revoke execute on function app.can_run_outlet(uuid) from public, anon;
grant execute on function app.can_run_outlet(uuid) to authenticated, service_role;

-- ─── M4.1 outlets: open/closed toggle ────────────────────────────────────────
-- is_open is a manual toggle that wins only until the next scheduled shift boundary
-- (see outlet_status_at), so a forgotten toggle never sticks for days.
grant update (is_open, location_tag) on public.outlets to authenticated;
create policy "outlet managers update their outlet" on public.outlets
  for update to authenticated
  using (app.can_run_outlet(id))
  with check (app.can_run_outlet(id));

create function public.outlets_stamp_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_open is distinct from old.is_open then
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function public.outlets_stamp_status() from public, anon, authenticated;
create trigger stamp_status before update on public.outlets
  for each row execute function public.outlets_stamp_status();

-- ─── M4.1 outlet_shifts ──────────────────────────────────────────────────────
create table public.outlet_shifts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null unique references public.outlets (id) on delete cascade,
  opens_at time not null,
  closes_at time not null, -- closes_at <= opens_at means the shift runs past midnight
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outlet_shifts_window check (opens_at <> closes_at)
);
create index outlet_shifts_updated_by_idx on public.outlet_shifts (updated_by);
create trigger set_updated_at before update on public.outlet_shifts
  for each row execute function extensions.moddatetime (updated_at);
create trigger stamp_updated_by before insert or update on public.outlet_shifts
  for each row execute function public.stamp_updated_by();

alter table public.outlet_shifts enable row level security;
revoke all on public.outlet_shifts from anon, authenticated;
grant select, insert, update on public.outlet_shifts to authenticated;
create policy "authenticated read outlet shifts" on public.outlet_shifts
  for select to authenticated using (true);
create policy "outlet managers set shift" on public.outlet_shifts
  for insert to authenticated with check (app.can_run_outlet(outlet_id));
create policy "outlet managers change shift" on public.outlet_shifts
  for update to authenticated
  using (app.can_run_outlet(outlet_id))
  with check (app.can_run_outlet(outlet_id));
-- Temporary changes (with an optional push) go through the timing-override API instead.

-- PRD §3B.1 defaults: Day 10:30–22:30, Night 22:30–10:30. New canteens get them automatically.
create function public.outlets_default_shift()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type in ('day_canteen', 'night_canteen') then
    insert into public.outlet_shifts (outlet_id, opens_at, closes_at)
    values (new.id,
            case when new.type = 'day_canteen' then time '10:30' else time '22:30' end,
            case when new.type = 'day_canteen' then time '22:30' else time '10:30' end)
    on conflict (outlet_id) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.outlets_default_shift() from public, anon, authenticated;
create trigger default_shift after insert on public.outlets
  for each row execute function public.outlets_default_shift();

insert into public.outlet_shifts (outlet_id, opens_at, closes_at)
select o.id,
       case when o.type = 'day_canteen' then time '10:30' else time '22:30' end,
       case when o.type = 'day_canteen' then time '22:30' else time '10:30' end
from public.outlets o
where o.type in ('day_canteen', 'night_canteen')
on conflict (outlet_id) do nothing;

-- ─── M4.1 live status (IST) ──────────────────────────────────────────────────
-- One shift occurrence per service date: the newest active slot-less override for that date beats
-- the default shift. An occurrence starting on date D ends on D+1 when it crosses midnight.
create function public.outlet_shift_occurrences(p_outlet uuid, p_from date, p_to date)
returns table (
  service_date date,
  is_closed boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  override_id uuid,
  override_reason text
)
language sql
stable
set search_path = ''
as $$
  select d.day,
         eff.is_closed,
         case when not eff.is_closed then (d.day + eff.opens_at) at time zone 'Asia/Kolkata' end,
         case when not eff.is_closed then
           (d.day + eff.closes_at
              + case when eff.closes_at <= eff.opens_at then interval '1 day' else interval '0 days' end)
             at time zone 'Asia/Kolkata'
         end,
         eff.override_id,
         eff.override_reason
  from (select gs::date as day
        from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') gs) d
  cross join lateral (
    select coalesce(ov.is_closed, false) as is_closed,
           coalesce(ov.opens_at, sh.opens_at) as opens_at,
           coalesce(ov.closes_at, sh.closes_at) as closes_at,
           ov.id as override_id,
           ov.reason as override_reason
    from (select 1) as one
    left join public.outlet_shifts sh on sh.outlet_id = p_outlet
    left join lateral (
      select o.id, o.is_closed, o.opens_at, o.closes_at, o.reason
      from public.timing_overrides o
      where o.outlet_id = p_outlet and o.slot is null and o.revoked_at is null
        and d.day between o.starts_on and o.ends_on
      order by o.created_at desc
      limit 1
    ) ov on true
  ) eff
  where eff.is_closed or eff.opens_at is not null
  order by d.day
$$;

-- Open/closed at an instant. A manual toggle (outlets.is_open) counts only if it was made after
-- the latest scheduled boundary (a shift start or end); otherwise the schedule decides.
create function public.outlet_status_at(p_outlet uuid, p_at timestamptz)
returns table (
  is_open boolean,
  source text,                -- 'schedule' | 'manual' | 'none' (no hours published, no toggle)
  closes_at timestamptz,      -- when open: end of the current shift (null if opened outside it)
  next_opens_at timestamptz,  -- when closed: start of the next shift (within a week)
  shift_starts_at timestamptz, -- current shift, else the next one
  shift_ends_at timestamptz,
  status_updated_at timestamptz
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today date := (p_at at time zone 'Asia/Kolkata')::date;
  v_toggle boolean;
  v_toggled_at timestamptz;
  v_has_shift boolean;
  v_cur_start timestamptz;
  v_cur_end timestamptz;
  v_next_start timestamptz;
  v_next_end timestamptz;
  v_boundary timestamptz;
  v_fresh boolean;
begin
  select o.is_open, o.status_updated_at into v_toggle, v_toggled_at
  from public.outlets o where o.id = p_outlet;
  if not found then
    return;
  end if;
  v_has_shift := exists (select 1 from public.outlet_shifts s where s.outlet_id = p_outlet);

  select oc.starts_at, oc.ends_at into v_cur_start, v_cur_end
  from public.outlet_shift_occurrences(p_outlet, v_today - 1, v_today + 7) oc
  where not oc.is_closed and oc.starts_at <= p_at and p_at < oc.ends_at
  order by oc.starts_at desc
  limit 1;

  select oc.starts_at, oc.ends_at into v_next_start, v_next_end
  from public.outlet_shift_occurrences(p_outlet, v_today - 1, v_today + 7) oc
  where not oc.is_closed and oc.starts_at > p_at
  order by oc.starts_at
  limit 1;

  select max(b.at) into v_boundary
  from public.outlet_shift_occurrences(p_outlet, v_today - 1, v_today + 7) oc
  cross join lateral (values (oc.starts_at), (oc.ends_at)) as b(at)
  where b.at <= p_at;

  v_fresh := v_toggled_at is not null and v_toggled_at <= p_at
             and (v_boundary is null or v_toggled_at > v_boundary);

  is_open := case when v_fresh then v_toggle else v_cur_start is not null end;
  source := case when v_fresh then 'manual' when v_has_shift then 'schedule' else 'none' end;
  closes_at := case when is_open then v_cur_end end;
  next_opens_at := case when not is_open then v_next_start end;
  shift_starts_at := coalesce(v_cur_start, v_next_start);
  shift_ends_at := case when v_cur_start is not null then v_cur_end else v_next_end end;
  status_updated_at := v_toggled_at;
  return next;
end;
$$;

create view public.outlet_live_status with (security_invoker = true) as
  select o.id as outlet_id, o.type, o.bhawan_id, o.name, o.location_tag, s.*
  from public.outlets o
  cross join lateral public.outlet_status_at(o.id, now()) s
  where o.type <> 'mess';

revoke execute on function public.outlet_shift_occurrences(uuid, date, date),
  public.outlet_status_at(uuid, timestamptz) from public, anon;
grant execute on function public.outlet_shift_occurrences(uuid, date, date),
  public.outlet_status_at(uuid, timestamptz) to authenticated, service_role;
revoke all on public.outlet_live_status from anon, authenticated;
grant select on public.outlet_live_status to authenticated;

-- ─── M4.2 menu_items (custom vendor menu) ────────────────────────────────────
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 200),
  category text check (category is null or char_length(btrim(category)) between 1 and 40),
  price_paise integer not null check (price_paise between 0 and 500000),
  in_stock boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_items_outlet_name_key unique (outlet_id, name)
);
create index menu_items_updated_by_idx on public.menu_items (updated_by);
create index menu_items_name_trgm_idx on public.menu_items using gin (name extensions.gin_trgm_ops);
create index outlets_name_trgm_idx on public.outlets using gin (name extensions.gin_trgm_ops);
create trigger set_updated_at before update on public.menu_items
  for each row execute function extensions.moddatetime (updated_at);
create trigger stamp_updated_by before insert or update on public.menu_items
  for each row execute function public.stamp_updated_by();

alter table public.menu_items enable row level security;
revoke all on public.menu_items from anon, authenticated;
grant select, insert, update, delete on public.menu_items to authenticated;
create policy "authenticated read menu items" on public.menu_items
  for select to authenticated using (true);
create policy "outlet managers add menu items" on public.menu_items
  for insert to authenticated with check (app.can_run_outlet(outlet_id));
create policy "outlet managers update menu items" on public.menu_items
  for update to authenticated
  using (app.can_run_outlet(outlet_id))
  with check (app.can_run_outlet(outlet_id));
create policy "outlet managers delete menu items" on public.menu_items
  for delete to authenticated using (app.can_run_outlet(outlet_id));

-- ─── M4.3 fixed_rate_items (Institute Fixed-Rate Card, per Bhawan) ───────────
-- Applies to both canteens of the Bhawan. Vendors get no write policy: tamper-proof.
create table public.fixed_rate_items (
  id uuid primary key default gen_random_uuid(),
  bhawan_id uuid not null references public.bhawans (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 120),
  ceiling_price_paise integer not null check (ceiling_price_paise between 0 and 500000),
  circular_ref text check (circular_ref is null or char_length(circular_ref) <= 80),
  effective_from date not null default current_date,
  sort_order integer not null default 0,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixed_rate_items_bhawan_name_key unique (bhawan_id, name)
);
create index fixed_rate_items_updated_by_idx on public.fixed_rate_items (updated_by);
create trigger set_updated_at before update on public.fixed_rate_items
  for each row execute function extensions.moddatetime (updated_at);
create trigger stamp_updated_by before insert or update on public.fixed_rate_items
  for each row execute function public.stamp_updated_by();

alter table public.fixed_rate_items enable row level security;
revoke all on public.fixed_rate_items from anon, authenticated;
grant select, insert, update, delete on public.fixed_rate_items to authenticated;
create policy "authenticated read fixed rates" on public.fixed_rate_items
  for select to authenticated using (true);
create policy "bhawan secretary adds fixed rates" on public.fixed_rate_items
  for insert to authenticated with check (app.has_bhawan_role('bhawan_secretary', bhawan_id));
create policy "bhawan secretary updates fixed rates" on public.fixed_rate_items
  for update to authenticated
  using (app.has_bhawan_role('bhawan_secretary', bhawan_id))
  with check (app.has_bhawan_role('bhawan_secretary', bhawan_id));
create policy "bhawan secretary deletes fixed rates" on public.fixed_rate_items
  for delete to authenticated using (app.has_bhawan_role('bhawan_secretary', bhawan_id));

-- ─── M4.9 search across outlets and menu items (pg_trgm) ─────────────────────
-- Substring match (trigram-indexed ILIKE) ranks first; fuzzy word similarity catches typos
-- ("magi" → "Maggi"). Messes are excluded: their menus live in weekly_menus.
create function public.search_food(p_query text)
returns table (
  outlet_id uuid,
  outlet_name text,
  outlet_type public.outlet_type,
  bhawan_id uuid,
  item_id uuid,
  item_name text,
  price_paise integer,
  in_stock boolean,
  score real
)
language sql
stable
set search_path = ''
as $$
  with q as (
    select btrim(p_query) as term,
           '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
             as pattern
  ),
  hits as (
    select o.id as outlet_id, o.name as outlet_name, o.type as outlet_type, o.bhawan_id,
           null::uuid as item_id, null::text as item_name, null::integer as price_paise,
           null::boolean as in_stock,
           case when o.name ilike q.pattern then 1 else extensions.word_similarity(q.term, o.name) end
             as score
    from q, public.outlets o
    where o.type <> 'mess'
      and (o.name ilike q.pattern or extensions.word_similarity(q.term, o.name) >= 0.45)
    union all
    select o.id, o.name, o.type, o.bhawan_id, mi.id, mi.name, mi.price_paise, mi.in_stock,
           case when mi.name ilike q.pattern then 1 else extensions.word_similarity(q.term, mi.name) end
    from q
    join public.menu_items mi
      on mi.name ilike q.pattern or extensions.word_similarity(q.term, mi.name) >= 0.45
    join public.outlets o on o.id = mi.outlet_id
  )
  select h.*
  from hits h, q
  where char_length(q.term) >= 2
  order by h.score desc, h.item_id is not null, h.in_stock desc nulls first, h.price_paise, h.outlet_name
  limit 50
$$;
revoke execute on function public.search_food(text) from public, anon;
grant execute on function public.search_food(text) to authenticated;

-- ─── M4.6 Realtime: status toggles, shifts and menus reach other devices live ─
alter publication supabase_realtime add table public.outlets, public.outlet_shifts, public.menu_items;
