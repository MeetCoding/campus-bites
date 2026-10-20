-- Menu photos become a stack: every upload stays published (newest first) until an outlet manager
-- deletes it, instead of a new upload retiring the previous one. Capped per outlet so the public
-- bucket can't grow without bound.

-- ─── Cap (business constant, read by the app) ────────────────────────────────
alter table public.app_settings
  add column max_menu_photos integer not null default 10 check (max_menu_photos between 1 and 50);
comment on column public.app_settings.max_menu_photos is
  'Most published menu / noticeboard photos per outlet. Uploading more needs an old one deleted first.';

-- ─── Stack instead of one current photo ──────────────────────────────────────
drop trigger retire_previous on public.menu_photos;
drop function public.menu_photos_retire_previous();
drop index public.menu_photos_one_current;

-- Photos retired before this migration keep is_current = false and stay hidden; new uploads are
-- always published. The stack is "is_current, newest first".
comment on column public.menu_photos.is_current is
  'Published in the outlet''s photo stack. false only for photos retired before 015_menu_photo_stack.';
-- The stack query uses menu_photos_outlet_created_idx (outlet_id, created_at desc).

create function public.menu_photos_enforce_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cap integer := (select max_menu_photos from public.app_settings);
begin
  -- Serialise uploads per outlet so two at once can't both slip under the cap.
  perform pg_advisory_xact_lock(hashtextextended('menu_photos:' || new.outlet_id::text, 0));
  if new.is_current
     and (select count(*) from public.menu_photos where outlet_id = new.outlet_id and is_current) >= cap then
    raise exception 'MENU_PHOTO_LIMIT'
      using detail = format('At most %s photos per outlet. Delete an old one first.', cap);
  end if;
  return new;
end;
$$;
revoke execute on function public.menu_photos_enforce_cap() from public, anon, authenticated;
create trigger enforce_cap before insert on public.menu_photos
  for each row execute function public.menu_photos_enforce_cap();

-- ─── Delete: outlet managers (live check), table + storage object ────────────
grant delete on public.menu_photos to authenticated;
create policy "outlet managers delete menu photos" on public.menu_photos
  for delete to authenticated using (app.can_manage_outlet(outlet_id));

-- Storage `remove()` needs SELECT and DELETE on the object. The bucket is public, so SELECT here only
-- matters to the Storage API; reads for display still go through the CDN.
create policy "outlet managers read noticeboard objects" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'noticeboard-photos'
    and app.can_manage_outlet(app.try_uuid((storage.foldername(name))[1]))
  );
create policy "outlet managers delete noticeboard photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'noticeboard-photos'
    and app.can_manage_outlet(app.try_uuid((storage.foldername(name))[1]))
  );
