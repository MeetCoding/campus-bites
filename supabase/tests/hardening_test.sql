-- Database-wide hardening checks (TASKS M6.12). Read-only; run any time.
-- Success ends with "ALL HARDENING CHECKS PASSED".

do $$
declare
  bad text;
begin
  -- 1. RLS is enabled on every table in public.
  select string_agg(c.relname, ', ') into bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  assert bad is null, 'RLS disabled on: ' || bad;

  -- 2. Signed-out clients (anon) have no privilege on any public table or view.
  select string_agg(distinct table_name, ', ') into bad
  from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public';
  assert bad is null, 'anon has privileges on: ' || bad;

  -- 3. API-only tables: signed-in clients can't write them at all.
  select string_agg(table_name || ':' || privilege_type, ', ') into bad
  from information_schema.role_table_grants
  where grantee = 'authenticated' and table_schema = 'public'
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    and table_name in ('app_settings', 'whitelisted_vendors', 'role_assignments', 'timing_overrides',
                       'rebate_applications', 'rebate_events', 'complaint_events', 'complaint_nudges',
                       'meal_timings', 'bhawans');
  assert bad is null, 'authenticated can write API-only tables: ' || bad;

  -- 4. Complaints: insert only the five student columns; status etc. never client-writable.
  select string_agg(column_name || ':' || privilege_type, ', ') into bad
  from information_schema.column_privileges
  where grantee = 'authenticated' and table_schema = 'public' and table_name = 'complaints'
    and privilege_type in ('INSERT', 'UPDATE')
    and not (privilege_type = 'INSERT'
             and column_name in ('outlet_id', 'category', 'title', 'body', 'attachment_paths'));
  assert bad is null, 'unexpected complaint column grants: ' || bad;

  -- 5. Every foreign key's leading column is indexed (joins, cascades, RLS subqueries).
  select string_agg(format('%s.%s', c.conrelid::regclass, a.attname), ', ') into bad
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  join pg_namespace n on n.oid = (select relnamespace from pg_class where oid = c.conrelid)
  where c.contype = 'f' and n.nspname = 'public'
    and not exists (
      select 1 from pg_index i
      where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
    )
    and not exists ( -- GiST exclusion constraint on rebate_applications(student_id, …)
      select 1 from pg_constraint x
      where x.conrelid = c.conrelid and x.contype = 'x' and x.conkey[1] = c.conkey[1]
    );
  assert bad is null, 'unindexed foreign keys: ' || bad;

  -- 6. Every SECURITY DEFINER function pins search_path.
  select string_agg(p.oid::regprocedure::text, ', ') into bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%');
  assert bad is null, 'definer functions without search_path: ' || bad;

  -- 7. Service-role-only RPCs are not callable by clients.
  assert not has_function_privilege('authenticated', 'public.complaint_nudge(uuid, uuid)', 'execute'), 'nudge RPC exposed';
  assert not has_function_privilege('authenticated', 'public.complaint_escalate_due()', 'execute'), 'sweep RPC exposed';
  assert not has_function_privilege('authenticated',
    'public.complaint_transition(uuid, public.complaint_status, public.complaint_status, uuid, text, text, text)',
    'execute'), 'transition RPC exposed';
  assert not has_function_privilege('anon', 'public.complaint_board(uuid, public.complaint_domain)', 'execute'), 'board exposed to anon';
  assert not has_function_privilege('authenticated', 'app.run_escalation_sweep()', 'execute'), 'cron caller exposed';

  -- 8. Private buckets stay private.
  assert (select count(*) from storage.buckets
          where id in ('rebate-documents', 'complaint-attachments') and not public) = 2, 'private buckets';

  -- 9. The escalation job is scheduled.
  assert exists (select 1 from cron.job where jobname = 'escalation-sweep' and schedule = '*/15 * * * *'), 'cron job';
end $$;

select 'ALL HARDENING CHECKS PASSED' as result;
