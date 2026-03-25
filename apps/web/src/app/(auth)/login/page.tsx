'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Mail, Chrome } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

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

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
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

        {sent ? (
          <div className="rounded-lg bg-accent-primary/10 p-4 text-center text-sm text-accent-primary">
            ✉️ Skontroluj si email — poslali sme ti prihlasovací odkaz.
          </div>
        ) : (
          <>
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
                {loading ? 'Posielam...' : 'Prihlásiť sa emailom'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-bg-card px-2 text-text-secondary">alebo</span>
              </div>
            </div>

            <Button variant="secondary" className="w-full" onClick={handleGoogle}>
              <Chrome size={16} />
              Prihlásiť sa cez Google
            </Button>
          </>
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
