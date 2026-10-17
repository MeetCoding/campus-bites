-- Mess rebates regression test (TASKS M5.1). Runs inside a transaction that is rolled back.
-- Success ends with "ALL REBATE TESTS PASSED".

begin;

-- ─── Fixtures (as postgres = what FastAPI's service role can do) ─────────────
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student1@ece.iitr.ac.in', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student2@ece.iitr.ac.in', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'warden.rajendra@iitr.ac.in', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000d004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'warden.ganga@iitr.ac.in', '{}', now(), now());

insert into public.role_assignments (user_id, role, bhawan_id)
select '00000000-0000-0000-0000-00000000d003'::uuid, 'mess_authority'::public.app_role, id from public.bhawans where slug = 'rajendra'
union all
select '00000000-0000-0000-0000-00000000d004'::uuid, 'mess_authority'::public.app_role, id from public.bhawans where slug = 'ganga';

do $$
declare
  rajendra uuid := (select id from public.bhawans where slug = 'rajendra');
  s1 uuid := '00000000-0000-0000-0000-00000000d001';
  a1 uuid := '00000000-0000-0000-0000-00000000d003';
  first_id uuid;
begin
  assert (select min_rebate_days from public.app_settings) = 3, 'min_rebate_days = 3';
  assert (select rebate_backdate_days from public.app_settings) = 0, 'no backdating by default';

  insert into public.rebate_applications (student_id, bhawan_id, start_date, end_date, reason, document_path)
  values (s1, rajendra, '2026-10-20', '2026-10-23', 'Going home for Diwali', s1 || '/2026-10-17-a.pdf')
  returning id into first_id;
  assert (select days from public.rebate_applications where id = first_id) = 4, 'days is inclusive';
  assert (select count(*) from public.rebate_events where rebate_id = first_id and to_status = 'pending_verification'
          and from_status is null and actor_id = s1) = 1, 'submission logged';

  begin
    insert into public.rebate_applications (student_id, bhawan_id, start_date, end_date, reason)
    values (s1, rajendra, '2026-10-23', '2026-10-26', 'Overlaps the Diwali rebate');
    assert false, 'overlapping live rebates rejected by the exclusion constraint';
  exception when exclusion_violation then null;
  end;

  begin
    insert into public.rebate_applications (student_id, bhawan_id, start_date, end_date, reason, document_path)
    values (s1, rajendra, '2026-11-01', '2026-11-04', 'Someone else''s document', '00000000-0000-0000-0000-00000000d002/x.pdf');
    assert false, 'document must live in the student folder';
  exception when check_violation then null;
  end;

  begin
    update public.rebate_applications set status = 'approved' where id = first_id;
    assert false, 'cannot approve before the biometric cross-check';
  exception when check_violation then null;
  end;

  update public.rebate_applications
     set status = 'biometric_cross_checked', reviewed_by = a1, reviewed_at = now(), authority_remarks = 'Absent 20–23 Oct'
   where id = first_id;
  update public.rebate_applications
     set status = 'approved', reviewed_by = a1, reviewed_at = now(), authority_remarks = null
   where id = first_id;
  assert (select count(*) from public.rebate_events where rebate_id = first_id) = 3, 'three events';
  assert (select remarks from public.rebate_events where rebate_id = first_id and to_status = 'biometric_cross_checked') = 'Absent 20–23 Oct', 'remarks logged';

  begin
    update public.rebate_applications set status = 'rejected' where id = first_id;
    assert false, 'approved is final';
  exception when check_violation then null;
  end;

  -- A rejected application frees its dates
  insert into public.rebate_applications (student_id, bhawan_id, start_date, end_date, reason)
  values (s1, rajendra, '2026-11-10', '2026-11-12', 'Inter-IIT sports meet');
  update public.rebate_applications set status = 'rejected', reviewed_by = a1, authority_remarks = 'Not on the team list'
   where start_date = '2026-11-10';
  insert into public.rebate_applications (student_id, bhawan_id, start_date, end_date, reason)
  values (s1, rajendra, '2026-11-10', '2026-11-13', 'Inter-IIT sports meet (resubmitted)');
end $$;

-- ─── As the student ──────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000d001', 'role', 'authenticated', 'roles', json_build_array('student'))::text, true);

do $$
declare
  rajendra uuid := (select id from public.bhawans where slug = 'rajendra');
begin
  assert (select count(*) from public.rebate_applications) = 3, 'student reads own rebates';
  assert (select count(*) from public.rebate_events) = 6, 'and their events (3 + 2 + 1)';

  begin
    insert into public.rebate_applications (student_id, bhawan_id, start_date, end_date, reason)
    values (auth.uid(), rajendra, '2026-12-01', '2026-12-05', 'Direct insert from the app');
    assert false, 'direct insert from app rejected';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.rebate_applications set status = 'approved';
    assert false, 'student cannot change status';
  exception when insufficient_privilege then null;
  end;

  insert into storage.objects (bucket_id, name, owner_id) values ('rebate-documents', auth.uid() || '/2026-10-17-b.pdf', auth.uid());
  begin
    insert into storage.objects (bucket_id, name) values ('rebate-documents', '00000000-0000-0000-0000-00000000d002/x.pdf');
    assert false, 'cannot upload into another student folder';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ─── As another student ──────────────────────────────────────────────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000d002', 'role', 'authenticated', 'roles', json_build_array('student'))::text, true);
do $$
begin
  assert (select count(*) from public.rebate_applications) = 0, 'other students see nothing';
  assert (select count(*) from public.rebate_events) = 0, 'nor events';
  assert (select count(*) from storage.objects where bucket_id = 'rebate-documents') = 0, 'nor documents';
end $$;

-- ─── As the Rajendra Mess Authority ──────────────────────────────────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000d003', 'role', 'authenticated', 'roles', json_build_array('mess_authority'))::text, true);
do $$
begin
  assert (select count(*) from public.rebate_applications) = 3, 'authority reads own Bhawan queue';
  -- Only documents cited by a visible application (the -a.pdf object row was never uploaded; -b is uncited).
  assert (select count(*) from storage.objects where bucket_id = 'rebate-documents') = 0, 'uncited uploads stay private';
end $$;

reset role;
update public.rebate_applications set document_path = '00000000-0000-0000-0000-00000000d001/2026-10-17-b.pdf'
 where start_date = '2026-11-10' and status <> 'rejected';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000d003', 'role', 'authenticated', 'roles', json_build_array('mess_authority'))::text, true);
do $$
begin
  assert (select count(*) from storage.objects where bucket_id = 'rebate-documents') = 1, 'authority reads cited document';
end $$;

-- ─── As the Ganga Mess Authority ─────────────────────────────────────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000d004', 'role', 'authenticated', 'roles', json_build_array('mess_authority'))::text, true);
do $$
begin
  assert (select count(*) from public.rebate_applications) = 0, 'other Bhawan authority sees nothing';
  assert (select count(*) from storage.objects where bucket_id = 'rebate-documents') = 0, 'nor its documents';
end $$;

select 'ALL REBATE TESTS PASSED' as result;
rollback;
