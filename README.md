# Spending Dashboard

AI-powered spending dashboard with PSD2 bank linking, transaction categorization, and inter-account transfer detection.

**Primary market:** Slovakia | **Languages:** Slovak, English, Hungarian | **Currency:** EUR

## Overview

This is a B2C fintech app that:

1. **Connects to banks via PSD2** — Link accounts from Tatra banka, VÚB, Slovenská sporiteľňa, ČSOB, and other Slovak banks using GoCardless Bank Account Data API
2. **Automatically categorizes transactions** — Claude API categorizes every transaction into 20+ categories
3. **Detects inter-account transfers** — Prevents double-counting of transfers in spending analytics (critical for accuracy)
4. **Provides AI insights** — Weekly spending summaries, budget warnings, subscription alerts
5. **AI chat assistant** — Ask questions about your finances in natural language

## Tech Stack

- **Monorepo:** pnpm workspaces
- **Web:** Next.js 14+ (App Router), TypeScript, Tailwind CSS v4, shadcn/ui
- **Mobile:** React Native (Expo SDK 51+), NativeWind, Expo Router
- **Backend:** Supabase (Auth, PostgreSQL with RLS, Edge Functions)
- **AI:** Anthropic Claude API (Sonnet) — Edge Functions only
- **PSD2:** GoCardless Bank Account Data API
- **State:** Zustand + TanStack Query
- **Charts:** Recharts (web), Victory Native (mobile)

## Project Structure

```
/
├── apps/
│   ├── web/              # Next.js web app
│   └── mobile/           # React Native (Expo) mobile app
├── packages/
│   └── shared/           # Shared types, utils, Supabase client, i18n
├── supabase/
│   ├── migrations/       # PostgreSQL schema (including transfer_pairs table)
│   └── functions/        # Edge Functions (GoCardless, AI, sync)
├── CLAUDE.md            # Project conventions
├── tasks.md             # Task tracking
└── README.md            # This file
```

## Critical Implementation Details

### Transfer Detection

**Why it matters:** When users have multiple linked accounts, transfers between them appear as both expense and income. Without detection, all analytics are wrong.

**How it works:**
1. IBAN matching (confidence: 0.99) — counterparty IBAN is in user's accounts
2. Bank transfer codes (confidence: 0.90) — "PREVOD", "TRANSFER", etc.
3. Amount+date fuzzy matching (confidence: 0.55–0.85) — same amount, ±2 days
4. Keyword detection (confidence: 0.60–0.75) — "vlastný účet", "sporenie"
5. AI fallback for ambiguous cases

**Net zero validation:**
- `confirmed_zero`: debit + credit = 0 (perfect match)
- `confirmed_rounding`: |net| ≤ €0.05 (cross-currency rounding)
- `confirmed_with_fee`: €0.05 < |net| ≤ €5.00 (bank fee — split into transfer + fee)
- `mismatch`: |net| > €5.00 (false positive — unlink)

**Database rule:**
```sql
-- ✅ CORRECT — All spending queries MUST exclude transfers
SELECT SUM(amount) FROM transactions
WHERE user_id = $1 AND is_transfer = false;

-- ❌ WRONG — Inflated numbers
SELECT SUM(amount) FROM transactions
WHERE user_id = $1;
```

### GoCardless Integration

**Key gotchas:**
- Transaction structure varies by bank
- `creditorName`/`debtorName` not always present
- Amounts are STRINGS not numbers
- Rate limits: as low as 4 calls/day/account
- No webhooks — must poll (cron jobs)
- PSD2 consent expires every 90 days

**Sync strategy:**
- Initial sync: fetch all available history (up to 24 months)
- Incremental sync (every 6h): `last_sync - 3 days` to today (overlap for late-posting)
- Dedup: `UNIQUE(account_id, external_transaction_id)`

## Database Schema

### Key Tables

- **profiles** — User settings, language, onboarding status
- **bank_connections** — GoCardless requisitions, consent lifecycle
- **accounts** — Linked bank accounts (IBAN, balance, type)
- **transactions** — All transactions with `is_transfer` flag and `transfer_pair_id`
- **transfer_pairs** — Matched inter-account transfers (CRITICAL)
- **categories** — 20 system categories (Slovak names)
- **budgets** — Per-category budgets
- **insights** — AI-generated spending insights
- **chat_messages** — Chat history
- **recurring_groups** — Subscription/recurring payment detection
- **sync_logs** — Audit trail

### Database Functions

```sql
-- Spending by category (excludes transfers by default)
get_spending_by_category(user_id, start_date, end_date, include_transfers)

-- Monthly trend (excludes transfers)
get_monthly_trend(user_id, months)

-- Balance summary across all accounts
get_balance_summary(user_id)
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Supabase CLI
- GoCardless API credentials (sandbox or production)
- Anthropic API key

### Installation

```bash
# Clone repo
cd ~/projects/spending-dashboard

# Install dependencies
pnpm install

# Set up Supabase
supabase init
supabase start

# Run migrations
supabase db push

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Start development
pnpm dev              # Web app
pnpm dev:mobile       # Mobile app (Expo)
```

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# GoCardless Bank Account Data
GOCARDLESS_SECRET_ID=
GOCARDLESS_SECRET_KEY=
GOCARDLESS_BASE_URL=https://bankaccountdata.gocardless.com

# Anthropic
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Development Workflow

### Phase 1: Foundation ✅
- [x] Monorepo setup
- [x] Supabase schema with transfer_pairs
- [x] Category seed
- [x] Project documentation

### Phase 2: GoCardless Integration (In Progress)
- [ ] Edge Functions for auth, institutions, connect, sync
- [ ] Token management
- [ ] Sync orchestration

### Phase 3: Transfer Detection
- [ ] Matching algorithm (IBAN, fuzzy, keywords)
- [ ] Net zero validation
- [ ] Retroactive matching

### Phase 4: AI Layer
- [ ] Transaction categorization
- [ ] Weekly insights
- [ ] Chat assistant

### Phase 5: Frontend
- [ ] Web app (Next.js)
- [ ] Mobile app (Expo)
- [ ] Transfer-aware UI

### Phase 6: Cron & Lifecycle
- [ ] Scheduled sync (every 6h)
- [ ] Consent renewal (90-day lifecycle)

## Mock Data

Use realistic Slovak data for development:

**Merchants:** Kaufland, Lidl, Tesco, Billa, Shell, OMV, Orange SK, Slovak Telekom, O2, Bolt, Wolt, Glovo, Netflix, Spotify, HBO Max, Slovenské elektrárne, SPP, MHD Bratislava, Alza.sk, Mall.sk, Dr. Max

**Amounts:** EUR (groceries €15-80, dining €8-35, fuel €40-70, utilities €80-200, subscriptions €5-15, salary €1,500-3,500)

**Inter-account transfers:** Include test transfers ("Prevod na sporenie" €200, "Prevod z Revolut" €150) to verify detection from day 1.

## Security & Compliance

- **GDPR:** Minimize data retention, support full account deletion, never store bank credentials
- **PSD2:** 90-day consent lifecycle, re-consent flow built-in
- **RLS:** Row Level Security enabled on all tables
- **Secrets:** GoCardless tokens server-side only (Edge Functions), never expose to client
- **SQL Injection:** Parameterized queries everywhere

## Testing

```bash
# Type check
pnpm type-check

# Lint
pnpm lint

# Unit tests (TBD)
pnpm test

# E2E tests (TBD)
pnpm test:e2e
```

## Deployment

- **Web:** Vercel (production)
- **Mobile:** EAS (TestFlight / Play Console)
- **Backend:** Supabase (managed)

## License

Private — Capila, s. r. o.

## Support

For issues or questions, contact the Capila team.
