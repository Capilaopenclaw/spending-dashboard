import { View, Text, FlatList, TextInput, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDateShort, t } from '@spending-dashboard/shared'
import type { Transaction } from '@spending-dashboard/shared'

export default function TransactionsScreen() {
  const [search, setSearch] = useState('')

  const { data: txns, isLoading } = useQuery({
    queryKey: ['transactions', search],
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(100)

      if (search) {
        q = q.or(`merchant_name.ilike.%${search}%,original_description.ilike.%${search}%`)
      }

      const { data, error } = await q
      if (error) throw error
      return data as Transaction[]
    },
  })

  return (
    <View style={{ flex: 1, backgroundColor: '#0f1117', paddingTop: 60 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#f0f0f5', paddingHorizontal: 16, marginBottom: 12 }}>
        {t('transactions.title')}
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t('transactions.search')}
        placeholderTextColor="#8b8fa3"
        style={{
          backgroundColor: '#242836',
          borderRadius: 12,
          padding: 12,
          color: '#f0f0f5',
          fontSize: 14,
          marginHorizontal: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: '#ffffff10',
        }}
      />

      {isLoading ? (
        <ActivityIndicator color="#00d4aa" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={txns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item: tx }) => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: 1,
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
                  {formatDateShort(tx.date)} {tx.is_transfer && '· Prevod'}
                </Text>
              </View>
              <Text style={{
                fontSize: 14, fontWeight: '600', fontFamily: 'monospace',
                color: tx.is_transfer ? '#8b8fa3' : tx.amount < 0 ? '#f87171' : '#4ade80',
              }}>
                {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  )
}
