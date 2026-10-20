-- Admin web console (apps/web): admins listed by email before they ever sign in, a protected
-- owner admin, and vendor passcodes (Supabase phone + password) instead of SMS test numbers.

-- ─── Owner admin (can't be removed by anyone) ────────────────────────────────
alter table public.app_settings
  add column owner_admin_email text check (owner_admin_email = lower(owner_admin_email));
comment on column public.app_settings.owner_admin_email is
  'The platform owner. Always an admin: the API refuses to revoke this account''s admin role.';
update public.app_settings set owner_admin_email = 'meet_s@ece.iitr.ac.in';

-- ─── Admin invites (email listed before the person's first sign-in) ──────────
create table public.admin_invites (
  email text primary key
    check (email = lower(email) and email ~ '^[^@\s]+@([a-z0-9-]+\.)?iitr\.ac\.in$'),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.admin_invites is
  'IITR emails made admin on first sign-in (handle_new_user). API (service role) only.';
create index admin_invites_invited_by_idx on public.admin_invites (invited_by);

-- API-only: RLS on, no grants or policies for clients.
alter table public.admin_invites enable row level security;

-- New users: create the profile, then redeem a pending admin invite for their email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := nullif(lower(new.email), '');
begin
  insert into public.profiles (id, email, phone, full_name, avatar_url)
  values (
    new.id,
    v_email,
    -- GoTrue stores phones without '+'; keep E.164 in our tables
    case when coalesce(new.phone, '') = '' then null else '+' || ltrim(new.phone, '+') end,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  if v_email is not null then
    with redeemed as (
      delete from public.admin_invites where email = v_email returning invited_by
    )
    insert into public.role_assignments (user_id, role, assigned_by)
    select new.id, 'admin', invited_by from redeemed;
  end if;
  return new;
end;
$$;

-- Bootstrap the owner: admin now if they have signed in, otherwise on first sign-in.
do $$
declare
  v_owner text := (select owner_admin_email from public.app_settings);
  v_id uuid := (select id from public.profiles where email = v_owner);
begin
  if v_id is null then
    insert into public.admin_invites (email) values (v_owner) on conflict do nothing;
  else
    insert into public.role_assignments (user_id, role) values (v_id, 'admin')
    on conflict do nothing;
  end if;
end $$;

-- ─── Vendor sign-in accounts (phone + passcode) ──────────────────────────────
-- One row per whitelisted phone: its auth account (if any), when the admin last set a passcode
-- (app_metadata.passcode_set_at, written by the API) and the last sign-in. Service role only.
create function public.admin_vendor_accounts()
returns table (
  phone_e164 text,
  user_id uuid,
  passcode_set_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (wv.phone_e164)
         wv.phone_e164,
         u.id,
         (u.raw_app_meta_data ->> 'passcode_set_at')::timestamptz,
         u.last_sign_in_at
    from public.whitelisted_vendors wv
    left join auth.users u on u.phone = ltrim(wv.phone_e164, '+')
   order by wv.phone_e164
$$;

revoke execute on function public.admin_vendor_accounts() from public, anon, authenticated;
grant execute on function public.admin_vendor_accounts() to service_role;
