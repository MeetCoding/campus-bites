-- 012_complaint_event_definer: the "created" audit event is written by a trigger that runs as
-- the inserting student, who has no write access to complaint_events (by design). Run it with
-- the owner's rights; it only ever copies values from the row the student just inserted.
alter function public.complaints_log_created() security definer;
