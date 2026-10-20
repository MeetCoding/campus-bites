-- Admin web console regression test (migration 017_admin_web).
-- Runs inside a transaction that is rolled back. Success ends with "ALL ADMIN WEB TESTS PASSED".

begin;

-- ─── Owner is an admin (or invited) ──────────────────────────────────────────
do $$
declare
  v_owner text := (select owner_admin_email from public.app_settings);
begin
  assert v_owner = 'meet_s@ece.iitr.ac.in', 'owner email is set';
  assert exists (
    select 1 from public.role_assignments ra join public.profiles p on p.id = ra.user_id
     where p.email = v_owner and ra.role = 'admin'
  ) or exists (select 1 from public.admin_invites where email = v_owner),
    'owner is an admin or has a pending invite';
end $$;

-- ─── Invites only take lower-case IITR emails ────────────────────────────────
do $$
begin
  begin
    insert into public.admin_invites (email) values ('someone@gmail.com');
    assert false, 'non-IITR email accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.admin_invites (email) values ('Upper@iitr.ac.in');
    assert false, 'mixed-case email accepted';
  exception when check_violation then null;
  end;
end $$;

-- ─── An invite becomes the admin role at first sign-in ───────────────────────
insert into public.admin_invites (email) values ('new.admin@ece.iitr.ac.in');
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'New.Admin@ece.iitr.ac.in', '{}', now(), now());

do $$
begin
  assert exists (
    select 1 from public.role_assignments
     where user_id = '00000000-0000-0000-0000-00000000a001' and role = 'admin'
  ), 'invite redeemed into an admin role';
  assert not exists (select 1 from public.admin_invites where email = 'new.admin@ece.iitr.ac.in'),
    'invite removed once redeemed';
end $$;

-- An uninvited sign-in gets no role.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'student@ece.iitr.ac.in', '{}', now(), now());
do $$
begin
  assert not exists (
    select 1 from public.role_assignments where user_id = '00000000-0000-0000-0000-00000000a002'
  ), 'uninvited user is not an admin';
end $$;

-- ─── Vendor accounts: one row per whitelisted phone, passcode time from app_metadata ─
insert into public.whitelisted_vendors (phone_e164, outlet_id)
select '+919000000001', id from public.outlets where slug in ('amul', 'cafe-coffee-day');
insert into auth.users (id, instance_id, aud, role, phone, raw_app_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', '919000000001',
        '{"passcode_set_at": "2026-10-20T10:00:00Z"}', now(), now());
insert into public.whitelisted_vendors (phone_e164, outlet_id)
select '+919000000002', id from public.outlets where slug = 'amul';

do $$
declare
  r record;
begin
  assert (select count(*) from public.admin_vendor_accounts() where phone_e164 = '+919000000001') = 1,
    'one row per phone, not per outlet';
  select * into r from public.admin_vendor_accounts() where phone_e164 = '+919000000001';
  assert r.user_id = '00000000-0000-0000-0000-00000000a003', 'account found by phone';
  assert r.passcode_set_at = '2026-10-20T10:00:00Z'::timestamptz, 'passcode time read';
  select * into r from public.admin_vendor_accounts() where phone_e164 = '+919000000002';
  assert r.user_id is null and r.passcode_set_at is null, 'whitelisted phone without an account';
end $$;

-- ─── Clients can't touch any of it ───────────────────────────────────────────
set local role authenticated;
do $$
begin
  begin
    perform 1 from public.admin_invites;
    assert false, 'authenticated read admin_invites';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_vendor_accounts();
    assert false, 'authenticated ran admin_vendor_accounts';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'ALL ADMIN WEB TESTS PASSED' as result;
rollback;
