-- 003_auth: sign-up gate, JWT claims, RLS helper functions, Bhawan onboarding.
-- See ARCHITECTURE.md §3.3 (items 3–4) and §5.1.
-- After applying, enable both hooks in Dashboard → Authentication → Hooks:
--   Before User Created  → public.hook_before_user_created
--   Custom Access Token  → public.custom_access_token_hook

-- ─── Sign-up gate (before_user_created hook) ─────────────────────────────────
-- Email identities: Google only, @iitr.ac.in or @<dept>.iitr.ac.in.
-- Phone identities: must be an active row in whitelisted_vendors.
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_email text := lower(nullif(event -> 'user' ->> 'email', ''));
  v_phone text := nullif(event -> 'user' ->> 'phone', '');
  v_provider text := event -> 'user' -> 'app_metadata' ->> 'provider';
begin
  if v_email is not null then
    if v_provider is distinct from 'google' then
      return jsonb_build_object('error', jsonb_build_object(
        'http_code', 403,
        'message', 'Please sign in with your IITR Google account.'));
    end if;
    if v_email !~ '^[^@\s]+@([a-z0-9-]+\.)?iitr\.ac\.in$' then
      return jsonb_build_object('error', jsonb_build_object(
        'http_code', 403,
        'message', 'Only @iitr.ac.in Google accounts can use Campus Bites.'));
    end if;
    return '{}'::jsonb;
  end if;

  if v_phone is not null then
    -- GoTrue sends phones without '+'
    if exists (
      select 1 from public.whitelisted_vendors wv
      where wv.phone_e164 = '+' || ltrim(v_phone, '+') and wv.active
    ) then
      return '{}'::jsonb;
    end if;
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'This number is not registered. Ask the Campus Bites admin to whitelist it.'));
  end if;

  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Sign in with an IITR Google account or a registered vendor phone number.'));
end;
$$;

-- ─── JWT claims (custom_access_token hook) ───────────────────────────────────
-- Adds: app_role (highest), roles[], bhawan_id, scope_bhawan_ids[], outlet_ids[].
create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user_id uuid := (event ->> 'user_id')::uuid;
  v_claims jsonb := event -> 'claims';
  v_email text := nullif(v_claims ->> 'email', '');
  v_phone text := nullif(v_claims ->> 'phone', '');
  v_roles text[] := '{}';
  v_assigned text[];
  v_scope uuid[];
  v_outlets uuid[] := '{}';
  v_home uuid;
  v_app_role text;
begin
  select p.bhawan_id into v_home from public.profiles p where p.id = v_user_id;

  select coalesce(array_agg(distinct ra.role::text), '{}'),
         coalesce(array_agg(distinct ra.bhawan_id) filter (where ra.bhawan_id is not null), '{}')
    into v_assigned, v_scope
    from public.role_assignments ra
   where ra.user_id = v_user_id;

  -- IITR email users are students unless they are institute officials.
  if v_email is not null and not (v_assigned && array['mess_authority', 'adosw']) then
    v_roles := array['student'];
  end if;
  v_roles := v_roles || v_assigned;

  if v_phone is not null then
    select coalesce(array_agg(wv.outlet_id), '{}') into v_outlets
      from public.whitelisted_vendors wv
     where wv.phone_e164 = '+' || ltrim(v_phone, '+') and wv.active;
    if cardinality(v_outlets) > 0 then
      v_roles := v_roles || array['vendor'];
    end if;
  end if;

  select r.role into v_app_role
    from unnest(array['admin', 'adosw', 'mess_authority', 'mess_secretary', 'bhawan_secretary',
                      'vendor', 'student']) with ordinality as r(role, priority)
   where r.role = any(v_roles)
   order by r.priority
   limit 1;

  v_claims := v_claims || jsonb_build_object(
    'app_role', v_app_role,
    'roles', to_jsonb(v_roles),
    'bhawan_id', v_home,
    'scope_bhawan_ids', to_jsonb(v_scope),
    'outlet_ids', to_jsonb(v_outlets)
  );
  return jsonb_build_object('claims', v_claims);
end;
$$;

-- Hooks run as supabase_auth_admin; nobody else may call them.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;

grant select on public.profiles, public.role_assignments, public.whitelisted_vendors
  to supabase_auth_admin;
create policy "auth admin reads profiles" on public.profiles
  for select to supabase_auth_admin using (true);
create policy "auth admin reads role assignments" on public.role_assignments
  for select to supabase_auth_admin using (true);
create policy "auth admin reads whitelist" on public.whitelisted_vendors
  for select to supabase_auth_admin using (true);

-- ─── RLS helpers (private schema `app`, not exposed over the Data API) ───────
create schema if not exists app;
grant usage on schema app to authenticated, service_role;

create function app.jwt_text_array(claim text)
returns text[]
language sql
stable
set search_path = ''
as $$
  select case
    when jsonb_typeof(auth.jwt() -> claim) = 'array'
      then array(select jsonb_array_elements_text(auth.jwt() -> claim))
    else '{}'::text[]
  end
$$;

create function app.has_role(role public.app_role)
returns boolean
language sql
stable
set search_path = ''
as $$
  select role::text = any(app.jwt_text_array('roles'))
$$;

create function app.scope_bhawan_ids()
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select app.jwt_text_array('scope_bhawan_ids')::uuid[]
$$;

create function app.outlet_ids()
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select app.jwt_text_array('outlet_ids')::uuid[]
$$;

create function app.home_bhawan_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'bhawan_id', '')::uuid
$$;

-- ─── Student onboarding: choose own Bhawan exactly once ──────────────────────
grant update (bhawan_id) on public.profiles to authenticated;

create policy "students set own bhawan" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select app.has_role('student')))
  with check (id = (select auth.uid()));

create function public.profiles_guard_bhawan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.bhawan_id is distinct from old.bhawan_id then
    -- Clients may set it once; changing it later is an admin (service role) action.
    if old.bhawan_id is not null and current_user = 'authenticated' then
      raise exception 'Bhawan is already set; ask an admin to change it'
        using errcode = '42501';
    end if;
    if old.bhawan_id is null and new.onboarded_at is null then
      new.onboarded_at := now();
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.profiles_guard_bhawan() from public, anon, authenticated;

create trigger guard_bhawan before update on public.profiles
  for each row execute function public.profiles_guard_bhawan();
