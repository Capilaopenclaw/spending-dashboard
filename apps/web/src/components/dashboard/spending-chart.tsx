'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSpendingByCategory } from '@/lib/queries'
import { formatCurrency, t, getCategoryName } from '@spending-dashboard/shared'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

export function SpendingChart({ language }: { language: 'sk' | 'en' | 'hu' }) {
  const { data, isLoading } = useSpendingByCategory()

  if (isLoading) {
    return (
      <Card>
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </Card>
    )
  }

  const chartData = (data ?? [])
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  const total = chartData.reduce((sum, d) => sum + d.total, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.spendingByCategory', language)}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-center text-text-secondary py-8 text-sm">
            {language === 'sk' ? 'Žiadne výdavky tento mesiac' : 'No spending this month'}
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <div className="w-40 h-40 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={65}
                    dataKey="total"
                    stroke="none"
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="rounded-lg bg-bg-elevated px-3 py-2 text-xs shadow-lg border border-white/10">
                          <span>{d.icon} {d.category_name}</span>
                          <div className="tabular-nums font-medium">{formatCurrency(d.total)}</div>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {chartData.map((d) => (
                <div key={d.category_id} className="flex items-center gap-2 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-text-secondary flex-1 truncate">{d.icon} {d.category_name}</span>
                  <span className="tabular-nums text-text-primary font-medium">{formatCurrency(d.total)}</span>
                  <span className="tabular-nums text-text-secondary text-xs w-10 text-right">
                    {total > 0 ? Math.round((d.total / total) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
