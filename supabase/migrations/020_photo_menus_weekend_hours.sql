-- Menus are photographs only, outlets get weekend hours, and nobody is forced to pick a hostel.
-- Owner decisions, 20 Oct 2026. See ARCHITECTURE.md §6.

-- ─── 1. Typed menus are gone ─────────────────────────────────────────────────
-- Canteen/eatery menu items, the mess weekly menu and mess extra ("pay-to-get") items were typed
-- in by hand; every menu is now a photo (menu_photos). Data is deleted with the tables.
drop function public.search_food(text);
drop table public.menu_items;
drop table public.weekly_menus;
drop table public.extra_items;
drop function app.is_valid_weekly_menu(jsonb);
drop function app.can_manage_mess(uuid);

-- Search finds canteens and eateries by name (substring first, then fuzzy for typos).
create function public.search_food(p_query text)
returns table (
  outlet_id uuid,
  outlet_name text,
  outlet_type public.outlet_type,
  bhawan_id uuid,
  location_tag text,
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
  )
  select o.id, o.name, o.type, o.bhawan_id, o.location_tag,
         case when o.name ilike q.pattern then 1 else extensions.word_similarity(q.term, o.name) end
  from q, public.outlets o
  where char_length(q.term) >= 2
    and o.type <> 'mess'
    and (o.name ilike q.pattern or extensions.word_similarity(q.term, o.name) >= 0.45)
  order by 6 desc, o.name
  limit 50
$$;
revoke execute on function public.search_food(text) from public, anon;
grant execute on function public.search_food(text) to authenticated;

-- ─── 2. Mess "pay-to-get" items are a second photo stack ─────────────────────
-- kind 'menu' = the menu / noticeboard (every outlet); 'extras' = a mess's pay-to-get items.
alter table public.menu_photos
  add column kind text not null default 'menu' check (kind in ('menu', 'extras'));
comment on column public.menu_photos.kind is
  'menu = menu / noticeboard photo; extras = a mess''s pay-to-get (extra items) price list.';
drop index public.menu_photos_outlet_created_idx;
create index menu_photos_outlet_kind_created_idx on public.menu_photos (outlet_id, kind, created_at desc);

-- The cap now applies per outlet and kind; extras photos only exist for messes.
create or replace function public.menu_photos_enforce_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cap integer := (select max_menu_photos from public.app_settings);
begin
  if new.kind = 'extras'
     and (select type from public.outlets where id = new.outlet_id) is distinct from 'mess' then
    raise exception 'EXTRAS_PHOTO_MESS_ONLY' using detail = 'Extra-items photos are for messes only.';
  end if;
  -- Serialise uploads per outlet so two at once can't both slip under the cap.
  perform pg_advisory_xact_lock(hashtextextended('menu_photos:' || new.outlet_id::text, 0));
  if new.is_current
     and (select count(*) from public.menu_photos
           where outlet_id = new.outlet_id and kind = new.kind and is_current) >= cap then
    raise exception 'MENU_PHOTO_LIMIT'
      using detail = format('At most %s photos here. Delete an old one first.', cap);
  end if;
  return new;
end;
$$;

-- ─── 3. Weekend hours ────────────────────────────────────────────────────────
-- Optional Saturday/Sunday hours (IST). A shift belongs to the day it starts on, so a Friday
-- night shift uses weekday hours and a Sunday night one weekend hours. Overrides still win.
alter table public.outlet_shifts
  add column weekend_opens_at time,
  add column weekend_closes_at time,
  add constraint outlet_shifts_weekend_pair
    check ((weekend_opens_at is null) = (weekend_closes_at is null)),
  add constraint outlet_shifts_weekend_window
    check (weekend_opens_at is null or weekend_opens_at <> weekend_closes_at);
comment on column public.outlet_shifts.weekend_opens_at is
  'Saturday/Sunday opening time; null = same hours as weekdays.';

create or replace function public.outlet_shift_occurrences(p_outlet uuid, p_from date, p_to date)
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
           coalesce(ov.opens_at, case when wk.weekend then sh.weekend_opens_at end, sh.opens_at) as opens_at,
           coalesce(ov.closes_at, case when wk.weekend then sh.weekend_closes_at end, sh.closes_at) as closes_at,
           ov.id as override_id,
           ov.reason as override_reason
    from (select extract(isodow from d.day) in (6, 7) as weekend) as wk
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

-- ─── 4. "No hostel" (staff, faculty, day scholars) ───────────────────────────
-- Onboarding ends when a Bhawan is chosen (profiles_guard_bhawan stamps onboarded_at) or when the
-- user says they don't live in one (sets onboarded_at only). They can still pick a Bhawan later:
-- the guard only blocks changing a Bhawan that is already set.
grant update (onboarded_at) on public.profiles to authenticated;

-- JWT gains `onboarded` so the app's onboarding gate works without a Bhawan.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user_id uuid := (event ->> 'user_id')::uuid;
  v_claims jsonb := event -> 'claims';
  v_email text := nullif(v_claims ->> 'email', '');
  v_phone text := nullif(v_claims ->> 'phone', '');
  v_roles text[] := '{}';
  v_assigned text[];
  v_scope uuid[];
  v_outlets uuid[] := '{}';
  v_home uuid;
  v_onboarded boolean;
  v_app_role text;
begin
  select p.bhawan_id, p.onboarded_at is not null into v_home, v_onboarded
    from public.profiles p where p.id = v_user_id;

  select coalesce(array_agg(distinct ra.role::text), '{}'),
         coalesce(array_agg(distinct ra.bhawan_id) filter (where ra.bhawan_id is not null), '{}')
    into v_assigned, v_scope
    from public.role_assignments ra
   where ra.user_id = v_user_id;

  -- IITR email users are students unless they are institute officials.
  if v_email is not null and not (v_assigned && array['mess_authority', 'adosw']) then
    v_roles := array['student'];
  end if;
  v_roles := v_roles || v_assigned;

  if v_phone is not null then
    select coalesce(array_agg(wv.outlet_id), '{}') into v_outlets
      from public.whitelisted_vendors wv
     where wv.phone_e164 = '+' || ltrim(v_phone, '+') and wv.active;
    if cardinality(v_outlets) > 0 then
      v_roles := v_roles || array['vendor'];
    end if;
  end if;

  select r.role into v_app_role
    from unnest(array['admin', 'adosw', 'mess_authority', 'mess_secretary', 'bhawan_secretary',
                      'vendor', 'student']) with ordinality as r(role, priority)
   where r.role = any(v_roles)
   order by r.priority
   limit 1;

  v_claims := v_claims || jsonb_build_object(
    'app_role', v_app_role,
    'roles', to_jsonb(v_roles),
    'bhawan_id', v_home,
    'onboarded', coalesce(v_onboarded, false),
    'scope_bhawan_ids', to_jsonb(v_scope),
    'outlet_ids', to_jsonb(v_outlets)
  );
  return jsonb_build_object('claims', v_claims);
end;
$$;
