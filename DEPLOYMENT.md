# Production Deployment Guide

Tento dokument ťa prevedie kompletným nasadením AI Spending Dashboard do produkcie.

---

## Prehľad

**Komponenty na nasadenie:**
1. **Supabase** — Databáza + Edge Functions + Auth
2. **Vercel** — Web aplikácia (Next.js)
3. **Expo EAS** — Mobilná aplikácia (React Native)
4. **GoCardless** — PSD2 bank linking API
5. **Anthropic** — Claude AI API
6. **Cron** — Automatizované úlohy (sync, insights)

**Čas:** ~30-45 minút  
**Náklady:** Supabase Free, Vercel Hobby (free), Expo free build, GoCardless pay-as-you-go, Anthropic API usage-based

---

## 1. Supabase Setup

### 1.1 Vytvor Supabase projekt
1. Choď na https://supabase.com/dashboard
2. Klikni **New project**
3. Vyplň:
   - **Name:** `spending-dashboard-prod`
   - **Database Password:** (vygeneruj silný heslo, ulož do password manageru)
   - **Region:** `Central EU (Frankfurt)` (najbližšie k SK)
   - **Pricing plan:** Free (postačí na testovanie)
4. Počkaj ~2 minúty na inicializáciu

### 1.2 Nahraj databázové migrácie
```bash
cd ~/projects/spending-dashboard

# Nainštaluj Supabase CLI (ak ešte nemáš)
brew install supabase/tap/supabase  # macOS
# alebo: npm install -g supabase  # Linux/Windows

# Login
supabase login

# Link projekt
supabase link --project-ref YOUR_PROJECT_REF
# PROJECT_REF nájdeš v Supabase Dashboard → Project Settings → General → Reference ID

# Aplikuj migrácie
supabase db push

# Overiť, že tabuľky existujú
supabase db remote changes
```

**Overenie:** V Supabase Dashboard → Table Editor by si mal vidieť 10 tabuliek (profiles, bank_connections, accounts, transactions, transfer_pairs, categories, budgets, insights, chat_messages, recurring_groups, sync_logs).

### 1.3 Skontroluj Row Level Security (RLS)
V Supabase Dashboard → Database → Policies overiť, že všetky tabuľky majú RLS policies.

### 1.4 Nasaď Edge Functions
```bash
# Nastav secrets
supabase secrets set ANTHROPIC_API_KEY="sk-ant-..." \
  GOCARDLESS_SECRET_ID="your-secret-id" \
  GOCARDLESS_SECRET_KEY="your-secret-key"

# Nasaď všetky funkcie
supabase functions deploy gc-auth
supabase functions deploy gc-institutions
supabase functions deploy gc-connect-bank
supabase functions deploy gc-callback
supabase functions deploy gc-sync-transactions
supabase functions deploy gc-sync-balances
supabase functions deploy gc-sync-all
supabase functions deploy gc-disconnect-bank
supabase functions deploy gc-health-check
supabase functions deploy ai-categorize
supabase functions deploy ai-insights
supabase functions deploy ai-chat

# Overiť deployment
supabase functions list
```

**Poznámka:** GoCardless credentials získaš v kroku 4.

---

## 2. GoCardless API Setup

### 2.1 Vytvor GoCardless účet
1. Choď na https://bankaccountdata.gocardless.com/
2. Klikni **Sign Up**
3. Vyplň registráciu (company: Capila, s.r.o.)
4. Potvrď email

### 2.2 Získaj API credentials
1. V GoCardless Dashboard → **User secrets**
2. Klikni **Create new secret**
3. Poznač si:
   - **Secret ID** (začína `your-secret-id...`)
   - **Secret Key** (začína `your-secret-key...`)
4. Ulož do password manageru

### 2.3 Vytvor prvý access token (cez Edge Function)
```bash
# Po nasadení Edge Functions zavolaj gc-auth
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/gc-auth \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY"

# Overiť, že token je v databáze
# Supabase Dashboard → SQL Editor:
SELECT * FROM gc_tokens ORDER BY created_at DESC LIMIT 1;
```

### 2.4 Testovanie v Sandbox režime
```bash
# Získaj zoznam bánk (sandbox)
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/gc-institutions?country=sk \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY"

# Mali by si vidieť SANDBOXFINANCE_SFIN0000
```

**Production režim:**
- Musíš požiadať GoCardless o production prístup (vyplniť formulár s detailmi o aplikácii)
- Trvá 1-3 dni
- Po schválení budeš môcť používať reálne slovenské banky (Tatra banka, VÚB, atď.)

---

## 3. Vercel Deployment (Web App)

### 3.1 Connect GitHub repo
1. Choď na https://vercel.com/dashboard
2. Klikni **Add New... → Project**
3. Import `Capilaopenclaw/spending-dashboard`
4. **Framework Preset:** Next.js
5. **Root Directory:** `apps/web`
6. **Build Command:** `pnpm build` (automaticky detekované)
7. **Install Command:** `pnpm install`

### 3.2 Pridaj Environment Variables
V Vercel Project Settings → Environment Variables pridaj:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App URL (po prvom deployi)
NEXT_PUBLIC_APP_URL=https://spending-dashboard-prod.vercel.app
```

**Kde nájsť Supabase credentials:**
- Supabase Dashboard → Project Settings → API
- **URL:** pod "Project URL"
- **Anon key:** pod "Project API keys" → `anon` `public`

### 3.3 Deploy
1. Klikni **Deploy**
2. Počkaj ~2 minúty
3. Vercel ti dá URL: `https://spending-dashboard-XXXX.vercel.app`

### 3.4 Pridaj vlastnú doménu (voliteľné)
1. Vercel Project → Settings → Domains
2. Pridaj doménu (napr. `app.capila.io`)
3. Nastav DNS záznamy podľa inštrukcií

### 3.5 Overiť deployment
1. Otvor URL z Vercel
2. Mali by si vidieť login stránku
3. Skús magic link sign-in (email príde cez Supabase Auth)

---

## 4. Nastaviť Supabase Auth Callback

Aby fungoval login redirect po autentifikácii:

1. Supabase Dashboard → Authentication → URL Configuration
2. **Site URL:** `https://spending-dashboard-XXXX.vercel.app`
3. **Redirect URLs:** Pridaj:
   - `https://spending-dashboard-XXXX.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (pre local dev)
4. **Logout URL:** `https://spending-dashboard-XXXX.vercel.app/login`

---

## 5. Nastaviť Cron Jobs

Supabase Edge Functions potrebujú pravidelné volania pre sync a insights.

### Option A: Vercel Cron (jednoduchšie)
1. Vytvor `apps/web/app/api/cron/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // gc-auth: token refresh (every 20h)
  await fetch(`${supabaseUrl}/functions/v1/gc-auth`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${supabaseAnonKey}` },
  });

  // gc-sync-all: transaction sync (every 6h)
  await fetch(`${supabaseUrl}/functions/v1/gc-sync-all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${supabaseAnonKey}` },
  });

  // ai-insights: weekly (Mondays only)
  const today = new Date().getDay();
  if (today === 1) {
    await fetch(`${supabaseUrl}/functions/v1/ai-insights`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cron_all: true }),
    });
  }

  return NextResponse.json({ ok: true });
}
```

2. Vytvor `vercel.json` v root:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

3. Pridaj `CRON_SECRET` do Vercel env vars (vygeneruj náhodný string)

4. Commit + push → Vercel automaticky nasadí cron

### Option B: External cron service (EasyCron, cron-job.org)
1. Zaregistruj sa na https://www.easycron.com/
2. Vytvor 3 joby:
   - **Token refresh:** `POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/gc-auth` každých 20h
   - **Transaction sync:** `POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/gc-sync-all` každých 6h
   - **Insights:** `POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/ai-insights` (Mondays 07:00)
3. Pridaj header: `Authorization: Bearer YOUR_SUPABASE_ANON_KEY`

---

## 6. Mobile App Deployment (Expo)

### 6.1 Aktualizuj app.json
```bash
cd ~/projects/spending-dashboard/apps/mobile
```

Edituj `app.json`:
```json
{
  "expo": {
    "name": "Spending Dashboard",
    "slug": "spending-dashboard",
    "version": "1.0.0",
    "owner": "capila",
    "ios": {
      "bundleIdentifier": "io.capila.spending",
      "buildNumber": "1"
    },
    "android": {
      "package": "io.capila.spending",
      "versionCode": 1
    },
    "extra": {
      "supabaseUrl": "https://YOUR_PROJECT_REF.supabase.co",
      "supabaseAnonKey": "your-anon-key"
    }
  }
}
```

### 6.2 Vytvor Expo účet
```bash
npx expo login
# alebo vytvor účet na https://expo.dev/signup
```

### 6.3 Build pre iOS (TestFlight)
```bash
# Nainštaluj EAS CLI
npm install -g eas-cli

# Login
eas login

# Konfiguruj build
eas build:configure

# Build pre iOS (potrebuješ Apple Developer účet - $99/rok)
eas build --platform ios --profile production

# Submit do TestFlight
eas submit --platform ios
```

### 6.4 Build pre Android (Google Play)
```bash
# Build APK/AAB
eas build --platform android --profile production

# Submit do Google Play (potrebuješ Developer účet - $25 jednorazovo)
eas submit --platform android
```

### 6.5 Over The Air (OTA) updates
```bash
# Po zmene kódu môžeš pushnúť update bez nového buildu
eas update --branch production --message "Fix transfer detection"
```

---

## 7. Post-Deployment Checklist

### ✅ Backend
- [ ] Supabase projekt je live
- [ ] Databázové migrácie aplikované (10 tabuliek)
- [ ] Edge Functions nasadené (12 funkcií)
- [ ] RLS policies active
- [ ] GoCardless token v `gc_tokens` tabuľke
- [ ] Cron jobs nastavené (sync každých 6h)

### ✅ Web App
- [ ] Vercel deployment úspešný
- [ ] Environment variables nastavené
- [ ] Auth callback URL v Supabase
- [ ] Login funguje (magic link)
- [ ] Dashboard sa zobrazí po prihlásení

### ✅ Mobile App (ak buildneš)
- [ ] Expo build úspešný
- [ ] App.json má production credentials
- [ ] TestFlight/Google Play upload

### ✅ Integrácie
- [ ] GoCardless sandbox test (SANDBOXFINANCE)
- [ ] Claude AI categorization test
- [ ] Transfer detection test (vytvor 2 manuálne transakcie)

---

## 8. Testovací Workflow

### Test 1: Registrácia + Login
1. Otvor `https://YOUR_VERCEL_URL.vercel.app/login`
2. Zadaj email
3. Skontroluj inbox (Supabase pošle magic link)
4. Klikni na link → redirect na dashboard
5. **Očakávaný výsledok:** Vidíš prázdny dashboard (žiadne účty zatiaľ)

### Test 2: GoCardless Sandbox Bank Linking
1. V Settings → Linked Banks klikni **Connect Bank**
2. Vyber **SANDBOXFINANCE_SFIN0000** (sandbox banka)
3. Klikni auth link → presmeruje na GoCardless
4. Prihlás sa (sandbox credentials: akékoľvek email/heslo)
5. Potvrdí consent → redirect späť do appky
6. **Očakávaný výsledok:** Vidíš nový účet v Settings + Dashboard zobrazí zostatok

### Test 3: Transaction Sync
1. V Supabase Dashboard → SQL Editor spusti:
```sql
-- Manuálne pridaj 2 transakcie (simulácia GoCardless syncu)
INSERT INTO transactions (user_id, account_id, external_transaction_id, date, amount, currency, original_description, merchant_name)
VALUES
  (auth.uid(), (SELECT id FROM accounts WHERE user_id = auth.uid() LIMIT 1), 'TEST001', CURRENT_DATE, -50.00, 'EUR', 'Kaufland BA', 'Kaufland'),
  (auth.uid(), (SELECT id FROM accounts WHERE user_id = auth.uid() LIMIT 1), 'TEST002', CURRENT_DATE, -25.00, 'EUR', 'Netflix', 'Netflix');
```

2. Zavolaj `ai-categorize`:
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/ai-categorize \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "YOUR_USER_ID"}'
```

3. Refresh dashboard
4. **Očakávaný výsledok:** Vidíš 2 transakcie, správne kategorizované (Kaufland = Potraviny, Netflix = Predplatné)

### Test 4: Transfer Detection
1. Pridaj transfer pár:
```sql
-- Vytvor 2. účet (simulácia)
INSERT INTO accounts (user_id, bank_connection_id, external_account_id, account_name, account_type, currency, current_balance)
VALUES (auth.uid(), (SELECT id FROM bank_connections WHERE user_id = auth.uid() LIMIT 1), 'ACC002', 'Sporiteľňa', 'savings', 'EUR', 500.00);

-- Pridaj transfer transakcie
INSERT INTO transactions (user_id, account_id, external_transaction_id, date, amount, currency, original_description, merchant_name)
VALUES
  (auth.uid(), (SELECT id FROM accounts WHERE account_name = 'Bežný účet' LIMIT 1), 'TRANSFER001', CURRENT_DATE, -200.00, 'EUR', 'Prevod na sporenie', NULL),
  (auth.uid(), (SELECT id FROM accounts WHERE account_name = 'Sporiteľňa' LIMIT 1), 'TRANSFER002', CURRENT_DATE, 200.00, 'EUR', 'Prevod z bežného', NULL);
```

2. Zavolaj transfer detection:
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/gc-sync-transactions \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -d '{"account_id": "YOUR_ACCOUNT_ID"}'
```

3. Skontroluj `transfer_pairs` tabuľku:
```sql
SELECT * FROM transfer_pairs WHERE user_id = auth.uid();
```

4. **Očakávaný výsledok:** 
   - Vidíš 1 záznam v `transfer_pairs`
   - `is_transfer = true` na oboch transakciách
   - Dashboard spending **nevykazuje** €200 ako výdaj (lebo je to transfer)

---

## 9. Production Readiness Checklist

### Bezpečnosť
- [ ] Všetky API keys sú v Supabase secrets / Vercel env vars (nie v kóde)
- [ ] RLS policies testované
- [ ] CORS policies nastavené správne
- [ ] Rate limiting pre Edge Functions (Supabase má default 100 req/min)

### Monitoring
- [ ] Supabase Dashboard → Logs (sleduj chyby v Edge Functions)
- [ ] Vercel Dashboard → Analytics (sleduj návštevnosť)
- [ ] GoCardless Dashboard → API Usage (sleduj limity)

### Compliance
- [ ] GDPR: Privacy Policy + ToS pripravené
- [ ] PSD2: 90-day consent lifecycle implementovaný (`gc-health-check`)
- [ ] GoCardless production approval (ak ešte nemáš)

### Performance
- [ ] Database indexy na `transactions(user_id, date)` existujú (sú v migrácii)
- [ ] Edge Functions majú timeout 60s (Supabase default)
- [ ] Frontend lazy loading (Next.js App Router robí automaticky)

---

## 10. Troubleshooting

### "Error: Invalid API key" pri GoCardless
→ Over, že `GOCARDLESS_SECRET_ID` a `GOCARDLESS_SECRET_KEY` sú správne v Supabase secrets.

### "Error: Unauthorized" pri Edge Functions
→ Over, že používaš `NEXT_PUBLIC_SUPABASE_ANON_KEY`, nie service role key.

### Dashboard nevidí účty po pripojení banky
→ Skontroluj `gc-callback` logs v Supabase Dashboard → Functions → Logs.

### Transakcie sa nesyncujú
→ Over, že cron job beží (Vercel Cron → Logs) alebo zavolaj `gc-sync-all` manuálne.

### Transfer detection nefunguje
→ Skontroluj, že oba účty patria tomu istému `user_id` a majú IBAN v `accounts` tabuľke.

---

## 11. Náklady (odhad)

**Fáza 1: Testovanie (prvý mesiac)**
- Supabase: **$0** (Free tier: 500MB databáza, 2GB bandwidth, 500k Edge Function invocations)
- Vercel: **$0** (Hobby tier)
- Expo: **$0** (build zdarma pre hobby)
- GoCardless: **$0** (sandbox)
- Anthropic: **~$5-10** (testing, cca 100k tokenov)

**Fáza 2: Production (100 aktívnych užívateľov)**
- Supabase: **$0-25** (Free tier postačí, Pro = $25/mes ak treba viac)
- Vercel: **$0** (Hobby postačí, Pro = $20/mes pre custom domains)
- GoCardless: **€0.35/mesiac/užívateľ** = €35/mes pre 100 užívateľov
- Anthropic: **~$50-100** (kategorizácia + insights + chat, závisí od používania)

**Celkovo:** **~$100-150/mesiac** pre 100 užívateľov.

---

## 12. Next Steps

Po nasadení do produkcie:

1. **Získaj GoCardless production prístup** (vyplň form, 1-3 dni)
2. **Otestuj s reálnymi slovenskými bankami** (Tatra banka, VÚB)
3. **Pridaj onboarding wizard** (guided setup pre prvých užívateľov)
4. **Implementuj Fázu 4** (Recurring/Subscription detection) — už máš základ
5. **Nasaď analytics** (Plausible / PostHog pre usage tracking)
6. **Priprav marketing** (landing page, demo video)

---

**Hotovo!** 🚀

Máš otázky alebo potrebuješ pomoc s konkrétnym krokom? Daj vedieť.
