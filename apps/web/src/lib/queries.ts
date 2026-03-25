import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from './supabase'
import type {
  Account, Transaction, Category, Insight, BankConnection, TransferPair, ChatMessage, Profile,
} from '@spending-dashboard/shared'

// Use `any` typed client to avoid strict generic issues with custom Database type
const supabase: any = createClient()

// ---- Accounts ----
export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
      if (error) throw error
      return data as Account[]
    },
  })
}

export function useBalanceSummary() {
  return useQuery({
    queryKey: ['balance-summary'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_balance_summary')
      if (error) throw error
      return data as { total_balance: number; total_available: number; account_count: number }
    },
  })
}

// ---- Categories ----
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order')
      if (error) throw error
      return data as Category[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ---- Transactions ----
export function useTransactions(opts?: {
  accountId?: string
  categoryId?: string
  search?: string
  includeTransfers?: boolean
  limit?: number
  offset?: number
}) {
  const { accountId, categoryId, search, includeTransfers = true, limit = 50, offset = 0 } = opts ?? {}
  return useQuery({
    queryKey: ['transactions', { accountId, categoryId, search, includeTransfers, limit, offset }],
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1)

      if (accountId) q = q.eq('account_id', accountId)
      if (categoryId) q = q.eq('category_id', categoryId)
      if (!includeTransfers) q = q.eq('is_transfer', false)
      if (search) q = q.or(`merchant_name.ilike.%${search}%,original_description.ilike.%${search}%`)

      const { data, error } = await q
      if (error) throw error
      return data as Transaction[]
    },
  })
}

export function useRecentTransactions(limit: number = 10) {
  return useQuery({
    queryKey: ['recent-transactions', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as Transaction[]
    },
  })
}

// ---- Spending by Category ----
export function useSpendingByCategory(startDate?: string, endDate?: string) {
  const now = new Date()
  const start = startDate ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const end = endDate ?? now.toISOString().split('T')[0]

  return useQuery({
    queryKey: ['spending-by-category', start, end],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_spending_by_category', {
        p_start_date: start,
        p_end_date: end,
        p_include_transfers: false,
      })
      if (error) throw error
      return data as { category_id: string; category_name: string; icon: string; color: string; total: number }[]
    },
  })
}

// ---- Monthly Trend ----
export function useMonthlyTrend(months: number = 6) {
  return useQuery({
    queryKey: ['monthly-trend', months],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_monthly_trend', { p_months: months })
      if (error) throw error
      return data as { month: string; income: number; spending: number }[]
    },
  })
}

// ---- Insights ----
export function useInsights() {
  return useQuery({
    queryKey: ['insights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insights')
        .select('*')
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data as Insight[]
    },
  })
}

// ---- Bank Connections ----
export function useBankConnections() {
  return useQuery({
    queryKey: ['bank-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_connections')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as BankConnection[]
    },
  })
}

// ---- Transfer Pairs ----
export function useTransferPairs(opts?: { pendingOnly?: boolean }) {
  return useQuery({
    queryKey: ['transfer-pairs', opts],
    queryFn: async () => {
      let q = supabase
        .from('transfer_pairs')
        .select('*')
        .eq('is_user_rejected', false)
        .order('booking_date', { ascending: false })

      if (opts?.pendingOnly) {
        q = q.eq('is_user_confirmed', false).in('net_validation_status', ['probable', 'confirmed_zero', 'confirmed_rounding', 'confirmed_with_fee'])
      }

      const { data, error } = await q
      if (error) throw error
      return data as TransferPair[]
    },
  })
}

// ---- Chat Messages ----
export function useChatMessages() {
  return useQuery({
    queryKey: ['chat-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100)
      if (error) throw error
      return data as ChatMessage[]
    },
  })
}

// ---- Profile ----
export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (error) throw error
      return data as Profile
    },
  })
}

// ---- Mutations ----
export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('profiles')
        .update(updates as any)
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}

export function useDismissInsight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (insightId: string) => {
      const { error } = await supabase
        .from('insights')
        .update({ is_dismissed: true } as any)
        .eq('id', insightId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insights'] }),
  })
}

// ---- Transfer Spending (for dashboard info) ----
export function useTransferTotal() {
  return useQuery({
    queryKey: ['transfer-total'],
    queryFn: async () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('is_transfer', true)
        .lt('amount', 0)
        .gte('date', start)
      if (error) throw error
      const total = (data as any[] ?? []).reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0)
      return total
    },
  })
}
