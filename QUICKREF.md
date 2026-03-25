# Quick Reference — Spending Dashboard

One-page cheat sheet for developers.

## Project Structure

```
apps/web/          → Next.js 14 web app
apps/mobile/       → React Native (Expo) mobile app
packages/shared/   → Shared types, utils, i18n, algorithms
supabase/          → Database migrations + Edge Functions
```

## Critical Rules

### 1. Transfer Detection is MANDATORY
```sql
-- ✅ CORRECT — Excludes transfers
SELECT SUM(amount) FROM transactions
WHERE user_id = $1 AND is_transfer = false;

-- ❌ WRONG — Inflated numbers
SELECT SUM(amount) FROM transactions WHERE user_id = $1;
```

### 2. GoCardless API calls ONLY from Edge Functions
Never call GoCardless from client/browser — always server-side.

### 3. All spending queries exclude transfers
Use database functions: `get_spending_by_category()`, `get_monthly_trend()` — they exclude transfers by default.

## Database Tables

| Table | Key Fields |
|-------|------------|
| `profiles` | `language`, `currency`, `onboarding_completed` |
| `bank_connections` | `status`, `consent_expires_at`, `requisition_id` |
| `accounts` | `iban`, `current_balance`, `is_active` |
| `transactions` | **`is_transfer`**, `transfer_pair_id`, `category_id` |
| **`transfer_pairs`** | `net_validation_status`, `detection_method`, `detection_confidence` |
| `categories` | 20 Slovak categories seeded |

## Transfer Detection Algorithm

**Location:** `packages/shared/src/lib/transfer-detector.ts`

**Methods:**
1. IBAN match (0.99) → counterparty IBAN in user's accounts
2. Bank code (0.90) → "ICDT", "PREVOD", "TRANSFER"
3. Fuzzy (0.55–0.85) → same amount, ±2 days
4. Keywords (0.60–0.75) → "vlastný účet", "sporenie"

**Net Zero Validation:**
```typescript
net = debit.amount + credit.amount

if (net === 0) → "confirmed_zero"
if (|net| ≤ €0.05) → "confirmed_rounding"
if (€0.05 < |net| ≤ €5.00) → "confirmed_with_fee"
if (|net| > €5.00) → "mismatch"
```

## i18n

**Location:** `packages/shared/src/constants/i18n.ts`

```typescript
import { t } from '@spending-dashboard/shared'

const title = t('dashboard.title', 'sk') // "Prehľad"
const greeting = t('dashboard.welcome', 'sk', { name: 'Mátyáš' }) // "Ahoj, Mátyáš 👋"
```

Languages: `sk` (Slovak), `en` (English), `hu` (Hungarian)

## Formatting

**Location:** `packages/shared/src/utils/format.ts`

```typescript
import { formatCurrency, formatDate, cleanMerchantName } from '@spending-dashboard/shared'

formatCurrency(1234.56, 'EUR', 'sk-SK') // "1 234,56 €"
formatDate('2024-01-15', 'sk-SK') // "15. január 2024"
cleanMerchantName('Platba kartou KAUFLAND 1234 BRATISLAVA') // "KAUFLAND"
```

## Categories

**Location:** `packages/shared/src/constants/categories.ts`

20 system categories with Slovak names:
- 🛒 Potraviny (Groceries)
- 🍽️ Reštaurácie (Dining)
- 🚗 Doprava (Transport)
- ↔️ **Prevody (Transfers)** — CRITICAL
- ... and 16 more

## Database Functions

```sql
-- Spending by category (excludes transfers by default)
SELECT * FROM get_spending_by_category(
  user_id UUID,
  start_date DATE,
  end_date DATE,
  include_transfers BOOLEAN DEFAULT false
);

-- Monthly trend (excludes transfers)
SELECT * FROM get_monthly_trend(
  user_id UUID,
  months INTEGER DEFAULT 6
);

-- Balance summary
SELECT * FROM get_balance_summary(user_id UUID);
```

## Common Commands

```bash
# Development
pnpm dev                 # Start web app
pnpm dev:mobile          # Start mobile app
pnpm type-check          # Type check all packages
pnpm lint                # Lint

# Supabase
supabase start           # Start local instance
supabase stop            # Stop
supabase db push         # Apply migrations
supabase db reset        # Reset database
supabase functions deploy # Deploy Edge Functions

# Clean
pnpm clean               # Remove all node_modules, build artifacts
```

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# GoCardless
GOCARDLESS_SECRET_ID=your-secret-id
GOCARDLESS_SECRET_KEY=your-secret-key
GOCARDLESS_BASE_URL=https://bankaccountdata.gocardless.com

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## GoCardless Gotchas

1. Transaction structure varies by bank
2. Amounts are STRINGS not numbers
3. Rate limits: as low as 4 calls/day/account
4. No webhooks — must poll (every 6h)
5. PSD2 consent expires every 90 days

## Sync Strategy

```
Initial sync:
- No date filters, fetch all history (up to 24 months)

Incremental sync (every 6h):
- date_from = last_sync - 3 days
- date_to = today
- Dedup via UNIQUE(account_id, external_transaction_id)

After sync:
- Run transfer detection
- Update is_transfer flags
- Create transfer_pairs records
- AI categorization (non-transfers only)
```

## Testing

```bash
# Test transfer detection
npx tsx test-transfer-detection.ts

# Verify database
psql postgres://postgres:postgres@localhost:54322/postgres
\dt                    # List tables
SELECT * FROM categories; # Should see 20 rows
```

## Resources

- **CLAUDE.md** — Project conventions
- **README.md** — Project overview
- **SETUP.md** — Setup instructions
- **tasks.md** — Task tracking
- **DELIVERABLES.md** — What's built

## Next Steps (Phase 2)

1. Build GoCardless Edge Functions (auth, institutions, connect, sync)
2. Integrate transfer detection with sync pipeline
3. Test with sandbox: `SANDBOXFINANCE_SFIN0000`
4. Build frontend (Dashboard, Transactions, Settings)

---

**Phase 1: COMPLETE ✅**  
**Ready for Phase 2**
