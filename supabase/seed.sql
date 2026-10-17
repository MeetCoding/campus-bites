-- Official V1 roster (ARCHITECTURE.md §4.1). Idempotent: safe to re-run.

-- 11 Bhawans
insert into public.bhawans (name, slug, sort_order) values
  ('Rajendra Bhawan',     'rajendra',     1),
  ('Radhakrishna Bhawan', 'radhakrishna', 2),
  ('Ganga Bhawan',        'ganga',        3),
  ('Cautley Bhawan',      'cautley',      4),
  ('Rajiv Bhawan',        'rajiv',        5),
  ('Himalaya Bhawan',     'himalaya',     6),
  ('Vivekananda Bhawan',  'vivekananda',  7),
  ('Govind Bhawan',       'govind',       8),
  ('Vigyan Bhawan',       'vigyan',       9),
  ('Sarojini Bhawan',     'sarojini',     10),
  ('Jawahar Bhawan',      'jawahar',      11)
on conflict (slug) do nothing;

-- Mess + Day Canteen + Night Canteen per Bhawan (33 outlets)
insert into public.outlets (type, bhawan_id, name, slug)
select t.type, b.id, b.name || ' ' || t.label, b.slug || '-' || t.suffix
from public.bhawans b
cross join (values
  ('mess'::public.outlet_type,          'Mess',          'mess'),
  ('day_canteen'::public.outlet_type,   'Day Canteen',   'day-canteen'),
  ('night_canteen'::public.outlet_type, 'Night Canteen', 'night-canteen')
) as t (type, label, suffix)
on conflict (slug) do nothing;

-- 4 campus eateries
insert into public.outlets (type, bhawan_id, name, slug) values
  ('eatery', null, 'CBRI Canteen',    'cbri-canteen'),
  ('eatery', null, 'Cafe Coffee Day', 'cafe-coffee-day'),
  ('eatery', null, 'Amul',            'amul'),
  ('eatery', null, 'Yippe Kiosk',     'yippe-kiosk')
on conflict (slug) do nothing;

-- V1 shared owner: one phone whitelisted for every canteen and eatery (26 rows)
insert into public.whitelisted_vendors (phone_e164, outlet_id, label)
select '+919510709195', o.id, 'V1 shared campus owner'
from public.outlets o
where o.type in ('day_canteen', 'night_canteen', 'eatery')
on conflict (phone_e164, outlet_id) do nothing;
