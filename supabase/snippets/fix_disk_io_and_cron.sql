-- ============================================================================
-- Diagnostic & Fix Script: Disk IO Exhaustion & pg_cron Schedule Optimization
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. INSPECT ACTIVE CRON JOBS
-- Run this block to see all scheduled cron jobs and their frequencies
-- ---------------------------------------------------------------------------
select 
  jobid,
  jobname,
  schedule,
  active,
  command
from cron.job;

-- ---------------------------------------------------------------------------
-- 2. INSPECT RECENT CRON RUNS (Identify high-frequency jobs)
-- ---------------------------------------------------------------------------
select 
  jobid,
  runid,
  status,
  return_message,
  start_time,
  end_time
from cron.job_run_details
order by start_time desc
limit 25;

-- ---------------------------------------------------------------------------
-- 3. FIX / OPTIMIZE CRON JOBS
-- Change any aggressive cron job (e.g., '* * * * *' every minute) to run once every hour or disable it
-- ---------------------------------------------------------------------------

-- Option A: If you want to change ALL active cron jobs to run once every hour:
-- (Runs at minute 0 of every hour)
do $$
declare
  r record;
begin
  for r in (select jobid, jobname, schedule from cron.job where active = true) loop
    -- Update schedule to once every hour (0 * * * *)
    perform cron.alter_job(
      job_id := r.jobid,
      schedule := '0 * * * *'
    );
    raise notice 'Updated job % (%) to 1-hour schedule (0 * * * *)', r.jobid, r.jobname;
  end loop;
end $$;

-- Option B: If you want to deactivate/pause a specific job:
-- select cron.alter_job(job_id := <JOB_ID>, active := false);

-- Option C: If you want to completely remove/unschedule a job:
-- select cron.unschedule(<JOB_ID>);
-- or by jobname:
-- select cron.unschedule('<JOB_NAME>');

-- ---------------------------------------------------------------------------
-- 4. CLEANUP CRON LOGS & PG_NET LOGS (MAJOR DISK IO CULPRITS)
-- pg_cron and pg_net continuously write execution logs to disk on every single run.
-- Truncating or pruning old logs dramatically saves disk IO operations.
-- ---------------------------------------------------------------------------

-- Purge pg_cron run details older than 2 days (or truncate for immediate recovery)
delete from cron.job_run_details where start_time < now() - interval '2 days';
vacuum (analyze) cron.job_run_details;

-- Purge pg_net HTTP response logs if extension is enabled
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'net') then
    if exists (select 1 from information_schema.tables where table_schema = 'net' and table_name = '_http_response') then
      delete from net._http_response where created < now() - interval '2 days';
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. VERIFY AUTOMATION QUEUE TRIGGER DESIGN
-- The queue-worker is event-driven by trigger on insert into automation_queue.
-- Having an aggressive 1-minute polling cron is unnecessary because pg_net invokes
-- the worker immediately when tasks are created.
-- ---------------------------------------------------------------------------
select 
  status, 
  count(*) 
from public.automation_queue 
group by status;
