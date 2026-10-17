-- Canteens & eateries regression test (TASKS M4.1–M4.3, M4.9).
-- Runs inside a transaction that is rolled back. Success ends with "ALL CANTEEN TESTS PASSED".

begin;

-- ─── Fixtures (as postgres) ──────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@ece.iitr.ac.in', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bhawansecy@cse.iitr.ac.in', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '{}', now(), now());
-- c003 is the V1 vendor (whitelisted for every canteen and eatery)
update public.profiles set phone = '+919510709195' where id = '00000000-0000-0000-0000-00000000c003';

insert into public.role_assignments (user_id, role, bhawan_id)
select '00000000-0000-0000-0000-00000000c002'::uuid, 'bhawan_secretary'::public.app_role, id
from public.bhawans where slug = 'rajendra';

-- ─── Shift + live status logic (M4.1) ────────────────────────────────────────
do $$
declare
  day_c uuid := (select id from public.outlets where slug = 'rajendra-day-canteen');
  night_c uuid := (select id from public.outlets where slug = 'rajendra-night-canteen');
  amul uuid := (select id from public.outlets where slug = 'amul');
  r record;
begin
  assert (select count(*) from public.outlet_shifts) = 26, 'every canteen and eatery has a default shift';
  assert (select opens_at from public.outlet_shifts where outlet_id = amul) = '10:00', 'eateries default to 10:00–22:00 (008)';

  -- 2026-10-19 (Mon) 02:00 IST = 2026-10-18 20:30 UTC: night shift that began Sunday 22:30 is running
  select * into r from public.outlet_status_at(night_c, '2026-10-18 20:30:00+00');
  assert r.is_open and r.source = 'schedule', 'night canteen open at 02:00 IST';
  assert r.closes_at = '2026-10-19 10:30:00+05:30', 'closes 10:30 next morning';
  assert r.shift_starts_at = '2026-10-18 22:30:00+05:30', 'shift began the previous evening';

  select * into r from public.outlet_status_at(day_c, '2026-10-18 20:30:00+00');
  assert not r.is_open and r.next_opens_at = '2026-10-19 10:30:00+05:30', 'day canteen opens at 10:30';

  -- 22:30 boundary: day closes (end-exclusive), night opens
  assert not (select is_open from public.outlet_status_at(day_c, '2026-10-19 22:30:00+05:30')), 'day closed at 22:30';
  assert (select is_open from public.outlet_status_at(night_c, '2026-10-19 22:30:00+05:30')), 'night open at 22:30';
  assert (select is_open from public.outlet_status_at(day_c, '2026-10-19 22:29:00+05:30')), 'day open at 22:29';

  -- Shift override crossing midnight differently: 02:00–14:00 on the 21st
  insert into public.timing_overrides (outlet_id, starts_on, ends_on, opens_at, closes_at, reason)
  values (night_c, '2026-10-21', '2026-10-21', '02:00', '14:00', 'Exam shift');
  select * into r from public.outlet_status_at(night_c, '2026-10-21 13:00:00+05:30');
  assert r.is_open and r.closes_at = '2026-10-21 14:00:00+05:30', 'override shift open at 13:00';
  -- the Tuesday 22:30 default shift still ends 10:30 Wednesday
  assert (select is_open from public.outlet_status_at(night_c, '2026-10-21 01:00:00+05:30')), 'previous default shift runs until 10:30';

  -- Closed override, then the next opening is the following day
  insert into public.timing_overrides (outlet_id, starts_on, ends_on, is_closed, reason)
  values (day_c, '2026-10-20', '2026-10-20', true, 'Diwali');
  select * into r from public.outlet_status_at(day_c, '2026-10-20 12:00:00+05:30');
  assert not r.is_open and r.next_opens_at = '2026-10-21 10:30:00+05:30', 'closed day; reopens next day';

  -- Manual toggle wins until the next boundary, then the schedule takes over again
  update public.outlets set is_open = false where id = day_c;
  update public.outlets set status_updated_at = '2026-10-19 12:00:00+05:30' where id = day_c;
  select * into r from public.outlet_status_at(day_c, '2026-10-19 13:00:00+05:30');
  assert not r.is_open and r.source = 'manual', 'vendor closed early';
  assert r.next_opens_at = '2026-10-21 10:30:00+05:30', 'next opening skips the closed Diwali day';
  assert (select is_open from public.outlet_status_at(day_c, '2026-10-19 11:00:00+05:30')), 'open before the toggle';
  select * into r from public.outlet_status_at(day_c, '2026-10-21 11:00:00+05:30');
  assert r.is_open and r.source = 'schedule', 'toggle expired at the next boundary';

  update public.outlets set is_open = true where id = night_c;
  update public.outlets set status_updated_at = '2026-10-19 21:00:00+05:30' where id = night_c;
  select * into r from public.outlet_status_at(night_c, '2026-10-19 21:30:00+05:30');
  assert r.is_open and r.source = 'manual' and r.closes_at is null, 'opened early, outside the shift';
  assert (select source from public.outlet_status_at(night_c, '2026-10-19 23:00:00+05:30')) = 'schedule', 'shift start takes over';

  -- Outlet without published hours: the toggle alone decides
  delete from public.outlet_shifts where outlet_id = amul;
  assert (select source from public.outlet_status_at(amul, now())) = 'none', 'no hours, no toggle';
  update public.outlets set is_open = true where id = amul;
  select * into r from public.outlet_status_at(amul, now());
  assert r.is_open and r.source = 'manual', 'eatery toggled open';

  -- New canteens get the default shift
  insert into public.bhawans (name, slug, sort_order) values ('Test Bhawan', 'test-bhawan', 99);
  insert into public.outlets (type, bhawan_id, name, slug)
  select 'night_canteen', id, 'Test Night Canteen', 'test-night-canteen' from public.bhawans where slug = 'test-bhawan';
  assert (select opens_at from public.outlet_shifts s join public.outlets o on o.id = s.outlet_id
          where o.slug = 'test-night-canteen') = '22:30', 'default shift for a new canteen';
  insert into public.outlets (type, bhawan_id, name, slug) values ('eatery', null, 'Test Eatery', 'test-eatery');
  assert (select closes_at from public.outlet_shifts s join public.outlets o on o.id = s.outlet_id
          where o.slug = 'test-eatery') = '22:00', 'new eateries default to 10:00–22:00';
end $$;

-- ─── RLS as the V1 vendor (M4.2, M4.3) ───────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000c003', 'role', 'authenticated',
  'roles', json_build_array('vendor'))::text, true);

do $$
declare
  rajendra uuid := (select id from public.bhawans where slug = 'rajendra');
  night_c uuid := (select id from public.outlets where slug = 'rajendra-night-canteen');
  rajendra_mess uuid := (select id from public.outlets where slug = 'rajendra-mess');
  amul uuid := (select id from public.outlets where slug = 'amul');
begin
  insert into public.menu_items (outlet_id, name, category, price_paise) values
    (night_c, 'Plain Maggi', 'Maggi', 3000),
    (night_c, 'Cheese Maggi', 'Maggi', 5000),
    (amul, 'Masala Maggi', null, 4000),
    (amul, 'Kool Cafe', 'Drinks', 2500);
  assert (select updated_by from public.menu_items where name = 'Plain Maggi') = auth.uid(), 'updated_by stamped';

  update public.menu_items set in_stock = false where name = 'Cheese Maggi';
  assert not (select in_stock from public.menu_items where name = 'Cheese Maggi'), 'vendor marks sold out';

  update public.outlets set is_open = false where id = night_c;
  assert (select status_updated_at from public.outlets where id = night_c) = now(), 'toggle stamps status_updated_at';
  -- Re-asserting the same value still counts, and clients can't backdate the stamp (006)
  update public.outlets set is_open = false, status_updated_at = '2000-01-01' where id = night_c;
  assert (select status_updated_at from public.outlets where id = night_c) = now(), 'stamp pinned to now()';

  update public.outlet_shifts set opens_at = '02:00', closes_at = '14:00' where outlet_id = night_c;
  assert (select opens_at from public.outlet_shifts where outlet_id = night_c) = '02:00', 'vendor changes shift';

  begin
    insert into public.menu_items (outlet_id, name, price_paise) values (rajendra_mess, 'Thali', 6000);
    assert false, 'vendors never run a mess';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.fixed_rate_items (bhawan_id, name, ceiling_price_paise) values (rajendra, 'Plain Maggi', 2500);
    assert false, 'vendors cannot write the fixed-rate card';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.outlets set name = 'Renamed' where id = night_c;
    assert false, 'only is_open/location_tag are writable';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ─── RLS as the Rajendra Bhawan Secretary ────────────────────────────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000c002', 'role', 'authenticated',
  'roles', json_build_array('student', 'bhawan_secretary'))::text, true);

do $$
declare
  rajendra uuid := (select id from public.bhawans where slug = 'rajendra');
  ganga uuid := (select id from public.bhawans where slug = 'ganga');
  day_c uuid := (select id from public.outlets where slug = 'rajendra-day-canteen');
  ganga_day uuid := (select id from public.outlets where slug = 'ganga-day-canteen');
  amul uuid := (select id from public.outlets where slug = 'amul');
begin
  insert into public.fixed_rate_items (bhawan_id, name, description, ceiling_price_paise, circular_ref)
  values (rajendra, 'Plain Maggi', 'Single packet', 2500, 'DOSW/CANTEEN/2026-Q3');
  update public.fixed_rate_items set ceiling_price_paise = 2000 where bhawan_id = rajendra;
  assert (select ceiling_price_paise from public.fixed_rate_items where bhawan_id = rajendra) = 2000, 'secretary edits own card';

  begin
    insert into public.fixed_rate_items (bhawan_id, name, ceiling_price_paise) values (ganga, 'Tea', 1000);
    assert false, 'not another Bhawan card';
  exception when insufficient_privilege then null;
  end;

  insert into public.menu_items (outlet_id, name, price_paise) values (day_c, 'Samosa', 1500);
  update public.outlet_shifts set closes_at = '23:00' where outlet_id = day_c;
  assert (select closes_at from public.outlet_shifts where outlet_id = day_c) = '23:00', 'secretary changes own canteen shift';

  begin
    insert into public.menu_items (outlet_id, name, price_paise) values (ganga_day, 'Samosa', 1500);
    assert false, 'cross-outlet menu write rejected';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.menu_items (outlet_id, name, price_paise) values (amul, 'Lassi', 3000);
    assert false, 'Bhawan secretaries do not run eateries';
  exception when insufficient_privilege then null;
  end;

  update public.outlet_shifts set closes_at = '01:00' where outlet_id = ganga_day;
  assert (select closes_at from public.outlet_shifts where outlet_id = ganga_day) = '22:30', 'other Bhawan shift untouched';
end $$;

-- ─── As a student: read everything, write nothing; search (M4.9) ─────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000c001', 'role', 'authenticated',
  'roles', json_build_array('student'))::text, true);

do $$
declare
  night_c uuid := (select id from public.outlets where slug = 'rajendra-night-canteen');
begin
  assert (select count(*) from public.outlet_live_status) = 28, 'view: 22 canteens + 4 eateries + test canteen + test eatery';
  assert (select count(*) from public.fixed_rate_items) = 1, 'students read the rate card';

  update public.outlets set is_open = true where id = night_c;
  assert not (select is_open from public.outlets where id = night_c), 'student cannot toggle';
  update public.menu_items set price_paise = 1 where name = 'Plain Maggi';
  assert (select price_paise from public.menu_items where name = 'Plain Maggi') = 3000, 'student cannot change prices';

  assert (select count(*) from public.search_food('maggi') where item_id is not null) = 3, 'maggi: three items';
  assert (select count(distinct outlet_id) from public.search_food('maggi')) = 2, 'across two outlets';
  assert (select count(*) from public.search_food('magi') where item_id is not null) >= 3, 'typo still matches';
  assert (select outlet_name from public.search_food('coffee') limit 1) = 'Cafe Coffee Day', 'outlet names are searchable';
  assert (select count(*) from public.search_food('%')) = 0, 'wildcards are escaped / too short';
  assert (select count(*) from public.search_food('mess')) = 0, 'messes excluded';
end $$;

select 'ALL CANTEEN TESTS PASSED' as result;
rollback;
