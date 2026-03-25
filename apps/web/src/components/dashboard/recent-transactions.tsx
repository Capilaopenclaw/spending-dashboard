'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRecentTransactions, useCategories } from '@/lib/queries'
import { formatCurrency, formatDateShort, getCategoryName } from '@spending-dashboard/shared'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function RecentTransactions({ language }: { language: 'sk' | 'en' | 'hu' }) {
  const { data: txns, isLoading } = useRecentTransactions(10)
  const { data: categories } = useCategories()

  const catMap = new Map((categories ?? []).map((c) => [c.id, c]))

  if (isLoading) {
    return (
      <Card>
        <Skeleton className="h-6 w-40 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          {language === 'sk' ? 'Posledné transakcie' : 'Recent Transactions'}
        </CardTitle>
        <Link href="/transactions" className="text-xs text-accent-primary hover:underline flex items-center gap-1">
          {language === 'sk' ? 'Všetky' : 'View all'} <ArrowRight size={12} />
        </Link>
      </CardHeader>
      <CardContent className="divide-y divide-white/5">
        {(txns ?? []).map((tx) => {
          const cat = tx.category_id ? catMap.get(tx.category_id) : null
          const isTransfer = tx.is_transfer
          return (
            <div
              key={tx.id}
              className={cn(
                'flex items-center gap-3 py-3',
                isTransfer && 'opacity-60'
              )}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm"
                style={{ backgroundColor: isTransfer ? '#94a3b820' : (cat?.color ?? '#6b7280') + '20' }}
              >
                {isTransfer ? '↔️' : cat?.icon ?? '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">
                  {tx.merchant_name ?? tx.cleaned_description ?? tx.original_description}
                </div>
                <div className="text-xs text-text-secondary">
                  {formatDateShort(tx.date)}
                  {cat && !isTransfer && (
                    <span
                      className="ml-2 inline-flex items-center rounded-pill px-1.5 py-0.5 text-[10px]"
                      style={{ backgroundColor: cat.color + '20', color: cat.color }}
                    >
                      {getCategoryName(cat, language)}
                    </span>
                  )}
                  {isTransfer && (
                    <span className="ml-2 text-text-secondary">{language === 'sk' ? 'Prevod' : 'Transfer'}</span>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  'tabular-nums text-sm font-medium',
                  tx.amount < 0 ? 'text-negative' : 'text-positive',
                  isTransfer && 'text-text-secondary'
                )}
              >
                {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
