import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { t, getLanguageName } from '@spending-dashboard/shared'
import type { BankConnection, Profile } from '@spending-dashboard/shared'

export default function SettingsScreen() {
  const queryClient = useQueryClient()

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      return data as Profile | null
    },
  })

  const { data: connections } = useQuery({
    queryKey: ['bank-connections'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bank_connections').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data as BankConnection[]
    },
  })

  async function handleLanguageChange(lang: 'sk' | 'en' | 'hu') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ language: lang }).eq('id', user.id)
    queryClient.invalidateQueries({ queryKey: ['profile'] })
  }

  async function handleSignOut() {
    Alert.alert('Odhlásiť sa', 'Naozaj sa chcete odhlásiť?', [
      { text: 'Zrušiť', style: 'cancel' },
      {
        text: 'Odhlásiť',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  const statusColors: Record<string, string> = {
    linked: '#4ade80',
    expired: '#f87171',
    error: '#f87171',
    pending: '#fbbf24',
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0f1117' }} contentContainerStyle={{ padding: 16, paddingTop: 60 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#f0f0f5', marginBottom: 20 }}>
        {t('settings.title')}
      </Text>

      {/* Language */}
      <View style={{ backgroundColor: '#1a1d27', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#ffffff08' }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#f0f0f5', marginBottom: 12 }}>
          {t('settings.language')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['sk', 'en', 'hu'] as const).map((lang) => (
            <TouchableOpacity
              key={lang}
              onPress={() => handleLanguageChange(lang)}
              style={{
                backgroundColor: profile?.language === lang ? '#00d4aa' : '#242836',
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: profile?.language === lang ? '#0f1117' : '#f0f0f5', fontSize: 13, fontWeight: '500' }}>
                {getLanguageName(lang)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bank Connections */}
      <View style={{ backgroundColor: '#1a1d27', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#ffffff08' }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#f0f0f5', marginBottom: 12 }}>
          {t('settings.linkedBanks')}
        </Text>
        {(connections ?? []).length === 0 ? (
          <Text style={{ color: '#8b8fa3', fontSize: 13 }}>Žiadne prepojené banky.</Text>
        ) : (
          (connections ?? []).map((conn) => (
            <View key={conn.id} style={{
              backgroundColor: '#242836',
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#f0f0f5', fontSize: 14, fontWeight: '500' }}>{conn.institution_name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColors[conn.status] ?? '#8b8fa3' }} />
                  <Text style={{ color: '#8b8fa3', fontSize: 11 }}>{conn.status}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        onPress={handleSignOut}
        style={{
          backgroundColor: '#f8717115',
          borderRadius: 12,
          padding: 14,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#f87171', fontWeight: '600', fontSize: 14 }}>Odhlásiť sa</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
