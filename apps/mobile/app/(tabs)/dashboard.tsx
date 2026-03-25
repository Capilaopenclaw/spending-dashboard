import { View, Text, ScrollView, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatCurrency, t } from '@spending-dashboard/shared'
import type { Account, Transaction } from '@spending-dashboard/shared'

export default function DashboardScreen() {
  const { data: accounts, isLoading: accLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('*').eq('is_active', true)
      if (error) throw error
      return data as Account[]
    },
  })

  const { data: recentTxns, isLoading: txnLoading } = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(10)
      if (error) throw error
      return data as Transaction[]
    },
  })

  const totalBalance = (accounts ?? []).reduce((sum, a) => sum + (a.current_balance ?? 0), 0)
  const loading = accLoading || txnLoading

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0f1117' }} contentContainerStyle={{ padding: 16, paddingTop: 60 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#f0f0f5', marginBottom: 20 }}>
        {t('dashboard.welcome', 'sk', { name: '' })}
      </Text>

      {/* Balance Card */}
      <View style={{ backgroundColor: '#1a1d27', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#ffffff08' }}>
        <Text style={{ fontSize: 12, color: '#8b8fa3', marginBottom: 4 }}>{t('dashboard.totalBalance')}</Text>
        {loading ? (
          <ActivityIndicator color="#00d4aa" />
        ) : (
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#f0f0f5', fontFamily: 'monospace' }}>
            {formatCurrency(totalBalance)}
          </Text>
        )}
      </View>

      {/* Recent Transactions */}
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#f0f0f5', marginBottom: 12 }}>
        {t('dashboard.recentTransactions')}
      </Text>
      <View style={{ backgroundColor: '#1a1d27', borderRadius: 16, borderWidth: 1, borderColor: '#ffffff08' }}>
        {loading ? (
          <ActivityIndicator color="#00d4aa" style={{ padding: 20 }} />
        ) : (
          (recentTxns ?? []).map((tx, i) => (
            <View
              key={tx.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                borderBottomWidth: i < (recentTxns?.length ?? 0) - 1 ? 1 : 0,
                borderBottomColor: '#ffffff08',
                opacity: tx.is_transfer ? 0.6 : 1,
              }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: tx.is_transfer ? '#94a3b815' : '#6b728015',
                alignItems: 'center', justifyContent: 'center', marginRight: 12,
              }}>
                <Text style={{ fontSize: 16 }}>{tx.is_transfer ? '↔️' : '📦'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#f0f0f5' }} numberOfLines={1}>
                  {tx.merchant_name ?? tx.cleaned_description ?? tx.original_description}
                </Text>
                <Text style={{ fontSize: 11, color: '#8b8fa3', marginTop: 2 }}>
                  {tx.is_transfer ? 'Prevod' : tx.date}
                </Text>
              </View>
              <Text style={{
                fontSize: 14, fontWeight: '600', fontFamily: 'monospace',
                color: tx.is_transfer ? '#8b8fa3' : tx.amount < 0 ? '#f87171' : '#4ade80',
              }}>
                {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}
