-- Master vendors (one phone that runs every mess, canteen and eatery, including outlets added
-- later), vendors managing messes, and deleting a vendor outright. See ARCHITECTURE.md §4.1.

-- ─── A vendor whitelisted for a mess manages that mess ───────────────────────
-- Same publishing tools as its Mess Secretary: noticeboard photos (can_manage_outlet), weekly
-- menu and extra items (can_manage_mess). Timing overrides (they push every resident) and mess
-- complaints stay with the Mess Secretary; open/closed toggles still exclude messes
-- (app.can_run_outlet).
create or replace function app.can_manage_outlet(p_outlet uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.outlets o
    where o.id = p_outlet
      and (
        (o.type = 'mess' and exists (
          select 1 from public.role_assignments ra
          where ra.user_id = auth.uid() and ra.role = 'mess_secretary' and ra.bhawan_id = o.bhawan_id))
        or (o.type in ('day_canteen', 'night_canteen') and exists (
          select 1 from public.role_assignments ra
          where ra.user_id = auth.uid() and ra.role = 'bhawan_secretary' and ra.bhawan_id = o.bhawan_id))
        or exists (
          select 1 from public.whitelisted_vendors wv
          join public.profiles p on p.phone = wv.phone_e164
          where p.id = auth.uid() and wv.outlet_id = o.id and wv.active)
      )
  )
$$;

-- Weekly menu / extra items are keyed by Bhawan: its Mess Secretary or its mess's vendor.
create function app.can_manage_mess(p_bhawan uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_bhawan_role('mess_secretary', p_bhawan)
      or exists (
        select 1 from public.outlets o
        where o.bhawan_id = p_bhawan and o.type = 'mess' and app.can_manage_outlet(o.id))
$$;
revoke execute on function app.can_manage_mess(uuid) from public, anon;
grant execute on function app.can_manage_mess(uuid) to authenticated, service_role;

drop policy "mess secretary inserts weekly menu" on public.weekly_menus;
drop policy "mess secretary updates weekly menu" on public.weekly_menus;
drop policy "mess secretary deletes weekly menu" on public.weekly_menus;
drop policy "mess secretary inserts extra items" on public.extra_items;
drop policy "mess secretary updates extra items" on public.extra_items;
drop policy "mess secretary deletes extra items" on public.extra_items;

create policy "mess managers insert weekly menu" on public.weekly_menus
  for insert to authenticated with check (app.can_manage_mess(bhawan_id));
create policy "mess managers update weekly menu" on public.weekly_menus
  for update to authenticated
  using (app.can_manage_mess(bhawan_id))
  with check (app.can_manage_mess(bhawan_id));
create policy "mess managers delete weekly menu" on public.weekly_menus
  for delete to authenticated using (app.can_manage_mess(bhawan_id));

create policy "mess managers insert extra items" on public.extra_items
  for insert to authenticated with check (app.can_manage_mess(bhawan_id));
create policy "mess managers update extra items" on public.extra_items
  for update to authenticated
  using (app.can_manage_mess(bhawan_id))
  with check (app.can_manage_mess(bhawan_id));
create policy "mess managers delete extra items" on public.extra_items
  for delete to authenticated using (app.can_manage_mess(bhawan_id));

-- ─── Master vendors ──────────────────────────────────────────────────────────
create table public.master_vendors (
  phone_e164 text primary key check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  label text,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.master_vendors is
  'Phones whitelisted for every outlet, now and later (outlets trigger). API (service role) only.';
create index master_vendors_added_by_idx on public.master_vendors (added_by);
alter table public.master_vendors enable row level security;
revoke all on public.master_vendors from anon, authenticated;

-- Every new outlet (a new eatery, or a new Bhawan's mess + canteens) goes to every master vendor.
create function public.outlets_assign_master_vendors()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.whitelisted_vendors (phone_e164, outlet_id, label, added_by)
  select mv.phone_e164, new.id, mv.label, mv.added_by from public.master_vendors mv
  on conflict (phone_e164, outlet_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.outlets_assign_master_vendors() from public, anon, authenticated;

create trigger assign_master_vendors after insert on public.outlets
  for each row execute function public.outlets_assign_master_vendors();

-- Makes a phone a master vendor and whitelists it for every existing outlet (idempotent).
create function public.admin_make_master_vendor(p_phone text, p_label text, p_added_by uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_added integer;
begin
  insert into public.master_vendors (phone_e164, label, added_by)
  values (p_phone, p_label, p_added_by)
  on conflict (phone_e164) do update set label = coalesce(excluded.label, public.master_vendors.label);

  insert into public.whitelisted_vendors (phone_e164, outlet_id, label, added_by)
  select p_phone, o.id, p_label, p_added_by from public.outlets o
  on conflict (phone_e164, outlet_id) do update set active = true;
  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

-- Removes a vendor entirely: master status and every outlet link. Returns the vendor's auth
-- user id (if they ever had an account) so the API can delete the sign-in account too.
create function public.admin_delete_vendor(p_phone text)
returns table (removed_links integer, user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_links integer;
begin
  delete from public.master_vendors where phone_e164 = p_phone;
  delete from public.whitelisted_vendors where phone_e164 = p_phone;
  get diagnostics v_links = row_count;
  return query
    select v_links, (select u.id from auth.users u where u.phone = ltrim(p_phone, '+'));
end;
$$;

-- Vendor accounts now say whether the phone is a master vendor.
drop function public.admin_vendor_accounts();
create function public.admin_vendor_accounts()
returns table (
  phone_e164 text,
  user_id uuid,
  passcode_set_at timestamptz,
  last_sign_in_at timestamptz,
  is_master boolean
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
         u.last_sign_in_at,
         exists (select 1 from public.master_vendors mv where mv.phone_e164 = wv.phone_e164)
    from public.whitelisted_vendors wv
    left join auth.users u on u.phone = ltrim(wv.phone_e164, '+')
   order by wv.phone_e164
$$;

revoke execute on function public.admin_make_master_vendor(text, text, uuid),
  public.admin_delete_vendor(text), public.admin_vendor_accounts() from public, anon, authenticated;
grant execute on function public.admin_make_master_vendor(text, text, uuid),
  public.admin_delete_vendor(text), public.admin_vendor_accounts() to service_role;
