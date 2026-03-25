'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Mail, Lock } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>('signin')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handlePasswordAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) {
        setError(error.message)
      } else {
        setSent(true)
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        window.location.href = '/dashboard'
      }
    }
    setLoading(false)
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
        <Card className="w-full max-w-md space-y-8 p-8">
          <div className="rounded-lg bg-accent-primary/10 p-4 text-center text-sm text-accent-primary">
            ✉️ Skontroluj si email — poslali sme ti {mode === 'magic' ? 'prihlasovací odkaz' : 'potvrdzovací odkaz'}.
          </div>
          <Button variant="secondary" onClick={() => setSent(false)} className="w-full">
            Späť
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <Card className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-accent-primary">💰</h1>
          <h2 className="mt-4 text-2xl font-bold text-text-primary">Spending Dashboard</h2>
          <p className="mt-2 text-text-secondary">
            Tvoje peniaze. Konečne pod kontrolou.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={mode === 'signin' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setMode('signin')}
            className="flex-1"
          >
            Prihlásenie
          </Button>
          <Button
            variant={mode === 'signup' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setMode('signup')}
            className="flex-1"
          >
            Registrácia
          </Button>
          <Button
            variant={mode === 'magic' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setMode('magic')}
            className="flex-1"
          >
            Magic Link
          </Button>
        </div>

        {mode === 'magic' ? (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              <Mail size={16} />
              {loading ? 'Posielam...' : 'Poslať magic link'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handlePasswordAuth} className="space-y-4">
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Heslo (min. 6 znakov)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              <Lock size={16} />
              {loading ? 'Načítavam...' : mode === 'signup' ? 'Zaregistrovať sa' : 'Prihlásiť sa'}
            </Button>
          </form>
        )}

        {error && (
          <div className="rounded-lg bg-negative/10 p-3 text-center text-sm text-negative">
            {error}
          </div>
        )}
      </Card>
    </div>
  )
}
