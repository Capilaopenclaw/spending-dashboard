'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBalanceSummary } from '@/lib/queries'
import { formatCurrency, t } from '@spending-dashboard/shared'
import { Wallet } from 'lucide-react'

export function BalanceCard({ language }: { language: 'sk' | 'en' | 'hu' }) {
  const { data, isLoading } = useBalanceSummary()

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-10 w-48" />
      </Card>
    )
  }

  return (
    <Card className="col-span-full bg-gradient-to-br from-accent-primary/20 to-accent-secondary/10">
      <div className="flex items-center gap-3 text-text-secondary text-sm mb-1">
        <Wallet size={16} />
        {t('dashboard.totalBalance', language)}
        {data?.account_count && (
          <span className="text-xs">({data.account_count} {language === 'sk' ? 'účtov' : 'accounts'})</span>
        )}
      </div>
      <div className="tabular-nums text-4xl font-bold text-text-primary">
        {formatCurrency(data?.total_balance ?? 0)}
      </div>
      {data?.total_available != null && data.total_available !== data.total_balance && (
        <div className="tabular-nums text-sm text-text-secondary mt-1">
          {language === 'sk' ? 'Disponibilný' : 'Available'}: {formatCurrency(data.total_available)}
        </div>
      )}
    </Card>
  )
}
