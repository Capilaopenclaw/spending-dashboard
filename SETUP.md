# Setup Guide — Spending Dashboard

Complete setup instructions for local development.

## Prerequisites

- **Node.js** 18+ and **pnpm** 8+
- **Supabase CLI** (`npm install -g supabase`)
- **Docker** (for local Supabase)
- **GoCardless API credentials** (sandbox or production)
- **Anthropic API key** (for Claude)

## Step 1: Install Dependencies

```bash
cd ~/projects/spending-dashboard

# Install all dependencies (monorepo)
pnpm install
```

## Step 2: Initialize Supabase

### Option A: Local Development (Recommended)

```bash
# Initialize Supabase (creates .supabase/ directory)
supabase init

# Start local Supabase (PostgreSQL, Studio, Edge Functions)
supabase start
```

This will output:
- **API URL** — Local Supabase endpoint
- **Anon Key** — Public API key
- **Service Role Key** — Server-side key (keep secret)
- **Studio URL** — Database admin UI (usually http://localhost:54323)

### Option B: Cloud Supabase

1. Go to https://supabase.com
2. Create a new project
3. Copy the **API URL** and **anon key** from Settings → API

## Step 3: Run Migrations

```bash
# Apply migrations to local database
supabase db push

# Or for cloud project
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

This will:
1. Create all tables (profiles, bank_connections, accounts, transactions, transfer_pairs, etc.)
2. Enable Row Level Security
3. Create database functions (get_spending_by_category, get_monthly_trend, get_balance_summary)
4. Seed 20 system categories

**Verify in Supabase Studio:**
- Open http://localhost:54323 (local) or your cloud Studio URL
- Go to **Table Editor** → should see all tables
- Go to **SQL Editor** → run: `SELECT * FROM categories;` → should see 20 categories

## Step 4: Configure Environment Variables

```bash
# Copy example
cp .env.example .env.local

# Edit .env.local
nano .env.local
```

### Required Variables

```env
# Supabase (from Step 2)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# GoCardless Bank Account Data API
# Get sandbox credentials: https://bankaccountdata.gocardless.com/
GOCARDLESS_SECRET_ID=your-secret-id
GOCARDLESS_SECRET_KEY=your-secret-key
GOCARDLESS_BASE_URL=https://bankaccountdata.gocardless.com

# Anthropic Claude API
# Get key: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-your-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### Getting GoCardless Sandbox Credentials

1. Go to https://bankaccountdata.gocardless.com/user-secrets/
2. Sign up for a free account
3. Create a new secret (sandbox mode)
4. Copy `secret_id` and `secret_key`

### Getting Anthropic API Key

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Go to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-`)

## Step 5: Start Development

### Web App

```bash
pnpm dev
```

Open http://localhost:3000

You should see the landing page:
- "Spending Dashboard"
- "Tvoje peniaze. Konečne pod kontrolou."
- Login button

### Mobile App (Optional)

```bash
# Install Expo CLI
npm install -g expo-cli

# Start mobile dev server
pnpm dev:mobile
```

Scan QR code with Expo Go app (iOS/Android).

## Step 6: Verify Database

Open Supabase Studio and check:

### Tables Created
- [x] profiles
- [x] bank_connections
- [x] accounts
- [x] transactions (with `is_transfer` column)
- [x] **transfer_pairs** (CRITICAL)
- [x] categories (20 rows)
- [x] budgets
- [x] insights
- [x] chat_messages
- [x] recurring_groups
- [x] sync_logs

### Database Functions
Run in SQL Editor:

```sql
-- Test spending by category (should return empty result for now)
SELECT * FROM get_spending_by_category(
  '00000000-0000-0000-0000-000000000000'::uuid,
  '2024-01-01'::date,
  '2024-12-31'::date
);

-- Test monthly trend (should return 6 months of zeros)
SELECT * FROM get_monthly_trend(
  '00000000-0000-0000-0000-000000000000'::uuid,
  6
);

-- Test balance summary (should return empty)
SELECT * FROM get_balance_summary(
  '00000000-0000-0000-0000-000000000000'::uuid
);
```

### Row Level Security
Check that RLS is enabled:

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All tables should have `rowsecurity = true`.

## Step 7: Test Transfer Detection Algorithm

```bash
# Create a test file
cat > test-transfer-detection.ts << 'EOF'
import { detectTransfers, validateNetZero } from './packages/shared/src/lib/transfer-detector'

// Mock data
const transactions = [
  {
    id: 'txn1',
    amount: -200.00,
    date: '2024-01-15',
    account_id: 'acc1',
    currency: 'EUR',
    original_description: 'Prevod na sporenie',
    metadata: { creditorAccount: { iban: 'SK1234567890' } }
  },
  {
    id: 'txn2',
    amount: 200.00,
    date: '2024-01-15',
    account_id: 'acc2',
    currency: 'EUR',
    original_description: 'Prevod z bežného účtu',
    metadata: { debtorAccount: { iban: 'SK0987654321' } }
  }
]

const accounts = [
  { id: 'acc1', iban: 'SK0987654321' },
  { id: 'acc2', iban: 'SK1234567890' }
]

const result = detectTransfers(transactions, accounts)
console.log('Transfer pairs:', result.transfer_pairs)
console.log('Probable transfers:', result.probable_transfers)

// Test net zero validation
const validation = validateNetZero(-200.00, 200.00)
console.log('Net validation:', validation)
EOF

# Run with tsx
npx tsx test-transfer-detection.ts
```

Expected output:
```
Transfer pairs: [
  {
    debit_transaction_id: 'txn1',
    credit_transaction_id: 'txn2',
    amount: 200,
    detection_method: 'iban_match',
    detection_confidence: 0.99,
    net_difference: 0
  }
]
Net validation: {
  net_difference: 0,
  net_validation_status: 'confirmed_zero',
  fee_amount: 0
}
```

## Common Issues

### Issue: Supabase won't start

**Solution:**
```bash
# Stop Supabase
supabase stop

# Remove volumes
docker volume prune

# Start again
supabase start
```

### Issue: Migrations fail

**Solution:**
```bash
# Reset database
supabase db reset

# Reapply migrations
supabase db push
```

### Issue: RLS blocking queries

**Solution:**
- You need to authenticate as a user first
- Or use the service role key (bypasses RLS)
- For testing, temporarily disable RLS:
  ```sql
  ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
  ```

### Issue: pnpm install fails

**Solution:**
```bash
# Clear cache
pnpm store prune

# Remove node_modules
rm -rf node_modules apps/*/node_modules packages/*/node_modules

# Reinstall
pnpm install
```

## Next Steps

Once setup is complete:

1. **Configure Supabase Auth** — Enable magic link and Google OAuth in Supabase Dashboard → Authentication → Providers
2. **Build GoCardless Edge Functions** — Start with Phase 2 (token management, institutions, connect flow)
3. **Test with sandbox data** — Use GoCardless sandbox institution: `SANDBOXFINANCE_SFIN0000`
4. **Implement frontend** — Dashboard, transactions, settings pages

## Useful Commands

```bash
# Start development
pnpm dev

# Type check all packages
pnpm type-check

# Lint
pnpm lint

# Clean everything
pnpm clean

# Supabase commands
supabase start          # Start local instance
supabase stop           # Stop local instance
supabase status         # Check status
supabase db reset       # Reset database
supabase db push        # Apply migrations
supabase functions deploy # Deploy Edge Functions
```

## Resources

- **Supabase Docs:** https://supabase.com/docs
- **GoCardless API:** https://bankaccountdata.gocardless.com/api/v2/
- **Anthropic API:** https://docs.anthropic.com/
- **Next.js Docs:** https://nextjs.org/docs
- **Expo Docs:** https://docs.expo.dev/

## Support

For issues or questions, check:
1. CLAUDE.md — Project conventions
2. README.md — Project overview
3. tasks.md — What's built and what's next
