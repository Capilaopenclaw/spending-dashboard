import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleMagicLink() {
    if (!email) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
    setLoading(false)
    if (error) {
      Alert.alert('Chyba', error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f1117', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 8 }}>💰</Text>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#f0f0f5', textAlign: 'center', marginBottom: 4 }}>
        Spending Dashboard
      </Text>
      <Text style={{ fontSize: 14, color: '#8b8fa3', textAlign: 'center', marginBottom: 32 }}>
        Tvoje peniaze. Konečne pod kontrolou.
      </Text>

      {sent ? (
        <View style={{ backgroundColor: '#00d4aa20', borderRadius: 12, padding: 16 }}>
          <Text style={{ color: '#00d4aa', textAlign: 'center', fontSize: 14 }}>
            ✉️ Skontroluj si email — poslali sme ti prihlasovací odkaz.
          </Text>
        </View>
      ) : (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
            placeholderTextColor="#8b8fa3"
            keyboardType="email-address"
            autoCapitalize="none"
            style={{
              backgroundColor: '#242836',
              borderRadius: 12,
              padding: 14,
              color: '#f0f0f5',
              fontSize: 14,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#ffffff15',
            }}
          />
          <TouchableOpacity
            onPress={handleMagicLink}
            disabled={loading}
            style={{
              backgroundColor: '#00d4aa',
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#0f1117', fontWeight: '600', fontSize: 14 }}>
              {loading ? 'Posielam...' : 'Prihlásiť sa emailom'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}
