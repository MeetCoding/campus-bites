-- 009_rebates: Mess rebate applications (TASKS M5) — applications + audit events, private
-- document bucket. Clients only read; every write goes through FastAPI (service role).
-- See ARCHITECTURE.md §3.2 (POST /v1/rebates, /transition), §4, §5.8.

create extension if not exists btree_gist with schema extensions;

-- How far back a rebate may start (days before today, IST). 0 = today or later.
alter table public.app_settings
  add column rebate_backdate_days integer not null default 0
  check (rebate_backdate_days between 0 and 30);
comment on column public.app_settings.rebate_backdate_days is
  'A rebate may start at most this many days before today (IST). 0 = no backdating.';

-- ─── M5.1 rebate_applications ────────────────────────────────────────────────
create table public.rebate_applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  bhawan_id uuid not null references public.bhawans (id) on delete restrict,
  -- Snapshot for the Mess Authority (profiles are private to their owner).
  student_name text,
  student_email text,
  start_date date not null,
  end_date date not null,
  days integer generated always as (end_date - start_date + 1) stored,
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  document_path text check (document_path is null or document_path like student_id::text || '/%'),
  status public.rebate_status not null default 'pending_verification',
  authority_remarks text check (authority_remarks is null or char_length(authority_remarks) <= 500),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rebate_applications_dates check (end_date >= start_date and end_date - start_date < 180),
  -- Race-proof "no overlapping live rebates" (the API checks first for a friendly error).
  constraint rebate_applications_no_overlap exclude using gist (
    student_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status <> 'rejected')
);
create index rebate_applications_student_idx on public.rebate_applications (student_id, created_at desc);
create index rebate_applications_queue_idx on public.rebate_applications (bhawan_id, status, created_at);
create index rebate_applications_reviewed_by_idx on public.rebate_applications (reviewed_by);
create index rebate_applications_document_idx on public.rebate_applications (document_path)
  where document_path is not null;
create trigger set_updated_at before update on public.rebate_applications
  for each row execute function extensions.moddatetime (updated_at);

create table public.rebate_events (
  id uuid primary key default gen_random_uuid(),
  rebate_id uuid not null references public.rebate_applications (id) on delete cascade,
  from_status public.rebate_status,
  to_status public.rebate_status not null,
  actor_id uuid references public.profiles (id) on delete set null,
  remarks text,
  created_at timestamptz not null default now()
);
create index rebate_events_rebate_idx on public.rebate_events (rebate_id, created_at);
create index rebate_events_actor_idx on public.rebate_events (actor_id);

-- Legal workflow (PRD §3A.4): pending → cross-checked → approved; reject from either open state.
create function public.rebate_guard_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and not (
       (old.status = 'pending_verification' and new.status in ('biometric_cross_checked', 'rejected'))
    or (old.status = 'biometric_cross_checked' and new.status in ('approved', 'rejected'))
  ) then
    raise exception 'Illegal rebate transition % → %', old.status, new.status using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.rebate_guard_transition() from public, anon, authenticated;
create trigger guard_transition before update on public.rebate_applications
  for each row execute function public.rebate_guard_transition();

-- Audit trail written by the database, atomically with the change it records.
create function public.rebate_log_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.rebate_events (rebate_id, from_status, to_status, actor_id)
    values (new.id, null, new.status, new.student_id);
  elsif new.status is distinct from old.status then
    insert into public.rebate_events (rebate_id, from_status, to_status, actor_id, remarks)
    values (new.id, old.status, new.status, new.reviewed_by, new.authority_remarks);
  end if;
  return new;
end;
$$;
revoke execute on function public.rebate_log_event() from public, anon, authenticated;
create trigger log_event after insert or update on public.rebate_applications
  for each row execute function public.rebate_log_event();

alter table public.rebate_applications enable row level security;
alter table public.rebate_events enable row level security;
revoke all on public.rebate_applications, public.rebate_events from anon, authenticated;
grant select on public.rebate_applications, public.rebate_events to authenticated;
grant select, insert, update on public.rebate_applications, public.rebate_events to service_role;

create policy "students read own rebates" on public.rebate_applications
  for select to authenticated using (student_id = (select auth.uid()));
create policy "mess authority reads bhawan rebates" on public.rebate_applications
  for select to authenticated using (app.has_bhawan_role('mess_authority', bhawan_id));
-- Events are visible exactly when their application is (the subquery is RLS-filtered).
create policy "read events of visible rebates" on public.rebate_events
  for select to authenticated
  using (exists (select 1 from public.rebate_applications r where r.id = rebate_id));
-- No insert/update/delete policies: writes are FastAPI-only (ARCHITECTURE.md §3.3).

-- ─── Private bucket for supporting documents ─────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rebate-documents', 'rebate-documents', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Path convention: {student_id}/{yyyy-mm-dd}-{random}.{jpg|pdf}
create policy "students upload own rebate documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rebate-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
-- Read (signed URLs): the uploader, or anyone who can see an application citing the file —
-- i.e. the Mess Authority of that Bhawan (rebate_applications RLS applies inside the subquery).
create policy "owners and reviewing authority read rebate documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rebate-documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.rebate_applications r where r.document_path = name)
    )
  );
