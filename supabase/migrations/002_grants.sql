-- 002_grants: explicit table privileges (Supabase is making default Data API grants opt-in),
-- defence in depth beneath RLS, and lock down the platform's rls_auto_enable() helper.

-- Signed-out clients get nothing from our tables.
revoke all on public.app_settings, public.bhawans, public.outlets, public.profiles,
  public.role_assignments, public.whitelisted_vendors from anon;

-- Signed-in clients may only read; writes are granted per column/table in later migrations
-- or go through FastAPI (service role).
revoke insert, update, delete, truncate, references, trigger on public.app_settings, public.bhawans,
  public.outlets, public.profiles, public.role_assignments from authenticated;
grant select on public.app_settings, public.bhawans, public.outlets, public.profiles,
  public.role_assignments to authenticated;

-- Whitelist is service-role / auth-hook only.
revoke all on public.whitelisted_vendors from authenticated;

-- Event-trigger function created by the platform; it must not be callable over the Data API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
