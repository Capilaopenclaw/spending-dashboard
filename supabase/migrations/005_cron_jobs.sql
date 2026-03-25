-- Phase 6: Cron Jobs & Lifecycle Management
-- This migration sets up pg_cron jobs for automated maintenance

-- Enable pg_cron extension (if not already enabled)
create extension if not exists pg_cron;

-- 1. Transaction Sync (every 6 hours)
-- Calls gc-sync-all for all active connections
select cron.schedule(
  'sync-transactions-6h',
  '0 */6 * * *', -- Every 6 hours at :00
  $$
  select
    net.http_post(
      url := current_setting('app.supabase_functions_url') || '/gc-sync-all',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);

-- 2. AI Insights Generation (Monday 07:00 UTC)
-- Generates weekly spending insights for all users
select cron.schedule(
  'generate-insights-weekly',
  '0 7 * * 1', -- Every Monday at 07:00 UTC
  $$
  select
    net.http_post(
      url := current_setting('app.supabase_functions_url') || '/ai-insights',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);

-- 3. Token Refresh (every 12 hours)
-- Refreshes GoCardless access tokens before expiry
select cron.schedule(
  'refresh-gc-tokens-12h',
  '0 */12 * * *', -- Every 12 hours at :00
  $$
  select
    net.http_post(
      url := current_setting('app.supabase_functions_url') || '/gc-refresh-tokens',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);

-- 4. Consent Expiry Check (daily at 08:00 UTC)
-- Notifies users whose bank consent is expiring within 7 days
select cron.schedule(
  'check-consent-expiry-daily',
  '0 8 * * *', -- Every day at 08:00 UTC
  $$
  update bank_connections
  set status = 'expiring_soon'
  where status = 'linked'
    and consent_expires_at is not null
    and consent_expires_at < now() + interval '7 days'
    and consent_expires_at > now();
  $$
);

-- 5. Cleanup Old Sync Logs (weekly Sunday 02:00 UTC)
-- Removes sync logs older than 90 days
select cron.schedule(
  'cleanup-sync-logs-weekly',
  '0 2 * * 0', -- Every Sunday at 02:00 UTC
  $$
  delete from sync_logs
  where created_at < now() - interval '90 days';
  $$
);

-- 6. Health Check (every 30 minutes)
-- Logs system health metrics
select cron.schedule(
  'health-check-30m',
  '*/30 * * * *', -- Every 30 minutes
  $$
  insert into sync_logs (user_id, connection_id, status, sync_type, result)
  values (
    '00000000-0000-0000-0000-000000000000',
    null,
    'success',
    'health_check',
    jsonb_build_object(
      'timestamp', now(),
      'active_connections', (select count(*) from bank_connections where status = 'linked'),
      'total_transactions', (select count(*) from transactions where created_at > now() - interval '24 hours'),
      'pending_transfers', (select count(*) from transfer_pairs where status = 'pending')
    )
  );
  $$
);

-- View all scheduled jobs
comment on extension pg_cron is 'Cron jobs configured: sync-transactions-6h, generate-insights-weekly, refresh-gc-tokens-12h, check-consent-expiry-daily, cleanup-sync-logs-weekly, health-check-30m';
