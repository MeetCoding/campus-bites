-- 013_escalation_cron: every 15 min, pg_cron → pg_net → FastAPI POST /internal/escalations/run
-- (TASKS M6.7). The API URL and shared secret live in Supabase Vault, never in this file:
--   api_base_url          e.g. https://campus-bites-0dim.onrender.com
--   internal_cron_secret  must equal the API's INTERNAL_CRON_SECRET env var
-- Until both exist the job is a no-op. Results: cron.job_run_details (job ran) and
-- net._http_response (API status code).

create function app.run_escalation_sweep()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_secret text;
begin
  select ds.decrypted_secret into v_base from vault.decrypted_secrets ds where ds.name = 'api_base_url';
  select ds.decrypted_secret into v_secret from vault.decrypted_secrets ds where ds.name = 'internal_cron_secret';
  if v_base is null or v_secret is null then
    raise notice 'escalation sweep skipped: Vault secrets api_base_url / internal_cron_secret missing';
    return null;
  end if;
  -- 30 s timeout: Render's free tier can take ~40 s to wake; the next run (15 min) retries,
  -- and the sweep is idempotent.
  return net.http_post(
    url := rtrim(v_base, '/') || '/internal/escalations/run',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Internal-Secret', v_secret),
    timeout_milliseconds := 30000
  );
end;
$$;
revoke execute on function app.run_escalation_sweep() from public, anon, authenticated;

select cron.schedule('escalation-sweep', '*/15 * * * *', 'select app.run_escalation_sweep()');
