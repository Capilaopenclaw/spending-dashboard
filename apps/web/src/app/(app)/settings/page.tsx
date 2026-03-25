'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { useProfile, useUpdateProfile, useBankConnections, useTransferPairs } from '@/lib/queries'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { t, getLanguageName, formatCurrency, formatDateShort } from '@spending-dashboard/shared'
import { ApiClient } from '@spending-dashboard/shared'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Building2, Unlink, Plus, Globe, ArrowLeftRight, Check, X, Link2, Trash2, Loader2, RefreshCcw } from 'lucide-react'

export default function SettingsPage() {
  const language = useAppStore((s) => s.language)
  const setLanguage = useAppStore((s) => s.setLanguage)
  const { data: profile, isLoading: profileLoading } = useProfile()
  const updateProfile = useUpdateProfile()
  const { data: connections, isLoading: connLoading } = useBankConnections()
  const { data: transferPairs } = useTransferPairs({ pendingOnly: true })
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [finalizing, setFinalizing] = useState(false)

  // Handle GoCardless callback
  useEffect(() => {
    const gcRef = searchParams.get('gc_ref')
    const gcStatus = searchParams.get('gc_status')
    
    if (gcRef && gcStatus === 'success') {
      const finalize = async () => {
        setFinalizing(true)
        try {
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) return

          const api = new ApiClient({
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
            supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            accessToken: session.access_token,
          })

          // Finalize connection (fetch accounts, etc.)
          await api.finalizeBankConnection(gcRef)
          
          // Trigger initial sync
          await api.syncAll()
          
          // Refresh UI
          queryClient.invalidateQueries({ queryKey: ['bank-connections'] })
          queryClient.invalidateQueries({ queryKey: ['accounts'] })
          queryClient.invalidateQueries({ queryKey: ['transactions'] })
          queryClient.invalidateQueries({ queryKey: ['balance-summary'] })
        } catch (err) {
          console.error('Finalization error:', err)
        } finally {
          setFinalizing(false)
          // Clear URL params without reload
          window.history.replaceState({}, '', window.location.pathname)
        }
      }
      finalize()
    }
  }, [searchParams, queryClient])

  async function handleConnectBank() {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const api = new ApiClient({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        accessToken: session.access_token,
      })

      const result = await api.connectBank(
        'SANDBOXFINANCE_SFIN0000',
        `${window.location.origin}/api/gc-callback`
      )
      window.location.href = result.auth_link
    } catch (err) {
      console.error('Connect bank error:', err)
    }
  }

  async function handleDisconnect(connectionId: string) {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const api = new ApiClient({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        accessToken: session.access_token,
      })
      await api.disconnectBank(connectionId)
      queryClient.invalidateQueries({ queryKey: ['bank-connections'] })
    } catch (err) {
      console.error('Disconnect error:', err)
    }
  }

  async function handleDeleteConnection(connectionId: string) {
    if (!confirm(t(language === 'sk' ? 'Naozaj chcete vymazať toto spojenie?' : 'Are you sure you want to delete this connection?', language))) return
    
    try {
      const supabase = createClient()
      const { error } = await supabase.from('bank_connections').delete().eq('id', connectionId)
      if (error) throw error
      
      queryClient.invalidateQueries({ queryKey: ['bank-connections'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    } catch (err) {
      console.error('Delete connection error:', err)
    }
  }

  async function handleSync(connectionId: string) {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const api = new ApiClient({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        accessToken: session.access_token,
      })
      await api.syncAll()
      queryClient.invalidateQueries()
    } catch (err) {
      console.error('Sync error:', err)
    }
  }

  async function handleTransferAction(pairId: string, action: 'confirm' | 'reject') {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const api = new ApiClient({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        accessToken: session.access_token,
      })

      if (action === 'confirm') {
        await api.confirmTransfer(pairId)
      } else {
        await api.rejectTransfer(pairId)
      }
      queryClient.invalidateQueries({ queryKey: ['transfer-pairs'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    } catch (err) {
      console.error('Transfer action error:', err)
    }
  }

  function handleLanguageChange(lang: 'sk' | 'en' | 'hu') {
    setLanguage(lang)
    updateProfile.mutate({ language: lang })
  }

  const statusBadge = (status: string) => {
    const map: Record<string, 'positive' | 'negative' | 'warning' | 'default'> = {
      linked: 'positive',
      expired: 'negative',
      error: 'negative',
      pending: 'warning',
      revoked: 'negative',
    }
    return map[status] ?? 'default'
  }

  return (
    <div className="space-y-6 max-w-2xl relative">
      {finalizing && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-bg-primary/80 backdrop-blur-sm rounded-xl">
          <Loader2 className="h-8 w-8 animate-spin text-accent-primary mb-4" />
          <p className="text-lg font-medium text-text-primary">
            {language === 'sk' ? 'Finalizujem prepojenie...' : 'Finalizing connection...'}
          </p>
          <p className="text-sm text-text-secondary">
            {language === 'sk' ? 'Sťahujem informácie o účtoch a transakcie.' : 'Fetching account details and transactions.'}
          </p>
        </div>
      )}

      <h1 className="text-2xl font-bold">{t('settings.title', language)}</h1>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe size={18} />
            {t('settings.language', language)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          {(['sk', 'en', 'hu'] as const).map((lang) => (
            <Button
              key={lang}
              variant={language === lang ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => handleLanguageChange(lang)}
            >
              {getLanguageName(lang)}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Bank Connections */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 size={18} />
            {t('settings.linkedBanks', language)}
          </CardTitle>
          <Button size="sm" onClick={handleConnectBank}>
            <Plus size={14} />
            {t('settings.addBank', language)}
          </Button>
        </CardHeader>
        <CardContent>
          {connLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (connections ?? []).length === 0 ? (
            <div className="text-center py-6 text-text-secondary text-sm">
              {language === 'sk' ? 'Žiadne prepojené banky.' : 'No linked banks.'}
            </div>
          ) : (
            <div className="space-y-3">
              {(connections ?? []).map((conn) => (
                <div key={conn.id} className="flex items-center gap-3 rounded-lg bg-bg-elevated p-3">
                  {conn.institution_logo_url ? (
                    <img src={conn.institution_logo_url} alt="" className="h-8 w-8 rounded" />
                  ) : (
                    <Building2 size={20} className="text-text-secondary" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{conn.institution_name}</div>
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <Badge variant={statusBadge(conn.status)}>{conn.status}</Badge>
                      {conn.last_synced_at && (
                        <span>{language === 'sk' ? 'Posledná sync' : 'Last sync'}: {formatDateShort(conn.last_synced_at)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSync(conn.id)}
                      title={language === 'sk' ? 'Synchronizovať' : 'Sync now'}
                    >
                      <RefreshCcw size={14} />
                    </Button>
                    {conn.status === 'linked' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect(conn.id)}
                        title={language === 'sk' ? 'Odpojiť' : 'Disconnect'}
                      >
                        <Unlink size={14} />
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteConnection(conn.id)}
                      title={language === 'sk' ? 'Vymazať' : 'Delete'}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight size={18} />
            {t('settings.transferManagement', language)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(transferPairs ?? []).length === 0 ? (
            <div className="text-center py-6 text-text-secondary text-sm">
              {language === 'sk' ? 'Žiadne nepotvrdené prevody.' : 'No pending transfers.'}
            </div>
          ) : (
            <div className="space-y-3">
              {(transferPairs ?? []).map((pair) => (
                <div key={pair.id} className="rounded-lg bg-bg-elevated p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">↔️</span>
                      <span className="tabular-nums text-sm font-medium">{formatCurrency(pair.amount)}</span>
                      <Badge variant="warning">{pair.net_validation_status}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTransferAction(pair.id, 'confirm')}
                        className="text-positive hover:text-positive"
                      >
                        <Check size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTransferAction(pair.id, 'reject')}
                        className="text-negative hover:text-negative"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-text-secondary">
                    {formatDateShort(pair.booking_date)} · {pair.detection_method} · {Math.round(pair.detection_confidence * 100)}%
                    {pair.net_difference !== 0 && ` · Δ ${formatCurrency(pair.net_difference)}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
