-- 011_complaints: Complaints & accountability (TASKS M6.1–M6.3). Students raise complaints
-- directly (RLS + routing trigger); every status change, nudge and escalation goes through
-- FastAPI, which calls the service-role-only RPCs below so each change and its audit event
-- commit together. See ARCHITECTURE.md §6.6.

-- ─── Helpers (private schema, live role checks) ──────────────────────────────
create function app.has_live_role(p_role public.app_role)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.role_assignments ra
    where ra.user_id = (select auth.uid()) and ra.role = p_role
  )
$$;

-- Routing: mess → Mess Secretary, hostel canteen → Bhawan Secretary, eatery → ADoSW.
create function app.can_handle_complaint(p_domain public.complaint_domain, p_bhawan uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_domain
    when 'mess' then app.has_bhawan_role('mess_secretary', p_bhawan)
    when 'hostel_canteen' then app.has_bhawan_role('bhawan_secretary', p_bhawan)
    else app.has_live_role('adosw')
  end
$$;

create function app.paths_in_folder(p_paths text[], p_folder uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(p like p_folder::text || '/%'), true) from unnest(p_paths) as p
$$;

revoke execute on function app.has_live_role(public.app_role),
  app.can_handle_complaint(public.complaint_domain, uuid), app.paths_in_folder(text[], uuid)
  from public, anon;
grant execute on function app.has_live_role(public.app_role),
  app.can_handle_complaint(public.complaint_domain, uuid), app.paths_in_folder(text[], uuid)
  to authenticated, service_role;

-- ─── M6.1 complaints ─────────────────────────────────────────────────────────
create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  outlet_id uuid not null references public.outlets (id) on delete restrict,
  -- Derived by trigger from the outlet (clients cannot choose the routing).
  bhawan_id uuid references public.bhawans (id) on delete restrict,
  domain public.complaint_domain not null,
  assignee_role public.app_role not null,
  category public.complaint_category not null,
  title text not null check (char_length(btrim(title)) between 5 and 120),
  body text not null check (char_length(btrim(body)) between 10 and 2000),
  attachment_paths text[] not null default '{}' check (cardinality(attachment_paths) <= 2),
  status public.complaint_status not null default 'open',
  opened_at timestamptz not null default now(), -- restarts the 48 h clock on 'reopened'
  resolved_at timestamptz,
  nudge_count integer not null default 0 check (nudge_count >= 0),
  last_nudged_at timestamptz,
  long_standing_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint complaints_domain_bhawan check ((domain = 'campus_eatery') = (bhawan_id is null)),
  constraint complaints_attachments_own_folder check (app.paths_in_folder(attachment_paths, created_by))
);
create index complaints_created_by_idx on public.complaints (created_by, created_at desc);
create index complaints_queue_idx on public.complaints (bhawan_id, domain, status);
create index complaints_outlet_idx on public.complaints (outlet_id);
create index complaints_sweep_idx on public.complaints (opened_at)
  where long_standing_at is null and status in ('open', 'in_progress', 'reopened');
create trigger set_updated_at before update on public.complaints
  for each row execute function extensions.moddatetime (updated_at);

create table public.complaint_events (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  kind text not null check (kind in ('created', 'status', 'reply', 'nudged', 'escalated')),
  from_status public.complaint_status,
  to_status public.complaint_status,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text not null check (actor_role in ('student', 'handler', 'system')),
  message text check (message is null or char_length(message) <= 1000),
  attachment_path text,
  created_at timestamptz not null default now()
);
create index complaint_events_complaint_idx on public.complaint_events (complaint_id, created_at);
create index complaint_events_actor_idx on public.complaint_events (actor_id);
create index complaint_events_attachment_idx on public.complaint_events (attachment_path)
  where attachment_path is not null;

create table public.complaint_nudges (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  nudged_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index complaint_nudges_complaint_idx on public.complaint_nudges (complaint_id, created_at);
create index complaint_nudges_nudged_by_idx on public.complaint_nudges (nudged_by);

-- ─── M6.2 routing + pinned fields on insert ──────────────────────────────────
create function public.complaints_prepare()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type public.outlet_type;
  v_bhawan uuid;
begin
  select o.type, o.bhawan_id into v_type, v_bhawan from public.outlets o where o.id = new.outlet_id;
  if not found then
    raise exception 'Unknown outlet' using errcode = 'foreign_key_violation';
  end if;
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.bhawan_id := v_bhawan;
  new.domain := case v_type when 'mess' then 'mess'
                            when 'eatery' then 'campus_eatery'
                            else 'hostel_canteen' end;
  new.assignee_role := case v_type when 'mess' then 'mess_secretary'
                                   when 'eatery' then 'adosw'
                                   else 'bhawan_secretary' end;
  new.status := 'open';
  new.opened_at := now();
  new.created_at := now();
  new.resolved_at := null;
  new.nudge_count := 0;
  new.last_nudged_at := null;
  new.long_standing_at := null;
  new.escalated_at := null;
  return new;
end;
$$;
revoke execute on function public.complaints_prepare() from public, anon, authenticated;
create trigger prepare before insert on public.complaints
  for each row execute function public.complaints_prepare();

create function public.complaints_log_created()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.complaint_events (complaint_id, kind, to_status, actor_id, actor_role)
  values (new.id, 'created', new.status, new.created_by, 'student');
  return new;
end;
$$;
revoke execute on function public.complaints_log_created() from public, anon, authenticated;
create trigger log_created after insert on public.complaints
  for each row execute function public.complaints_log_created();

-- PRD §3D.2 state machine, enforced in the database as a last line of defence.
create function public.complaints_guard_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and not (
       (old.status in ('open', 'reopened') and new.status = 'in_progress')
    or (old.status = 'in_progress' and new.status = 'awaiting_confirmation')
    or (old.status = 'awaiting_confirmation' and new.status in ('resolved', 'reopened'))
  ) then
    raise exception 'Illegal complaint transition % → %', old.status, new.status using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.complaints_guard_transition() from public, anon, authenticated;
create trigger guard_transition before update on public.complaints
  for each row execute function public.complaints_guard_transition();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.complaints enable row level security;
alter table public.complaint_events enable row level security;
alter table public.complaint_nudges enable row level security;
revoke all on public.complaints, public.complaint_events, public.complaint_nudges from anon, authenticated;
grant select on public.complaints, public.complaint_events, public.complaint_nudges to authenticated;
-- Students may only supply these columns; the trigger fills in routing and status.
grant insert (outlet_id, category, title, body, attachment_paths) on public.complaints to authenticated;
grant select, insert, update on public.complaints, public.complaint_events, public.complaint_nudges
  to service_role;

-- Complainant, the routed handler, the Bhawan's Mess Authority (Warden office, escalations)
-- and ADoSW (cross-Bhawan oversight).
create policy "complainant, handler and oversight read complaints" on public.complaints
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or app.can_handle_complaint(domain, bhawan_id)
    or (bhawan_id is not null and app.has_bhawan_role('mess_authority', bhawan_id))
    or (select app.has_live_role('adosw'))
  );
create policy "students raise complaints" on public.complaints
  for insert to authenticated
  with check (created_by = (select auth.uid()) and (select app.has_role('student')));

create policy "read events of visible complaints" on public.complaint_events
  for select to authenticated
  using (exists (select 1 from public.complaints c where c.id = complaint_id));
create policy "read nudges of visible complaints" on public.complaint_nudges
  for select to authenticated
  using (exists (select 1 from public.complaints c where c.id = complaint_id));
-- Status, nudge and escalation changes: FastAPI only, through the RPCs below.

-- ─── Service-role RPCs (atomic change + audit event) ─────────────────────────
-- Conditional on the expected current status, so two concurrent actions can't both apply.
create function public.complaint_transition(
  p_complaint uuid,
  p_from public.complaint_status,
  p_to public.complaint_status,
  p_actor uuid,
  p_actor_role text,
  p_message text,
  p_attachment text
)
returns setof public.complaints
language plpgsql
set search_path = ''
as $$
declare
  v_row public.complaints;
begin
  update public.complaints
     set status = p_to,
         opened_at = case when p_to = 'reopened' then now() else opened_at end,
         long_standing_at = case when p_to = 'reopened' then null else long_standing_at end,
         escalated_at = case when p_to = 'reopened' then null else escalated_at end,
         resolved_at = case when p_to = 'resolved' then now() else null end
   where id = p_complaint and status = p_from
  returning * into v_row;
  if not found then
    return;
  end if;
  insert into public.complaint_events
    (complaint_id, kind, from_status, to_status, actor_id, actor_role, message, attachment_path)
  values (p_complaint, case when p_from = p_to then 'reply' else 'status' end, p_from, p_to,
          p_actor, p_actor_role, p_message, p_attachment);
  return next v_row;
end;
$$;

-- Nudge: complainant only, unresolved, ≥ nudge_eligible_after_hours since created_at, and
-- ≥ nudge_cooldown_hours since the last nudge — all in one conditional UPDATE (race-safe:
-- a concurrent second nudge re-checks last_nudged_at after the row lock and matches nothing).
create function public.complaint_nudge(p_complaint uuid, p_student uuid)
returns setof public.complaints
language plpgsql
set search_path = ''
as $$
declare
  v_eligible integer;
  v_cooldown integer;
  v_row public.complaints;
begin
  select s.nudge_eligible_after_hours, s.nudge_cooldown_hours into v_eligible, v_cooldown
  from public.app_settings s;
  update public.complaints
     set nudge_count = nudge_count + 1, last_nudged_at = now()
   where id = p_complaint
     and created_by = p_student
     and status <> 'resolved'
     and now() - created_at >= make_interval(hours => v_eligible)
     and (last_nudged_at is null or now() - last_nudged_at >= make_interval(hours => v_cooldown))
  returning * into v_row;
  if not found then
    return;
  end if;
  insert into public.complaint_nudges (complaint_id, nudged_by) values (p_complaint, p_student);
  insert into public.complaint_events (complaint_id, kind, from_status, to_status, actor_id, actor_role)
  values (p_complaint, 'nudged', v_row.status, v_row.status, p_student, 'student');
  return next v_row;
end;
$$;

-- 48 h sweep: marks newly long-standing complaints exactly once (idempotent) and returns them.
create function public.complaint_escalate_due()
returns setof public.complaints
language plpgsql
set search_path = ''
as $$
declare
  v_hours integer;
begin
  select s.long_standing_after_hours into v_hours from public.app_settings s;
  return query
  with due as (
    update public.complaints c
       set long_standing_at = now(), escalated_at = now()
     where c.status in ('open', 'in_progress', 'reopened')
       and c.long_standing_at is null
       and now() - c.opened_at >= make_interval(hours => v_hours)
    returning c.*
  ), logged as (
    insert into public.complaint_events (complaint_id, kind, from_status, to_status, actor_role, message)
    select due.id, 'escalated', due.status, due.status, 'system',
           format('Unresolved for %s h — escalated', v_hours)
    from due
  )
  select * from due;
end;
$$;

revoke execute on function
  public.complaint_transition(uuid, public.complaint_status, public.complaint_status, uuid, text, text, text),
  public.complaint_nudge(uuid, uuid),
  public.complaint_escalate_due()
  from public, anon, authenticated;
grant execute on function
  public.complaint_transition(uuid, public.complaint_status, public.complaint_status, uuid, text, text, text),
  public.complaint_nudge(uuid, uuid),
  public.complaint_escalate_due()
  to service_role;

-- ─── M6.3 public issue board (anonymised) ────────────────────────────────────
-- Security definer because students may not read other students' complaint rows; it exposes
-- no complainant identity or free text body — only what a public notice board would show.
create function public.complaint_board(
  p_bhawan uuid default null,
  p_domain public.complaint_domain default null
)
returns table (
  id uuid,
  outlet_id uuid,
  outlet_name text,
  bhawan_id uuid,
  domain public.complaint_domain,
  category public.complaint_category,
  title text,
  status public.complaint_status,
  created_at timestamptz,
  opened_at timestamptz,
  resolved_at timestamptz,
  nudge_count integer,
  is_long_standing boolean,
  is_escalated boolean,
  is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.outlet_id, o.name, c.bhawan_id, c.domain, c.category, c.title, c.status,
         c.created_at, c.opened_at, c.resolved_at, c.nudge_count,
         c.status in ('open', 'in_progress', 'reopened')
           and now() - c.opened_at >= make_interval(hours => s.long_standing_after_hours),
         c.escalated_at is not null,
         c.created_by = auth.uid()
  from public.complaints c
  join public.outlets o on o.id = c.outlet_id
  cross join public.app_settings s
  where auth.uid() is not null
    and (p_bhawan is null or c.bhawan_id = p_bhawan)
    and (p_domain is null or c.domain = p_domain)
    -- open issues, plus anything resolved in the last 7 days
    and (c.status <> 'resolved' or c.resolved_at > now() - interval '7 days')
  order by 13 desc, c.opened_at asc
  limit 200
$$;
revoke execute on function public.complaint_board(uuid, public.complaint_domain) from public, anon;
grant execute on function public.complaint_board(uuid, public.complaint_domain) to authenticated;

-- ─── Private bucket for complaint photos and handler proof ───────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('complaint-attachments', 'complaint-attachments', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Path convention: {uploader_id}/{yyyy-mm-dd}-{random}.jpg
create policy "users upload own complaint attachments" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'complaint-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
-- Uploader, or anyone who can see a complaint / event citing the file (RLS applies inside).
create policy "parties read complaint attachments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'complaint-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.complaints c where name = any (c.attachment_paths))
      or exists (select 1 from public.complaint_events e where e.attachment_path = name)
    )
  );

-- Realtime: status changes reach the complainant's and handler's screens live.
alter publication supabase_realtime add table public.complaints;
