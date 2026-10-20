-- Map pins for outlets (eateries in the app today): the student map, home-screen map and
-- "Directions". Set by the admin (FastAPI, eatery master data) or by the outlet's own vendor
-- (direct write under the existing "outlet managers update their outlet" policy).

alter table public.outlets
  add column latitude double precision,
  add column longitude double precision,
  add constraint outlets_pin_complete check ((latitude is null) = (longitude is null)),
  add constraint outlets_pin_range check (
    latitude is null or (latitude between -90 and 90 and longitude between -180 and 180)
  );
comment on column public.outlets.latitude is 'Map pin (WGS84). Set together with longitude, or both null.';

-- Column grant: the same people who can set location_tag (app.can_run_outlet, live) can move the pin.
grant update (latitude, longitude) on public.outlets to authenticated;

-- Expose the pin with the live status the map colours by. New columns go at the end so
-- `create or replace` keeps the view's existing column order.
create or replace view public.outlet_live_status with (security_invoker = true) as
  select o.id as outlet_id, o.type, o.bhawan_id, o.name, o.location_tag, s.*, o.latitude, o.longitude
  from public.outlets o
  cross join lateral public.outlet_status_at(o.id, now()) s
  where o.type <> 'mess';
