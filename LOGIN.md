# Login Instructions

## Production URL
https://spending-dashboard-mn9n6n2ed-matyas-projects-a6cb7e2d.vercel.app

## Test Account Credentials
- **Email:** `matyas.varga@capila.io`
- **Password:** `TempPass123!`

## Steps to Login
1. Visit the production URL above
2. Click "Sign In" or go directly to `/login`
3. Enter the email and password above
4. After login, you should see:
   - **Dashboard:** Balance showing **3,826.24 EUR** (2 accounts × 1913.12 EUR)
   - **Transactions:** 12 transactions from GoCardless Sandbox
   - **Accounts:** 2 bank accounts (both "Main Account")

## Why Balance Shows Zero Before Login
- All data is protected by **Row Level Security (RLS)**
- Unauthenticated users see empty responses
- After login, your user token (`auth.uid()`) allows Supabase to return your data

## Troubleshooting
If balance still shows zero after login:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Check for any errors
4. Go to Network tab → filter by "accounts" or "balance"
5. Check if requests return 200 OK with data

If you see errors, share the error messages and I'll debug further.

## Database Verification (backend)
Your data exists in the database:
- ✅ **2 accounts** (GL6414580000014587, GL8251090000051092)
- ✅ **12 transactions** (Freshto Ideal, Jennifer Houston, Liam Brown)
- ✅ **Current balance:** 1913.12 EUR per account
- ✅ **Total balance:** 3,826.24 EUR

The data is there — you just need to authenticate to see it.
