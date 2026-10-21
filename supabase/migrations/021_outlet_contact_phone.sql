-- Public contact number for an outlet (e.g. an eatery worker students can call). Not a login:
-- vendor sign-in stays whitelisted_vendors + passcode. Set by admins (API) or the outlet's own
-- vendor / Bhawan Secretary (column grant under the existing app.can_run_outlet policy).
alter table public.outlets
  add column contact_phone text check (contact_phone ~ '^\+[1-9][0-9]{7,14}$');
comment on column public.outlets.contact_phone is
  'Public contact number shown to students (E.164); null = none. Not used for sign-in.';

grant update (contact_phone) on public.outlets to authenticated;

-- `create or replace` keeps the view's existing column order; the new column goes last.
create or replace view public.outlet_live_status with (security_invoker = true) as
  select o.id as outlet_id, o.type, o.bhawan_id, o.name, o.location_tag, s.*, o.latitude, o.longitude,
         o.contact_phone
  from public.outlets o
  cross join lateral public.outlet_status_at(o.id, now()) s
  where o.type <> 'mess';
