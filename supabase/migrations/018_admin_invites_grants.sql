-- 017 left Supabase's default Data API grants on admin_invites; it is API (service role) only.
revoke all on public.admin_invites from anon, authenticated;
