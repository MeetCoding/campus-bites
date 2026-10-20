-- Mess Hub regression test (TASKS M3.5, M3.8, M3.9, M3.13, M3.1).
-- Runs inside a transaction that is rolled back. Success ends with "ALL MESS TESTS PASSED".

begin;

-- ─── Fixtures (as postgres) ──────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@ece.iitr.ac.in', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'messsecy@cse.iitr.ac.in', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000b003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '{}', now(), now());
-- b003 is a vendor: give its profile the whitelisted number (auth.users.phone is unique, so set it on the profile)
update public.profiles set phone = '+919510709195' where id = '00000000-0000-0000-0000-00000000b003';

-- A photo on another Bhawan's mess (the secretary below must not be able to delete it).
insert into public.menu_photos (outlet_id, storage_path, uploaded_by)
select id, id || '/2026-10-19-ganga.jpg', null from public.outlets where slug = 'ganga-mess';

insert into public.role_assignments (user_id, role, bhawan_id)
select '00000000-0000-0000-0000-00000000b002'::uuid, 'mess_secretary'::public.app_role, id
from public.bhawans where slug = 'rajendra';

-- ─── Schedule logic (M3.5) ───────────────────────────────────────────────────
do $$
declare
  rajendra uuid := (select id from public.bhawans where slug = 'rajendra');
  ganga uuid := (select id from public.bhawans where slug = 'ganga');
  rajendra_mess uuid := (select id from public.outlets where slug = 'rajendra-mess');
  r record;
begin
  -- 2026-10-19 is a Monday, 2026-10-17 a Saturday
  select * into r from public.mess_day_schedule(rajendra, '2026-10-19') where slot = 'breakfast';
  assert r.opens_at = '07:30' and r.closes_at = '09:30', 'weekday breakfast 7:30–9:30';
  select * into r from public.mess_day_schedule(rajendra, '2026-10-17') where slot = 'breakfast';
  assert r.opens_at = '08:00' and r.closes_at = '10:00', 'weekend breakfast 8:00–10:00';
  assert (select count(*) from public.mess_day_schedule(rajendra, '2026-10-19')) = 3, 'three meals a day';

  -- IST conversion: 02:45 UTC = 08:15 IST on Monday
  assert (select status from public.mess_schedule_at(rajendra, '2026-10-19 02:45:00+00') where slot = 'breakfast') = 'serving', 'breakfast serving at 08:15 IST';
  assert (select status from public.mess_schedule_at(rajendra, '2026-10-19 02:45:00+00') where slot = 'lunch') = 'upcoming', 'lunch upcoming at 08:15 IST';
  assert (select status from public.mess_schedule_at(rajendra, '2026-10-19 04:00:00+00') where slot = 'breakfast') = 'done', 'breakfast done at 09:30 IST (end-exclusive)';
  -- 20:00 UTC Sunday = 01:30 IST Monday → service_date is Monday
  assert (select distinct service_date from public.mess_schedule_at(rajendra, '2026-10-18 20:00:00+00')) = '2026-10-19', 'IST date rolls over before UTC';

  -- Bhawan-specific timing beats the institute default
  insert into public.meal_timings (bhawan_id, slot, day_type, opens_at, closes_at)
  values (rajendra, 'lunch', 'weekday', '13:00', '15:00');
  assert (select opens_at from public.mess_day_schedule(rajendra, '2026-10-19') where slot = 'lunch') = '13:00', 'bhawan lunch timing';
  assert (select opens_at from public.mess_day_schedule(ganga, '2026-10-19') where slot = 'lunch') = '12:30', 'other bhawans keep default';

  -- Overrides: newest active wins, revoked ignored, closed surfaces reason
  insert into public.timing_overrides (outlet_id, slot, starts_on, ends_on, opens_at, closes_at, reason, created_at)
  values (rajendra_mess, 'dinner', '2026-10-19', '2026-10-25', '20:00', '22:00', 'Exam season', now() - interval '1 hour');
  assert (select opens_at from public.mess_day_schedule(rajendra, '2026-10-20') where slot = 'dinner') = '20:00', 'override applies inside range';
  assert (select opens_at from public.mess_day_schedule(rajendra, '2026-10-26') where slot = 'dinner') = '19:30', 'override ends after ends_on';

  insert into public.timing_overrides (outlet_id, slot, starts_on, ends_on, is_closed, reason)
  values (rajendra_mess, 'dinner', '2026-10-20', '2026-10-20', true, 'Diwali dinner at the institute lawn');
  select * into r from public.mess_schedule_at(rajendra, '2026-10-20 06:00:00+00') where slot = 'dinner';
  assert r.status = 'closed' and r.override_reason = 'Diwali dinner at the institute lawn', 'newest (closed) override wins';

  update public.timing_overrides set revoked_at = now() where reason like 'Diwali%';
  assert (select is_closed from public.mess_day_schedule(rajendra, '2026-10-20') where slot = 'dinner') = false, 'revoked override ignored';
  assert (select opens_at from public.mess_day_schedule(ganga, '2026-10-20') where slot = 'dinner') = '19:30', 'overrides are per Bhawan';
end $$;

-- ─── Weekly menu JSON validation (M3.8) ──────────────────────────────────────
do $$
begin
  assert app.is_valid_weekly_menu('{"mon": {"breakfast": ["Poha", "Tea"], "dinner": []}}'), 'valid menu';
  assert app.is_valid_weekly_menu('{}'), 'empty menu is valid';
  assert not app.is_valid_weekly_menu('{"monday": {}}'), 'unknown day key';
  assert not app.is_valid_weekly_menu('{"mon": {"brunch": []}}'), 'unknown meal key';
  assert not app.is_valid_weekly_menu('{"mon": {"lunch": [1, 2]}}'), 'dishes must be strings';
  assert not app.is_valid_weekly_menu('{"mon": {"lunch": [""]}}'), 'empty dish';
  assert not app.is_valid_weekly_menu('[]'), 'must be an object';
end $$;

-- ─── RLS as the Rajendra Mess Secretary ──────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000b002', 'role', 'authenticated',
  'roles', json_build_array('student', 'mess_secretary'))::text, true);

do $$
declare
  rajendra uuid := (select id from public.bhawans where slug = 'rajendra');
  ganga uuid := (select id from public.bhawans where slug = 'ganga');
  rajendra_mess uuid := (select id from public.outlets where slug = 'rajendra-mess');
  ganga_mess uuid := (select id from public.outlets where slug = 'ganga-mess');
  rajendra_canteen uuid := (select id from public.outlets where slug = 'rajendra-day-canteen');
  first_photo uuid;
begin
  assert (select count(*) from public.mess_schedule_today) = 33, 'view: 11 bhawans × 3 meals';

  insert into public.weekly_menus (bhawan_id, week_start, items)
  values (rajendra, '2026-10-19', '{"mon": {"breakfast": ["Aloo paratha", "Curd"]}}')
  on conflict (bhawan_id, week_start) do update set items = excluded.items;
  assert (select updated_by from public.weekly_menus where bhawan_id = rajendra) = auth.uid(), 'updated_by stamped';

  begin
    insert into public.weekly_menus (bhawan_id, week_start, items) values (ganga, '2026-10-19', '{}');
    assert false, 'secretary must not edit another Bhawan menu';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.weekly_menus (bhawan_id, week_start, items) values (rajendra, '2026-10-20', '{}');
    assert false, 'week_start must be a Monday';
  exception when check_violation then null;
  end;

  insert into public.extra_items (bhawan_id, name, unit, price_paise) values (rajendra, 'Paneer', 'per plate', 4000);
  update public.extra_items set available = false where bhawan_id = rajendra and name = 'Paneer';
  begin
    insert into public.extra_items (bhawan_id, name, price_paise) values (ganga, 'Egg', 1200);
    assert false, 'secretary must not edit another Bhawan rate card';
  exception when insufficient_privilege then null;
  end;

  assert app.can_manage_outlet(rajendra_mess), 'secretary manages own mess';
  assert not app.can_manage_outlet(ganga_mess), 'not another mess';
  assert not app.can_manage_outlet(rajendra_canteen), 'mess secretary does not manage canteens';

  insert into public.menu_photos (outlet_id, storage_path, width, height)
  values (rajendra_mess, rajendra_mess || '/2026-10-19-a.jpg', 2560, 1920)
  returning id into first_photo;
  insert into public.menu_photos (outlet_id, storage_path, width, height)
  values (rajendra_mess, rajendra_mess || '/2026-10-19-b.jpg', 2560, 1920);
  insert into public.menu_photos (outlet_id, storage_path, width, height)
  values (rajendra_mess, rajendra_mess || '/2026-10-19-c.jpg', 2560, 1920);
  assert (select count(*) from public.menu_photos where outlet_id = rajendra_mess and is_current) = 3, 'photos stack up';
  assert (select is_current from public.menu_photos where id = first_photo), 'older photo stays published';

  delete from public.menu_photos where id = first_photo;
  assert not exists (select 1 from public.menu_photos where id = first_photo), 'manager deletes a photo';
  assert (select count(*) from public.menu_photos where outlet_id = rajendra_mess) = 2, 'only that photo removed';

  -- Another outlet's photo: RLS hides it from DELETE.
  delete from public.menu_photos where outlet_id = ganga_mess;
  assert (select count(*) from public.menu_photos where outlet_id = ganga_mess) = 1, 'cannot delete another mess photo';

  begin
    insert into public.menu_photos (outlet_id, storage_path) values (ganga_mess, ganga_mess || '/x.jpg');
    assert false, 'cannot upload for another mess';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.menu_photos (outlet_id, storage_path) values (rajendra_mess, ganga_mess || '/x.jpg');
    assert false, 'path must live in the outlet folder';
  exception when check_violation then null;
  end;

  begin
    insert into public.timing_overrides (outlet_id, slot, starts_on, ends_on, opens_at, closes_at, reason)
    values (rajendra_mess, 'lunch', current_date, current_date, '13:00', '15:00', 'Direct write');
    assert false, 'overrides are FastAPI-only';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ─── RLS as a student ────────────────────────────────────────────────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000b001', 'role', 'authenticated',
  'roles', json_build_array('student'))::text, true);

do $$
declare
  rajendra uuid := (select id from public.bhawans where slug = 'rajendra');
  current_photo uuid := (select id from public.menu_photos where is_current limit 1);
  visible_photos bigint;
begin
  assert (select count(*) from public.weekly_menus) = 1, 'students read menus';
  assert (select count(*) from public.extra_items) = 1, 'students read rate card';
  assert (select count(*) from public.menu_photos where outlet_id = (select id from public.outlets where slug = 'rajendra-mess')) = 2,
    'students see the whole photo stack';

  visible_photos := (select count(*) from public.menu_photos);
  delete from public.menu_photos;
  assert (select count(*) from public.menu_photos) = visible_photos, 'students cannot delete photos';

  begin
    update public.extra_items set price_paise = 1 where bhawan_id = rajendra;
    -- RLS hides the row from UPDATE; prove nothing changed
    assert (select price_paise from public.extra_items where bhawan_id = rajendra) = 4000, 'student cannot change prices';
  exception when insufficient_privilege then null;
  end;

  insert into public.photo_reports (photo_id, reason) values (current_photo, 'outdated');
  begin
    insert into public.photo_reports (photo_id, reason) values (current_photo, 'blurry');
    assert false, 'one report per photo per student';
  exception when unique_violation then null;
  end;

  perform public.register_push_token('ExponentPushToken[device-1]', 'android');
  assert (select count(*) from public.push_tokens) = 1, 'student sees own token';
end $$;

-- ─── The same device signs in as the vendor: token moves to them ─────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000b003', 'role', 'authenticated',
  'roles', json_build_array('vendor'))::text, true);

do $$
declare
  rajendra_canteen uuid := (select id from public.outlets where slug = 'rajendra-night-canteen');
  rajendra_mess uuid := (select id from public.outlets where slug = 'rajendra-mess');
  current_photo uuid := (select id from public.menu_photos where is_current limit 1);
begin
  perform public.register_push_token('ExponentPushToken[device-1]', 'ios');
  assert (select count(*) from public.push_tokens) = 1, 'vendor now owns the device token';

  assert app.can_manage_outlet(rajendra_canteen), 'whitelisted vendor manages canteen';
  assert not app.can_manage_outlet(rajendra_mess), 'vendors never manage a mess';

  begin
    insert into public.photo_reports (photo_id, reason) values (current_photo, 'outdated');
    assert false, 'only students report photos';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000b001', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.push_tokens) = 0, 'student lost the moved token';
end $$;

-- ─── Storage: noticeboard uploads only into a managed outlet's folder ────────
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000b002', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  own text := (select id from public.outlets where slug = 'rajendra-mess') || '/2026-10-19-test.jpg';
  other text := (select id from public.outlets where slug = 'ganga-mess') || '/2026-10-19-test.jpg';
begin
  insert into storage.objects (bucket_id, name, owner_id) values ('noticeboard-photos', own, auth.uid()::text);
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('noticeboard-photos', other, auth.uid()::text);
    assert false, 'uploaded into another outlet folder';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('noticeboard-photos', 'not-a-uuid/x.jpg', auth.uid()::text);
    assert false, 'uploaded outside an outlet folder';
  exception when insufficient_privilege then null;
  end;

  -- Removing a stacked photo deletes its object (Storage API needs SELECT + DELETE).
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'noticeboard-photos' and name = own;
  assert not exists (select 1 from storage.objects where bucket_id = 'noticeboard-photos' and name = own),
    'manager deletes own outlet object';
end $$;

reset role;
insert into storage.objects (bucket_id, name)
select 'noticeboard-photos', id || '/2026-10-19-keep.jpg' from public.outlets where slug = 'ganga-mess';
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000b002', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  other text := (select id from public.outlets where slug = 'ganga-mess') || '/2026-10-19-keep.jpg';
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'noticeboard-photos' and name = other;
end $$;
reset role;
do $$
begin
  assert exists (select 1 from storage.objects where bucket_id = 'noticeboard-photos'
                 and name = (select id from public.outlets where slug = 'ganga-mess') || '/2026-10-19-keep.jpg'),
    'cannot delete another outlet object';
end $$;

-- ─── Photo stack cap (app_settings.max_menu_photos) ──────────────────────────
reset role;
update public.app_settings set max_menu_photos = 2; -- Rajendra mess already has 2
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000b002', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  rajendra_mess uuid := (select id from public.outlets where slug = 'rajendra-mess');
begin
  begin
    insert into public.menu_photos (outlet_id, storage_path) values (rajendra_mess, rajendra_mess || '/2026-10-19-d.jpg');
    assert false, 'stack is capped';
  exception when raise_exception then
    assert sqlerrm = 'MENU_PHOTO_LIMIT', 'stable error code';
  end;
end $$;

-- ─── Signed-out ──────────────────────────────────────────────────────────────
reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.mess_schedule_today;
    assert false, 'anon must not read schedules';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'ALL MESS TESTS PASSED' as result;

rollback;
