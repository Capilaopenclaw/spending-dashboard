import { useEffect, useState } from 'react'
import { createClient } from './supabase'
import type { Profile } from '@spending-dashboard/shared'

const supabase = createClient()

export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        setProfile(data as Profile | null)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  return { user, profile, loading, supabase }
}

export function useLanguage(): 'sk' | 'en' | 'hu' {
  const { profile } = useAuth()
  return profile?.language ?? 'sk'
}
