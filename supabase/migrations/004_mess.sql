-- 004_mess: Mess Hub (TASKS M3) — push tokens, meal timings + overrides, IST schedule,
-- weekly menus, noticeboard photos (+ storage bucket), photo reports, extra items.
-- See ARCHITECTURE.md §3 (boundary), §4 (data model), §5.5–5.6 (flows).

-- ─── Shared helpers (private schema) ─────────────────────────────────────────
create function app.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

-- Live DB check (not the JWT) so a removed secretary loses write access immediately.
-- Invoker rights: callers can read their own role_assignments rows via RLS.
create function app.has_bhawan_role(p_role public.app_role, p_bhawan uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.role_assignments ra
    where ra.user_id = (select auth.uid()) and ra.role = p_role and ra.bhawan_id = p_bhawan
  )
$$;

-- Who may publish menus/photos for an outlet: the Bhawan's Mess Secretary (mess), the Bhawan
-- Secretary (hostel canteens) or a whitelisted vendor (canteens + eateries). Security definer
-- because the whitelist is not readable by clients.
create function app.can_manage_outlet(p_outlet uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.outlets o
    where o.id = p_outlet
      and (
        (o.type = 'mess' and exists (
          select 1 from public.role_assignments ra
          where ra.user_id = auth.uid() and ra.role = 'mess_secretary' and ra.bhawan_id = o.bhawan_id))
        or (o.type in ('day_canteen', 'night_canteen') and exists (
          select 1 from public.role_assignments ra
          where ra.user_id = auth.uid() and ra.role = 'bhawan_secretary' and ra.bhawan_id = o.bhawan_id))
        or (o.type <> 'mess' and exists (
          select 1 from public.whitelisted_vendors wv
          join public.profiles p on p.phone = wv.phone_e164
          where p.id = auth.uid() and wv.outlet_id = o.id and wv.active))
      )
  )
$$;

revoke execute on function app.try_uuid(text), app.has_bhawan_role(public.app_role, uuid),
  app.can_manage_outlet(uuid) from public, anon;
grant execute on function app.try_uuid(text), app.has_bhawan_role(public.app_role, uuid),
  app.can_manage_outlet(uuid) to authenticated, service_role;

-- ─── M3.1 push_tokens ────────────────────────────────────────────────────────
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_token text not null unique check (expo_token ~ '^Expo(nent)?PushToken\[.+\]$'),
  platform text not null check (platform in ('ios', 'android', 'web')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;
grant select, delete on public.push_tokens to authenticated;

create policy "users read own push tokens" on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users delete own push tokens" on public.push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

-- A device token belongs to whoever signed in on that device last, so registration must be
-- able to move a token between users — hence security definer (scoped to auth.uid()).
create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to register for notifications' using errcode = '42501';
  end if;
  insert into public.push_tokens (user_id, expo_token, platform, last_seen_at)
  values (auth.uid(), p_token, p_platform, now())
  on conflict (expo_token) do update
    set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
end;
$$;
revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ─── M3.4 meal_timings + timing_overrides ────────────────────────────────────
create table public.meal_timings (
  id uuid primary key default gen_random_uuid(),
  bhawan_id uuid references public.bhawans (id) on delete cascade, -- null = institute default
  slot public.meal_slot not null,
  day_type public.day_type not null,
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_timings_window check (closes_at > opens_at), -- meals never cross midnight
  constraint meal_timings_unique unique nulls not distinct (bhawan_id, slot, day_type)
);
create trigger set_updated_at before update on public.meal_timings
  for each row execute function extensions.moddatetime (updated_at);

-- PRD §3A.1 institute defaults
insert into public.meal_timings (bhawan_id, slot, day_type, opens_at, closes_at) values
  (null, 'breakfast', 'weekday',         '07:30', '09:30'),
  (null, 'breakfast', 'weekend_holiday', '08:00', '10:00'),
  (null, 'lunch',     'weekday',         '12:30', '14:30'),
  (null, 'lunch',     'weekend_holiday', '12:30', '14:30'),
  (null, 'dinner',    'weekday',         '19:30', '21:30'),
  (null, 'dinner',    'weekend_holiday', '19:30', '21:30');

create table public.timing_overrides (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets (id) on delete cascade,
  slot public.meal_slot, -- mess overrides target a meal; canteen shift overrides leave it null
  starts_on date not null,
  ends_on date not null,
  is_closed boolean not null default false,
  opens_at time,
  closes_at time,
  reason text not null check (char_length(btrim(reason)) between 3 and 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint timing_overrides_dates check (ends_on >= starts_on and ends_on - starts_on <= 120),
  constraint timing_overrides_times check (
    (is_closed and opens_at is null and closes_at is null)
    or (not is_closed and opens_at is not null and closes_at is not null and opens_at <> closes_at)
  )
);
create index timing_overrides_outlet_active_idx on public.timing_overrides (outlet_id, ends_on)
  where revoked_at is null;
create index timing_overrides_created_by_idx on public.timing_overrides (created_by);

alter table public.meal_timings enable row level security;
alter table public.timing_overrides enable row level security;
revoke all on public.meal_timings, public.timing_overrides from anon, authenticated;
grant select on public.meal_timings, public.timing_overrides to authenticated;
create policy "authenticated read meal timings" on public.meal_timings
  for select to authenticated using (true);
create policy "authenticated read timing overrides" on public.timing_overrides
  for select to authenticated using (true);
-- Writes: FastAPI only (validation + push broadcast), ARCHITECTURE.md §3.2.

-- ─── M3.5 effective schedule in IST ──────────────────────────────────────────
-- Effective meal windows for one Bhawan on one date: Bhawan-specific timing beats the
-- institute default; the newest active override for a slot beats both.
create function public.mess_day_schedule(p_bhawan uuid, p_day date)
returns table (
  slot public.meal_slot,
  opens_at time,
  closes_at time,
  is_closed boolean,
  override_id uuid,
  override_reason text
)
language sql
stable
set search_path = ''
as $$
  with base as (
    select distinct on (mt.slot) mt.slot, mt.opens_at, mt.closes_at
    from public.meal_timings mt
    where (mt.bhawan_id = p_bhawan or mt.bhawan_id is null)
      and mt.day_type = case when extract(isodow from p_day) in (6, 7)
                             then 'weekend_holiday'::public.day_type
                             else 'weekday'::public.day_type end
    order by mt.slot, mt.bhawan_id nulls last
  ),
  overrides as (
    select distinct on (o.slot) o.slot, o.is_closed, o.opens_at, o.closes_at, o.id, o.reason
    from public.timing_overrides o
    join public.outlets mess on mess.id = o.outlet_id and mess.type = 'mess' and mess.bhawan_id = p_bhawan
    where o.revoked_at is null and o.slot is not null and p_day between o.starts_on and o.ends_on
    order by o.slot, o.created_at desc
  )
  select b.slot,
         coalesce(ov.opens_at, b.opens_at),
         coalesce(ov.closes_at, b.closes_at),
         coalesce(ov.is_closed, false),
         ov.id,
         ov.reason
  from base b
  left join overrides ov on ov.slot = b.slot
  order by b.slot
$$;

-- Same, with a per-slot status at an instant. Taking the instant as a parameter keeps it testable.
create function public.mess_schedule_at(p_bhawan uuid, p_at timestamptz)
returns table (
  bhawan_id uuid,
  service_date date,
  slot public.meal_slot,
  opens_at time,
  closes_at time,
  is_closed boolean,
  override_reason text,
  status text -- 'upcoming' | 'serving' | 'done' | 'closed'
)
language sql
stable
set search_path = ''
as $$
  with ist as (select (p_at at time zone 'Asia/Kolkata') as ts)
  select p_bhawan,
         ist.ts::date,
         d.slot,
         d.opens_at,
         d.closes_at,
         d.is_closed,
         d.override_reason,
         case
           when d.is_closed then 'closed'
           when ist.ts::time < d.opens_at then 'upcoming'
           when ist.ts::time < d.closes_at then 'serving'
           else 'done'
         end
  from ist, public.mess_day_schedule(p_bhawan, ist.ts::date) d
$$;

create view public.mess_schedule_today with (security_invoker = true) as
  select s.*
  from public.bhawans b
  cross join lateral public.mess_schedule_at(b.id, now()) s;

revoke execute on function public.mess_day_schedule(uuid, date), public.mess_schedule_at(uuid, timestamptz)
  from public, anon;
grant execute on function public.mess_day_schedule(uuid, date), public.mess_schedule_at(uuid, timestamptz)
  to authenticated, service_role;
revoke all on public.mess_schedule_today from anon, authenticated;
grant select on public.mess_schedule_today to authenticated;

-- ─── M3.8 weekly_menus ───────────────────────────────────────────────────────
-- items: {"mon": {"breakfast": ["Poha", "Tea"], "lunch": [...], "dinner": [...]}, "tue": {...}}
create function app.is_valid_weekly_menu(items jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(items) = 'object'
     and not exists (
       select 1
       from jsonb_each(items) as day(key, value)
       where day.key not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
          or jsonb_typeof(day.value) <> 'object'
          or exists (
            select 1
            from jsonb_each(day.value) as meal(key, value)
            where meal.key not in ('breakfast', 'lunch', 'dinner')
               or jsonb_typeof(meal.value) <> 'array'
               or jsonb_array_length(meal.value) > 20
               or exists (
                 select 1 from jsonb_array_elements(meal.value) as dish(value)
                 where jsonb_typeof(dish.value) <> 'string'
                    or char_length(dish.value #>> '{}') not between 1 and 80
               )
          )
     )
$$;
grant execute on function app.is_valid_weekly_menu(jsonb) to authenticated, service_role;

create table public.weekly_menus (
  id uuid primary key default gen_random_uuid(),
  bhawan_id uuid not null references public.bhawans (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  items jsonb not null default '{}' check (app.is_valid_weekly_menu(items)),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_menus_bhawan_week_key unique (bhawan_id, week_start)
);
create index weekly_menus_updated_by_idx on public.weekly_menus (updated_by);
create trigger set_updated_at before update on public.weekly_menus
  for each row execute function extensions.moddatetime (updated_at);

-- ─── M3.13 extra_items ───────────────────────────────────────────────────────
create table public.extra_items (
  id uuid primary key default gen_random_uuid(),
  bhawan_id uuid not null references public.bhawans (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  unit text check (unit is null or char_length(unit) <= 30),
  price_paise integer not null check (price_paise between 0 and 100000),
  available boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extra_items_bhawan_name_key unique (bhawan_id, name)
);
create index extra_items_updated_by_idx on public.extra_items (updated_by);
create trigger set_updated_at before update on public.extra_items
  for each row execute function extensions.moddatetime (updated_at);

-- Stamp the editor on secretary-managed rows.
create function public.stamp_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
revoke execute on function public.stamp_updated_by() from public, anon, authenticated;
create trigger stamp_updated_by before insert or update on public.weekly_menus
  for each row execute function public.stamp_updated_by();
create trigger stamp_updated_by before insert or update on public.extra_items
  for each row execute function public.stamp_updated_by();

alter table public.weekly_menus enable row level security;
alter table public.extra_items enable row level security;
revoke all on public.weekly_menus, public.extra_items from anon, authenticated;
grant select, insert, update, delete on public.weekly_menus, public.extra_items to authenticated;

create policy "authenticated read weekly menus" on public.weekly_menus
  for select to authenticated using (true);
create policy "mess secretary inserts weekly menu" on public.weekly_menus
  for insert to authenticated with check (app.has_bhawan_role('mess_secretary', bhawan_id));
create policy "mess secretary updates weekly menu" on public.weekly_menus
  for update to authenticated
  using (app.has_bhawan_role('mess_secretary', bhawan_id))
  with check (app.has_bhawan_role('mess_secretary', bhawan_id));
create policy "mess secretary deletes weekly menu" on public.weekly_menus
  for delete to authenticated using (app.has_bhawan_role('mess_secretary', bhawan_id));

create policy "authenticated read extra items" on public.extra_items
  for select to authenticated using (true);
create policy "mess secretary inserts extra items" on public.extra_items
  for insert to authenticated with check (app.has_bhawan_role('mess_secretary', bhawan_id));
create policy "mess secretary updates extra items" on public.extra_items
  for update to authenticated
  using (app.has_bhawan_role('mess_secretary', bhawan_id))
  with check (app.has_bhawan_role('mess_secretary', bhawan_id));
create policy "mess secretary deletes extra items" on public.extra_items
  for delete to authenticated using (app.has_bhawan_role('mess_secretary', bhawan_id));

-- ─── M3.9 menu_photos, photo_reports, storage ────────────────────────────────
create table public.menu_photos (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets (id) on delete cascade,
  week_start date check (week_start is null or extract(isodow from week_start) = 1),
  storage_path text not null unique,
  width integer check (width > 0),
  height integer check (height > 0),
  uploaded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  constraint menu_photos_path_in_outlet_folder check (storage_path like outlet_id::text || '/%')
);
create unique index menu_photos_one_current on public.menu_photos (outlet_id) where is_current;
create index menu_photos_outlet_created_idx on public.menu_photos (outlet_id, created_at desc);
create index menu_photos_uploaded_by_idx on public.menu_photos (uploaded_by);

-- New current photo retires the previous one. Definer: the uploader has no UPDATE right.
create function public.menu_photos_retire_previous()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_current then
    update public.menu_photos set is_current = false
    where outlet_id = new.outlet_id and is_current and id <> new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.menu_photos_retire_previous() from public, anon, authenticated;
create trigger retire_previous before insert on public.menu_photos
  for each row execute function public.menu_photos_retire_previous();

create table public.photo_reports (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.menu_photos (id) on delete cascade,
  reported_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  reason text not null check (reason in ('outdated', 'blurry', 'other')),
  created_at timestamptz not null default now(),
  constraint photo_reports_once_per_user unique (photo_id, reported_by)
);
create index photo_reports_reported_by_idx on public.photo_reports (reported_by);

alter table public.menu_photos enable row level security;
alter table public.photo_reports enable row level security;
revoke all on public.menu_photos, public.photo_reports from anon, authenticated;
grant select, insert on public.menu_photos, public.photo_reports to authenticated;

create policy "authenticated read menu photos" on public.menu_photos
  for select to authenticated using (true);
create policy "outlet managers add menu photos" on public.menu_photos
  for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and app.can_manage_outlet(outlet_id));

create policy "reporters and outlet managers read reports" on public.photo_reports
  for select to authenticated
  using (
    reported_by = (select auth.uid())
    or exists (select 1 from public.menu_photos mp
               where mp.id = photo_id and app.can_manage_outlet(mp.outlet_id))
  );
create policy "students report photos" on public.photo_reports
  for insert to authenticated
  with check (reported_by = (select auth.uid()) and (select app.has_role('student')));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('noticeboard-photos', 'noticeboard-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Path convention: {outlet_id}/{yyyy-mm-dd}-{uuid}.jpg. Public bucket: reads go through the CDN.
create policy "outlet managers upload noticeboard photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'noticeboard-photos'
    and app.can_manage_outlet(app.try_uuid((storage.foldername(name))[1]))
  );
