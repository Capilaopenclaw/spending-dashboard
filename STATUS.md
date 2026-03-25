# STATUS — AI Spending Dashboard

## Current Phase: Phase 5 ✅ Complete

### Phase 1: Foundation ✅
- Monorepo (pnpm workspaces): apps/web, packages/shared
- Database schema: 10 tables + RLS + functions (001_initial_schema.sql)
- Seed data: 20 Slovak categories (002_seed_categories.sql)
- Shared package: types, transfer detector, categories, i18n, format utils
- Web scaffold: Next.js 14 + Tailwind

### Phase 2: GoCardless Integration ✅
- **Migration:** `003_gc_tokens.sql` — server-side token storage
- **Shared modules:** `_shared/cors.ts`, `_shared/supabase.ts`, `_shared/gocardless.ts`, `_shared/gc-token-manager.ts`
- **9 Edge Functions implemented**

### Phase 3: AI Layer ✅
- **Shared module:** `_shared/claude.ts` — Claude API client with retry/backoff + streaming
- **3 Edge Functions:** ai-categorize, ai-insights, ai-chat

### Phase 5: Frontend ✅
- **Web App (apps/web):** Next.js 14 with App Router
  - Auth flow: Magic link + Google sign-in (`/login`, `/auth/callback`)
  - 5 main tabs with sidebar navigation (collapsible, bottom tabs on mobile):
    - **Dashboard:** Balance card, spending-by-category donut chart (EXCLUDES transfers), month-over-month bar chart, recent transactions, latest AI insight card, transfer summary
    - **Transactions:** Grouped by date, search, category/account filters, transfer toggle (↔️ icon, muted styling for transfers), pagination
    - **Insights:** Severity-colored AI insight cards (info/warning/positive), dismiss functionality
    - **Chat:** Streaming SSE chat interface with suggestion chips, message history
    - **Settings:** Language selector (SK/EN/HU), bank connections (add/disconnect/status), transfer management (confirm/reject pending pairs)
  - GoCardless callback handler (`/api/gc-callback`)
  - Design system: Dark theme (#0f1117), accent (#00d4aa), JetBrains Mono tabular numbers, skeleton loaders, card/pill components
  - TanStack Query hooks for all data fetching
  - Zustand store for language and sidebar state

- **Mobile App (apps/mobile):** Expo/React Native scaffold
  - Expo Router with 5-tab bottom navigation
  - Auth screen (magic link)
  - Dashboard: Balance + recent transactions
  - Transactions: Search + scrollable list with transfer-aware styling
  - Insights: Severity-colored cards
  - Chat: Message interface with suggestions
  - Settings: Language, bank connections, sign out
  - Supabase client with SecureStore for token persistence
  - Dark theme matching web design

- **Shared (packages/shared):**
  - `ApiClient` class for Edge Function calls
  - Types, i18n, format utils used by both web and mobile

### Build Status
- ✅ Web: `next build` passes (all pages compile)
- ✅ TypeScript: `tsc --noEmit` clean
- ⚠️ Mobile: Scaffold only — needs `expo` environment to build

### Key Design Decisions
- All spending queries use `is_transfer = false` filter (CRITICAL)
- Transfer transactions rendered with ↔️ icon and muted opacity
- Transfer summary shown separately on dashboard (informational, not in totals)
- Chat uses SSE streaming with fallback to non-streaming
- Supabase RPC calls cast to `any` due to untyped custom functions
- All UI strings go through `t()` i18n function (SK/EN/HU)

### Phase 6: Cron & Lifecycle ✅ (Configuration Required)
- ✅ **Migration:** `005_cron_jobs.sql` (pg_cron setup — manual config needed)
- ✅ **Edge Functions:** `gc-refresh-tokens`, `notify-consent-expiry`
- ✅ **Cron Documentation:** `CRON_SETUP.md` with 3 setup options (Supabase Dashboard / Vercel / GitHub Actions)
- ⏳ **Manual Setup Required:** 6 cron jobs (sync every 6h, insights weekly, token refresh 12h, consent check daily, cleanup weekly, health check 30m)
- ✅ **Consent Renewal Flow:** Automated notifications 7 days before expiry, status `expiring_soon`

### Cron Jobs Defined:
1. **Transaction Sync** (every 6 hours) → `gc-sync-all`
2. **AI Insights** (Monday 07:00 UTC) → `ai-insights`
3. **Token Refresh** (every 12 hours) → `gc-refresh-tokens`
4. **Consent Expiry Check** (daily 08:00 UTC) → `notify-consent-expiry`
5. **Cleanup Sync Logs** (weekly Sunday 02:00 UTC) → SQL delete
6. **Health Check** (every 30 minutes) → SQL insert

### Next: Phase 7 — Polish & Production Readiness
- [ ] GoCardless Production approval (real Slovak banks)
- [ ] Supabase Auth callbacks configuration
- [ ] Production environment variables
- [ ] Error monitoring (Sentry / LogRocket)
- [ ] Performance optimization (query indexes, caching)
- [ ] Mobile app polish (Expo build, app store submission)
