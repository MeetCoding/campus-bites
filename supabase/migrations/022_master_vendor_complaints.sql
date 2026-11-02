-- 022_master_vendor_complaints: a master vendor (phone in public.master_vendors) can handle
-- every complaint — mess, hostel canteen and campus eatery — alongside the routed secretary /
-- ADoSW. Adds the live check, the handler rule, and an `is_master_vendor` JWT claim (UI only).

-- Live check: is the signed-in user's phone a master vendor? (security definer: master_vendors
-- is API-only, authenticated has no grants on it.)
create function app.is_master_vendor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.master_vendors mv
    join public.profiles p on p.phone = mv.phone_e164
    where p.id = auth.uid()
  )
$$;
revoke execute on function app.is_master_vendor() from public, anon;
grant execute on function app.is_master_vendor() to authenticated, service_role;

-- Routing stays (mess → Mess Secretary, hostel canteen → Bhawan Secretary, eatery → ADoSW);
-- master vendors are handlers for every domain on top of that.
create or replace function app.can_handle_complaint(p_domain public.complaint_domain, p_bhawan uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app.is_master_vendor()
    or case p_domain
      when 'mess' then app.has_bhawan_role('mess_secretary', p_bhawan)
      when 'hostel_canteen' then app.has_bhawan_role('bhawan_secretary', p_bhawan)
      else app.has_live_role('adosw')
    end
$$;

-- The token hook runs as supabase_auth_admin and now reads master_vendors.
grant select on public.master_vendors to supabase_auth_admin;
create policy "auth admin reads master vendors" on public.master_vendors
  for select to supabase_auth_admin using (true);

-- JWT gains `is_master_vendor` so the app can show the complaint queue.
create or replace function public.custom_access_token_hook(event jsonb)
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
  v_master boolean := false;
  v_home uuid;
  v_onboarded boolean;
  v_app_role text;
begin
  select p.bhawan_id, p.onboarded_at is not null into v_home, v_onboarded
    from public.profiles p where p.id = v_user_id;

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
    select exists (
      select 1 from public.master_vendors mv where mv.phone_e164 = '+' || ltrim(v_phone, '+')
    ) into v_master;
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
    'onboarded', coalesce(v_onboarded, false),
    'scope_bhawan_ids', to_jsonb(v_scope),
    'outlet_ids', to_jsonb(v_outlets),
    'is_master_vendor', v_master
  );
  return jsonb_build_object('claims', v_claims);
end;
$$;
