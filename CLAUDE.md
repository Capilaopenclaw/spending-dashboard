# CLAUDE.md — Spending Dashboard Project Conventions

## Project Overview
AI-powered spending dashboard — B2C fintech app with PSD2 bank linking (GoCardless), AI transaction categorization (Claude API), and inter-account transfer detection.

**Primary market:** Slovakia | **Languages:** Slovak (primary), English, Hungarian | **Currency:** EUR

## Tech Stack
- **Monorepo:** pnpm workspaces
- **Web:** Next.js 14+ (App Router), TypeScript, Tailwind CSS v4, shadcn/ui
- **Mobile:** React Native (Expo SDK 51+), NativeWind, Expo Router
- **Backend:** Supabase (Auth, PostgreSQL, Edge Functions)
- **AI:** Anthropic Claude API (Sonnet) — Edge Functions ONLY
- **PSD2:** GoCardless Bank Account Data API
- **State:** Zustand (client), TanStack Query (server)
- **Charts:** Recharts (web), Victory Native (mobile)

## Critical Rules

### 1. Transfer Detection is MANDATORY
- Inter-account transfers appear as both expense and income
- Without detection, all spending/income numbers are inflated and WRONG
- ALL spending queries MUST include: `AND is_transfer = false`
- Transfers shown separately in UI with muted styling and ↔️ icon

### 2. GoCardless Security
- API calls ONLY from Supabase Edge Functions — NEVER from client
- Store tokens server-side only
- Handle inconsistent bank data defensively (not all fields always present)
- 90-day PSD2 consent lifecycle from day 1

### 3. Database Rules
- Use parameterized queries everywhere (SQL injection prevention)
- Row Level Security enabled on ALL tables
- Store raw GoCardless response in `metadata` JSONB for debugging
- UNIQUE constraint on (account_id, external_transaction_id) for deduplication

### 4. AI Layer
- Claude API calls ONLY from Edge Functions
- Categorize non-transfer transactions only
- Store confidence scores
- Learn from user corrections

### 5. Code Quality
- TypeScript strict mode
- Explicit types over inference
- Small, single-responsibility functions
- Error handling everywhere
- No hardcoded secrets (env vars only)

## File Structure

```
/
├── apps/
│   ├── web/              # Next.js 14+ web app
│   └── mobile/           # React Native (Expo) mobile app
├── packages/
│   └── shared/           # Shared types, utils, Supabase client, i18n
├── supabase/
│   ├── migrations/       # PostgreSQL schema
│   └── functions/        # Edge Functions (GoCardless, AI, sync)
├── pnpm-workspace.yaml
├── CLAUDE.md            # This file
└── tasks.md             # Task tracking
```

## Coding Conventions

### TypeScript
```typescript
// ✅ Explicit types
interface Transaction {
  id: string;
  amount: number;
  is_transfer: boolean;
}

// ✅ Parameterized queries
const { data } = await supabase
  .from('transactions')
  .select('*')
  .eq('user_id', userId)
  .eq('is_transfer', false);

// ❌ Never SQL string interpolation
// WRONG: .select(`* WHERE user_id = '${userId}'`)
```

### Error Handling
```typescript
// ✅ Always handle errors
try {
  const result = await fetchTransactions();
  if (!result.success) {
    logger.error('Fetch failed', result.error);
    return { error: result.error };
  }
  return result.data;
} catch (error) {
  logger.error('Unexpected error', error);
  throw error;
}
```

### i18n
```typescript
// Use t(key, lang) everywhere
import { t } from '@/shared/constants/i18n';

const title = t('dashboard.title', 'sk'); // "Prehľad"
```

## Database Schema Key Points

### transfer_pairs table
- Links debit and credit transactions across accounts
- Validates net zero (or near-zero with fees/rounding)
- Tracks detection method (IBAN match, fuzzy, keywords, AI)
- Stores confidence score

### Spending Queries
```sql
-- ✅ CORRECT
SELECT SUM(amount)
FROM transactions
WHERE user_id = $1
  AND is_transfer = false
  AND transaction_type = 'expense';

-- ❌ WRONG (inflated numbers)
SELECT SUM(amount)
FROM transactions
WHERE user_id = $1
  AND transaction_type = 'expense';
```

## Transfer Detection Algorithm

1. **IBAN Match** (confidence: 0.99)
   - Counterparty IBAN is in user's linked accounts
   
2. **Bank Transfer Code** (confidence: 0.90)
   - bankTransactionCode = "ICDT"
   - Keywords: "PREVOD", "TRANSFER", "VLASTNY UCET"

3. **Amount+Date Fuzzy** (confidence: 0.55–0.85)
   - Same absolute amount, same currency, ±2 days
   - Same day = 0.85, ±1 day = 0.70, ±2 days = 0.55

4. **Keyword Detection** (confidence: 0.60–0.75)
   - "prevod", "vlastný účet", "sporenie", "transfer"

5. **AI Fallback** for ambiguous cases

### Net Zero Validation
```typescript
const net = debitAmount + creditAmount;

if (net === 0) return 'confirmed_zero';
if (Math.abs(net) <= 0.05) return 'confirmed_rounding';
if (Math.abs(net) > 0 && Math.abs(net) <= 5.00) return 'confirmed_with_fee';
if (Math.abs(net) > 5.00) return 'mismatch'; // false positive
```

## GoCardless Integration

### Key Gotchas
- Transaction structure varies by bank
- `creditorName`/`debtorName` not always present
- Amounts are STRINGS not numbers
- Rate limits: as low as 4 calls/day/account
- No webhooks — must poll (cron jobs)
- Consent expires every 90 days

### Sync Strategy
```typescript
// Initial sync: no date filters, get all history
// Incremental sync (every 6h): last_sync - 3 days to today
// Dedup: UNIQUE(account_id, external_transaction_id)
```

## Phase Implementation Order

1. ✅ **Phase 1: Foundation**
   - Monorepo setup
   - Supabase schema with transfer_pairs
   - Category seed
   - Auth

2. **Phase 2: GoCardless**
   - Token management
   - Institution listing
   - Connect + callback flow
   - Transaction/balance sync

3. **Phase 3: Transfer Detection**
   - Matching algorithm
   - Net zero validation
   - Retroactive matching

4. **Phase 4: AI Layer**
   - Categorization (non-transfers)
   - Weekly insights
   - Chat assistant

5. **Phase 5: Frontend**
   - Dashboard (web + mobile)
   - Transfer-aware UI
   - Transaction management

6. **Phase 6: Cron & Lifecycle**
   - Scheduled sync
   - Consent renewal

## Mock Data
Use realistic Slovak data:
- Merchants: Kaufland, Lidl, Tesco, Orange SK, Slovak Telekom, Bolt, Netflix, Spotify, SPP, MHD Bratislava
- Amounts: EUR (groceries €15-80, dining €8-35, utilities €80-200, salary €1,500-3,500)
- Include inter-account transfers for testing

## Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# GoCardless
GOCARDLESS_SECRET_ID=
GOCARDLESS_SECRET_KEY=
GOCARDLESS_BASE_URL=https://bankaccountdata.gocardless.com

# Anthropic
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

## Git Workflow
- Branch from main
- Clear conventional commits
- Test before pushing
- Never commit secrets

## Questions/Clarifications
When uncertain:
1. Check master prompt (`~/projects/master-prompt-spending-dashboard.md`)
2. Prioritize transfer detection accuracy
3. Default to Slovak language/locale
4. Defensive coding for GoCardless data
