'use client'

import { useAppStore } from '@/lib/store'
import { useProfile } from '@/lib/queries'
import { t } from '@spending-dashboard/shared'
import { BalanceCard } from '@/components/dashboard/balance-card'
import { SpendingChart } from '@/components/dashboard/spending-chart'
import { MonthComparison } from '@/components/dashboard/month-comparison'
import { RecentTransactions } from '@/components/dashboard/recent-transactions'
import { InsightCard } from '@/components/dashboard/insight-card'
import { TransferSummary } from '@/components/dashboard/transfer-summary'

export default function DashboardPage() {
  const language = useAppStore((s) => s.language)
  const { data: profile } = useProfile()

  const name = profile?.display_name ?? profile?.email?.split('@')[0] ?? ''

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">
        {t('dashboard.welcome', language, { name })}
      </h1>

      <BalanceCard language={language} />
      <TransferSummary language={language} />
      <InsightCard language={language} />

      <div className="grid gap-6 md:grid-cols-2">
        <SpendingChart language={language} />
        <MonthComparison language={language} />
      </div>

      <RecentTransactions language={language} />
    </div>
  )
}
