-- 001_init: extensions, enums, business constants, core tables, RLS, profile trigger.
-- See ARCHITECTURE.md §3.3 (security), §4 (data model), §8.1 (constants).

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists moddatetime with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ─── Enums ───────────────────────────────────────────────────────────────────
create type public.app_role as enum (
  'student', 'mess_secretary', 'bhawan_secretary', 'mess_authority', 'adosw', 'vendor', 'admin'
);
create type public.outlet_type as enum ('mess', 'day_canteen', 'night_canteen', 'eatery');
create type public.complaint_domain as enum ('mess', 'hostel_canteen', 'campus_eatery');
create type public.complaint_category as enum (
  'hygiene', 'seating', 'lighting', 'food_quality', 'overcharging', 'other'
);
create type public.complaint_status as enum (
  'open', 'in_progress', 'awaiting_confirmation', 'resolved', 'reopened'
);
create type public.rebate_status as enum (
  'pending_verification', 'biometric_cross_checked', 'approved', 'rejected'
);
create type public.meal_slot as enum ('breakfast', 'lunch', 'dinner');
create type public.day_type as enum ('weekday', 'weekend_holiday');

-- ─── app_settings (single row of business constants) ─────────────────────────
create table public.app_settings (
  id boolean primary key default true check (id),
  min_rebate_days integer not null default 3 check (min_rebate_days >= 1),
  long_standing_after_hours integer not null default 48 check (long_standing_after_hours > 0),
  nudge_eligible_after_hours integer not null default 168 check (nudge_eligible_after_hours > 0),
  nudge_cooldown_hours integer not null default 24 check (nudge_cooldown_hours > 0),
  updated_at timestamptz not null default now()
);
comment on table public.app_settings is
  'Single-row business constants. Writes via migration/service role only.';
comment on column public.app_settings.nudge_eligible_after_hours is
  'Complaint must be unresolved this many hours after created_at before the complainant can nudge (168 h = 7 days).';

insert into public.app_settings (id) values (true);

-- ─── bhawans ─────────────────────────────────────────────────────────────────
create table public.bhawans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── outlets (messes, hostel canteens, campus eateries) ──────────────────────
create table public.outlets (
  id uuid primary key default gen_random_uuid(),
  type public.outlet_type not null,
  bhawan_id uuid references public.bhawans (id) on delete restrict,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  location_tag text,
  is_open boolean not null default false,
  status_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- eateries are campus-wide; every other outlet belongs to a Bhawan
  constraint outlets_bhawan_matches_type check ((type = 'eatery') = (bhawan_id is null))
);
-- one mess / day canteen / night canteen per Bhawan
create unique index outlets_bhawan_type_key on public.outlets (bhawan_id, type) where bhawan_id is not null;
create index outlets_bhawan_id_idx on public.outlets (bhawan_id);

-- ─── profiles (1:1 with auth.users) ──────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  phone text,
  full_name text,
  avatar_url text,
  bhawan_id uuid references public.bhawans (id) on delete set null,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_bhawan_id_idx on public.profiles (bhawan_id);

-- ─── role_assignments (staff/authority roles; students & vendors are implicit) ─
create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null check (role not in ('student', 'vendor')),
  bhawan_id uuid references public.bhawans (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint role_assignments_scope check (
    (role in ('mess_secretary', 'bhawan_secretary', 'mess_authority')) = (bhawan_id is not null)
  ),
  constraint role_assignments_unique unique nulls not distinct (user_id, role, bhawan_id)
);
-- exactly one mess secretary per Bhawan
create unique index role_assignments_one_mess_secy on public.role_assignments (bhawan_id)
  where role = 'mess_secretary';
create index role_assignments_bhawan_id_idx on public.role_assignments (bhawan_id);
create index role_assignments_assigned_by_idx on public.role_assignments (assigned_by);

-- ─── whitelisted_vendors (phone ↔ outlet; one phone may own many outlets) ────
create table public.whitelisted_vendors (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  outlet_id uuid not null references public.outlets (id) on delete cascade,
  label text,
  active boolean not null default true,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whitelisted_vendors_phone_outlet_key unique (phone_e164, outlet_id)
);
create index whitelisted_vendors_outlet_id_idx on public.whitelisted_vendors (outlet_id);
create index whitelisted_vendors_added_by_idx on public.whitelisted_vendors (added_by);

-- ─── updated_at triggers ─────────────────────────────────────────────────────
create trigger set_updated_at before update on public.app_settings
  for each row execute function extensions.moddatetime (updated_at);
create trigger set_updated_at before update on public.bhawans
  for each row execute function extensions.moddatetime (updated_at);
create trigger set_updated_at before update on public.outlets
  for each row execute function extensions.moddatetime (updated_at);
create trigger set_updated_at before update on public.profiles
  for each row execute function extensions.moddatetime (updated_at);
create trigger set_updated_at before update on public.whitelisted_vendors
  for each row execute function extensions.moddatetime (updated_at);

-- ─── Row Level Security (deny by default) ────────────────────────────────────
alter table public.app_settings enable row level security;
alter table public.bhawans enable row level security;
alter table public.outlets enable row level security;
alter table public.profiles enable row level security;
alter table public.role_assignments enable row level security;
alter table public.whitelisted_vendors enable row level security;

create policy "authenticated can read settings" on public.app_settings
  for select to authenticated using (true);

create policy "authenticated can read bhawans" on public.bhawans
  for select to authenticated using (true);

create policy "authenticated can read outlets" on public.outlets
  for select to authenticated using (true);

create policy "users read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "users read own role assignments" on public.role_assignments
  for select to authenticated using (user_id = (select auth.uid()));

-- whitelisted_vendors: no client policies (service role / auth hooks only).

-- ─── auth.users → profiles ───────────────────────────────────────────────────
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, phone, full_name, avatar_url)
  values (
    new.id,
    nullif(lower(new.email), ''),
    -- GoTrue stores phones without '+'; keep E.164 in our tables
    case when coalesce(new.phone, '') = '' then null else '+' || ltrim(new.phone, '+') end,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
