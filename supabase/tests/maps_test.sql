-- Map pins regression test (migration 016_outlet_coordinates).
-- Runs inside a transaction that is rolled back. Success ends with "ALL MAP TESTS PASSED".

begin;

-- ─── Fixtures (as postgres) ──────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@ece.iitr.ac.in', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '{}', now(), now());
-- f003 is the V1 vendor (whitelisted for every canteen and eatery)
update public.profiles set phone = '+919510709195' where id = '00000000-0000-0000-0000-00000000f003';
-- An eatery nobody is whitelisted for (master vendors would be auto-assigned it, 019)
delete from public.master_vendors;
insert into public.outlets (type, name, slug) values ('eatery', 'Map Test Kiosk', 'map-test-kiosk');

do $$
begin
  begin
    update public.outlets set latitude = 29.86 where slug = 'amul';
    assert false, 'a pin needs both coordinates';
  exception when check_violation then null;
  end;
  begin
    update public.outlets set latitude = 95, longitude = 77.9 where slug = 'amul';
    assert false, 'latitude out of range';
  exception when check_violation then null;
  end;
end $$;

-- ─── Vendor sets its own eatery's pin ────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000f003', 'role', 'authenticated',
  'roles', json_build_array('vendor'))::text, true);

do $$
begin
  update public.outlets set latitude = 29.8649, longitude = 77.8966 where slug = 'amul';
  assert (select latitude from public.outlets where slug = 'amul') = 29.8649, 'vendor pins own eatery';

  update public.outlets set latitude = 29.1, longitude = 77.1 where slug = 'map-test-kiosk';
  assert (select latitude from public.outlets where slug = 'map-test-kiosk') is null, 'not an outlet they run';

  update public.outlets set latitude = 29.1, longitude = 77.1 where slug = 'rajendra-mess';
  assert (select latitude from public.outlets where slug = 'rajendra-mess') is null, 'messes are not vendor-run';

  begin
    update public.outlets set name = 'Renamed' where slug = 'amul';
    assert false, 'only the granted columns are writable';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ─── Student: reads pins through the live-status view, can't move them ──────
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000f001', 'role', 'authenticated',
  'roles', json_build_array('student'))::text, true);

do $$
begin
  assert (select latitude from public.outlet_live_status
          where outlet_id = (select id from public.outlets where slug = 'amul')) = 29.8649,
    'view exposes the pin';
  update public.outlets set latitude = 1, longitude = 1 where slug = 'amul';
  assert (select latitude from public.outlets where slug = 'amul') = 29.8649, 'students cannot move pins';
end $$;

reset role;
select 'ALL MAP TESTS PASSED' as result;

rollback;
