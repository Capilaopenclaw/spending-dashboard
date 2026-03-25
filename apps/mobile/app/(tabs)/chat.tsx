import { View, Text, TextInput, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { t } from '@spending-dashboard/shared'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const msg = text.trim()
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setInput('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

      const res = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: msg, stream: false }),
      })

      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply ?? 'Prepáč, nastala chyba.' }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Prepáč, nastala chyba. Skús to znova.' }])
    } finally {
      setLoading(false)
    }
  }

  const suggestions = [t('chat.suggestion1'), t('chat.suggestion2'), t('chat.suggestion3')]

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0f1117' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <View style={{ flex: 1, paddingTop: 60 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#f0f0f5', paddingHorizontal: 16, marginBottom: 12 }}>
          {t('chat.title')}
        </Text>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>🤖</Text>
              <Text style={{ color: '#8b8fa3', textAlign: 'center', fontSize: 14, marginBottom: 20, maxWidth: 260 }}>
                Opýtaj sa ma čokoľvek o tvojich financiách.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => sendMessage(s)}
                    style={{ backgroundColor: '#242836', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
                  >
                    <Text style={{ color: '#f0f0f5', fontSize: 12 }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{
              flexDirection: 'row',
              justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 12,
            }}>
              <View style={{
                maxWidth: '80%',
                backgroundColor: item.role === 'user' ? '#00d4aa' : '#242836',
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}>
                <Text style={{
                  fontSize: 14,
                  color: item.role === 'user' ? '#0f1117' : '#f0f0f5',
                  lineHeight: 20,
                }}>
                  {item.content}
                </Text>
              </View>
            </View>
          )}
        />

        <View style={{
          flexDirection: 'row',
          padding: 12,
          paddingBottom: 24,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: '#ffffff08',
        }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('chat.placeholder')}
            placeholderTextColor="#8b8fa3"
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
            style={{
              flex: 1,
              backgroundColor: '#242836',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              color: '#f0f0f5',
              fontSize: 14,
              borderWidth: 1,
              borderColor: '#ffffff10',
            }}
          />
          <TouchableOpacity
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              backgroundColor: '#00d4aa',
              borderRadius: 20,
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: (!input.trim() || loading) ? 0.5 : 1,
            }}
          >
            <Text style={{ fontSize: 16 }}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
