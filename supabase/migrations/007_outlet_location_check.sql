-- 007_outlet_location_check: location_tag became client-writable in 005 (outlet managers);
-- bound it like every other free-text column.
alter table public.outlets
  add constraint outlets_location_tag_length
  check (location_tag is null or char_length(btrim(location_tag)) between 1 and 60);
