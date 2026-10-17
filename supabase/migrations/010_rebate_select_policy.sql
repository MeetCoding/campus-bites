-- 010_rebate_select_policy: one permissive SELECT policy instead of two (performance advisor
-- 0006 multiple_permissive_policies). Same access: the applicant, or the Bhawan's Mess Authority.
drop policy "students read own rebates" on public.rebate_applications;
drop policy "mess authority reads bhawan rebates" on public.rebate_applications;
create policy "applicant or bhawan mess authority reads rebates" on public.rebate_applications
  for select to authenticated
  using (student_id = (select auth.uid()) or app.has_bhawan_role('mess_authority', bhawan_id));
