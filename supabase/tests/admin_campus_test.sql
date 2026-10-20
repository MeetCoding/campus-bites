-- Admin master-list RPCs (014_admin_campus). Runs inside a transaction that is rolled back.
-- Success ends with "ALL ADMIN CAMPUS TESTS PASSED".

begin;

-- ─── As the API (service role = postgres here) ───────────────────────────────
do $$
declare
  b public.bhawans;
begin
  select * into b from public.admin_create_bhawan('Testpur Bhawan', 'testpur');
  assert b.sort_order = (select max(sort_order) from public.bhawans), 'appended to the end';
  assert (select array_agg(name order by name) from public.outlets where bhawan_id = b.id)
         = array['Testpur Bhawan Day Canteen', 'Testpur Bhawan Mess', 'Testpur Bhawan Night Canteen'],
         'three outlets named like the seed';
  assert (select count(*) from public.outlets where slug in ('testpur-mess', 'testpur-day-canteen', 'testpur-night-canteen')) = 3, 'outlet slugs';
  assert (select count(*) from public.outlet_shifts s join public.outlets o on o.id = s.outlet_id
          where o.bhawan_id = b.id) = 2, 'both canteens get default shifts';
  assert (select count(*) from public.mess_day_schedule(b.id, '2026-10-19')) = 3, 'mess uses the default meal timings';

  begin
    perform public.admin_create_bhawan('Testpur Bhawan', 'testpur-2');
    assert false, 'duplicate name rejected';
  exception when unique_violation then null;
  end;

  select * into b from public.admin_update_bhawan(b.id, 'Testpur Gandhi Bhawan', 40);
  assert b.name = 'Testpur Gandhi Bhawan' and b.sort_order = 40 and b.slug = 'testpur', 'renamed, reordered, slug kept';
  assert (select name from public.outlets where slug = 'testpur-mess') = 'Testpur Gandhi Bhawan Mess', 'outlets renamed';
  select * into b from public.admin_update_bhawan(b.id, null, 41);
  assert b.name = 'Testpur Gandhi Bhawan' and b.sort_order = 41, 'null leaves the name alone';
  assert not exists (select 1 from public.admin_update_bhawan(gen_random_uuid(), 'Ghost Bhawan')), 'unknown id → no row';

  assert public.admin_delete_bhawan(b.id), 'empty Bhawan removed';
  assert not exists (select 1 from public.outlets where slug like 'testpur-%'), 'with its outlets';
  assert not public.admin_delete_bhawan(b.id), 'second delete → false';

  -- A Bhawan someone lives in stays.
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'resident@ece.iitr.ac.in', '{}', now(), now());
  update public.profiles set bhawan_id = (select id from public.bhawans where slug = 'ganga')
   where id = '00000000-0000-0000-0000-00000000f001';
  begin
    perform public.admin_delete_bhawan((select id from public.bhawans where slug = 'ganga'));
    assert false, 'inhabited Bhawan must not be removed';
  exception when foreign_key_violation then null;
  end;
  assert exists (select 1 from public.bhawans where slug = 'ganga'), 'ganga still there';
end $$;

-- ─── Clients can't call them ─────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000f001', 'role', 'authenticated', 'roles', json_build_array('admin'))::text, true);
do $$
begin
  begin
    perform public.admin_create_bhawan('Rogue Bhawan', 'rogue');
    assert false, 'admin RPCs are service-role only, even for admins';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'ALL ADMIN CAMPUS TESTS PASSED' as result;
rollback;
