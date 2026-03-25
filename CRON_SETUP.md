# Cron Setup Instructions

## ⚠️ Important: Manual Setup Required

Supabase's managed PostgreSQL does **not** support `pg_cron` extension on the Hobby/Free plan. Cron jobs must be configured via **Supabase Dashboard** or using **external cron services** (Vercel Cron, GitHub Actions, etc.).

## Option 1: Supabase Dashboard (Recommended for Production)

1. Navigate to: https://supabase.com/dashboard/project/tduwpkyufgiumgbtyime/database/cron-jobs
2. Enable Cron Jobs (if available on your plan)
3. Manually create the following jobs:

### Job 1: Transaction Sync (every 6 hours)
- **Schedule:** `0 */6 * * *`
- **Function:** HTTP Request
- **URL:** `https://tduwpkyufgiumgbtyime.supabase.co/functions/v1/gc-sync-all`
- **Method:** POST
- **Headers:** `Authorization: Bearer <SERVICE_ROLE_KEY>`
- **Body:** `{}`

### Job 2: AI Insights Generation (Monday 07:00 UTC)
- **Schedule:** `0 7 * * 1`
- **Function:** HTTP Request
- **URL:** `https://tduwpkyufgiumgbtyime.supabase.co/functions/v1/ai-insights`
- **Method:** POST
- **Headers:** `Authorization: Bearer <SERVICE_ROLE_KEY>`
- **Body:** `{}`

### Job 3: Token Refresh (every 12 hours)
- **Schedule:** `0 */12 * * *`
- **Function:** HTTP Request
- **URL:** `https://tduwpkyufgiumgbtyime.supabase.co/functions/v1/gc-refresh-tokens`
- **Method:** POST
- **Headers:** `Authorization: Bearer <SERVICE_ROLE_KEY>`
- **Body:** `{}`

### Job 4: Consent Expiry Check (daily at 08:00 UTC)
- **Schedule:** `0 8 * * *`
- **Function:** HTTP Request
- **URL:** `https://tduwpkyufgiumgbtyime.supabase.co/functions/v1/notify-consent-expiry`
- **Method:** POST
- **Headers:** `Authorization: Bearer <SERVICE_ROLE_KEY>`
- **Body:** `{}`

### Job 5: Cleanup Old Sync Logs (weekly Sunday 02:00 UTC)
- **Schedule:** `0 2 * * 0`
- **Function:** SQL
- **Query:**
```sql
delete from sync_logs where created_at < now() - interval '90 days';
```

### Job 6: Health Check (every 30 minutes)
- **Schedule:** `*/30 * * * *`
- **Function:** SQL
- **Query:**
```sql
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
```

## Option 2: Vercel Cron (if using Vercel deployment)

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-transactions",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/generate-insights",
      "schedule": "0 7 * * 1"
    },
    {
      "path": "/api/cron/refresh-tokens",
      "schedule": "0 */12 * * *"
    },
    {
      "path": "/api/cron/check-consent-expiry",
      "schedule": "0 8 * * *"
    }
  ]
}
```

Then create Next.js API routes that call the Supabase Edge Functions with the service role key.

## Option 3: GitHub Actions (Free Alternative)

Create `.github/workflows/cron.yml`:
```yaml
name: Scheduled Tasks
on:
  schedule:
    - cron: '0 */6 * * *'  # Transaction sync
    - cron: '0 7 * * 1'    # Weekly insights
    - cron: '0 */12 * * *' # Token refresh
    - cron: '0 8 * * *'    # Consent check

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Call Supabase Functions
        run: |
          curl -X POST https://tduwpkyufgiumgbtyime.supabase.co/functions/v1/gc-sync-all \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

## Current Status
- ✅ Edge Functions deployed: `gc-refresh-tokens`, `notify-consent-expiry`
- ⏳ Cron jobs: **Awaiting manual configuration** (Supabase Dashboard or external service)
- 📝 Migration `005_cron_jobs.sql` created but **NOT APPLIED** (pg_cron not available on Hobby plan)

## Next Steps
1. Choose your cron strategy (Supabase Dashboard / Vercel / GitHub Actions)
2. Configure the 6 jobs listed above
3. Test each job manually via Dashboard or curl
4. Monitor execution logs in Supabase Dashboard
