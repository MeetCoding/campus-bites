-- Complaints regression test (TASKS M6.1–M6.3, M6.5 race-safety, M6.6 idempotency).
-- Runs inside a transaction that is rolled back. Success ends with "ALL COMPLAINT TESTS PASSED".

begin;

-- ─── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select u.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '{}', now(), now()
from (values
  ('00000000-0000-0000-0000-00000000e001', 'student1@ece.iitr.ac.in'),
  ('00000000-0000-0000-0000-00000000e002', 'student2@ece.iitr.ac.in'),
  ('00000000-0000-0000-0000-00000000e003', 'messsecy@cse.iitr.ac.in'),
  ('00000000-0000-0000-0000-00000000e004', 'bhawansecy@cse.iitr.ac.in'),
  ('00000000-0000-0000-0000-00000000e005', 'adosw@iitr.ac.in'),
  ('00000000-0000-0000-0000-00000000e006', 'warden.rajendra@iitr.ac.in'),
  ('00000000-0000-0000-0000-00000000e007', 'messsecy.ganga@cse.iitr.ac.in')
) as u(id, email);

insert into public.role_assignments (user_id, role, bhawan_id)
select '00000000-0000-0000-0000-00000000e003'::uuid, 'mess_secretary'::public.app_role, id from public.bhawans where slug = 'rajendra'
union all select '00000000-0000-0000-0000-00000000e004'::uuid, 'bhawan_secretary', id from public.bhawans where slug = 'rajendra'
union all select '00000000-0000-0000-0000-00000000e006'::uuid, 'mess_authority', id from public.bhawans where slug = 'rajendra'
union all select '00000000-0000-0000-0000-00000000e007'::uuid, 'mess_secretary', id from public.bhawans where slug = 'ganga'
union all select '00000000-0000-0000-0000-00000000e005'::uuid, 'adosw', null;

-- ─── As student 1: raise one complaint per domain (M6.2 routing) ─────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-00000000e001', 'role', 'authenticated', 'roles', json_build_array('student'))::text, true);

do $$
declare
  rajendra uuid := (select id from public.bhawans where slug = 'rajendra');
  r record;
begin
  insert into public.complaints (outlet_id, category, title, body, attachment_paths)
  select id, 'food_quality', 'Milk diluted at breakfast', 'The milk served at breakfast has been watery all week.',
         array[auth.uid() || '/2026-10-17-milk.jpg']
  from public.outlets where slug = 'rajendra-mess';
  insert into public.complaints (outlet_id, category, title, body)
  select id, 'lighting', 'Benches dark after 11 PM', 'The outdoor seating has no working lights after 11 PM.'
  from public.outlets where slug = 'rajendra-night-canteen';
  insert into public.complaints (outlet_id, category, title, body)
  select id, 'overcharging', 'Charged above MRP', 'Kool Cafe was sold at Rs 30 against an MRP of Rs 25.'
  from public.outlets where slug = 'amul';

  select * into r from public.complaints where category = 'food_quality';
  assert r.domain = 'mess' and r.assignee_role = 'mess_secretary' and r.bhawan_id = rajendra, 'mess → Mess Secretary';
  assert r.status = 'open' and r.created_by = auth.uid(), 'status and author pinned';
  select * into r from public.complaints where category = 'lighting';
  assert r.domain = 'hostel_canteen' and r.assignee_role = 'bhawan_secretary' and r.bhawan_id = rajendra, 'canteen → Bhawan Secretary';
  select * into r from public.complaints where category = 'overcharging';
  assert r.domain = 'campus_eatery' and r.assignee_role = 'adosw' and r.bhawan_id is null, 'eatery → ADoSW';
  assert (select count(*) from public.complaint_events where kind = 'created') = 3, 'creation logged';

  begin
    insert into public.complaints (outlet_id, category, title, body, status)
    select id, 'other', 'Trying to self-resolve', 'This should not be allowed at all.', 'resolved'
    from public.outlets where slug = 'amul';
    assert false, 'status is not client-writable';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.complaints (outlet_id, category, title, body, attachment_paths)
    select id, 'other', 'Someone else photo', 'Attaching a file from another folder.', array['00000000-0000-0000-0000-00000000e002/x.jpg']
    from public.outlets where slug = 'amul';
    assert false, 'attachments must be in the complainant folder';
  exception when check_violation then null;
  end;
  begin
    update public.complaints set status = 'resolved';
    assert false, 'client status update rejected';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.complaint_nudge((select id from public.complaints limit 1), auth.uid());
    assert false, 'RPCs are service-role only';
  exception when insufficient_privilege then null;
  end;

  insert into storage.objects (bucket_id, name, owner_id) values ('complaint-attachments', auth.uid() || '/2026-10-17-milk.jpg', auth.uid());
  begin
    insert into storage.objects (bucket_id, name) values ('complaint-attachments', '00000000-0000-0000-0000-00000000e002/x.jpg');
    assert false, 'cannot upload into another folder';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ─── Visibility per role ─────────────────────────────────────────────────────
reset role; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000e002', 'role', 'authenticated', 'roles', json_build_array('student'))::text, true);
do $$
declare r record;
begin
  assert (select count(*) from public.complaints) = 0, 'other students cannot read complaint rows';
  assert (select count(*) from storage.objects where bucket_id = 'complaint-attachments') = 0, 'nor photos';
  assert (select count(*) from public.complaint_board((select id from public.bhawans where slug = 'rajendra'))) = 2, 'board: Rajendra mess + canteen';
  assert (select count(*) from public.complaint_board(null, 'campus_eatery')) = 1, 'board: eateries';
  select * into r from public.complaint_board() limit 1;
  assert not r.is_mine, 'board is anonymised';
end $$;

reset role; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000e003', 'role', 'authenticated', 'roles', json_build_array('student', 'mess_secretary'))::text, true);
do $$ begin
  assert (select count(*) from public.complaints) = 1 and (select domain from public.complaints) = 'mess', 'Mess Secretary sees own Bhawan mess complaints';
  assert (select count(*) from storage.objects where bucket_id = 'complaint-attachments') = 1, 'and their photos';
end $$;

reset role; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000e007', 'role', 'authenticated', 'roles', json_build_array('student', 'mess_secretary'))::text, true);
do $$ begin
  assert (select count(*) from public.complaints) = 0, 'other Bhawan secretary sees nothing';
  assert (select count(*) from storage.objects where bucket_id = 'complaint-attachments') = 0, 'nor photos';
end $$;

reset role; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000e004', 'role', 'authenticated', 'roles', json_build_array('student', 'bhawan_secretary'))::text, true);
do $$ begin
  assert (select count(*) from public.complaints) = 1 and (select domain from public.complaints) = 'hostel_canteen', 'Bhawan Secretary sees canteen complaints';
end $$;

reset role; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000e006', 'role', 'authenticated', 'roles', json_build_array('mess_authority'))::text, true);
do $$ begin
  assert (select count(*) from public.complaints) = 2, 'Warden office sees its Bhawan (mess + canteen)';
end $$;

reset role; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000e005', 'role', 'authenticated', 'roles', json_build_array('adosw'))::text, true);
do $$ begin
  assert (select count(*) from public.complaints where created_by::text like '00000000-0000-0000-0000-00000000e%') = 3,
    'ADoSW sees everything (eateries + cross-Bhawan oversight)';
  assert (select count(*) from public.complaint_events e join public.complaints c on c.id = e.complaint_id
           where c.created_by::text like '00000000-0000-0000-0000-00000000e%') = 3, 'and the events';
end $$;

-- ─── Workflow RPCs (as the service role would call them) ─────────────────────
reset role;
do $$
declare
  s1 uuid := '00000000-0000-0000-0000-00000000e001';
  ms uuid := '00000000-0000-0000-0000-00000000e003';
  mess_c uuid := (select id from public.complaints where domain = 'mess' and created_by::text like '00000000-0000-0000-0000-00000000e%');
  canteen_c uuid := (select id from public.complaints where domain = 'hostel_canteen' and created_by::text like '00000000-0000-0000-0000-00000000e%');
  eatery_c uuid := (select id from public.complaints where domain = 'campus_eatery' and created_by::text like '00000000-0000-0000-0000-00000000e%');
  r record;
  n integer;
begin
  -- state machine
  begin
    update public.complaints set status = 'resolved' where id = mess_c;
    assert false, 'open → resolved is illegal';
  exception when check_violation then null;
  end;
  assert (select count(*) from public.complaint_transition(mess_c, 'open', 'in_progress', ms, 'handler', 'Spoke to the contractor', null)) = 1, 'open → in_progress';
  assert (select count(*) from public.complaint_transition(mess_c, 'open', 'in_progress', ms, 'handler', 'again', null)) = 0, 'stale expected status → no-op';
  assert (select count(*) from public.complaint_transition(mess_c, 'in_progress', 'in_progress', ms, 'handler', 'Fresh supplier from Monday', null)) = 1, 'reply without status change';
  perform public.complaint_transition(mess_c, 'in_progress', 'awaiting_confirmation', ms, 'handler', 'Fixed', ms || '/proof.jpg');
  update public.complaints set opened_at = now() - interval '60 hours', long_standing_at = now(), escalated_at = now() where id = mess_c;
  select * into r from public.complaint_transition(mess_c, 'awaiting_confirmation', 'reopened', s1, 'student', 'Still watery', null);
  assert r.status = 'reopened' and r.opened_at > now() - interval '1 minute' and r.long_standing_at is null and r.escalated_at is null, 'reopen restarts the 48 h clock';
  assert (select count(*) from public.complaint_events where complaint_id = mess_c and kind = 'reply') = 1, 'reply logged';
  assert (select array_agg(kind order by created_at, kind) from public.complaint_events where complaint_id = mess_c) is not null, 'timeline exists';

  -- nudge: too early, then eligible once, then cooldown; never for others or when resolved
  assert (select count(*) from public.complaint_nudge(canteen_c, s1)) = 0, 'no nudge before 7 days';
  update public.complaints set created_at = now() - interval '8 days' where id in (canteen_c, eatery_c);
  assert (select count(*) from public.complaint_nudge(canteen_c, '00000000-0000-0000-0000-00000000e002')) = 0, 'only the complainant nudges';
  assert (select count(*) from public.complaint_nudge(canteen_c, s1)) = 1, 'nudge after 7 days';
  assert (select count(*) from public.complaint_nudge(canteen_c, s1)) = 0, 'second nudge within 24 h rejected';
  assert (select nudge_count from public.complaints where id = canteen_c) = 1, 'counter = 1';
  update public.complaints set last_nudged_at = now() - interval '25 hours' where id = canteen_c;
  assert (select count(*) from public.complaint_nudge(canteen_c, s1)) = 1, 'nudge again after the cooldown';
  assert (select count(*) from public.complaint_nudges where complaint_id = canteen_c) = 2, 'two nudge rows';

  -- escalation sweep: exactly once
  update public.complaints set opened_at = now() - interval '49 hours' where id = canteen_c;
  select count(*) into n from public.complaint_escalate_due();
  assert n = 1, 'one complaint crosses 48 h';
  select count(*) into n from public.complaint_escalate_due();
  assert n = 0, 'second sweep escalates nothing (idempotent)';
  assert (select long_standing_at is not null and escalated_at is not null from public.complaints where id = canteen_c), 'flags set';
  assert (select count(*) from public.complaint_events where complaint_id = canteen_c and kind = 'escalated') = 1, 'escalation logged once';
end $$;

-- Board pins long-standing first
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000e002', 'role', 'authenticated', 'roles', json_build_array('student'))::text, true);
do $$
declare r record;
begin
  select * into r from public.complaint_board((select id from public.bhawans where slug = 'rajendra')) limit 1;
  assert r.is_long_standing and r.is_escalated and r.domain = 'hostel_canteen', '49 h-old open complaint flagged and pinned first';
end $$;

select 'ALL COMPLAINT TESTS PASSED' as result;
rollback;
