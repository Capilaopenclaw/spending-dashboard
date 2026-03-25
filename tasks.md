# Tasks — Spending Dashboard

## Phase 1: Foundation ✅

- [x] Initialize pnpm monorepo
  - [x] Create workspace structure (apps/web, apps/mobile, packages/shared)
  - [x] Configure pnpm-workspace.yaml
  - [x] Set up root package.json with shared dependencies
- [x] Supabase setup
  - [x] Create initial migration (001_initial_schema.sql)
    - [x] profiles table
    - [x] bank_connections table
    - [x] accounts table
    - [x] transactions table (with is_transfer, transfer_pair_id)
    - [x] transfer_pairs table (CRITICAL)
    - [x] categories table
    - [x] budgets table
    - [x] insights table
    - [x] chat_messages table
    - [x] recurring_groups table
    - [x] sync_logs table
    - [x] RLS policies for all tables
    - [x] updated_at trigger function
    - [x] Database functions (get_spending_by_category, get_monthly_trend, get_balance_summary)
  - [x] Create seed migration (002_seed_categories.sql)
    - [x] 20 system categories (Slovak names, icons, colors)
- [x] Shared package
  - [x] TypeScript types (Database, Transaction, Account, TransferPair, etc.)
  - [x] Category constants (20 system categories with Slovak names)
  - [x] i18n utilities (t() function, Slovak/English/Hungarian)
  - [x] Format utilities (currency, dates, merchant name cleaning)
  - [x] Transfer detection algorithm (IBAN, fuzzy, keywords, net zero validation)
- [x] Web app scaffold
  - [x] Next.js 14 with App Router
  - [x] Tailwind CSS with dark theme
  - [x] TypeScript configuration
  - [x] Supabase client setup
- [x] Project documentation
  - [x] CLAUDE.md (conventions)
  - [x] README.md (overview)
  - [x] tasks.md (this file)
- [ ] Auth setup
  - [ ] Configure Supabase Auth (magic link + Google)
  - [ ] Set up redirect URLs

## Phase 2: GoCardless Integration ✅

- [x] Shared modules
  - [x] _shared/cors.ts — CORS headers helper
  - [x] _shared/supabase.ts — Supabase client (anon + admin)
  - [x] _shared/gocardless.ts — Full GoCardless API client (tokens, institutions, agreements, requisitions, accounts, transactions, balances)
  - [x] _shared/gc-token-manager.ts — Auto-refresh token management with DB persistence
  - [x] 003_gc_tokens.sql — Migration for token storage table
- [x] Edge Functions — Auth
  - [x] gc-auth: token management (create, refresh, store)
- [x] Edge Functions — Institutions
  - [x] gc-institutions: list Slovak banks by country, in-memory 24h cache
- [x] Edge Functions — Connect Flow
  - [x] gc-connect-bank: create agreement (90d consent) + requisition, return auth link
  - [x] gc-callback: handle redirect, fetch account details + balances, store accounts
- [x] Edge Functions — Sync
  - [x] gc-sync-transactions: fetch + normalize + store + TRANSFER DETECTION (integrated)
  - [x] gc-sync-balances: update account balances (single or by connection)
  - [x] gc-sync-all: orchestrate full sync for all active connections (cron target)
- [x] Edge Functions — Management
  - [x] gc-disconnect-bank: DELETE requisition, revoke access, deactivate accounts
  - [x] gc-health-check: consent expiry check, expiring-soon warnings, GoCardless status verification

## Phase 3: Transfer Detection ✅ (integrated into Phase 2)

- [x] Transfer detection algorithm (packages/shared/src/lib/transfer-detector.ts — already existed from Phase 1)
- [x] Transfer detection integrated into gc-sync-transactions and gc-sync-all
  - [x] IBAN matching (confidence: 0.99)
  - [x] Amount+date fuzzy matching (confidence: 0.55–0.85)
  - [x] Keyword detection for probable single-leg transfers
  - [x] Net zero validation (confirmed_zero, confirmed_rounding, confirmed_with_fee, mismatch)
  - [x] Creates transfer_pairs records
  - [x] Updates transactions.is_transfer, transfer_pair_id, transaction_type, category_id
  - [x] Rejects mismatch pairs (|net| > 5.00)
  - [x] Scans 90 days of unmatched transactions on each sync

## Phase 4: AI Layer

- [ ] ai-categorize Edge Function
  - [ ] Claude API batch categorization
  - [ ] Filter: non-transfer transactions only
  - [ ] Store category_id and confidence score
  - [ ] Learn from user corrections
- [ ] ai-insights Edge Function
  - [ ] Weekly spending digest
  - [ ] Spending spikes, anomalies, budget warnings
  - [ ] Subscription alerts
- [ ] ai-chat Edge Function
  - [ ] Conversational interface
  - [ ] User financial data as context (last 30 days)
  - [ ] Store chat history

## Phase 5: Frontend — Web ✅

- [x] Next.js app setup
  - [x] App Router structure ((auth)/ and (app)/ route groups)
  - [x] Tailwind CSS + custom UI components (Card, Button, Input, Badge, Skeleton)
  - [x] Supabase client (browser + server)
  - [x] TanStack Query hooks for all data
  - [x] Zustand store (language, sidebar state)
- [x] Auth screens
  - [x] Login/signup (magic link + Google) — /login
  - [x] Callback handler — /auth/callback
- [x] Dashboard page
  - [x] Total balance card (all accounts summed)
  - [x] Spending vs last month (bar chart + % change)
  - [x] Spending by category donut chart (EXCLUDES transfers ✅)
  - [x] Transfers summary (separate, informational)
  - [x] Recent transactions (10, with transfer-aware styling)
  - [x] Latest AI insight (dismissible)
- [x] Transactions page
  - [x] Search + filters (category, account, transfer toggle)
  - [x] Grouped by date with pagination
  - [x] Transfer-aware styling (↔️ icon, muted opacity)
- [x] Insights page
  - [x] AI insight cards with severity coloring (info/warning/positive)
  - [x] Dismiss functionality
- [x] Chat page
  - [x] SSE streaming chat interface
  - [x] Suggestion chips
  - [x] Chat history from Supabase
- [x] Settings page
  - [x] Language selector (SK/EN/HU)
  - [x] Linked banks (status, add via GoCardless, disconnect)
  - [x] Transfer management (confirm/reject pending pairs)
- [x] GoCardless callback route — /api/gc-callback
- [x] Design system
  - [x] Dark theme (#0f1117, #00d4aa accent)
  - [x] JetBrains Mono tabular numbers for amounts
  - [x] Skeleton loaders
  - [x] Collapsible sidebar (desktop) / bottom tabs (mobile)
- [ ] Onboarding flow (bank picker wizard — deferred to post-MVP)
- [ ] Transaction detail sheet (deferred to post-MVP)

## Phase 6: Frontend — Mobile ✅

- [x] Expo app setup
  - [x] Expo Router
  - [x] Supabase client with SecureStore
- [x] Auth screens — Login with magic link
- [x] Tab navigation (5 tabs, bottom bar)
  - [x] Dashboard — Balance + recent transactions
  - [x] Transactions — Search + list with transfer styling
  - [x] Insights — Severity-colored cards
  - [x] Chat — Message interface with suggestions
  - [x] Settings — Language, bank connections, sign out
- [x] Transfer-aware UI
  - [x] ↔️ icon for transfers
  - [x] Muted styling (opacity: 0.6)
- [ ] NativeWind styling (deferred — using inline styles for scaffold)

## Phase 7: Cron & Lifecycle

- [ ] Supabase cron jobs
  - [ ] Token refresh (every 20h)
  - [ ] Transaction sync (every 6h)
  - [ ] Balance update (every 6h)
  - [ ] Health check (daily 03:00)
  - [ ] Weekly insights (Mon 07:00)
- [ ] Consent renewal flow
  - [ ] Notifications at day 75, 85
  - [ ] Automatic expiry at day 90
  - [ ] Re-consent UI

## Testing & QA

- [ ] Unit tests
  - [ ] Transfer detection algorithm
  - [ ] Net zero validation
  - [ ] Transaction normalization
- [ ] Integration tests
  - [ ] GoCardless sync flow (sandbox)
  - [ ] Transfer matching with mock data
- [ ] E2E tests
  - [ ] Onboarding flow
  - [ ] Transaction categorization
  - [ ] Transfer management

## Deployment

- [ ] Web: Vercel
  - [ ] Environment variables
  - [ ] Production domain
- [ ] Mobile: EAS
  - [ ] Build configuration
  - [ ] TestFlight/Play Console setup

## Documentation

- [ ] README.md
- [ ] API documentation
- [ ] Deployment guide
- [ ] User guide (Slovak)

---

## Current Status
**Phase:** 1 (Foundation) — ✅ COMPLETE
**Next:** Phase 2 (GoCardless Integration)
**Last updated:** 2026-03-25

## What's Built So Far

### Phase 1: Foundation ✅
1. **Monorepo structure** — pnpm workspaces with apps/web, apps/mobile (scaffold), packages/shared
2. **Database schema** — Complete PostgreSQL schema with ALL tables including the critical `transfer_pairs` table
3. **Transfer detection algorithm** — Full implementation in TypeScript with IBAN matching, fuzzy matching, keyword detection, and net zero validation
4. **Shared package** — TypeScript types, i18n (Slovak/English/Hungarian), formatting utilities, category constants
5. **Web app scaffold** — Next.js 14 with App Router, Tailwind CSS dark theme, Supabase client
6. **Documentation** — CLAUDE.md, README.md, tasks.md

### Key Files Created
- `supabase/migrations/001_initial_schema.sql` — Full schema with RLS, triggers, and database functions
- `supabase/migrations/002_seed_categories.sql` — 20 system categories with Slovak names
- `packages/shared/src/lib/transfer-detector.ts` — Complete transfer detection algorithm
- `packages/shared/src/types/database.ts` — All TypeScript types for Supabase
- `packages/shared/src/constants/categories.ts` — System categories
- `packages/shared/src/constants/i18n.ts` — Multilingual translations
- `packages/shared/src/utils/format.ts` — Currency, date, merchant name utilities
- `apps/web/` — Next.js app with Tailwind, TypeScript, basic landing page

### Critical Implementation Notes
- **Transfer detection is MANDATORY** — Without it, spending/income numbers are inflated
- **ALL spending queries MUST include:** `AND is_transfer = false`
- **Database functions** automatically exclude transfers (unless explicitly requested)
- **Net zero validation** handles perfect matches, rounding errors, and bank fees
- **GoCardless integration** next — tokens server-side only, defensive data handling

### Ready for Phase 2
The foundation is complete. Next steps:
1. Set up Supabase project (local or cloud)
2. Run migrations (`supabase db push`)
3. Configure environment variables
4. Build GoCardless Edge Functions

## Phase 3: AI Layer ✅

- [x] Shared modules
  - [x] _shared/claude.ts — Claude API client (retry with backoff, streaming support)
- [x] ai-categorize Edge Function
  - [x] Batch processing (50 transactions per Claude call)
  - [x] Auto-categorize transfers as "Prevody" (no AI call)
  - [x] Load user corrections as learning context
  - [x] Only process is_transfer = false transactions
  - [x] Store category_id + category_confidence
  - [x] Support both authenticated and service-level calls
- [x] ai-insights Edge Function
  - [x] Compare last 7 days vs previous 7 days
  - [x] Exclude transfers from all calculations
  - [x] Detect spending spikes (>20%), anomalies, subscriptions
  - [x] Generate trilingual insights (SK/EN/HU) with severity
  - [x] Store in insights table
  - [x] Support cron_all mode for batch processing all users
- [x] ai-chat Edge Function
  - [x] SSE streaming response
  - [x] 30-day financial context (excluding transfers)
  - [x] Chat history (last 10 messages)
  - [x] Respects user language preference from profiles
  - [x] Stores conversation in chat_messages table
  - [x] Non-streaming fallback option
- [x] Integration
  - [x] gc-sync-transactions triggers ai-categorize after new transactions
