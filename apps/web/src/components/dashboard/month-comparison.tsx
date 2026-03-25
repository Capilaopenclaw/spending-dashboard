'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMonthlyTrend } from '@/lib/queries'
import { formatCurrency, t } from '@spending-dashboard/shared'
import { TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

export function MonthComparison({ language }: { language: 'sk' | 'en' | 'hu' }) {
  const { data, isLoading } = useMonthlyTrend(6)

  if (isLoading) {
    return (
      <Card>
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-40 w-full" />
      </Card>
    )
  }

  const months = data ?? []
  const current = months[months.length - 1]
  const previous = months[months.length - 2]
  const diff = current && previous ? current.spending - previous.spending : 0
  const pct = previous?.spending ? Math.round((diff / previous.spending) * 100) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.thisMonth', language)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-text-secondary mb-1">{t('dashboard.spending', language)}</div>
            <div className="tabular-nums text-xl font-bold text-negative">
              {formatCurrency(current?.spending ?? 0)}
            </div>
            {pct !== 0 && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${pct > 0 ? 'text-negative' : 'text-positive'}`}>
                {pct > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(pct)}% vs {language === 'sk' ? 'minulý mesiac' : 'last month'}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-text-secondary mb-1">{t('dashboard.income', language)}</div>
            <div className="tabular-nums text-xl font-bold text-positive">
              {formatCurrency(current?.income ?? 0)}
            </div>
          </div>
        </div>

        {months.length > 1 && (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months}>
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#8b8fa3', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => {
                    const d = new Date(v + '-01')
                    return d.toLocaleDateString(language === 'sk' ? 'sk-SK' : 'en-US', { month: 'short' })
                  }}
                />
                <YAxis hide />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.length) return null
                    return (
                      <div className="rounded-lg bg-bg-elevated px-3 py-2 text-xs shadow-lg border border-white/10 space-y-1">
                        <div className="text-positive tabular-nums">+{formatCurrency(payload[0]?.value as number)}</div>
                        <div className="text-negative tabular-nums">-{formatCurrency(payload[1]?.value as number)}</div>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="income" fill="#4ade80" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spending" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
