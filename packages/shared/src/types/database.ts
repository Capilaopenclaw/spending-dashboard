// Database types for Supabase

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      bank_connections: {
        Row: BankConnection
        Insert: Omit<BankConnection, 'created_at' | 'updated_at'>
        Update: Partial<Omit<BankConnection, 'id' | 'created_at'>>
      }
      accounts: {
        Row: Account
        Insert: Omit<Account, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Account, 'id' | 'created_at'>>
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'created_at'>
        Update: Partial<Omit<Transaction, 'id' | 'created_at'>>
      }
      transfer_pairs: {
        Row: TransferPair
        Insert: Omit<TransferPair, 'created_at' | 'updated_at'>
        Update: Partial<Omit<TransferPair, 'id' | 'created_at'>>
      }
      categories: {
        Row: Category
        Insert: Omit<Category, 'created_at'>
        Update: Partial<Omit<Category, 'id' | 'created_at'>>
      }
      budgets: {
        Row: Budget
        Insert: Omit<Budget, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Budget, 'id' | 'created_at'>>
      }
      insights: {
        Row: Insight
        Insert: Omit<Insight, 'created_at'>
        Update: Partial<Omit<Insight, 'id' | 'created_at'>>
      }
      chat_messages: {
        Row: ChatMessage
        Insert: Omit<ChatMessage, 'created_at'>
        Update: Partial<Omit<ChatMessage, 'id' | 'created_at'>>
      }
      recurring_groups: {
        Row: RecurringGroup
        Insert: Omit<RecurringGroup, 'created_at' | 'updated_at'>
        Update: Partial<Omit<RecurringGroup, 'id' | 'created_at'>>
      }
      sync_logs: {
        Row: SyncLog
        Insert: Omit<SyncLog, 'created_at'>
        Update: Partial<Omit<SyncLog, 'id' | 'created_at'>>
      }
    }
  }
}

export interface Profile {
  id: string
  display_name: string | null
  email: string | null
  language: 'sk' | 'en' | 'hu'
  currency: string
  onboarding_completed: boolean
  notification_preferences: NotificationPreferences
  created_at: string
  updated_at: string
}

export interface NotificationPreferences {
  weekly_digest: boolean
  overspend_alerts: boolean
  subscription_alerts: boolean
}

export type BankConnectionStatus = 'pending' | 'linked' | 'expired' | 'error' | 'revoked'

export interface BankConnection {
  id: string
  user_id: string
  provider: string
  institution_id: string
  institution_name: string
  institution_logo_url: string | null
  requisition_id: string
  agreement_id: string | null
  status: BankConnectionStatus
  last_synced_at: string | null
  consent_expires_at: string | null
  metadata: Json | null
  created_at: string
  updated_at: string
}

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'loan' | 'other'

export interface Account {
  id: string
  user_id: string
  bank_connection_id: string
  external_account_id: string
  iban: string | null
  account_name: string | null
  account_type: AccountType
  currency: string
  current_balance: number | null
  available_balance: number | null
  balance_updated_at: string | null
  is_primary: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export type TransactionType = 'expense' | 'income' | 'transfer' | 'refund' | 'fee' | 'other'

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  external_transaction_id: string
  date: string
  value_date: string | null
  amount: number
  currency: string
  original_description: string
  cleaned_description: string | null
  merchant_name: string | null
  category_id: string | null
  category_confidence: number | null
  is_category_user_corrected: boolean
  is_recurring: boolean
  recurring_group_id: string | null
  is_transfer: boolean
  transfer_pair_id: string | null
  transaction_type: TransactionType
  tags: string[]
  notes: string | null
  metadata: Json | null
  created_at: string
}

export type NetValidationStatus = 
  | 'confirmed_zero' 
  | 'confirmed_rounding' 
  | 'confirmed_with_fee' 
  | 'probable' 
  | 'user_confirmed' 
  | 'mismatch'

export type DetectionMethod = 
  | 'iban_match' 
  | 'amount_date_match' 
  | 'keyword_match' 
  | 'ai_detected' 
  | 'user_manual'

export interface TransferPair {
  id: string
  user_id: string
  debit_transaction_id: string
  credit_transaction_id: string
  amount: number
  currency: string
  fee_amount: number
  net_validation_status: NetValidationStatus
  net_difference: number
  detection_method: DetectionMethod
  detection_confidence: number
  from_account_id: string
  to_account_id: string
  booking_date: string
  is_user_confirmed: boolean
  is_user_rejected: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name_sk: string
  name_en: string
  name_hu: string
  slug: string
  icon: string
  color: string
  parent_category_id: string | null
  sort_order: number
  is_system: boolean
  created_at: string
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  amount: number
  period: 'monthly' | 'weekly' | 'yearly'
  start_date: string
  end_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type InsightSeverity = 'info' | 'warning' | 'positive'

export interface Insight {
  id: string
  user_id: string
  title_sk: string
  title_en: string
  title_hu: string
  message_sk: string
  message_en: string
  message_hu: string
  severity: InsightSeverity
  insight_type: string
  metadata: Json | null
  is_read: boolean
  is_dismissed: boolean
  created_at: string
}

export interface ChatMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  metadata: Json | null
  created_at: string
}

export interface RecurringGroup {
  id: string
  user_id: string
  merchant_name: string
  category_id: string | null
  frequency: 'weekly' | 'monthly' | 'yearly'
  average_amount: number
  currency: string
  is_subscription: boolean
  first_transaction_date: string
  last_transaction_date: string
  transaction_count: number
  created_at: string
  updated_at: string
}

export type SyncLogStatus = 'success' | 'error' | 'partial'

export interface SyncLog {
  id: string
  user_id: string
  bank_connection_id: string | null
  account_id: string | null
  sync_type: string
  status: SyncLogStatus
  transactions_added: number
  transactions_updated: number
  error_message: string | null
  metadata: Json | null
  created_at: string
}
