-- Initial schema for Spending Dashboard
-- Includes all tables with Row Level Security

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PROFILES TABLE (extends auth.users)
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  language TEXT NOT NULL DEFAULT 'sk' CHECK (language IN ('sk', 'en', 'hu')),
  currency TEXT NOT NULL DEFAULT 'EUR',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  notification_preferences JSONB NOT NULL DEFAULT '{"weekly_digest": true, "overspend_alerts": true, "subscription_alerts": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- BANK_CONNECTIONS TABLE (GoCardless requisitions)
-- ============================================

CREATE TABLE bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'gocardless',
  institution_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  institution_logo_url TEXT,
  requisition_id TEXT NOT NULL,
  agreement_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'linked', 'expired', 'error', 'revoked')),
  last_synced_at TIMESTAMPTZ,
  consent_expires_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_connections_user_id ON bank_connections(user_id);
CREATE INDEX idx_bank_connections_status ON bank_connections(status);

CREATE TRIGGER bank_connections_updated_at
  BEFORE UPDATE ON bank_connections
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- RLS for bank_connections
ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections"
  ON bank_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections"
  ON bank_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections"
  ON bank_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections"
  ON bank_connections FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- ACCOUNTS TABLE (bank accounts)
-- ============================================

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  external_account_id TEXT NOT NULL,
  iban TEXT,
  account_name TEXT,
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit_card', 'loan', 'other')),
  currency TEXT NOT NULL DEFAULT 'EUR',
  current_balance NUMERIC(15, 2),
  available_balance NUMERIC(15, 2),
  balance_updated_at TIMESTAMPTZ,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_bank_connection_id ON accounts(bank_connection_id);
CREATE INDEX idx_accounts_iban ON accounts(iban) WHERE iban IS NOT NULL;

CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- RLS for accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts"
  ON accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- CATEGORIES TABLE (system + user-defined)
-- ============================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_sk TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_hu TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_is_system ON categories(is_system);

-- RLS for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view system categories"
  ON categories FOR SELECT
  USING (is_system = true);

-- ============================================
-- TRANSACTIONS TABLE (CRITICAL: includes transfer fields)
-- ============================================

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  external_transaction_id TEXT NOT NULL,
  date DATE NOT NULL,
  value_date DATE,
  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  original_description TEXT NOT NULL,
  cleaned_description TEXT,
  merchant_name TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  category_confidence NUMERIC(3, 2) CHECK (category_confidence >= 0 AND category_confidence <= 1),
  is_category_user_corrected BOOLEAN NOT NULL DEFAULT false,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_group_id UUID,
  is_transfer BOOLEAN NOT NULL DEFAULT false,
  transfer_pair_id UUID,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('expense', 'income', 'transfer', 'refund', 'fee', 'other')),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Deduplication constraint: one transaction per account
  CONSTRAINT unique_account_transaction UNIQUE (account_id, external_transaction_id)
);

CREATE INDEX idx_transactions_user_id_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_user_id_category ON transactions(user_id, category_id);
CREATE INDEX idx_transactions_account_id_date ON transactions(account_id, date DESC);
CREATE INDEX idx_transactions_is_transfer ON transactions(is_transfer);
CREATE INDEX idx_transactions_transfer_pair_id ON transactions(transfer_pair_id) WHERE transfer_pair_id IS NOT NULL;

-- RLS for transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- TRANSFER_PAIRS TABLE (CRITICAL for accurate analytics)
-- ============================================

CREATE TABLE transfer_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  debit_transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  credit_transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  fee_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  net_validation_status TEXT NOT NULL CHECK (net_validation_status IN ('confirmed_zero', 'confirmed_rounding', 'confirmed_with_fee', 'probable', 'user_confirmed', 'mismatch')),
  net_difference NUMERIC(15, 2) NOT NULL DEFAULT 0,
  detection_method TEXT NOT NULL CHECK (detection_method IN ('iban_match', 'amount_date_match', 'keyword_match', 'ai_detected', 'user_manual')),
  detection_confidence NUMERIC(3, 2) NOT NULL CHECK (detection_confidence >= 0 AND detection_confidence <= 1),
  from_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  is_user_confirmed BOOLEAN NOT NULL DEFAULT false,
  is_user_rejected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure debit and credit are different transactions
  CONSTRAINT different_transactions CHECK (debit_transaction_id != credit_transaction_id),
  -- Ensure from and to accounts are different
  CONSTRAINT different_accounts CHECK (from_account_id != to_account_id)
);

CREATE INDEX idx_transfer_pairs_user_id ON transfer_pairs(user_id);
CREATE INDEX idx_transfer_pairs_debit_txn ON transfer_pairs(debit_transaction_id);
CREATE INDEX idx_transfer_pairs_credit_txn ON transfer_pairs(credit_transaction_id);
CREATE INDEX idx_transfer_pairs_booking_date ON transfer_pairs(booking_date);
CREATE INDEX idx_transfer_pairs_validation_status ON transfer_pairs(net_validation_status);

CREATE TRIGGER transfer_pairs_updated_at
  BEFORE UPDATE ON transfer_pairs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- RLS for transfer_pairs
ALTER TABLE transfer_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transfer pairs"
  ON transfer_pairs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transfer pairs"
  ON transfer_pairs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transfer pairs"
  ON transfer_pairs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transfer pairs"
  ON transfer_pairs FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- BUDGETS TABLE
-- ============================================

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('monthly', 'weekly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_category_id ON budgets(category_id);

CREATE TRIGGER budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- RLS for budgets
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own budgets"
  ON budgets FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- INSIGHTS TABLE (AI-generated insights)
-- ============================================

CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title_sk TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_hu TEXT NOT NULL,
  message_sk TEXT NOT NULL,
  message_en TEXT NOT NULL,
  message_hu TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'positive')),
  insight_type TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insights_user_id ON insights(user_id);
CREATE INDEX idx_insights_created_at ON insights(created_at DESC);
CREATE INDEX idx_insights_is_read ON insights(is_read);

-- RLS for insights
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own insights"
  ON insights FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- CHAT_MESSAGES TABLE (AI chat history)
-- ============================================

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- RLS for chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat messages"
  ON chat_messages FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- RECURRING_GROUPS TABLE (subscription detection)
-- ============================================

CREATE TABLE recurring_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  merchant_name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  average_amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  is_subscription BOOLEAN NOT NULL DEFAULT false,
  first_transaction_date DATE NOT NULL,
  last_transaction_date DATE NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recurring_groups_user_id ON recurring_groups(user_id);
CREATE INDEX idx_recurring_groups_merchant ON recurring_groups(merchant_name);

CREATE TRIGGER recurring_groups_updated_at
  BEFORE UPDATE ON recurring_groups
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- RLS for recurring_groups
ALTER TABLE recurring_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own recurring groups"
  ON recurring_groups FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- SYNC_LOGS TABLE (audit trail)
-- ============================================

CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_connection_id UUID REFERENCES bank_connections(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  transactions_added INTEGER NOT NULL DEFAULT 0,
  transactions_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_user_id ON sync_logs(user_id);
CREATE INDEX idx_sync_logs_created_at ON sync_logs(created_at DESC);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);

-- RLS for sync_logs
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs"
  ON sync_logs FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- DATABASE FUNCTIONS
-- ============================================

-- Get spending by category (EXCLUDES transfers by default)
CREATE OR REPLACE FUNCTION get_spending_by_category(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_include_transfers BOOLEAN DEFAULT false
)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  category_icon TEXT,
  category_color TEXT,
  total_amount NUMERIC,
  transaction_count BIGINT,
  percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH category_totals AS (
    SELECT
      t.category_id,
      SUM(ABS(t.amount)) AS total,
      COUNT(*) AS count
    FROM transactions t
    WHERE t.user_id = p_user_id
      AND t.date >= p_start_date
      AND t.date <= p_end_date
      AND t.amount < 0 -- expenses only
      AND (p_include_transfers OR t.is_transfer = false)
      AND t.category_id IS NOT NULL
    GROUP BY t.category_id
  ),
  total_spending AS (
    SELECT SUM(total) AS grand_total
    FROM category_totals
  )
  SELECT
    ct.category_id,
    c.name_sk AS category_name,
    c.icon AS category_icon,
    c.color AS category_color,
    ct.total AS total_amount,
    ct.count AS transaction_count,
    ROUND((ct.total / NULLIF(ts.grand_total, 0)) * 100, 2) AS percentage
  FROM category_totals ct
  JOIN categories c ON c.id = ct.category_id
  CROSS JOIN total_spending ts
  ORDER BY ct.total DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get monthly trend (EXCLUDES transfers)
CREATE OR REPLACE FUNCTION get_monthly_trend(
  p_user_id UUID,
  p_months INTEGER DEFAULT 6
)
RETURNS TABLE (
  month TEXT,
  total_income NUMERIC,
  total_expenses NUMERIC,
  net NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH months AS (
    SELECT
      DATE_TRUNC('month', generate_series(
        NOW() - (p_months || ' months')::INTERVAL,
        NOW(),
        '1 month'
      ))::DATE AS month_start
  )
  SELECT
    TO_CHAR(m.month_start, 'YYYY-MM') AS month,
    COALESCE(SUM(CASE WHEN t.amount > 0 AND t.is_transfer = false THEN t.amount ELSE 0 END), 0) AS total_income,
    COALESCE(SUM(CASE WHEN t.amount < 0 AND t.is_transfer = false THEN ABS(t.amount) ELSE 0 END), 0) AS total_expenses,
    COALESCE(SUM(CASE WHEN t.is_transfer = false THEN t.amount ELSE 0 END), 0) AS net
  FROM months m
  LEFT JOIN transactions t ON
    t.user_id = p_user_id
    AND t.date >= m.month_start
    AND t.date < m.month_start + INTERVAL '1 month'
  GROUP BY m.month_start
  ORDER BY m.month_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get balance summary across all accounts
CREATE OR REPLACE FUNCTION get_balance_summary(p_user_id UUID)
RETURNS TABLE (
  total_balance NUMERIC,
  total_available NUMERIC,
  account_id UUID,
  account_name TEXT,
  account_type TEXT,
  current_balance NUMERIC,
  available_balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH account_balances AS (
    SELECT
      a.id AS account_id,
      COALESCE(a.account_name, 'Unnamed Account') AS account_name,
      a.account_type,
      COALESCE(a.current_balance, 0) AS current_balance,
      COALESCE(a.available_balance, 0) AS available_balance
    FROM accounts a
    WHERE a.user_id = p_user_id
      AND a.is_active = true
  ),
  totals AS (
    SELECT
      SUM(current_balance) AS total_balance,
      SUM(available_balance) AS total_available
    FROM account_balances
  )
  SELECT
    t.total_balance,
    t.total_available,
    ab.account_id,
    ab.account_name,
    ab.account_type,
    ab.current_balance,
    ab.available_balance
  FROM account_balances ab
  CROSS JOIN totals t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE transfer_pairs IS 'Inter-account transfer matching — CRITICAL for accurate spending analytics';
COMMENT ON COLUMN transactions.is_transfer IS 'MUST be false in all spending queries to avoid inflated numbers';
COMMENT ON FUNCTION get_spending_by_category IS 'Excludes transfers by default — set p_include_transfers=true to include';
COMMENT ON FUNCTION get_monthly_trend IS 'Excludes transfers automatically';
