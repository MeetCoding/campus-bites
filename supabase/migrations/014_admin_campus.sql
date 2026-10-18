-- Admin management of the campus master list (PRD §2 System Admin: "manage master list of
-- hostels and campus eateries"). Bhawans need their three outlets created / renamed / removed
-- together, so those go through service-role-only RPCs called by FastAPI. Eateries are single
-- rows and are written by the API's service client directly.

-- Creates the Bhawan and its Mess, Day Canteen and Night Canteen, named like the seed
-- ("<Bhawan> Mess" / "Day Canteen" / "Night Canteen"). Default shifts come from the
-- outlets_default_shift trigger; meal timings fall back to the institute defaults.
create function public.admin_create_bhawan(p_name text, p_slug text, p_sort_order integer default null)
returns setof public.bhawans
language plpgsql
set search_path = ''
as $$
declare
  b public.bhawans;
begin
  insert into public.bhawans (name, slug, sort_order)
  values (p_name, p_slug,
          coalesce(p_sort_order, (select coalesce(max(sort_order), 0) + 1 from public.bhawans)))
  returning * into b;

  insert into public.outlets (type, bhawan_id, name, slug)
  select t.type, b.id, b.name || ' ' || case t.type when 'mess' then 'Mess' when 'day_canteen' then 'Day Canteen' else 'Night Canteen' end, b.slug || '-' || t.suffix
  from (values ('mess'::public.outlet_type, 'mess'),
               ('day_canteen'::public.outlet_type, 'day-canteen'),
               ('night_canteen'::public.outlet_type, 'night-canteen')) as t (type, suffix);

  return next b;
end;
$$;

-- Renames (and/or reorders) a Bhawan; its outlets are renamed to match. Slugs stay stable.
create function public.admin_update_bhawan(p_id uuid, p_name text default null, p_sort_order integer default null)
returns setof public.bhawans
language plpgsql
set search_path = ''
as $$
declare
  b public.bhawans;
begin
  update public.bhawans
     set name = coalesce(p_name, name),
         sort_order = coalesce(p_sort_order, sort_order)
   where id = p_id
  returning * into b;
  if not found then
    return;
  end if;

  update public.outlets
     set name = b.name || ' ' || case type when 'mess' then 'Mess' when 'day_canteen' then 'Day Canteen' else 'Night Canteen' end
   where bhawan_id = p_id;

  return next b;
end;
$$;

-- Removes a Bhawan created by mistake. Refused (foreign_key_violation) once anyone lives there or
-- it has rebate / complaint history; menus, rate cards, shifts and role assignments cascade.
create function public.admin_delete_bhawan(p_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where bhawan_id = p_id) then
    raise exception 'bhawan has residents' using errcode = 'foreign_key_violation';
  end if;
  delete from public.outlets where bhawan_id = p_id;
  delete from public.bhawans where id = p_id;
  return found;
end;
$$;

revoke execute on function public.admin_create_bhawan(text, text, integer) from public, anon, authenticated;
revoke execute on function public.admin_update_bhawan(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.admin_delete_bhawan(uuid) from public, anon, authenticated;
grant execute on function public.admin_create_bhawan(text, text, integer) to service_role;
grant execute on function public.admin_update_bhawan(uuid, text, integer) to service_role;
grant execute on function public.admin_delete_bhawan(uuid) to service_role;

