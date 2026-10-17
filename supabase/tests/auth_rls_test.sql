-- Auth hooks + RLS regression test (TASKS M2.14).
-- Runs entirely inside a transaction that is rolled back — safe on the dev project.
-- Run: paste into the SQL editor, or `psql "$DB_URL" -f supabase/tests/auth_rls_test.sql`.
-- Any failed ASSERT aborts with a message; success ends with "ALL AUTH/RLS TESTS PASSED".

begin;

-- ─── Fixtures (as postgres) ──────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, phone, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@ece.iitr.ac.in', null, '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'secy@cse.iitr.ac.in', null, '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'warden@iitr.ac.in', null, '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000a004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '919510709195', '{}', now(), now());

insert into public.role_assignments (user_id, role, bhawan_id)
select '00000000-0000-0000-0000-00000000a002'::uuid, 'mess_secretary'::public.app_role, id from public.bhawans where slug = 'rajendra'
union all
select '00000000-0000-0000-0000-00000000a003'::uuid, 'mess_authority'::public.app_role, id from public.bhawans where slug = 'rajendra';

-- ─── before_user_created hook ────────────────────────────────────────────────
do $$
declare
  g jsonb := '{"provider": "google"}';
begin
  assert public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('email', 'a@ece.iitr.ac.in', 'app_metadata', g))) = '{}', 'dept email must be allowed';
  assert public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('email', 'A@IITR.AC.IN', 'app_metadata', g))) = '{}', 'bare iitr email (any case) must be allowed';
  assert public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('email', 'a@gmail.com', 'app_metadata', g))) ? 'error', 'gmail must be rejected';
  assert public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('email', 'a@eviliitr.ac.in', 'app_metadata', g))) ? 'error', 'look-alike domain must be rejected';
  assert public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('email', 'a@iitr.ac.in.evil.com', 'app_metadata', g))) ? 'error', 'suffix attack must be rejected';
  assert public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('email', 'a@ece.iitr.ac.in', 'app_metadata', '{"provider": "email"}'::jsonb))) ? 'error', 'email/password sign-up must be rejected';
  assert public.hook_before_user_created('{"user": {"phone": "919510709195"}}') = '{}', 'whitelisted phone must be allowed';
  assert public.hook_before_user_created('{"user": {"phone": "+919510709195"}}') = '{}', 'whitelisted phone with + must be allowed';
  assert public.hook_before_user_created('{"user": {"phone": "919999999999"}}') ? 'error', 'unknown phone must be rejected';
  assert public.hook_before_user_created('{"user": {"email": "", "phone": ""}}') ? 'error', 'anonymous must be rejected';
end $$;

-- ─── custom_access_token hook ────────────────────────────────────────────────
do $$
declare
  rajendra uuid := (select id from public.bhawans where slug = 'rajendra');
  c jsonb;
begin
  c := public.custom_access_token_hook(jsonb_build_object('user_id', '00000000-0000-0000-0000-00000000a001',
         'claims', '{"email": "student@ece.iitr.ac.in", "phone": "", "role": "authenticated"}'::jsonb)) -> 'claims';
  assert c ->> 'app_role' = 'student', 'student app_role';
  assert c -> 'roles' = '["student"]', 'student roles';
  assert c ->> 'role' = 'authenticated', 'postgres role claim must be untouched';
  assert jsonb_typeof(c -> 'bhawan_id') = 'null', 'no bhawan before onboarding';

  c := public.custom_access_token_hook(jsonb_build_object('user_id', '00000000-0000-0000-0000-00000000a002',
         'claims', '{"email": "secy@cse.iitr.ac.in", "phone": ""}'::jsonb)) -> 'claims';
  assert c ->> 'app_role' = 'mess_secretary', 'secretary app_role';
  assert c -> 'roles' @> '["student", "mess_secretary"]', 'secretary is also a student';
  assert c -> 'scope_bhawan_ids' = jsonb_build_array(rajendra), 'secretary scope';

  c := public.custom_access_token_hook(jsonb_build_object('user_id', '00000000-0000-0000-0000-00000000a003',
         'claims', '{"email": "warden@iitr.ac.in", "phone": ""}'::jsonb)) -> 'claims';
  assert c ->> 'app_role' = 'mess_authority', 'authority app_role';
  assert not (c -> 'roles' ? 'student'), 'officials are not students';

  c := public.custom_access_token_hook(jsonb_build_object('user_id', '00000000-0000-0000-0000-00000000a004',
         'claims', '{"email": "", "phone": "919510709195"}'::jsonb)) -> 'claims';
  assert c ->> 'app_role' = 'vendor', 'vendor app_role';
  assert c -> 'roles' = '["vendor"]', 'vendor roles';
  assert jsonb_array_length(c -> 'outlet_ids') = 26, 'vendor owns 22 canteens + 4 eateries';
end $$;

-- ─── RLS as a student ────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000a001', 'role', 'authenticated',
  'email', 'student@ece.iitr.ac.in', 'app_role', 'student', 'roles', json_build_array('student'),
  'scope_bhawan_ids', '[]'::json, 'outlet_ids', '[]'::json)::text, true);

do $$
declare
  n int;
  ganga uuid := (select id from public.bhawans where slug = 'ganga');
begin
  assert (select count(*) from public.bhawans) = 11, 'student reads 11 bhawans';
  assert (select count(*) from public.outlets) = 37, 'student reads 37 outlets';
  assert (select min_rebate_days from public.app_settings) = 3, 'student reads app_settings';
  assert (select count(*) from public.profiles) = 1, 'student sees only own profile';
  assert (select count(*) from public.role_assignments) = 0, 'student sees no role assignments';

  begin
    perform 1 from public.whitelisted_vendors;
    assert false, 'whitelist must not be readable';
  exception when insufficient_privilege then null;
  end;

  update public.profiles set bhawan_id = ganga where id = auth.uid();
  get diagnostics n = row_count;
  assert n = 1, 'student can set own bhawan';
  assert (select onboarded_at from public.profiles where id = auth.uid()) is not null, 'onboarded_at stamped';

  begin
    update public.profiles set bhawan_id = (select id from public.bhawans where slug = 'rajendra') where id = auth.uid();
    assert false, 'bhawan must not change twice';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles set full_name = 'Mallory' where id = auth.uid();
    assert false, 'only bhawan_id is client-writable';
  exception when insufficient_privilege then null;
  end;

  update public.profiles set bhawan_id = ganga where id = '00000000-0000-0000-0000-00000000a002';
  get diagnostics n = row_count;
  assert n = 0, 'cannot touch another profile';

  begin
    insert into public.role_assignments (user_id, role) values (auth.uid(), 'admin');
    assert false, 'students cannot grant themselves roles';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.app_settings set min_rebate_days = 1;
    assert false, 'app_settings is read-only';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ─── RLS as a secretary: sees own assignment only ────────────────────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000a002', 'role', 'authenticated',
  'roles', json_build_array('student', 'mess_secretary'))::text, true);

do $$
begin
  assert (select count(*) from public.role_assignments) = 1, 'secretary sees only own assignment';
  assert app.has_role('mess_secretary') and app.has_role('student') and not app.has_role('admin'), 'has_role helper';
end $$;

-- ─── RLS as a vendor: cannot pick a bhawan ───────────────────────────────────
reset role;
-- claims are built as postgres (the whitelist itself is not readable by `authenticated`)
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000a004', 'role', 'authenticated',
  'roles', json_build_array('vendor'),
  'outlet_ids', (select json_agg(outlet_id) from public.whitelisted_vendors))::text, true);
set local role authenticated;

do $$
declare n int;
begin
  assert cardinality(app.outlet_ids()) = 26, 'outlet_ids helper';
  update public.profiles set bhawan_id = (select id from public.bhawans where slug = 'ganga') where id = auth.uid();
  get diagnostics n = row_count;
  assert n = 0, 'vendors cannot set a bhawan';
end $$;

-- ─── Signed-out ──────────────────────────────────────────────────────────────
reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.bhawans;
    assert false, 'anon must not read bhawans';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'ALL AUTH/RLS TESTS PASSED' as result;

rollback;
