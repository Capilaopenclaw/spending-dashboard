'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useTransactions, useCategories, useAccounts } from '@/lib/queries'
import { formatCurrency, formatDate, getCategoryName, t } from '@spending-dashboard/shared'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Search, Filter, X } from 'lucide-react'

export default function TransactionsPage() {
  const language = useAppStore((s) => s.language)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const [accountFilter, setAccountFilter] = useState<string | undefined>()
  const [showTransfers, setShowTransfers] = useState(true)
  const [offset, setOffset] = useState(0)

  const { data: txns, isLoading } = useTransactions({
    search: search || undefined,
    categoryId: categoryFilter,
    accountId: accountFilter,
    includeTransfers: showTransfers,
    limit: 50,
    offset,
  })
  const { data: categories } = useCategories()
  const { data: accounts } = useAccounts()

  const catMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, typeof txns> = {}
    for (const tx of txns ?? []) {
      const key = tx.date
      if (!groups[key]) groups[key] = []
      groups[key]!.push(tx)
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [txns])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('transactions.title', language)}</h1>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <Input
            placeholder={t('transactions.search', language)}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0) }}
            className="pl-9"
          />
        </div>

        <select
          value={categoryFilter ?? ''}
          onChange={(e) => { setCategoryFilter(e.target.value || undefined); setOffset(0) }}
          className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm text-text-primary"
        >
          <option value="">{t('transactions.allCategories', language)}</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {getCategoryName(c, language)}</option>
          ))}
        </select>

        <select
          value={accountFilter ?? ''}
          onChange={(e) => { setAccountFilter(e.target.value || undefined); setOffset(0) }}
          className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm text-text-primary"
        >
          <option value="">{t('transactions.allAccounts', language)}</option>
          {(accounts ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.account_name ?? a.iban ?? a.id.slice(0, 8)}</option>
          ))}
        </select>

        <Button
          variant={showTransfers ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => { setShowTransfers(!showTransfers); setOffset(0) }}
        >
          ↔️ {language === 'sk' ? 'Prevody' : 'Transfers'}
          {!showTransfers && <X size={12} />}
        </Button>
      </div>

      {/* Transaction List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <Card className="py-12 text-center text-text-secondary">
          {language === 'sk' ? 'Žiadne transakcie' : 'No transactions found'}
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, dateTxns]) => (
            <div key={date}>
              <div className="sticky top-0 z-10 bg-bg-primary/90 backdrop-blur-sm pb-2 text-sm font-medium text-text-secondary">
                {formatDate(date, language === 'sk' ? 'sk-SK' : language === 'hu' ? 'hu-HU' : 'en-US')}
              </div>
              <Card className="divide-y divide-white/5 p-0">
                {(dateTxns ?? []).map((tx) => {
                  const cat = tx.category_id ? catMap.get(tx.category_id) : null
                  const isTransfer = tx.is_transfer
                  return (
                    <div
                      key={tx.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated/50 transition-colors cursor-pointer',
                        isTransfer && 'opacity-60'
                      )}
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full text-base flex-shrink-0"
                        style={{ backgroundColor: isTransfer ? '#94a3b815' : (cat?.color ?? '#6b7280') + '15' }}
                      >
                        {isTransfer ? '↔️' : cat?.icon ?? '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text-primary truncate">
                          {tx.merchant_name ?? tx.cleaned_description ?? tx.original_description}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          {isTransfer ? (
                            <span className="text-text-secondary">{language === 'sk' ? 'Prevod medzi účtami' : 'Account transfer'}</span>
                          ) : cat ? (
                            <span
                              className="inline-flex items-center rounded-pill px-1.5 py-0.5"
                              style={{ backgroundColor: cat.color + '15', color: cat.color }}
                            >
                              {getCategoryName(cat, language)}
                            </span>
                          ) : null}
                          {tx.is_recurring && <span className="text-accent-secondary">🔄</span>}
                        </div>
                      </div>
                      <div
                        className={cn(
                          'tabular-nums text-sm font-semibold flex-shrink-0',
                          isTransfer ? 'text-text-secondary' : tx.amount < 0 ? 'text-negative' : 'text-positive'
                        )}
                      >
                        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                      </div>
                    </div>
                  )
                })}
              </Card>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex justify-center gap-2">
            {offset > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setOffset(Math.max(0, offset - 50))}>
                ← {language === 'sk' ? 'Predchádzajúce' : 'Previous'}
              </Button>
            )}
            {(txns?.length ?? 0) === 50 && (
              <Button variant="secondary" size="sm" onClick={() => setOffset(offset + 50)}>
                {language === 'sk' ? 'Ďalšie' : 'Next'} →
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
