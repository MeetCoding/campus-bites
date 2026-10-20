-- Master vendors + vendors managing messes regression test (migration 019_master_vendors).
-- Runs inside a transaction that is rolled back. Success ends with "ALL MASTER VENDOR TESTS PASSED".

begin;

-- ─── Fixtures (as postgres) ──────────────────────────────────────────────────
-- b001 = master vendor, b002 = a vendor whitelisted for Rajendra's mess only.
insert into auth.users (id, instance_id, aud, role, phone, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '919000000011', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '919000000012', '{}', now(), now());
insert into public.whitelisted_vendors (phone_e164, outlet_id)
select '+919000000012', id from public.outlets where slug = 'rajendra-mess';

-- ─── Making a master vendor links every outlet ───────────────────────────────
do $$
declare
  v_linked integer := public.admin_make_master_vendor('+919000000011', 'Owner', null);
begin
  assert v_linked = (select count(*) from public.outlets), 'linked to every outlet';
  assert (select count(*) from public.whitelisted_vendors where phone_e164 = '+919000000011')
       = (select count(*) from public.outlets), 'one whitelist row per outlet';
  assert public.admin_make_master_vendor('+919000000011', null, null) = v_linked, 'idempotent';
  assert (select label from public.master_vendors where phone_e164 = '+919000000011') = 'Owner',
    'a null label keeps the old one';
  assert (select is_master from public.admin_vendor_accounts() where phone_e164 = '+919000000011'),
    'accounts report master';
  assert not (select is_master from public.admin_vendor_accounts() where phone_e164 = '+919000000012'),
    'ordinary vendor is not master';
end $$;

-- ─── Outlets added later go to the master too (new eatery, new Bhawan) ───────
insert into public.outlets (type, name, slug) values ('eatery', 'Master Test Kiosk', 'master-test-kiosk');
select public.admin_create_bhawan('Master Test Bhawan', 'master-test', null);
do $$
begin
  assert exists (
    select 1 from public.whitelisted_vendors wv join public.outlets o on o.id = wv.outlet_id
     where wv.phone_e164 = '+919000000011' and o.slug = 'master-test-kiosk'
  ), 'new eatery assigned to master';
  assert (
    select count(*) from public.whitelisted_vendors wv join public.outlets o on o.id = wv.outlet_id
     where wv.phone_e164 = '+919000000011' and o.slug like 'master-test-%' and o.bhawan_id is not null
  ) = 3, 'new Bhawan mess + both canteens assigned to master';
  assert not exists (
    select 1 from public.whitelisted_vendors wv join public.outlets o on o.id = wv.outlet_id
     where wv.phone_e164 = '+919000000012' and o.slug = 'master-test-kiosk'
  ), 'ordinary vendors are not auto-assigned';
end $$;

-- ─── A mess vendor manages that mess (menu, extra items), not others ─────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000b002', 'role', 'authenticated',
  'roles', json_build_array('vendor'))::text, true);

do $$
declare
  v_rajendra uuid := (select id from public.bhawans where slug = 'rajendra');
  v_ganga uuid := (select id from public.bhawans where slug = 'ganga');
begin
  assert app.can_manage_outlet((select id from public.outlets where slug = 'rajendra-mess')),
    'mess vendor manages its mess (photos)';
  assert not app.can_run_outlet((select id from public.outlets where slug = 'rajendra-mess')),
    'but cannot toggle the mess open/closed';
  assert not app.can_manage_outlet((select id from public.outlets where slug = 'ganga-mess')),
    'no rights in another mess';

  insert into public.menu_photos (outlet_id, kind, storage_path)
  select id, 'extras', id || '/master-test-extras.jpg' from public.outlets where slug = 'rajendra-mess';
  assert exists (select 1 from public.menu_photos where storage_path like '%/master-test-extras.jpg'),
    'mess vendor publishes an extras photo';

  begin
    insert into public.menu_photos (outlet_id, kind, storage_path)
    select id, 'extras', id || '/nope.jpg' from public.outlets where slug = 'ganga-mess';
    assert false, 'extras photo in another mess';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ─── The master vendor manages every mess ────────────────────────────────────
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000b001', 'role', 'authenticated',
  'roles', json_build_array('vendor'))::text, true);
do $$
begin
  assert (select bool_and(app.can_manage_outlet(id)) from public.outlets where type = 'mess'), 'master manages every mess';
end $$;

-- ─── Clients can't see or call any of it ─────────────────────────────────────
do $$
begin
  begin
    perform 1 from public.master_vendors;
    assert false, 'authenticated read master_vendors';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_make_master_vendor('+919000000012', null, null);
    assert false, 'authenticated made a master vendor';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_delete_vendor('+919000000012');
    assert false, 'authenticated deleted a vendor';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ─── Deleting a vendor removes master status and every link ──────────────────
do $$
declare
  r record;
begin
  select * into r from public.admin_delete_vendor('+919000000011');
  assert r.removed_links = (select count(*) from public.outlets), 'all links removed';
  assert r.user_id = '00000000-0000-0000-0000-00000000b001', 'returns the sign-in account';
  assert not exists (select 1 from public.master_vendors where phone_e164 = '+919000000011'), 'no longer master';
  assert not exists (select 1 from public.whitelisted_vendors where phone_e164 = '+919000000011'), 'no links left';

  insert into public.outlets (type, name, slug) values ('eatery', 'After Delete Kiosk', 'after-delete-kiosk');
  assert not exists (select 1 from public.whitelisted_vendors where phone_e164 = '+919000000011'),
    'deleted master gets no new outlets';

  select * into r from public.admin_delete_vendor('+919999999999');
  assert r.removed_links = 0 and r.user_id is null, 'unknown phone is a no-op';
end $$;

select 'ALL MASTER VENDOR TESTS PASSED' as result;
rollback;
