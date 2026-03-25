import { View, Text, ScrollView, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { t } from '@spending-dashboard/shared'
import type { Insight } from '@spending-dashboard/shared'

const SEVERITY_COLORS = {
  info: { bg: '#6366f115', text: '#6366f1' },
  warning: { bg: '#fbbf2415', text: '#fbbf24' },
  positive: { bg: '#4ade8015', text: '#4ade80' },
}

export default function InsightsScreen() {
  const { data: insights, isLoading } = useQuery({
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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0f1117' }} contentContainerStyle={{ padding: 16, paddingTop: 60 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#f0f0f5', marginBottom: 16 }}>
        {t('insights.title')}
      </Text>

      {isLoading ? (
        <ActivityIndicator color="#00d4aa" style={{ marginTop: 40 }} />
      ) : (insights ?? []).length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>👁️</Text>
          <Text style={{ color: '#8b8fa3', textAlign: 'center', fontSize: 14 }}>
            Zatiaľ žiadne prehľady.
          </Text>
        </View>
      ) : (
        (insights ?? []).map((insight) => {
          const colors = SEVERITY_COLORS[insight.severity] ?? SEVERITY_COLORS.info
          return (
            <View
              key={insight.id}
              style={{
                backgroundColor: colors.bg,
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.text + '30',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 }}>
                {insight.title_sk}
              </Text>
              <Text style={{ fontSize: 13, color: '#8b8fa3', lineHeight: 20 }}>
                {insight.message_sk}
              </Text>
            </View>
          )
        })
      )}
    </ScrollView>
  )
}
